import { describe, expect, it } from 'vitest';
import { listeningBand, overallBand, readingBand, roundBand } from '@/lib/bands';
import { isCorrect, score } from '@/lib/grade';
import { daysUntil, skillBand, streak } from '@/lib/progress';
import { addDays, dayKey, isDue, newCard, review } from '@/lib/srs';
import type { Session } from '@/lib/storage';
import type { Question } from '@/lib/exam-types';
import { VOCAB } from '@/data/vocabulary';

describe('bands', () => {
  it('rounds the overall band by IELTS rules', () => {
    expect(roundBand(7.75)).toBe(8);
    expect(roundBand(7.25)).toBe(7.5);
    expect(roundBand(7.125)).toBe(7);
    expect(overallBand([8, 8, 7.5, 7.5])).toBe(8);
    expect(overallBand([])).toBeNull();
  });

  it('converts raw scores scaled to 40', () => {
    expect(readingBand(35, 40)).toBe(8);
    expect(readingBand(10, 10)).toBe(9);
    expect(readingBand(9, 10)).toBe(8);
    expect(listeningBand(32, 40)).toBe(7.5);
    expect(readingBand(0, 10)).toBe(0);
  });
});

describe('grade', () => {
  const gap: Question = { id: 'g', type: 'gap', text: '', answers: ['noon', '12'], why: '' };
  const mcq: Question = { id: 'm', type: 'mcq', text: '', options: ['a', 'b'], answer: 1, why: '' };

  it('accepts gap answers ignoring case, spaces and trailing punctuation', () => {
    expect(isCorrect(gap, '  Noon. ')).toBe(true);
    expect(isCorrect(gap, 'midnight')).toBe(false);
    expect(isCorrect(gap, '')).toBe(false);
  });

  it('scores multiple choice by index', () => {
    expect(isCorrect(mcq, 1)).toBe(true);
    expect(isCorrect(mcq, 0)).toBe(false);
    expect(score([gap, mcq], { g: 'noon', m: 0 })).toBe(1);
  });
});

describe('srs', () => {
  it('moves up a box when correct and resets when wrong', () => {
    const today = '2026-10-27';
    let c = review(newCard(today), true, today);
    expect(c.box).toBe(2);
    expect(c.due).toBe('2026-10-29');
    c = review(c, false, today);
    expect(c.box).toBe(1);
    expect(c.due).toBe('2026-10-28');
  });

  it('treats unseen cards as due and caps at box 5', () => {
    expect(isDue(undefined, '2026-10-27')).toBe(true);
    let c = newCard('2026-10-27');
    for (let i = 0; i < 9; i++) c = review(c, true, '2026-10-27');
    expect(c.box).toBe(5);
  });

  it('adds days across month boundaries', () => {
    expect(addDays('2026-10-30', 3)).toBe('2026-11-02');
  });
});

describe('progress', () => {
  const at = (key: string) => new Date(`${key}T12:00:00`).toISOString();
  const s = (skill: Session['skill'], key: string, band?: number): Session => ({ id: key + skill, skill, at: at(key), band, note: '' });

  it('averages the last three banded sessions', () => {
    const list = [s('reading', '2026-10-01', 5), s('reading', '2026-10-02', 7), s('reading', '2026-10-03', 7.5), s('reading', '2026-10-04', 8)];
    expect(skillBand(list, 'reading')).toBe(7.5);
    expect(skillBand(list, 'writing')).toBeNull();
  });

  it('counts a streak that ends today or yesterday', () => {
    const list = [s('reading', '2026-10-25'), s('writing', '2026-10-26'), s('reading', '2026-10-27')];
    expect(streak(list, '2026-10-27')).toBe(3);
    expect(streak(list.slice(0, 2), '2026-10-27')).toBe(2);
    expect(streak(list.slice(0, 1), '2026-10-27')).toBe(0);
  });

  it('counts days until the exam', () => {
    expect(daysUntil('2026-11-27', '2026-10-27')).toBe(31);
    expect(dayKey(new Date(2026, 9, 27))).toBe('2026-10-27');
  });
});

describe('vocabulary integrity', () => {
  it('has unique ids', () => {
    const ids = VOCAB.map((w) => w.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
