import { defineConfig, devices } from "@playwright/test";
import { E2E_DB_PORT, E2E_DB_URI, E2E_SESSION_TOKEN, MOCK_GITHUB_PORT } from "./tests/e2e/env";

const PORT = 3100;
const MOCK_GITHUB = `http://localhost:${MOCK_GITHUB_PORT}`;

export default defineConfig({
  testDir: "tests/e2e",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  workers: 1, // 모든 테스트가 하나의 DB를 쓰므로 순서대로 실행한다.
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    // 기본은 로그인된 상태. auth.spec.ts는 쿠키 없이 시작한다.
    storageState: {
      cookies: [
        {
          name: "session",
          value: E2E_SESSION_TOKEN,
          domain: "localhost",
          path: "/",
          expires: -1,
          httpOnly: true,
          secure: false,
          sameSite: "Lax",
        },
      ],
      origins: [],
    },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: `node scripts/dev-db.mjs --port ${E2E_DB_PORT} --ephemeral`,
      port: E2E_DB_PORT,
      timeout: 120_000,
      reuseExistingServer: false,
    },
    {
      command: `node tests/e2e/mock-github.mjs ${MOCK_GITHUB_PORT}`,
      url: `${MOCK_GITHUB}/health`,
      timeout: 30_000,
      reuseExistingServer: false,
    },
    {
      command: `npx next dev -p ${PORT}`,
      url: `http://localhost:${PORT}/api/health`,
      env: {
        MONGODB_URI: E2E_DB_URI,
        NEXT_DIST_DIR: ".next-e2e",
        GITHUB_CLIENT_ID: "e2e-client-id",
        GITHUB_CLIENT_SECRET: "e2e-client-secret",
        GITHUB_OAUTH_URL: MOCK_GITHUB,
        GITHUB_API_URL: MOCK_GITHUB,
      },
      timeout: 180_000,
      reuseExistingServer: false,
    },
  ],
});
