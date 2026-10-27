import { randomUUID } from 'node:crypto';
import type { Attempt, AttemptSkill, CardProgress } from '@/lib/progress-types';
import type { Db } from './db';

/** Lịch sử học theo từng người dùng. Mọi truy vấn đều lọc theo `user_id`: không ai đọc được dữ liệu của người khác. */

interface AttemptRow { id: string; skill: AttemptSkill; exam_id: string | null; band: number | null; note: string; at: string }

const toAttempt = (r: AttemptRow): Attempt => ({
  id: r.id, skill: r.skill, at: r.at, note: r.note,
  ...(r.band === null || r.band === undefined ? {} : { band: Number(r.band) }),
  ...(r.exam_id ? { examId: r.exam_id } : {}),
});

export async function addAttempt(
  db: Db, userId: string, a: { skill: AttemptSkill; examId?: string; band?: number; note: string }, now = new Date(),
): Promise<Attempt> {
  const id = randomUUID();
  const at = now.toISOString();
  await db.run(
    'INSERT INTO attempts (id, user_id, skill, exam_id, band, note, at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id, userId, a.skill, a.examId ?? null, a.band ?? null, a.note, at],
  );
  return toAttempt({ id, skill: a.skill, exam_id: a.examId ?? null, band: a.band ?? null, note: a.note, at });
}

export async function listAttempts(db: Db, userId: string, limit = 500): Promise<Attempt[]> {
  const rows = await db.all<AttemptRow>(
    'SELECT id, skill, exam_id, band, note, at FROM attempts WHERE user_id = ? ORDER BY at DESC, id LIMIT ?', [userId, limit],
  );
  return rows.map(toAttempt);
}

export async function getVocab(db: Db, userId: string): Promise<Record<string, CardProgress>> {
  const rows = await db.all<{ word_id: string; box: number; due: string; seen: number }>(
    'SELECT word_id, box, due, seen FROM vocab_progress WHERE user_id = ?', [userId],
  );
  return Object.fromEntries(rows.map((r) => [r.word_id, { box: Number(r.box), due: r.due, seen: Number(r.seen) }]));
}

export async function saveVocab(db: Db, userId: string, cards: Record<string, CardProgress>): Promise<void> {
  await db.tx(async (t) => {
    for (const [wordId, c] of Object.entries(cards)) {
      await t.run(
        `INSERT INTO vocab_progress (user_id, word_id, box, due, seen) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT (user_id, word_id) DO UPDATE SET box = excluded.box, due = excluded.due, seen = excluded.seen`,
        [userId, wordId, c.box, c.due, c.seen],
      );
    }
  });
}

export async function getExamDate(db: Db, userId: string): Promise<string> {
  const r = await db.get<{ exam_date: string }>('SELECT exam_date FROM prefs WHERE user_id = ?', [userId]);
  return r?.exam_date ?? '';
}

export async function setExamDate(db: Db, userId: string, date: string): Promise<void> {
  await db.run(
    `INSERT INTO prefs (user_id, exam_date) VALUES (?, ?)
     ON CONFLICT (user_id) DO UPDATE SET exam_date = excluded.exam_date`, [userId, date],
  );
}
