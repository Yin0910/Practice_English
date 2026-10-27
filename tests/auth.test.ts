import { describe, expect, it } from 'vitest';
import {
  authenticate, createSession, destroySession, hashPassword, tokenFromRequest, upsertUser, userFromToken, verifyPassword,
} from '@/server/auth';
import { loginBlocked, loginFailed, loginSucceeded, resetRateLimits } from '@/server/rate-limit';
import { addAttempt, getExamDate, getVocab, listAttempts, saveVocab, setExamDate } from '@/server/progress-repo';
import { open } from './helpers';

// Mật khẩu dưới đây chỉ để thử, không phải mật khẩu thật của ai.
const PW = 'correct-horse-battery';

describe('password hashing', () => {
  it('verifies the right password only, and never stores it in clear', async () => {
    const hash = await hashPassword(PW);
    expect(hash.startsWith('scrypt$')).toBe(true);
    expect(hash).not.toContain(PW);
    expect(await verifyPassword(PW, hash)).toBe(true);
    expect(await verifyPassword('wrong-password-1', hash)).toBe(false);
    expect(await verifyPassword(PW, 'garbage')).toBe(false);
  });

  it('uses a different salt every time', async () => {
    expect(await hashPassword(PW)).not.toBe(await hashPassword(PW));
  });
});

describe('required accounts', () => {
  it('accepts the two usernames the project must have', async () => {
    const db = await open('sqlite');
    expect(await upsertUser(db, 'zitconlonton', PW)).toBe('created');
    expect(await upsertUser(db, 'yinhocielts', PW)).toBe('created');
    expect((await db.all('SELECT username FROM users ORDER BY username')).map((r) => (r as { username: string }).username))
      .toEqual(['yinhocielts', 'zitconlonton']);
  });
});

describe('cookie parsing', () => {
  const req = (cookie?: string) => new Request('http://x/api', cookie ? { headers: { cookie } } : {});
  it('finds the session cookie among others', () => {
    expect(tokenFromRequest(req('a=1; pe_session=abc123; b=2'))).toBe('abc123');
    expect(tokenFromRequest(req('a=1'))).toBeNull();
    expect(tokenFromRequest(req())).toBeNull();
    expect(tokenFromRequest(req('xpe_session=nope'))).toBeNull();
  });
});

describe('login throttling', () => {
  it('blocks after repeated failures and forgives after a success', () => {
    resetRateLimits();
    for (let i = 0; i < 10; i++) {
      expect(loginBlocked('1.2.3.4', 'alice', i).blocked).toBe(false);
      loginFailed('1.2.3.4', 'alice', i);
    }
    expect(loginBlocked('1.2.3.4', 'alice', 11)).toMatchObject({ blocked: true });
    expect(loginBlocked('9.9.9.9', 'bob', 11).blocked).toBe(false); // người khác không bị liên luỵ
    loginSucceeded('1.2.3.4', 'alice');
    expect(loginBlocked('1.2.3.4', 'alice', 12).blocked).toBe(false);
    resetRateLimits();
  });
});

