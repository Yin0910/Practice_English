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
                                                └─► SQLite trong volume Docker `practice_data`
                                                     (RIÊNG — không chạm CSDL của SaleCheckIn)
```

Nhận mã bằng `git push` qua SSH, như tender-intelligence. Khác tender-intelligence ở chỗ **không dùng PostgreSQL của SaleCheckIn**:
ứng dụng này ít người dùng và ghi nhẹ nên SQLite trong volume riêng là đủ. Container chỉ đứng chung mạng Docker `salecheckin_default`
để Caddy của SaleCheckIn *định tuyến* tới nó bằng bí danh `practice-app` — không phải để chung CSDL.

## Việc nào chạm vào hệ thống đang chạy thật

Chỉ có các việc dưới đây. Mọi thứ còn lại nằm trong thư mục `/srv/practice-english` mới, container mới và volume mới.

| # | Việc | Chạm vào | Hoàn tác |
|---|---|---|---|
| 5 | Thêm một khối vào `deploy/Caddyfile` của SaleCheckIn rồi `caddy reload` | Caddy phục vụ app, website, báo cáo | xoá khối, `caddy reload` |

Đúng một việc chạm vào hạ tầng dùng chung. Không tạo database hay role nào trên PostgreSQL của SaleCheckIn, không đụng lịch sao lưu của nó,
không có bản ghi DNS nào phải thêm hay xoá (xem bước 1). Container mới bị giới hạn **512 MB RAM, 1 CPU** vì máy chủ 4 CPU / 8 GB còn chạy
website, CSDL và báo cáo của dự án khác.

## 1. Tên miền

Hai tên, không cái nào cần cấu hình DNS tay:

| Dùng cho | Tên | Vì sao không cần DNS |
|---|---|---|
| Giao diện (Vercel) | tên mặc định Vercel cấp, dạng `practice-english-xxxx.vercel.app` | Vercel tự gán khi Import project (bước 8) |
| API (máy chủ) | `ielts-api.27-71-26-215.sslip.io` | sslip.io tự phân giải ra IP ghi ngay trong tên (ở đây là `27.71.26.215`); đổi IP máy chủ thì đổi luôn tên này |

Không có bước "tạo bản ghi DNS" nào ở đây. Kiểm tên API phân giải đúng: `nslookup ielts-api.27-71-26-215.sslip.io` phải ra `27.71.26.215`.

## 2. Đưa mã lên máy chủ (git push qua SSH, như tender-intelligence)

```bash
# Máy chủ: tạo kho nhận mã (tổ chức GitHub tắt Deploy keys nên đẩy trực tiếp từ máy phát triển)
ssh root@27.71.26.215 'mkdir -p /srv/practice-english && cd /srv/practice-english \
  && git init -q -b main && git config receive.denyCurrentBranch updateInstead'

