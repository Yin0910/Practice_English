# Triển khai: giao diện ở Vercel, database và AI chấm ở máy chủ

> **Đối tượng** — người vận hành. **Trạng thái** — các file trong thư mục này đã viết và soát, nhưng **chưa chạy lần nào trên máy chủ**
> (máy phát triển không có Docker). Làm lần lượt từng bước, kiểm ở cuối mỗi bước, dừng ngay nếu có gì lạ.

```
Trình duyệt ──► Vercel  (tên miền giao diện: chỉ có giao diện, không giữ khoá nào)
                  │  /api/*  được chuyển tiếp
                  ▼
        Máy chủ 27.71.26.215 (dùng chung với SaleCheckIn)
          Caddy của SaleCheckIn (HTTPS) ──► practice-app (API đề, chấm bài, chấm AI)
                                                │
                                                └─► PostgreSQL của SaleCheckIn, database `practice` (tài khoản `practice_app`)
```

Cách làm giống tender-intelligence đang chạy cùng máy chủ: không dựng PostgreSQL riêng, đứng chung mạng Docker `salecheckin_default`, nhận mã bằng `git push` qua SSH.

## Việc nào chạm vào hệ thống đang chạy thật

Chỉ có các việc dưới đây. Mọi thứ còn lại nằm trong thư mục `/srv/practice-english` mới và container mới.

| # | Việc | Chạm vào | Hoàn tác |
|---|---|---|---|
| 3 | Tạo database `practice` + tài khoản `practice_app` trong PostgreSQL | PostgreSQL của SaleCheckIn (chỉ **tạo mới**, không đụng `salecheckin` và `tender`) | `DROP DATABASE practice; DROP ROLE practice_app;` |
| 6 | Thêm một khối vào `deploy/Caddyfile` của SaleCheckIn rồi `caddy reload` | Caddy phục vụ app, website, báo cáo | xoá khối, `caddy reload` |
| 1 | Thêm bản ghi DNS cho tên miền API | DNS ở Viettel IDC | xoá bản ghi |
| 9 | Thêm database `practice` vào lịch sao lưu đêm | `/etc/cron.daily/salecheckin-dump` | bỏ dòng thêm |

Container mới bị giới hạn **512 MB RAM, 1 CPU** vì máy chủ 4 CPU / 8 GB còn chạy website, CSDL và báo cáo.

## 1. Tên miền và DNS

Cần hai tên (ví dụ):

| Dùng cho | Ví dụ | Bản ghi DNS |
|---|---|---|
| Giao diện (Vercel) | `ielts.namlinh.com` | Vercel sẽ hiện đúng bản ghi cần tạo ở bước 8 (thường CNAME) |
| API (máy chủ) | `ielts-api.namlinh.com` | `A` trỏ về `27.71.26.215` |

Tạo bản ghi `A` của API **trước** bước 6; chưa có DNS mà bật khối Caddy thì Caddy xin chứng chỉ thất bại liên tục.
Kiểm: `nslookup ielts-api.namlinh.com` ra `27.71.26.215`.

## 2. Đưa mã lên máy chủ (git push qua SSH, như tender-intelligence)

```bash
# Máy chủ: tạo kho nhận mã (tổ chức GitHub tắt Deploy keys nên đẩy trực tiếp từ máy phát triển)
ssh root@27.71.26.215 'mkdir -p /srv/practice-english && cd /srv/practice-english \
  && git init -q -b main && git config receive.denyCurrentBranch updateInstead'

# Máy phát triển, trong thư mục Website_PracticeEnglish (đã git init và commit):
git push ssh://root@27.71.26.215/srv/practice-english main:main
```

Kiểm: `ssh root@27.71.26.215 'ls /srv/practice-english'` thấy `compose.yaml`, `Dockerfile`, `deploy/`, `db/seed/`.

## 3. Tạo database và tài khoản riêng (một lần)

Trên máy chủ:

```bash
PW=$(openssl rand -hex 24); echo "$PW"      # GHI LẠI: là PG_PASSWORD ở bước 4
docker compose -f /srv/salecheckin/compose.yaml exec -T db \
  psql -U salecheckin -d postgres -v ON_ERROR_STOP=1 -v pw="'$PW'" < /srv/practice-english/deploy/provision-db.sql
```

