export const TARGET_BAND = 8.0;

/** Bảng quy đổi điểm thô /40 → band (IELTS Academic Reading), tra từ cao xuống thấp. */
const READING_TABLE: [number, number][] = [
  [39, 9], [37, 8.5], [35, 8], [33, 7.5], [30, 7], [27, 6.5], [23, 6],
  [19, 5.5], [15, 5], [13, 4.5], [10, 4], [8, 3.5], [6, 3], [4, 2.5],
];

/** Bảng quy đổi điểm thô /40 → band (Listening). */
const LISTENING_TABLE: [number, number][] = [
  [39, 9], [37, 8.5], [35, 8], [32, 7.5], [30, 7], [26, 6.5], [23, 6],
  [18, 5.5], [16, 5], [13, 4.5], [10, 4], [8, 3.5], [6, 3], [4, 2.5],
];

function lookup(table: [number, number][], raw40: number): number {
  for (const [min, band] of table) if (raw40 >= min) return band;
  return raw40 >= 1 ? 2 : 0;
}

/** Đề luyện ngắn hơn 40 câu: quy tỉ lệ về thang 40 rồi tra bảng — chỉ là ước lượng. */
function estimate(table: [number, number][], correct: number, total: number): number {
  if (total <= 0) return 0;
  return lookup(table, Math.round((correct / total) * 40));
}

export const readingBand = (correct: number, total: number) => estimate(READING_TABLE, correct, total);
export const listeningBand = (correct: number, total: number) => estimate(LISTENING_TABLE, correct, total);

/** Làm tròn band về bội số 0.5 theo luật IELTS: .25 → .5, .75 → lên nguyên kế tiếp. */
export function roundBand(x: number): number {
  return Math.floor(x * 2 + 0.5) / 2;
}

export function overallBand(parts: number[]): number | null {
  if (parts.length === 0) return null;
  return roundBand(parts.reduce((a, b) => a + b, 0) / parts.length);
}

export const formatBand = (b: number | null | undefined) => (b == null ? '–' : b.toFixed(1));
