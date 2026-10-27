#!/usr/bin/env bash
#
# Phát hành một bản mới của Band 8.0 Practice trên máy chủ (compose.yaml).
# Mã đã nằm sẵn trong thư mục này nhờ `git push` (docs/deploy.md, bước 2), nên script KHÔNG tự lấy mã.
#
#   bash /srv/practice-english/deploy/docker-deploy.sh
#
# Thứ tự cố ý: kiểm tra điều kiện → DỰNG IMAGE → đổi container → chờ API thật trả lời.
# Dựng hỏng thì dừng ở đó và bản đang chạy không bị đụng tới.
set -euo pipefail

THU_MUC=${THU_MUC:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}
cd "$THU_MUC"

canh() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
loi()  { printf '\033[1;31m%s\033[0m\n' "$*" >&2; exit 1; }
doc_env() { sed -n "s/^$1=//p" .env | tail -n 1 | tr -d "\"' \r"; }

[[ -f .env ]] || loi "Chưa có ${THU_MUC}/.env — chép từ .env.example rồi điền PG_PASSWORD (docs/deploy.md, bước 4)."
[[ -n "$(doc_env PG_PASSWORD)" ]] || loi "PG_PASSWORD trong .env đang trống."

MANG=$(doc_env PG_NETWORK); MANG=${MANG:-salecheckin_default}

canh "1. Kiểm tra điều kiện"
docker network inspect "$MANG" >/dev/null 2>&1 \
  || loi "Không thấy mạng Docker '${MANG}'. SaleCheckIn phải đang chạy (docker compose ps ở thư mục của nó)."
echo "  Mạng ${MANG}: có."

canh "2. Dựng image"
# Giữ image đang chạy dưới tên `truoc` để còn đường quay lui ở bước 3.
if docker image inspect practice-english:latest >/dev/null 2>&1; then
  docker tag practice-english:latest practice-english:truoc
fi
docker compose build

canh "3. Đổi sang bản mới và chờ /api/exams/stats trả lời"
if docker compose up -d --wait --remove-orphans; then
  docker compose ps
  echo
  echo "XONG."
  exit 0
fi

echo "  HỎNG — dịch vụ không lên. Nhật ký 50 dòng cuối:" >&2
docker compose logs --tail 50 app >&2 || true
echo >&2
echo "Quay về bản cũ:  docker tag practice-english:truoc practice-english:latest && docker compose up -d --wait" >&2
exit 1
