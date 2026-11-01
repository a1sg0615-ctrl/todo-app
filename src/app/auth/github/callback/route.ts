import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createSession, destroySession, isHttps, readCookie, setSessionCookie } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { callbackUrl, fetchGitHubProfile } from "@/lib/github";
import { OAUTH_STATE_COOKIE } from "@/lib/session-cookie";
import { upsertGitHubUser } from "@/services/users";

function sameState(a: string | null, b: string | undefined): boolean {
  if (!a || !b || a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

function redirect(req: Request, path: string): NextResponse {
  const res = NextResponse.redirect(new URL(path, req.url));
  // state는 한 번만 쓴다.
  res.cookies.set(OAUTH_STATE_COOKIE, "", { httpOnly: true, secure: isHttps(req), path: "/auth/github", maxAge: 0 });
  return res;
}

/** GitHub가 돌려보낸 code로 사용자 정보를 받아 저장하고 세션을 만든다. */
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  if (params.get("error")) return redirect(req, "/login?error=denied");
  if (!sameState(params.get("state"), readCookie(req, OAUTH_STATE_COOKIE))) {
    return redirect(req, "/login?error=state");
  }
  const code = params.get("code");
  if (!code) return redirect(req, "/login?error=code");

  try {
    await connectDB();
    const user = await upsertGitHubUser(await fetchGitHubProfile(code, callbackUrl(req)));
    // 이미 로그인된 브라우저라면 이전 세션은 지우고 새로 만든다.
    await destroySession(req);
    const { token, expiresAt } = await createSession(user.id);
    const res = redirect(req, "/board");
    setSessionCookie(res, req, token, expiresAt);
    return res;
  } catch (err) {
    console.error(err);
    return redirect(req, "/login?error=github");
  }
}
