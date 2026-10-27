#!/usr/bin/env node
/**
 * Tạo tài khoản đăng nhập (hoặc đặt lại mật khẩu nếu tên đã có), qua API quản trị của ứng dụng đang chạy.
 *
 *   npm run user:create -- zitconlonton
 *   npm run user:create -- yinhocielts --url https://ielts-api.ten-mien.com --token <ADMIN_TOKEN>
 *
 * Mật khẩu được HỎI ẨN khi chạy (gõ hai lần để xác nhận), không bao giờ nhận qua tham số dòng lệnh để khỏi
 * nằm trong lịch sử lệnh hay danh sách tiến trình. Chạy không có cửa sổ lệnh (CI) thì đọc biến PRACTICE_PASSWORD.
 * ADMIN_TOKEN và địa chỉ (mặc định http://localhost:3000) lấy từ biến môi trường hoặc .env / .env.local.
 */
import fs from 'node:fs';

function envFromFile(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !line.trim().startsWith('#')) out[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
  return out;
}

function askHidden(prompt) {
  return new Promise((resolve) => {
    const { stdin, stdout } = process;
    stdout.write(prompt);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    let buf = '';
    const onData = (chunk) => {
      for (const c of chunk) {
        if (c === '\r' || c === '\n') {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.off('data', onData);
          stdout.write('\n');
          return resolve(buf);
        }
        if (c === '\u0003') { stdout.write('\n'); process.exit(130); }
        buf = c === '\u007f' || c === '\b' ? buf.slice(0, -1) : buf + c;
      }
    };
    stdin.on('data', onData);
  });
}

const fileEnv = { ...envFromFile('.env'), ...envFromFile('.env.local') };
let url = process.env.EXAMS_URL || 'http://localhost:3000';
let token = process.env.ADMIN_TOKEN || fileEnv.ADMIN_TOKEN || '';
let username = '';
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--url') url = args[++i];
  else if (args[i] === '--token') token = args[++i];
  else if (args[i].startsWith('-')) { console.error(`Không hiểu tham số: ${args[i]}`); process.exit(2); }
  else username = args[i];
}

if (!username) {
  console.error('Cách dùng: npm run user:create -- <tên-đăng-nhập> [--url http://localhost:3000] [--token ...]');
  process.exit(1);
}
if (!token) {
  console.error('Thiếu ADMIN_TOKEN (đặt trong .env.local hoặc truyền --token).');
  process.exit(1);
}

let password = process.env.PRACTICE_PASSWORD || '';
if (!password) {
  if (!process.stdin.isTTY) {
    console.error('Không có cửa sổ lệnh để hỏi mật khẩu: đặt biến môi trường PRACTICE_PASSWORD.');
    process.exit(1);
  }
  password = await askHidden(`Mật khẩu cho "${username}": `);
  const again = await askHidden('Nhập lại mật khẩu: ');
  if (password !== again) {
    console.error('Hai lần nhập không khớp. Chưa tạo gì.');
    process.exit(1);
  }
}

const res = await fetch(new URL(`/api/admin/users/${encodeURIComponent(username)}`, url), {
  method: 'PUT',
  headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
  body: JSON.stringify({ password }),
}).catch((e) => ({ ok: false, status: 0, json: async () => ({ error: e.message }) }));
const data = await res.json().catch(() => ({}));

if (res.ok) {
  console.log(data.result === 'created' ? `Đã tạo tài khoản "${data.username}".` : `Đã đặt lại mật khẩu của "${data.username}" (các phiên đang đăng nhập bị đăng xuất).`);
} else {
  console.error(`Lỗi ${res.status}: ${data.error ?? 'không rõ'}`);
  process.exit(1);
}
