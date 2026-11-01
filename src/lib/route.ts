import { NextResponse } from "next/server";
import { requireUserId } from "./auth";
import { connectDB } from "./db";
import { AppError } from "./errors";

export type IdContext = { params: Promise<{ id: string }> };

function toErrorResponse(err: unknown): NextResponse {
  if (err instanceof AppError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  if (err instanceof SyntaxError) {
    return NextResponse.json({ error: "요청 본문이 올바른 JSON이 아닙니다" }, { status: 400 });
  }
  console.error(err);
  return NextResponse.json({ error: "서버 오류가 발생했습니다" }, { status: 500 });
}

/** DB 연결과 오류 응답 변환을 맡는 Route Handler 래퍼 */
export function route<A extends unknown[]>(handler: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      await connectDB();
      return await handler(...args);
    } catch (err) {
      return toErrorResponse(err);
    }
  };
}

/** route()에 로그인 확인을 더한 래퍼. 세션이 없으면 401, 있으면 userId를 첫 인자로 넘긴다. */
export function authRoute<A extends unknown[]>(
  handler: (userId: string, req: Request, ...rest: A) => Promise<Response>,
) {
  return route(async (req: Request, ...rest: A) => handler(await requireUserId(req), req, ...rest));
}

export const noContent = () => new NextResponse(null, { status: 204 });
