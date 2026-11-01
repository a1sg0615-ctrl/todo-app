export const E2E_DB_PORT = 27018;
export const E2E_DB_URI = `mongodb://127.0.0.1:${E2E_DB_PORT}/todo-e2e`;
export const MOCK_GITHUB_PORT = 3200;

// 기존 시나리오는 이 세션으로 로그인된 상태에서 실행한다. resetDb()가 매번 이 세션을 DB에 다시 넣는다.
export const E2E_SESSION_TOKEN = "e2e-session-token-0000000000000000000000000000000000000000000000";
export const E2E_USER = { githubId: 1, username: "e2e-user" };
