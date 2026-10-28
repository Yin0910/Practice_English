# Image của Band 8.0 Practice: giao diện + API + chấm AI trong MỘT ứng dụng Next.js.
# Database là SQLite trong volume riêng (compose.yaml) — image chỉ chứa mã, không chứa dữ liệu hay .env.
#
#   docker compose up -d --build        (quy trình đủ: README, mục "Triển khai")

ARG NODE_VERSION=24

FROM node:${NODE_VERSION}-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1


# --- Phụ thuộc: chỉ để DỰNG ---------------------------------------------------
FROM base AS deps
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund


# --- Dựng (cần mạng: next/font tải font Google lúc dựng) ----------------------
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Bản độc lập: nhỏ, có sẵn server.js, chỉ mang theo thư viện thật sự dùng tới.
ENV BUILD_STANDALONE=1
RUN npm run build


# --- Chạy ---------------------------------------------------------------------
FROM base AS run
ENV NODE_ENV=production
ENV PORT=3000
# Docker tự đặt HOSTNAME = mã container và server.js nghe đúng tên đó; ép về 0.0.0.0 để cổng được map ra.
ENV HOSTNAME=0.0.0.0

COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
# Bộ đề mẫu (nạp vào database trống lần đầu) và script nhập đề: server.js đọc chúng lúc chạy nên phải chép riêng.
COPY --from=build --chown=node:node /app/db ./db
COPY --from=build --chown=node:node /app/scripts ./scripts

# Thư mục cho database SQLite (compose.yaml gắn volume vào đây). Tạo sẵn và cho user `node` làm chủ:
# volume Docker đặt ở đây lần đầu sẽ kế thừa đúng quyền này, nếu không container chạy bằng `node`
# (không phải root, xem USER bên dưới) sẽ không ghi được và sqlite báo "unable to open database file".
RUN mkdir -p /app/data && chown node:node /app/data

USER node
EXPOSE 3000
CMD ["node", "server.js"]