describe.each(['sqlite', 'postgres'] as const)('accounts and study history (%s)', (dialect) => {
  it('creates an account, normalises the name, and updates the password instead of duplicating', async () => {
    const db = await open(dialect);
    expect(await upsertUser(db, 'Alice.Test', PW)).toBe('created');
    expect(await authenticate(db, 'alice.test', PW)).toMatchObject({ username: 'alice.test' });
    expect(await authenticate(db, '  ALICE.TEST ', PW)).not.toBeNull();
    expect(await upsertUser(db, 'alice.test', 'another-password-9')).toBe('updated');
    expect(await authenticate(db, 'alice.test', PW)).toBeNull();
    expect(await authenticate(db, 'alice.test', 'another-password-9')).not.toBeNull();
    expect((await db.get<{ n: number }>('SELECT CAST(COUNT(*) AS INTEGER) AS n FROM users'))!.n).toBe(1);
  });

  it('stores only a hash in the database', async () => {
    const db = await open(dialect);
    await upsertUser(db, 'alice', PW);
    const row = (await db.get<{ password_hash: string }>('SELECT password_hash FROM users'))!;
    expect(row.password_hash).not.toContain(PW);
  });

  it('rejects bad names and short passwords', async () => {
    const db = await open(dialect);
    await expect(upsertUser(db, 'ab', PW)).rejects.toThrow('Tên đăng nhập');
    await expect(upsertUser(db, 'has space', PW)).rejects.toThrow('Tên đăng nhập');
    await expect(upsertUser(db, 'alice', 'short')).rejects.toThrow('Mật khẩu');
  });

  it('fails for unknown users and wrong passwords alike', async () => {
    const db = await open(dialect);
    await upsertUser(db, 'alice', PW);
    expect(await authenticate(db, 'alice', 'nope-nope-nope')).toBeNull();
    expect(await authenticate(db, 'nobody', PW)).toBeNull();
  });

  it('opens a session, expires it, and ends it on logout', async () => {
    const db = await open(dialect);
    await upsertUser(db, 'alice', PW);
    const user = (await authenticate(db, 'alice', PW))!;
    const now = new Date('2026-10-27T08:00:00Z');
    const { token } = await createSession(db, user.id, now);
    expect(await userFromToken(db, token, now)).toMatchObject({ username: 'alice' });
    expect(await userFromToken(db, 'not-a-token', now)).toBeNull();
    expect(await userFromToken(db, token, new Date('2026-12-01T00:00:00Z'))).toBeNull(); // quá 30 ngày
    await destroySession(db, token);
    expect(await userFromToken(db, token, now)).toBeNull();
    // Cơ sở dữ liệu chỉ giữ bản băm của mã phiên.
    const { token: t2 } = await createSession(db, user.id, now);
    const stored = (await db.get<{ token_hash: string }>('SELECT token_hash FROM auth_sessions'))!;
    expect(stored.token_hash).not.toBe(t2);
  });

  it('ends existing sessions when the password is reset', async () => {
    const db = await open(dialect);
    await upsertUser(db, 'alice', PW);
    const user = (await authenticate(db, 'alice', PW))!;
    const { token } = await createSession(db, user.id);
    await upsertUser(db, 'alice', 'brand-new-password-1');
    expect(await userFromToken(db, token)).toBeNull();
  });

  it('keeps each person’s history, vocabulary and exam date private', async () => {
    const db = await open(dialect);
    await upsertUser(db, 'alice', PW);
    await upsertUser(db, 'bob', PW);
    const a = (await authenticate(db, 'alice', PW))!;
    const b = (await authenticate(db, 'bob', PW))!;

    await addAttempt(db, a.id, { skill: 'reading', examId: 'vertical-farming', band: 7, note: 'A1' }, new Date('2026-10-01T10:00:00Z'));
    await addAttempt(db, a.id, { skill: 'writing', note: 'A2' }, new Date('2026-10-02T10:00:00Z'));
    await addAttempt(db, b.id, { skill: 'speaking', band: 6.5, note: 'B1' }, new Date('2026-10-03T10:00:00Z'));

    const mine = await listAttempts(db, a.id);
    expect(mine.map((x) => x.note)).toEqual(['A2', 'A1']); // mới nhất trước
    expect(mine[1]).toMatchObject({ skill: 'reading', examId: 'vertical-farming', band: 7 });
    expect(mine[0]!.band).toBeUndefined();
    expect(mine[0]!.examId).toBeUndefined();
    expect((await listAttempts(db, b.id)).map((x) => x.note)).toEqual(['B1']);

    await saveVocab(db, a.id, { 'mitigate-1': { box: 2, due: '2026-10-29', seen: 1 }, 'deplete-1': { box: 1, due: '2026-10-28', seen: 1 } });
    await saveVocab(db, a.id, { 'mitigate-1': { box: 3, due: '2026-11-01', seen: 2 } });
    expect(await getVocab(db, a.id)).toEqual({
      'mitigate-1': { box: 3, due: '2026-11-01', seen: 2 },
      'deplete-1': { box: 1, due: '2026-10-28', seen: 1 },
    });
    expect(await getVocab(db, b.id)).toEqual({});

    expect(await getExamDate(db, a.id)).toBe('');
    await setExamDate(db, a.id, '2027-03-15');
    await setExamDate(db, a.id, '2027-04-01');
    expect(await getExamDate(db, a.id)).toBe('2027-04-01');
    expect(await getExamDate(db, b.id)).toBe('');
  });
});