Kiểm: in ra `CREATE ROLE`, `CREATE DATABASE`, `REVOKE`. Chạy lại lần hai sẽ báo "already exists": đó là bình thường và không làm hỏng gì.

## 4. Cấu hình `.env` trên máy chủ

```bash
cd /srv/practice-english && cp .env.example .env && nano .env
```

Điền: `PG_PASSWORD` (từ bước 3), `ADMIN_TOKEN` (`openssl rand -hex 24`), `ANTHROPIC_API_KEY` (**tự dán vào file này**, không gửi qua chat/tin nhắn).
Để nguyên `PG_USER=practice_app`, `PG_DATABASE=practice`, `PG_HOST=db`, `PG_NETWORK=salecheckin_default`. File `.env` không lên git.

## 5. Dựng và chạy

```bash
cd /srv/practice-english && bash deploy/docker-deploy.sh
```

Lần đầu, ứng dụng thấy database `practice` trống nên tự nạp `db/seed/*.json` (62 đề). Kiểm:

```bash
docker compose logs --tail 30 app                      # không có lỗi "Không mở được database"
docker compose exec app node -e "fetch('http://127.0.0.1:3000/api/exams/stats').then(r=>r.json()).then(console.log)"
# mong đợi: total 62, bySkill {reading 4, listening 4, writing 24, speaking 30}
```

## 6. HTTPS cho API (Caddy của SaleCheckIn)

1. Mở `deploy/caddy-api.snippet`, đổi `API.TEN-MIEN-CUA-BAN.com` thành tên miền API thật.
2. Dán khối đó vào `deploy/Caddyfile` **của kho SaleCheckIn** (cạnh khối `report.namlinhpharma.com`) và **commit vào kho SaleCheckIn**:
   khối dán tay trên máy chủ sẽ mất khi `docker-deploy.sh` của SaleCheckIn chạy `git reset --hard`.
3. Trên máy chủ, kiểm rồi nạp lại (reload, không restart nên các site khác không gián đoạn):

```bash
cd /srv/salecheckin
docker compose exec caddy caddy validate --config /etc/caddy/Caddyfile
docker compose exec caddy caddy reload   --config /etc/caddy/Caddyfile
```

Kiểm: `curl -s https://ielts-api.namlinh.com/api/exams/stats` ra JSON. Kiểm tiếp các site cũ vẫn lên:
`curl -sI https://app.namlinh.com | head -1`, `curl -sI https://report.namlinhpharma.com | head -1`, `curl -sI https://namlinhpharma.com | head -1`.

## 7. Tạo hai tài khoản đăng nhập

Không có đăng ký công khai: chỉ hai tài khoản **`zitconlonton`** và **`yinhocielts`**, tạo bằng script. Mật khẩu được **hỏi ẩn khi chạy** (gõ hai lần), không nằm trong lệnh, trong git hay trong file nào;
database chỉ lưu bản băm. Chạy từ máy phát triển, trỏ vào API trên máy chủ (cần `ADMIN_TOKEN` ở bước 4):

```bash
npm run user:create -- zitconlonton --url https://ielts-api.namlinh.com --token <ADMIN_TOKEN>
npm run user:create -- yinhocielts  --url https://ielts-api.namlinh.com --token <ADMIN_TOKEN>
```

Mỗi lệnh in "Đã tạo tài khoản ...". Chạy lại với tên đã có là **đặt lại mật khẩu** (và đăng xuất các phiên đang mở). Việc này chỉ ghi vào bảng `users` của database `practice`.

## 8a. Thử API từ ngoài

```bash
curl -s https://ielts-api.namlinh.com/api/exams/stats                                 # công khai: ra JSON
curl -s -w ' [%{http_code}]\n' "https://ielts-api.namlinh.com/api/exams?skill=reading"  # chưa đăng nhập: phải [401]
curl -s -w ' [%{http_code}]\n' -X POST https://ielts-api.namlinh.com/api/exams/import -H 'content-type: application/json' -d '[]'   # phải [401]
```

Hai dòng sau phải trả **401**: đề và API ghi đang đòi đăng nhập/token. Nếu không phải 401, dừng lại và đừng tiếp tục.

## 8. Vercel (giao diện)