# Máy phát triển, trong thư mục Website_PracticeEnglish (đã git init và commit):
git push ssh://root@27.71.26.215/srv/practice-english main:main
```

Kiểm: `ssh root@27.71.26.215 'ls /srv/practice-english'` thấy `compose.yaml`, `Dockerfile`, `deploy/`, `db/seed/`.

## 3. Cấu hình `.env` trên máy chủ

```bash
cd /srv/practice-english && cp .env.example .env && nano .env
```

Điền: `ADMIN_TOKEN` (`openssl rand -hex 24`), `ANTHROPIC_API_KEY` (**tự dán vào file này**, không gửi qua chat/tin nhắn). Không có mục
database nào phải điền — SQLite tự tạo trong volume. File `.env` không lên git.

## 4. Dựng và chạy

```bash
cd /srv/practice-english && bash deploy/docker-deploy.sh
```

Lần đầu, ứng dụng thấy volume `practice_data` trống nên tự tạo `exams.db` và nạp `db/seed/*.json` (62 đề). Kiểm:

```bash
docker compose logs --tail 30 app                      # không có lỗi "Không mở được database"
docker compose exec app node -e "fetch('http://127.0.0.1:3000/api/exams/stats').then(r=>r.json()).then(console.log)"
# mong đợi: total 62, bySkill {reading 4, listening 4, writing 24, speaking 30}
```

## 5. HTTPS cho API (Caddy của SaleCheckIn)

1. `deploy/caddy-api.snippet` đã dùng sẵn `ielts-api.27-71-26-215.sslip.io`; đổi lại chỉ nếu IP máy chủ khác.
2. Dán khối đó vào `deploy/Caddyfile` **của kho SaleCheckIn** (cạnh khối `report.namlinhpharma.com`) và **commit vào kho SaleCheckIn**:
   khối dán tay trên máy chủ sẽ mất khi `docker-deploy.sh` của SaleCheckIn chạy `git reset --hard`.
3. Trên máy chủ, kiểm rồi nạp lại (reload, không restart nên các site khác không gián đoạn):

```bash
cd /srv/salecheckin
docker compose exec caddy caddy validate --config /etc/caddy/Caddyfile
docker compose exec caddy caddy reload   --config /etc/caddy/Caddyfile
```

Kiểm: `curl -s https://ielts-api.27-71-26-215.sslip.io/api/exams/stats` ra JSON. Kiểm tiếp các site cũ vẫn lên (khối này không đụng tới chúng):
`curl -sI https://app.namlinh.com | head -1`, `curl -sI https://report.namlinhpharma.com | head -1`, `curl -sI https://namlinhpharma.com | head -1`.

## 6. Tạo hai tài khoản đăng nhập

Không có đăng ký công khai: chỉ hai tài khoản **`zitconlonton`** và **`yinhocielts`**, tạo bằng script. Mật khẩu được **hỏi ẩn khi chạy** (gõ hai lần), không nằm trong lệnh, trong git hay trong file nào;
database chỉ lưu bản băm. Chạy từ máy phát triển, trỏ vào API trên máy chủ (cần `ADMIN_TOKEN` ở bước 3):

```bash
npm run user:create -- zitconlonton --url https://ielts-api.27-71-26-215.sslip.io --token <ADMIN_TOKEN>
npm run user:create -- yinhocielts  --url https://ielts-api.27-71-26-215.sslip.io --token <ADMIN_TOKEN>
```

Mỗi lệnh in "Đã tạo tài khoản ...". Chạy lại với tên đã có là **đặt lại mật khẩu** (và đăng xuất các phiên đang mở). Việc này chỉ ghi vào volume `practice_data`.

## 7. Thử API từ ngoài

```bash
curl -s https://ielts-api.27-71-26-215.sslip.io/api/exams/stats                                 # công khai: ra JSON
curl -s -w ' [%{http_code}]\n' "https://ielts-api.27-71-26-215.sslip.io/api/exams?skill=reading"  # chưa đăng nhập: phải [401]
curl -s -w ' [%{http_code}]\n' -X POST https://ielts-api.27-71-26-215.sslip.io/api/exams/import -H 'content-type: application/json' -d '[]'   # phải [401]
```

Hai dòng sau phải trả **401**: đề và API ghi đang đòi đăng nhập/token. Nếu không phải 401, dừng lại và đừng tiếp tục.

## 8. Vercel (giao diện)

1. Đẩy mã lên một kho GitHub (riêng tư) để Vercel đọc, rồi **Import** kho đó trong Vercel.
2. Settings → Environment Variables: **`API_ORIGIN=https://ielts-api.27-71-26-215.sslip.io`** (Production và Preview). Phải đặt **trước** lần dựng: rewrite được cố định lúc build; đổi sau thì Redeploy.
3. **Không** đặt `ANTHROPIC_API_KEY`, `ADMIN_TOKEN` ở Vercel (không có database nào để đặt `DATABASE_URL`).
4. Không cần mục Domains: dùng luôn tên mặc định Vercel cấp sau khi dựng xong (dạng `practice-english-xxxx.vercel.app`), không đụng `namlinh.com`.

Kiểm: mở tên `*.vercel.app` đó, bấm Đăng nhập bằng một trong hai tài khoản, vào Reading, làm và nộp một đề: kết quả đến từ máy chủ và buổi vừa làm hiện trong Tổng quan.
Đăng xuất rồi đăng nhập lại (hoặc đổi trình duyệt): lịch sử còn nguyên. Trang chủ phải hiện "62 đề".

**Cookie đăng nhập đi qua Vercel**: trình duyệt chỉ nói chuyện với tên miền Vercel, Vercel chuyển `/api/*` về máy chủ. Cookie phiên được đặt cờ `Secure` nhờ header `X-Forwarded-Proto`
(Caddy gửi), nên cần HTTPS cả hai chặng, vốn đã đúng ở cách làm này. **Chưa kiểm trên Vercel thật**: nếu đăng nhập báo thành công nhưng tải lại trang lại bị đá về đăng nhập, kiểm tra header `Set-Cookie` ở tab Network trước tiên.

## 9. Sao lưu

Dữ liệu (tài khoản, lịch sử học, tiến độ từ vựng, đề) nằm trong volume Docker `practice_data`, **tách hẳn khỏi** lịch dump đêm của
SaleCheckIn (lịch đó chỉ dump database `salecheckin` của nó, không liên quan). Sao lưu file SQLite bằng lệnh `.backup` của chính nó (an toàn
ngay cả khi ứng dụng đang ghi, không cần dừng container):

```bash
mkdir -p /var/backups/practice-english
docker compose -f /srv/practice-english/compose.yaml exec -T app \
  node -e "require('node:sqlite').DatabaseSync.prototype.constructor; const {DatabaseSync}=require('node:sqlite'); new DatabaseSync('/app/data/exams.db').exec(\"VACUUM INTO '/app/data/backup-$(date +%F).db'\")"
docker cp practice-english-app-1:/app/data/backup-$(date +%F).db /var/backups/practice-english/
docker compose -f /srv/practice-english/compose.yaml exec -T app rm /app/data/backup-$(date +%F).db
```

Đặt làm việc hằng ngày bằng `cron` (ví dụ `/etc/cron.daily/practice-english-backup`, tương tự cách SaleCheckIn đã làm cho chính nó) và dọn bản cũ sau một thời gian.
Đề tự soạn nằm trong `db/seed/*.json` trong git nên luôn dựng lại được; **đề nhập thêm qua API, tài khoản và lịch sử học thì chỉ có trong volume này**, nên bản sao lưu ở trên là chỗ duy nhất giữ được chúng.

## 10. Cập nhật về sau

```bash
git push ssh://root@27.71.26.215/srv/practice-english main:main     # từ máy phát triển
ssh root@27.71.26.215 'bash /srv/practice-english/deploy/docker-deploy.sh'
```

Thêm đề không cần dựng lại: `POST /api/exams/import` kèm token (xem README). Lên Vercel thì `git push` lên kho GitHub là tự phát hành.

## 11. Quay lui và gỡ bỏ

- **Bản mới hỏng**: script in sẵn lệnh quay về `practice-english:truoc`.
- **Gỡ hẳn**: xoá khối Caddy rồi `caddy reload`; `cd /srv/practice-english && docker compose down` (**không** `-v`, trừ khi thật sự muốn xoá
  sạch tài khoản và lịch sử học); xoá dự án Vercel (không có bản ghi DNS nào để xoá).

## Lưu ý

- **Chấm AI chỉ dành cho người đã đăng nhập**, giới hạn theo từng tài khoản (`AI_RATE_LIMIT_PER_HOUR`) và cả hệ thống (`AI_RATE_LIMIT_PER_DAY`). Đoán mật khẩu bị chặn tạm sau nhiều lần sai (theo IP và theo tên);
  khi đi qua Vercel, Caddy chỉ thấy IP của Vercel nên lớp theo tên mới là lớp chắc chắn.
- **Dữ liệu tách hoàn toàn khỏi SaleCheckIn**: volume `practice_data` riêng, không role hay database nào trên PostgreSQL của SaleCheckIn, không chung lịch sao lưu.
- **Mật khẩu từng gõ vào khung chat** thì nằm trong lịch sử cuộc trò chuyện đó; nên đổi bằng chính lệnh `user:create` sau khi hệ thống chạy ổn.
- **Chưa kiểm trên Docker thật**: lần chạy đầu trên máy chủ chính là lần kiểm đầu tiên, nên theo dõi `docker compose logs -f app`.
