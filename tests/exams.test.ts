import { describe, expect, it } from 'vitest';
import { postgresDb, type Db } from '@/server/db';
import { examInput, parseExams } from '@/server/exam-schema';
import { answerKey, deleteExam, examStats, getExam, gradeExam, listExams, upsertExam } from '@/server/exams-repo';
import { checkAiQuota, hit, resetRateLimits } from '@/server/rate-limit';
import { seedFromDir } from '@/server/seed';
import { SEED_DIR, open } from './helpers';

const reading = (over: Record<string, unknown> = {}) => ({
  id: 'sample-reading', skill: 'reading', title: 'Sample', kind: 'Passage', topic: 'Health', level: 'Band 7', minutes: 20,
  body: { paragraphs: [{ label: 'A', text: 'Text.' }] },
  questions: [
    { id: 'q1', type: 'tfng', text: 'Claim?', answer: 'True', explanation: 'Because.' },
    { id: 'q2', type: 'mcq', text: 'Pick', options: ['a', 'b', 'c'], answer: 2, explanation: '' },
    { id: 'q3', type: 'gap', text: 'Fill ___', answer: ['word', 'term'], explanation: '' },
  ],
  ...over,
});
const put = (db: Db, ...exams: Record<string, unknown>[]) =>
  db.tx(async (t) => { for (const e of exams) await upsertExam(t, examInput.parse(e)); });