1. Đẩy mã lên một kho GitHub (riêng tư) để Vercel đọc, rồi **Import** kho đó trong Vercel.
2. Settings → Environment Variables: **`API_ORIGIN=https://ielts-api.namlinh.com`** (Production và Preview). Phải đặt **trước** lần dựng: rewrite được cố định lúc build; đổi sau thì Redeploy.
3. **Không** đặt `DATABASE_URL`, `ANTHROPIC_API_KEY`, `ADMIN_TOKEN` ở Vercel.
4. Settings → Domains: thêm `ielts.namlinh.com`, tạo bản ghi DNS theo hướng dẫn Vercel hiện ra.

Kiểm: mở `https://ielts.namlinh.com`, bấm Đăng nhập bằng một trong hai tài khoản, vào Reading, làm và nộp một đề: kết quả đến từ máy chủ và buổi vừa làm hiện trong Tổng quan.
Đăng xuất rồi đăng nhập lại (hoặc đổi trình duyệt): lịch sử còn nguyên. Trang chủ phải hiện "62 đề".

**Cookie đăng nhập đi qua Vercel**: trình duyệt chỉ nói chuyện với tên miền Vercel, Vercel chuyển `/api/*` về máy chủ. Cookie phiên được đặt cờ `Secure` nhờ header `X-Forwarded-Proto`
(Caddy gửi), nên cần HTTPS cả hai chặng, vốn đã đúng ở cách làm này. **Chưa kiểm trên Vercel thật**: nếu đăng nhập báo thành công nhưng tải lại trang lại bị đá về đăng nhập, kiểm tra header `Set-Cookie` ở tab Network trước tiên.

## 9. Sao lưu

Lịch dump đêm của SaleCheckIn chỉ dump database `salecheckin`. Xem file đó trên máy chủ (`cat /etc/cron.daily/salecheckin-dump`) rồi thêm cho `practice`, theo cùng kiểu, ví dụ:

```bash
docker compose -f /srv/salecheckin/compose.yaml exec -T db pg_dump -U salecheckin -Fc practice > /var/backups/practice-$(date +%F).dump
```

Đề tự soạn nằm trong `db/seed/*.json` trong git nên luôn dựng lại được; **đề nhập thêm qua API thì không**, nên giữ file JSON gốc trong git hoặc dựa vào bản dump này.
**Tài khoản và lịch sử học của từng người chỉ có trong database này**, nên bản dump là thứ duy nhất giữ được chúng.

## 10. Cập nhật về sau

```bash
git push ssh://root@27.71.26.215/srv/practice-english main:main     # từ máy phát triển
ssh root@27.71.26.215 'bash /srv/practice-english/deploy/docker-deploy.sh'
```

Thêm đề không cần dựng lại: `POST /api/exams/import` kèm token (xem README). Lên Vercel thì `git push` lên kho GitHub là tự phát hành.

## 11. Quay lui và gỡ bỏ

- **Bản mới hỏng**: script in sẵn lệnh quay về `practice-english:truoc`.
- **Gỡ hẳn**: xoá khối Caddy rồi `caddy reload`; `cd /srv/practice-english && docker compose down` (**không** `-v`);
  `DROP DATABASE practice; DROP ROLE practice_app;` bằng tài khoản quản trị PostgreSQL; xoá bản ghi DNS và dự án Vercel.

## Lưu ý

- **Chấm AI chỉ dành cho người đã đăng nhập**, giới hạn theo từng tài khoản (`AI_RATE_LIMIT_PER_HOUR`) và cả hệ thống (`AI_RATE_LIMIT_PER_DAY`). Đoán mật khẩu bị chặn tạm sau nhiều lần sai (theo IP và theo tên);
  khi đi qua Vercel, Caddy chỉ thấy IP của Vercel nên lớp theo tên mới là lớp chắc chắn.
- **Sao lưu có cả tài khoản và lịch sử học**: chúng nằm trong cùng database `practice` (bước 9).
- **Mật khẩu từng gõ vào khung chat** thì nằm trong lịch sử cuộc trò chuyện đó; nên đổi bằng chính lệnh `user:create` sau khi hệ thống chạy ổn.
- **Chưa kiểm** trên PostgreSQL thật và trên Docker: lần chạy đầu trên máy chủ chính là lần kiểm đầu tiên, nên theo dõi `docker compose logs -f app`.
