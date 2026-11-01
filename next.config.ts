import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // E2E 서버는 별도 폴더를 써서 실행 중인 `npm run dev`(.next)와 충돌하지 않게 한다.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
};

export default nextConfig;