describe.each(['sqlite', 'postgres'] as const)('exam database (%s)', (dialect) => {
  describe('seed data', () => {
    it('loads every seed file without a single validation error', async () => {
      const db = await open(dialect);
      const r = await seedFromDir(db, SEED_DIR);
      expect(r.errors).toEqual([]);
      expect(r.exams).toBeGreaterThan(0);
      expect((await examStats(db)).total).toBe(r.exams);
    });

    it('has a valid answer for every question and unique ids across all exams', async () => {
      const db = await open(dialect, true);
      const all = (await listExams(db, { limit: 200 })).items;
      expect(new Set(all.map((e) => e.id)).size).toBe(all.length);
      for (const e of all.filter((x) => x.skill === 'reading' || x.skill === 'listening')) {
        const key = await answerKey(db, e.id);
        expect(key.length, e.id).toBe(e.questionCount);
        for (const q of key) if (q.type === 'mcq') expect(q.options[q.answer], `${e.id}/${q.id}`).toBeDefined();
      }
    });

    it('has a script or passage long enough to be a real exam', async () => {
      const db = await open(dialect, true);
      for (const e of (await listExams(db, { skill: 'reading', limit: 200 })).items) {
        const body = (await getExam(db, e.id))!.body as { paragraphs: { text: string }[] };
        expect(body.paragraphs.map((p) => p.text).join(' ').split(/\s+/).length, e.id).toBeGreaterThan(250);
      }
      for (const e of (await listExams(db, { skill: 'listening', limit: 200 })).items) {
        const body = (await getExam(db, e.id))!.body as { script: string };
        expect(body.script.split(/\s+/).length, e.id).toBeGreaterThan(150);
      }
    });

    it('keeps the order exams were imported in', async () => {
      const db = await open(dialect, true);
      const ids = (await listExams(db, { skill: 'reading', limit: 200 })).items.map((e) => e.id);
      expect(ids[0]).toBe('vertical-farming');
      expect(ids).toContain('free-public-transport');
    });
  });

  describe('listing and reading exams', () => {
    it('filters by skill, topic and text, and paginates', async () => {
      const db = await open(dialect);
      await put(db, reading(), reading({ id: 'second-reading', title: 'Sleep and memory', topic: 'Economy' }), reading({ id: 'draft-one', status: 'draft' }));
      expect((await listExams(db, { skill: 'reading' })).total).toBe(2);
      expect((await listExams(db, { includeDrafts: true })).total).toBe(3);
      expect((await listExams(db, { topics: ['Economy'] })).items.map((e) => e.id)).toEqual(['second-reading']);
      expect((await listExams(db, { q: 'sleep' })).items.map((e) => e.id)).toEqual(['second-reading']);
      expect((await listExams(db, { q: 'SLEEP' })).items.map((e) => e.id)).toEqual(['second-reading']);
      expect((await listExams(db, { q: '%' })).total).toBe(0);
      expect((await listExams(db, { limit: 1, offset: 1 })).items.map((e) => e.id)).toEqual(['second-reading']);
      expect((await listExams(db, { skill: 'writing' })).total).toBe(0);
    });

    it('never sends answers or explanations to the client', async () => {
      const db = await open(dialect);
      await put(db, reading());
      const exam = (await getExam(db, 'sample-reading'))!;
      expect(exam.questionCount).toBe(3);
      expect(typeof exam.questionCount).toBe('number');
      expect(JSON.stringify(exam)).not.toMatch(/"answers?"|"why"|"explanation"|Because\./);
      expect(exam.questions[1]!.options).toEqual(['a', 'b', 'c']);
    });

    it('hides drafts unless asked for', async () => {
      const db = await open(dialect);
      await put(db, reading({ status: 'draft' }));
      expect(await getExam(db, 'sample-reading')).toBeNull();
      expect(await getExam(db, 'sample-reading', { includeDraft: true })).not.toBeNull();
    });
  });

  describe('grading', () => {
    it('grades on the server and returns the answers only after submission', async () => {
      const db = await open(dialect);
      await put(db, reading());
      const r = (await gradeExam(db, 'sample-reading', { q1: 'True', q2: 0, q3: ' Term. ' }))!;
      expect(r.correct).toBe(2);
      expect(r.total).toBe(3);
      expect(r.results.q2).toMatchObject({ correct: false, answer: 'c' });
      expect(r.results.q3!.correct).toBe(true);
      expect(r.results.q1!.why).toBe('Because.');
    });

    it('grades the seeded vertical farming exam: 8 of 10 is Band 7', async () => {
      const db = await open(dialect, true);
      const r = (await gradeExam(db, 'vertical-farming', {
        q1: 'False', q2: 'True', q3: 'True', q4: 'True', q5: 'False', q6: 1, q7: 1, q8: 0, q9: 'Pesticides ', q10: 'arable',
      }))!;
      expect(r.correct).toBe(8);
      expect(r.band).toBe(7);
    });

    it('refuses writing and unknown exams', async () => {
      const db = await open(dialect, true);
      expect(await gradeExam(db, 't2-transport', {})).toBeNull();
      expect(await gradeExam(db, 'no-such-exam', {})).toBeNull();
    });
  });

  describe('writing to the database', () => {
    it('replaces questions on update, keeps the position, and cascades on delete', async () => {
      const db = await open(dialect);
      await put(db, reading(), reading({ id: 'other-reading' }));
      await put(db, reading({ title: 'Renamed', questions: [{ id: 'only', type: 'gap', text: 'x', answer: ['y'], explanation: '' }] }));
      expect((await getExam(db, 'sample-reading'))!.title).toBe('Renamed');
      expect((await answerKey(db, 'sample-reading')).map((q) => q.id)).toEqual(['only']);
      expect((await listExams(db)).items.map((e) => e.id)).toEqual(['sample-reading', 'other-reading']);
      expect(await deleteExam(db, 'sample-reading')).toBe(true);
      expect(await answerKey(db, 'sample-reading')).toEqual([]);
      expect(await deleteExam(db, 'sample-reading')).toBe(false);
    });

    // pg-mem bỏ qua giao dịch (không hoàn tác thật). Với PostgreSQL, adapter được kiểm riêng ở "postgres adapter transactions".
    it.skipIf(dialect === 'postgres')('rolls back a whole batch when one write fails', async () => {
      const db = await open(dialect);
      await expect(db.tx(async (t) => {
        await upsertExam(t, examInput.parse(reading()));
        throw new Error('boom');
      })).rejects.toThrow('boom');
      expect((await listExams(db)).total).toBe(0);
    });

    it('statistics count published exams per skill', async () => {
      const db = await open(dialect, true);
      const s = await examStats(db);
      expect(s.bySkill.reading).toBeGreaterThanOrEqual(4);
      expect(s.bySkill.writing).toBeGreaterThanOrEqual(20);
      expect(s.topics).toContain('Education');
      expect(s.questions).toBeGreaterThan(50);
    });
  });
});

