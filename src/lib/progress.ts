import { roundBand } from './bands';
import { addDays, dayKey } from './srs';
import type { Session, Skill } from './storage';

/** Band hiện tại của một kỹ năng = trung bình 3 buổi gần nhất có band, làm tròn về 0.5. */
export function skillBand(sessions: Session[], skill: Skill): number | null {
  const bands = sessions
    .filter((s) => s.skill === skill && s.band !== undefined)
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 3)
    .map((s) => s.band as number);
  if (bands.length === 0) return null;
  return roundBand(bands.reduce((a, b) => a + b, 0) / bands.length);
}

/** Số ngày liên tiếp có học. Hôm nay chưa học thì vẫn tính chuỗi đến hôm qua. */
export function streak(sessions: Session[], today: string): number {
  const days = new Set(sessions.map((s) => dayKey(new Date(s.at))));
  let cursor = days.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (days.has(cursor)) {
    n += 1;
    cursor = addDays(cursor, -1);
  }
  return n;
}

export function daysUntil(target: string, today: string): number {
  const [ty, tm, td] = target.split('-').map(Number) as [number, number, number];
  const [y, m, d] = today.split('-').map(Number) as [number, number, number];
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(y, m - 1, d)) / 86_400_000);
}
