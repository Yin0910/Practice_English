/**
 * Ôn từ vựng kiểu Leitner: 5 hộp, đúng thì lên hộp (giãn lịch), sai thì về hộp 1.
 * Ngày tính theo giờ địa phương dạng 'YYYY-MM-DD' để lưu và so sánh bằng chuỗi.
 */

export interface CardState {
  box: number; // 1..5
  due: string; // YYYY-MM-DD
  seen: number;
}

/** Số ngày chờ trước lần ôn kế tiếp, theo hộp. */
export const BOX_DAYS = [0, 1, 2, 4, 8, 16] as const;
export const MAX_BOX = 5;

export function dayKey(d: Date = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function addDays(key: string, days: number): string {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number];
  return dayKey(new Date(y, m - 1, d + days));
}

export const newCard = (today: string): CardState => ({ box: 1, due: today, seen: 0 });

export function review(card: CardState, correct: boolean, today: string): CardState {
  const box = correct ? Math.min(card.box + 1, MAX_BOX) : 1;
  return { box, due: addDays(today, BOX_DAYS[box] ?? 1), seen: card.seen + 1 };
}

export const isDue = (card: CardState | undefined, today: string) => !card || card.due <= today;

/** Từ đã ở hộp 4–5 coi như đã thuộc. */
export const isMastered = (card: CardState | undefined) => !!card && card.box >= 4;
