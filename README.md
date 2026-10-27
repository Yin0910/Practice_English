# Band 8.0 Practice

Website luyện thi IELTS hướng tới **Band 8.0**, xoay quanh một **kho đề** nằm trong database và được lấy qua API.
Next.js (App Router) + TypeScript, CSS thuần. Tiến độ cá nhân lưu trong trình duyệt; bộ đề, chấm bài và chấm AI nằm ở máy chủ.

## Chạy trên máy cá nhân

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # vitest
npm run typecheck
npm run build
```

Lần đầu chạy, ứng dụng tạo `data/exams.db` (SQLite) và nạp sẵn các đề trong `db/seed/*.json`.

**Đăng nhập.** Các trang luyện thi và API đề đều cần đăng nhập; không có đăng ký công khai, tài khoản do quản trị tạo. Lịch sử học, tiến độ từ vựng
và ngày thi lưu **ở database theo từng tài khoản** (đổi máy vẫn còn, người này không thấy dữ liệu người kia). Để thử trên máy cá nhân:

```bash
# 1. đặt ADMIN_TOKEN trong .env.local (tự đặt một chuỗi bất kỳ), rồi chạy npm run dev
echo "ADMIN_TOKEN=dev-token-doi-di" > .env.local
# 2. tạo tài khoản; mật khẩu được hỏi ẩn khi chạy (không gõ trong lệnh)
npm run user:create -- zitconlonton
npm run user:create -- yinhocielts
```

Chạy lại lệnh với tên đã có sẽ **đặt lại mật khẩu** (và đăng xuất các phiên đang mở). Mật khẩu chỉ được lưu dưới dạng băm scrypt, không có ở mã nguồn hay file nào.

## Kho đề

| Kỹ năng | Số đề | Chấm bài |
|---|---|---|
| Reading | 4 (10 câu mỗi đề) | tự động, ở máy chủ |
| Listening | 4 (8–9 câu mỗi đề) | tự động, ở máy chủ |
| Writing | 24 (16 Task 2, 8 Task 1 dạng bảng số liệu) | AI (tuỳ chọn) hoặc tự chấm 4 tiêu chí |
| Speaking | 30 (Part 1, 2, 3) | tự chấm 4 tiêu chí |

Toàn bộ bài đọc, bài nghe, đề viết và số liệu Task 1 đều tự soạn. Từ vựng (42 từ) vẫn nằm trong mã nguồn (`src/data/vocabulary.ts`).
Band của Reading/Listening là **ước lượng**: số câu đúng được quy tỉ lệ về thang 40 câu rồi tra bảng quy đổi.

## API

Mọi đường dẫn nằm dưới `/api`. Chỉ `GET /api/exams/stats` và đăng nhập là công khai. Đọc đề, chấm bài, lịch sử và chấm AI cần **đăng nhập** (cookie phiên `HttpOnly`);
**các API ghi đề và quản lý tài khoản cần `ADMIN_TOKEN`** (`Authorization: Bearer ...`) và bị tắt hẳn khi chưa đặt token.

| Phương thức và đường dẫn | Việc | Quyền |
|---|---|---|
| `POST /api/auth/login` | `{ "username", "password" }` → đặt cookie phiên (30 ngày). Sai nhiều lần thì bị chặn tạm | công khai |
| `POST /api/auth/logout` · `GET /api/auth/me` | Đăng xuất · người đang đăng nhập (`{ "user": null }` nếu chưa) | công khai |
| `GET /api/exams?skill=&topic=&kind=&q=&limit=&offset=` | Danh sách đề (không có đáp án). `include=body` kèm nội dung cho Writing/Speaking | đăng nhập |
| `GET /api/exams/{id}` | Một đề đầy đủ, **không có đáp án** | đăng nhập |
| `POST /api/exams/{id}/grade` | Chấm Reading/Listening: `{ "answers": { "q1": "False", "q6": 1 } }` → điểm, band, đáp án, giải thích | đăng nhập |
| `GET /api/exams/stats` | Số đề theo kỹ năng, số câu hỏi, các chủ đề | công khai |
| `GET /api/history` · `POST /api/history` | Lịch sử học của chính mình · ghi thêm một buổi luyện | đăng nhập |
| `GET /api/vocab` · `PUT /api/vocab` | Tiến độ ôn từ vựng của chính mình | đăng nhập |
| `GET /api/prefs` · `PUT /api/prefs` | Ngày thi của chính mình | đăng nhập |
| `POST /api/writing-feedback` | Chấm Writing bằng AI: `{ "examId", "essay" }`, có giới hạn lượt theo tài khoản | đăng nhập (cần `ANTHROPIC_API_KEY`) |
| `PUT /api/admin/users/{username}` | Tạo tài khoản hoặc đặt lại mật khẩu: `{ "password" }` (dùng `npm run user:create`) | token quản trị |
| `POST /api/exams` | Tạo một đề (409 nếu đã có id) | token quản trị |
| `PUT /api/exams/{id}` / `DELETE /api/exams/{id}` | Sửa / xoá đề | token quản trị |
| `POST /api/exams/import` | Nhập hàng loạt, tất cả hoặc không | token quản trị |

Đáp án chỉ rời máy chủ sau khi nộp bài (trong kết quả của `/grade`), nên không đọc được từ trình duyệt trước khi làm.

## Thêm đề vào database

Mỗi file JSON là một mảng đề. Nội dung theo kỹ năng nằm trong `body`; Reading/Listening có thêm `questions`.

```json
{
  "id": "my-reading-01",
  "skill": "reading",
  "title": "Tên bài đọc",
  "kind": "Passage",
  "topic": "Education",
  "level": "Band 8",
  "minutes": 20,
  "body": { "paragraphs": [{ "label": "A", "text": "..." }] },
  "questions": [
    { "id": "q1", "type": "tfng", "text": "...", "answer": "True", "explanation": "Giải thích bằng tiếng Việt" },
    { "id": "q2", "type": "mcq", "text": "...", "options": ["a", "b", "c"], "answer": 1, "explanation": "..." },
    { "id": "q3", "type": "gap", "text": "Điền ______ .", "answer": ["pesticides", "pesticide"], "explanation": "..." }
  ]
}
```

- `listening`: `body` là `{ "script": "...", "audioUrl": "https://..." }`; có `audioUrl` thì trang phát file audio thay cho giọng đọc của trình duyệt.
- `writing`: `body` là `{ "task": 1|2, "prompt": "...", "minWords": 250, "table": { "caption", "head", "rows" } }` (`table` chỉ Task 1).
- `speaking`: `body` là `{ "part": 1|2|3, "questions": [...], "cue": "..." }` (Part 2 bắt buộc có `cue`).
- `status: "draft"` để lưu nháp, chưa hiện ra cho người học.

Có hai cách nạp. **Lần đầu**: bỏ file vào `db/seed/` (database trống sẽ tự nạp). **Sau đó**, nhập vào database đang chạy:

```bash
npm run db:import -- --url http://localhost:3000 --token <ADMIN_TOKEN> db/seed/my-exams.json
```

Đề sai định dạng bị từ chối kèm danh sách lỗi từng chỗ và **không đề nào được ghi** (nhập kiểu tất cả hoặc không). Đề cùng `id` được thay mới.

## Triển khai: giao diện ở Vercel, database và AI chấm ở máy chủ

```
Trình duyệt ──► Vercel (tên miền, giao diện)
                  │  /api/*  chuyển tiếp (rewrite)
                  ▼
              Máy chủ:  Caddy (HTTPS) ──► app (API đề, chấm bài, chấm AI) ──► PostgreSQL
```

Cùng một mã nguồn chạy hai kiểu. **Trên máy chủ** là bản đầy đủ (API + database + AI). **Trên Vercel** chỉ là giao diện: đặt `API_ORIGIN` thì
mọi `/api/*` được chuyển tới máy chủ. Trình duyệt vẫn gọi cùng một tên miền nên không vướng CORS, và `ANTHROPIC_API_KEY`, `ADMIN_TOKEN`,
mật khẩu database **không bao giờ nằm ở Vercel**.

### 1. Trên máy chủ (đã có Docker, như máy chủ của SaleCheckIn)

```bash
git clone <repo> practice-english && cd practice-english
cp .env.example .env        # điền POSTGRES_PASSWORD, ADMIN_TOKEN, ANTHROPIC_API_KEY
docker compose up -d --build
docker compose logs -f app  # lần đầu tự nạp db/seed/*.json vào database trống
```

Ứng dụng nghe ở `127.0.0.1:3101` (đổi bằng `APP_PORT`). Stack này có project, volume và cổng riêng, **không dùng chung gì** với SaleCheckIn nên không ảnh hưởng dữ liệu của nó.

### 2. HTTPS cho API

Thêm một khối vào Caddy đang chạy (hoặc nginx), với tên miền phụ trỏ DNS về máy chủ, ví dụ `api.ten-mien.com`:

```
api.ten-mien.com {
	encode zstd gzip
	reverse_proxy 127.0.0.1:3101
}
```

Nếu Caddy chạy trong container (như ở SaleCheckIn) thì `127.0.0.1` là chính container Caddy: dùng `host.docker.internal:3101` kèm `extra_hosts: ["host.docker.internal:host-gateway"]`
cho service caddy, hoặc nối Caddy vào mạng của stack này. Đây là việc sửa cấu hình máy chủ chung, nên làm có chủ đích.

### 3. Trên Vercel

Import repo này, rồi đặt biến môi trường **`API_ORIGIN=https://api.ten-mien.com`** (đặt trước khi dựng: rewrite được cố định lúc build). Gắn tên miền chính vào project Vercel.
Không đặt `DATABASE_URL`, `ANTHROPIC_API_KEY`, `ADMIN_TOKEN` ở Vercel.

### Lưu ý vận hành

- **Giới hạn chấm AI**: mỗi IP tối đa `AI_RATE_LIMIT_PER_HOUR` lượt mỗi giờ và cả hệ thống tối đa `AI_RATE_LIMIT_PER_DAY` lượt mỗi ngày. Khi đi qua Vercel,
  Caddy mặc định chỉ thấy địa chỉ của Vercel, nên giới hạn theo IP gần như thành giới hạn chung; lớp theo ngày mới là lớp bảo vệ chắc chắn. Muốn có IP thật, cấu hình `trusted_proxies` trong Caddy.
- **Sao lưu**: `docker compose exec db pg_dump -U practice practice > practice.sql`. Đừng bao giờ `docker compose down -v`.
- **Đổi nội dung đề** không cần dựng lại: dùng `POST /api/exams/import` (hoặc `npm run db:import`).
- **Neon**: bộ đọc/ghi dùng PostgreSQL chuẩn, nên đặt `DATABASE_URL` là chuỗi kết nối Neon cũng chạy. Chưa thiết lập và chưa thử chế độ chạy toàn bộ trên Vercel (không có máy chủ).
- **Đã kiểm**: SQLite thật, PostgreSQL qua pg-mem (giả lập), adapter Postgres qua pool giả (BEGIN/COMMIT/ROLLBACK), `next build`. **Chưa kiểm** trên PostgreSQL thật và trên Docker, vì máy phát triển chưa có.

## Cấu trúc

```
db/seed/            bộ đề mẫu (JSON), tự nạp vào database trống
src/app/            các trang + API (/api/exams, /api/writing-feedback)
src/server/         database (SQLite/Postgres), truy vấn đề, kiểm tra định dạng, giới hạn lượt gọi
src/components/     header, tab, ô lọc, bảng đề, câu hỏi
src/lib/            quy đổi band, ôn từ, chấm câu, tiến độ, gọi API
Dockerfile, compose.yaml    chạy trên máy chủ
tests/              vitest: logic, database (SQLite + Postgres giả lập), hạn mức AI
```
