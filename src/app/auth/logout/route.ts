import { NextResponse } from "next/server";
import { clearSessionCookie, destroySession } from "@/lib/auth";
import { connectDB } from "@/lib/db";

/** 로그아웃: DB의 세션 문서를 지우고 세션 쿠키를 만료시킨다. */
export async function POST(req: Request) {
  try {
    await connectDB();
    await destroySession(req);
  } catch (err) {
    // DB 오류가 나도 쿠키는 지워 브라우저에서는 로그아웃되게 한다.
    console.error(err);
  }
  const res = NextResponse.redirect(new URL("/login", req.url), 303);
  clearSessionCookie(res, req);
  return res;
}
