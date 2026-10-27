import fs from 'node:fs';
import path from 'node:path';
import type { Db } from './db';
import { parseExams } from './exam-schema';
import { upsertExam } from './exams-repo';

/** Nạp mọi file `*.json` trong thư mục seed. Đề lỗi bị bỏ qua và được báo lại, đề hợp lệ vẫn được ghi. */
export async function seedFromDir(db: Db, dir: string): Promise<{ files: number; exams: number; errors: string[] }> {
  if (!fs.existsSync(dir)) return { files: 0, exams: 0, errors: [] };
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
  const errors: string[] = [];
  let exams = 0;
  for (const file of files) {
    let data: unknown;
    try {
      data = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
    } catch (e) {
      errors.push(`${file}: không đọc được JSON (${(e as Error).message})`);
      continue;
    }
    const parsed = parseExams(data);
    errors.push(...parsed.errors.map((m) => `${file} ${m}`));
    await db.tx(async (t) => { for (const x of parsed.exams) await upsertExam(t, x); });
    exams += parsed.exams.length;
  }
  if (errors.length) console.error(`[seed] ${errors.length} lỗi:\n${errors.join('\n')}`);
  return { files: files.length, exams, errors };
}
