-- Tạo database và tài khoản RIÊNG cho Band 8.0 Practice trong PostgreSQL của SaleCheckIn.
-- Chạy MỘT lần, bằng tài khoản quản trị của PostgreSQL (chủ cụm là `salecheckin`):
--
--   PW=$(openssl rand -hex 24)        # ghi lại: đây là PG_PASSWORD trong .env của Practice English
--   docker compose -f /srv/salecheckin/compose.yaml exec -T db \
--     psql -U salecheckin -d postgres -v ON_ERROR_STOP=1 -v pw="'$PW'" < /srv/practice-english/deploy/provision-db.sql
--
-- Chỉ TẠO MỚI: không đụng tới database `salecheckin` (website) hay `tender`. Tài khoản practice_app không có
-- quyền gì ở các database kia (REVOKE CONNECT bên dưới, và database của họ đã tự khoá riêng).
-- Bản sao lưu đêm của SaleCheckIn chỉ dump database `salecheckin`, nên `practice` phải được thêm vào lịch dump
-- (docs/deploy.md, bước 9).

CREATE ROLE practice_app LOGIN PASSWORD :pw;
CREATE DATABASE practice OWNER practice_app ENCODING 'UTF8' LOCALE 'C.UTF-8' TEMPLATE template0;
REVOKE CONNECT ON DATABASE practice FROM PUBLIC;
