import { AppError } from "./errors";

// 기본값은 실제 GitHub. E2E 테스트에서만 모의 서버 주소로 바꾼다.
// 운영(production)에서는 덮어쓰기를 무시해 client_secret이 다른 호스트로 가지 않게 한다.
const override = (value: string | undefined) => (process.env.NODE_ENV === "production" ? undefined : value);
const oauthBase = () => override(process.env.GITHUB_OAUTH_URL) ?? "https://github.com";
const apiBase = () => override(process.env.GITHUB_API_URL) ?? "https://api.github.com";

export interface GitHubProfile {
  githubId: number;
  username: string;
  avatarUrl: string;
}

/** client_id/secret은 환경 변수에서만 읽는다. */
export function githubCredentials(): { clientId: string; clientSecret: string } {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new AppError(500, "GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET 환경 변수가 설정되지 않았습니다");
  }
  return { clientId, clientSecret };
}

export function callbackUrl(req: Request): string {
  return process.env.GITHUB_CALLBACK_URL ?? new URL("/auth/github/callback", req.url).toString();
}

export function authorizeUrl(clientId: string, redirectUri: string, state: string): string {
  const url = new URL("/login/oauth/authorize", oauthBase());
  url.search = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, scope: "read:user", state }).toString();
  return url.toString();
}

/** 인증 코드를 액세스 토큰으로 바꾸고 GitHub 프로필을 가져온다. */
export async function fetchGitHubProfile(code: string, redirectUri: string): Promise<GitHubProfile> {
  const { clientId, clientSecret } = githubCredentials();

  const tokenRes = await fetch(new URL("/login/oauth/access_token", oauthBase()), {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code, redirect_uri: redirectUri }),
  });
  const token = (await tokenRes.json().catch(() => ({}))) as { access_token?: string; error?: string };
  if (!tokenRes.ok || !token.access_token) {
    throw new Error(`GitHub 토큰 교환 실패: ${token.error ?? tokenRes.status}`);
  }

  const userRes = await fetch(new URL("/user", apiBase()), {
    headers: { Authorization: `Bearer ${token.access_token}`, Accept: "application/vnd.github+json", "User-Agent": "todo-app" },
  });
  if (!userRes.ok) throw new Error(`GitHub 사용자 조회 실패: ${userRes.status}`);
  const user = (await userRes.json()) as { id: number; login: string; avatar_url?: string };
  return { githubId: user.id, username: user.login, avatarUrl: user.avatar_url ?? "" };
}
