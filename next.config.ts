import type { NextConfig } from 'next';

/**
 * Hai cách chạy, cùng một mã nguồn:
 *   - Đầy đủ (mặc định): giao diện + API + database (SQLite hoặc PostgreSQL) + chấm AI trong một ứng dụng.
 *     Đây là bản chạy trên máy chủ.
 *   - Chỉ giao diện (đặt API_ORIGIN khi DỰNG, ví dụ trên Vercel): mọi đường /api/* được chuyển thẳng
 *     tới máy chủ. Trình duyệt vẫn gọi cùng một tên miền nên không vướng CORS, và khoá AI, token quản trị,
 *     mật khẩu database không bao giờ nằm ở Vercel.
 */
const apiOrigin = process.env.API_ORIGIN?.replace(/\/$/, '');

const config: NextConfig = {
  reactStrictMode: true,
  // Docker dựng bản độc lập (nhỏ, có sẵn server.js). Chạy thường thì không cần.
  output: process.env.BUILD_STANDALONE === '1' ? 'standalone' : undefined,
  ...(apiOrigin
    ? {
        async rewrites() {
          // beforeFiles: ưu tiên hơn các route /api trong chính ứng dụng này.
          return { beforeFiles: [{ source: '/api/:path*', destination: `${apiOrigin}/api/:path*` }], afterFiles: [], fallback: [] };
        },
      }
    : {}),
};

export default config;
