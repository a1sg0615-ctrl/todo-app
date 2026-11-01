import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/session-cookie";

// 세션 쿠키가 없으면 화면 대신 로그인 페이지로 보낸다.
// 쿠키가 있어도 만료·위조일 수 있으므로 실제 확인은 API(401)가 하고, 401이면 화면이 /login으로 보낸다.
export function middleware(req: NextRequest) {
  if (req.cookies.has(SESSION_COOKIE)) return NextResponse.next();
  return NextResponse.redirect(new URL("/login", req.url));
}

export const config = {
  matcher: ["/", "/board/:path*", "/tasks/:path*", "/weekly/:path*", "/yearly/:path*"],
};
