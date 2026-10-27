#!/usr/bin/env node
/**
 * Nhập đề từ file JSON vào database đang chạy, qua API quản trị.
 *
 *   npm run db:import -- db/seed/my-exams.json
 *   npm run db:import -- --url http://localhost:3100 --token abc123 file1.json file2.json
 *
 * Mặc định đọc ADMIN_TOKEN và địa chỉ (http://localhost:3000) từ biến môi trường / .env.local.
 * Định dạng đề: xem README, mục "Thêm đề vào database".
 */
import fs from 'node:fs';
import path from 'node:path';

function envFromFile(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !line.trim().startsWith('#')) out[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
  return out;
}

const fileEnv = { ...envFromFile('.env'), ...envFromFile('.env.local') };
let url = process.env.EXAMS_URL || 'http://localhost:3000';
let token = process.env.ADMIN_TOKEN || fileEnv.ADMIN_TOKEN || '';
const files = [];
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--url') url = args[++i];
  else if (args[i] === '--token') token = args[++i];
  else files.push(args[i]);
}

if (files.length === 0) {
  console.error('Cách dùng: npm run db:import -- [--url http://localhost:3000] [--token ...] file.json [file2.json ...]');
  process.exit(1);
}
if (!token) {
  console.error('Thiếu ADMIN_TOKEN (đặt trong .env.local hoặc truyền --token).');
  process.exit(1);
}

let failed = false;
for (const file of files) {
  let exams;
  try {
    exams = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    console.error(`${file}: không đọc được JSON (${e.message})`);
    failed = true;
    continue;
  }
  const res = await fetch(new URL('/api/exams/import', url), {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify(exams),
  }).catch((e) => ({ ok: false, status: 0, json: async () => ({ error: e.message }) }));
  const data = await res.json().catch(() => ({}));
  if (res.ok) {
    console.log(`${path.basename(file)}: đã nhập ${data.imported} đề`);
  } else {
    failed = true;
    console.error(`${path.basename(file)}: lỗi ${res.status} - ${data.error ?? 'không rõ'}`);
    for (const d of data.details ?? []) console.error(`  - ${d}`);
  }
}
process.exit(failed ? 1 : 0);
