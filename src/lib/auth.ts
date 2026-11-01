import { createHash, randomBytes } from "node:crypto";
import type { NextResponse } from "next/server";
import { Session } from "@/models/Session";
import { unauthorized } from "./errors";
import { SESSION_COOKIE } from "./session-cookie";

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30일

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
export const randomToken = () => randomBytes(32).toString("hex");

export function readCookie(req: Request, name: string): string | undefined {
  for (const part of (req.headers.get("cookie") ?? "").split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return undefined;
}

/** https로 접속했을 때만 Secure 쿠키를 쓴다 (로컬 http 개발과 LAN 접속을 위해). */
export const isHttps = (req: Request) => new URL(req.url).protocol === "https:";

export async function createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await Session.create({ tokenHash: hashToken(token), userId, expiresAt });
  return { token, expiresAt };
}

async function getSessionUserId(req: Request): Promise<string | null> {
  const token = readCookie(req, SESSION_COOKIE);
  if (!token) return null;
  const session = await Session.findOne({ tokenHash: hashToken(token), expiresAt: { $gt: new Date() } }).lean();
  return session ? session.userId.toString() : null;
}

export async function requireUserId(req: Request): Promise<string> {
  const userId = await getSessionUserId(req);
  if (!userId) throw unauthorized();
  return userId;
}

/** 요청 쿠키의 세션을 DB에서 지운다. */
export async function destroySession(req: Request): Promise<void> {
  const token = readCookie(req, SESSION_COOKIE);
  if (token) await Session.deleteOne({ tokenHash: hashToken(token) });
}

export function setSessionCookie(res: NextResponse, req: Request, token: string, expires: Date) {
  res.cookies.set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: isHttps(req), path: "/", expires });
}

export function clearSessionCookie(res: NextResponse, req: Request) {
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, sameSite: "lax", secure: isHttps(req), path: "/", maxAge: 0 });
}
