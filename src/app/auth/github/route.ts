import { NextResponse } from "next/server";
import { isHttps, randomToken } from "@/lib/auth";
import { authorizeUrl, callbackUrl, githubCredentials } from "@/lib/github";
import { OAUTH_STATE_COOKIE } from "@/lib/session-cookie";

/** GitHub 로그인 시작: CSRF 방지용 state를 쿠키에 담고 GitHub 인증 화면으로 보낸다. */
export async function GET(req: Request) {
  let clientId: string;
  try {
    clientId = githubCredentials().clientId;
  } catch (err) {
    console.error(err);
    return NextResponse.redirect(new URL("/login?error=config", req.url));
  }

  const state = randomToken();
  const res = NextResponse.redirect(authorizeUrl(clientId, callbackUrl(req), state));
  res.cookies.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: isHttps(req),
    path: "/auth/github",
    maxAge: 600,
  });
  return res;
}