describe('postgres adapter transactions', () => {
  /** Pool giả: ghi lại mọi câu lệnh gửi qua từng kết nối để kiểm tra BEGIN / COMMIT / ROLLBACK và việc trả kết nối. */
  function fakePool() {
    const log: string[] = [];
    let released = 0;
    const query = async (text: string) => { log.push(text); return { rows: [], rowCount: 0 }; };
    const pool = { query, end: async () => undefined, connect: async () => ({ query, release: () => { released += 1; } }) };
    return { log, pool: pool as unknown as Parameters<typeof postgresDb>[0], released: () => released };
  }

  it('commits on success and returns the connection', async () => {
    const f = fakePool();
    const db = postgresDb(f.pool);
    await db.tx(async (t) => { await t.run('DELETE FROM exams WHERE id = ?', ['a']); });
    expect(f.log).toEqual(['BEGIN', 'DELETE FROM exams WHERE id = $1', 'COMMIT']);
    expect(f.released()).toBe(1);
  });

  it('rolls back on error, rethrows, and still returns the connection', async () => {
    const f = fakePool();
    const db = postgresDb(f.pool);
    await expect(db.tx(async (t) => { await t.run('DELETE FROM exams'); throw new Error('boom'); })).rejects.toThrow('boom');
    expect(f.log).toEqual(['BEGIN', 'DELETE FROM exams', 'ROLLBACK']);
    expect(f.released()).toBe(1);
  });

  it('shares the outer transaction when nested and converts ? to $n', async () => {
    const f = fakePool();
    const db = postgresDb(f.pool);
    await db.tx((t) => t.tx(async (inner) => { await inner.run('UPDATE exams SET title = ? WHERE id = ?', ['x', 'y']); }));
    expect(f.log).toEqual(['BEGIN', 'UPDATE exams SET title = $1 WHERE id = $2', 'COMMIT']);
    expect(f.released()).toBe(1);
  });
});

describe('validation', () => {
  it('accepts a good exam and reports each problem with its position', () => {
    expect(parseExams([reading()]).errors).toEqual([]);
    const bad = parseExams([
      reading({ id: 'Bad Id' }),
      reading({ id: 'dup' }),
      reading({ id: 'dup' }),
      reading({ id: 'mcq-range', questions: [{ id: 'q1', type: 'mcq', text: 'x', options: ['a', 'b'], answer: 5 }] }),
      reading({ id: 'same-q', questions: [{ id: 'q1', type: 'gap', text: 'x', answer: ['a'] }, { id: 'q1', type: 'gap', text: 'y', answer: ['b'] }] }),
    ]);
    expect(bad.exams.map((e) => e.id)).toEqual(['dup']);
    const text = bad.errors.join('\n');
    expect(text).toContain('#1 (Bad Id)');
    expect(text).toContain('trùng id đề "dup"');
    expect(text).toContain('vượt quá số lựa chọn');
    expect(text).toContain('trùng id câu hỏi');
  });

  it('requires a cue for speaking part 2 and no questions for writing', () => {
    const speaking = { id: 'sp-two', skill: 'speaking', title: 'T', body: { part: 2, questions: ['a'] } };
    expect(parseExams([speaking]).errors.join()).toContain('cue');
    expect(parseExams([{ ...speaking, body: { part: 2, questions: ['a'], cue: 'Describe...' } }]).errors).toEqual([]);
    const writing = { id: 'wr-one', skill: 'writing', title: 'W', body: { task: 2, prompt: 'p', minWords: 250 } };
    expect(parseExams([writing]).errors).toEqual([]);
    expect(parseExams([{ ...writing, questions: [{ id: 'q', type: 'gap', text: 'x', answer: ['a'] }] }]).errors.length).toBeGreaterThan(0);
  });
});

describe('AI grading quota', () => {
  it('limits calls per window and lets them through again afterwards', () => {
    resetRateLimits();
    expect(hit('k', 2, 1000, 0).ok).toBe(true);
    expect(hit('k', 2, 1000, 10).ok).toBe(true);
    const blocked = hit('k', 2, 1000, 20);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSec).toBe(1);
    expect(hit('k', 2, 1000, 1500).ok).toBe(true);
  });

  it('limits each account separately, and everyone together per day', () => {
    resetRateLimits();
    process.env.AI_RATE_LIMIT_PER_HOUR = '2';
    process.env.AI_RATE_LIMIT_PER_DAY = '4';
    try {
      expect(checkAiQuota('user-a', 0).ok).toBe(true);
      expect(checkAiQuota('user-a', 1).ok).toBe(true);
      expect(checkAiQuota('user-a', 2)).toMatchObject({ ok: false, scope: 'user' });
      expect(checkAiQuota('user-b', 3).ok).toBe(true);
      expect(checkAiQuota('user-b', 4).ok).toBe(true);
      expect(checkAiQuota('user-c', 5)).toMatchObject({ ok: false, scope: 'global' });
    } finally {
      delete process.env.AI_RATE_LIMIT_PER_HOUR;
      delete process.env.AI_RATE_LIMIT_PER_DAY;
      resetRateLimits();
    }
  });
});
