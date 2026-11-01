import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import mongoose, { Types } from "mongoose";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as callbackRoute from "@/app/auth/github/callback/route";
import * as githubRoute from "@/app/auth/github/route";
import * as logoutRoute from "@/app/auth/logout/route";
import * as meRoute from "@/app/api/me/route";
import * as tasksRoute from "@/app/api/tasks/route";
import * as taskRoute from "@/app/api/tasks/[id]/route";
import * as reorderRoute from "@/app/api/tasks/reorder/route";
import * as weeklyPlansRoute from "@/app/api/weekly-plans/route";
import * as weeklyPlanRoute from "@/app/api/weekly-plans/[id]/route";
import * as yearlyGoalsRoute from "@/app/api/yearly-goals/route";
import * as yearlyGoalRoute from "@/app/api/yearly-goals/[id]/route";
import { createSession, hashToken } from "@/lib/auth";
import { Session } from "@/models/Session";
import { User } from "@/models/User";
import { migrateUserId } from "../../scripts/migrate-user-id.mjs";

const MON = "2026-10-26";
const SUN = "2026-11-01";
const SOME_ID = "64b000000000000000000000";

const req = (method: string, url: string, { token, body, cookie }: { token?: string; body?: unknown; cookie?: string } = {}) =>
  new Request(`http://localhost${url}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token || cookie ? { Cookie: cookie ?? `session=${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

async function login(githubId: number, username: string) {
  const user = await User.create({ githubId, username });
  return { id: user._id.toString(), token: (await createSession(user._id.toString())).token };
}

describe("인증 없는 요청", () => {
  it("모든 할 일/주간 계획/1년 목표 API가 401이다", async () => {
    const calls: Promise<Response>[] = [
      tasksRoute.GET(req("GET", "/api/tasks")),
      tasksRoute.POST(req("POST", "/api/tasks", { body: { title: "t", date: MON } })),
      taskRoute.PATCH(req("PATCH", "/"), ctx(SOME_ID)),
      taskRoute.DELETE(req("DELETE", "/"), ctx(SOME_ID)),
      reorderRoute.POST(req("POST", "/", { body: { ids: [SOME_ID] } })),
      weeklyPlansRoute.GET(req("GET", "/api/weekly-plans")),
      weeklyPlansRoute.POST(req("POST", "/", { body: {} })),
      weeklyPlanRoute.GET(req("GET", "/"), ctx(SOME_ID)),
      weeklyPlanRoute.PATCH(req("PATCH", "/"), ctx(SOME_ID)),
      weeklyPlanRoute.DELETE(req("DELETE", "/"), ctx(SOME_ID)),
      yearlyGoalsRoute.GET(req("GET", "/")),
      yearlyGoalsRoute.POST(req("POST", "/", { body: {} })),
      yearlyGoalRoute.GET(req("GET", "/"), ctx(SOME_ID)),
      yearlyGoalRoute.PATCH(req("PATCH", "/"), ctx(SOME_ID)),
      yearlyGoalRoute.DELETE(req("DELETE", "/"), ctx(SOME_ID)),
      meRoute.GET(req("GET", "/api/me")),
    ];
    for (const res of await Promise.all(calls)) expect(res.status).toBe(401);
  });

  it("존재하지 않거나 만료된 세션 토큰도 401이다", async () => {
    expect((await tasksRoute.GET(req("GET", "/api/tasks", { token: "forged" }))).status).toBe(401);

    const { id } = await login(1, "a");
    const token = "expired-token";
    await Session.create({ tokenHash: hashToken(token), userId: id, expiresAt: new Date(Date.now() - 1000) });
    expect((await tasksRoute.GET(req("GET", "/api/tasks", { token }))).status).toBe(401);
  });
});

describe("사용자별 데이터 범위", () => {
  it("다른 사용자의 할 일은 보이지 않고 수정/삭제하면 404다", async () => {
    const a = await login(1, "alice");
    const b = await login(2, "bob");
    const task = await (await tasksRoute.POST(req("POST", "/", { token: a.token, body: { title: "A 할 일", date: MON } }))).json();

    const bList = await (await tasksRoute.GET(req("GET", "/api/tasks", { token: b.token }))).json();
    expect(bList).toEqual([]);
    expect((await taskRoute.PATCH(req("PATCH", "/", { token: b.token, body: { status: "done" } }), ctx(task.id))).status).toBe(404);
    expect((await taskRoute.DELETE(req("DELETE", "/", { token: b.token }), ctx(task.id))).status).toBe(404);
    expect((await reorderRoute.POST(req("POST", "/", { token: b.token, body: { ids: [task.id] } }))).status).toBe(400);

    const aList = await (await tasksRoute.GET(req("GET", "/api/tasks", { token: a.token }))).json();
    expect(aList).toEqual([expect.objectContaining({ id: task.id, status: "todo" })]);
  });

  it("다른 사용자의 주간 계획/1년 목표에는 연결할 수 없고 조회·수정·삭제하면 404다", async () => {
    const a = await login(1, "alice");
    const b = await login(2, "bob");
    const goal = await (await yearlyGoalsRoute.POST(req("POST", "/", { token: a.token, body: { title: "g", year: 2026 } }))).json();
    const plan = await (
      await weeklyPlansRoute.POST(req("POST", "/", { token: a.token, body: { title: "p", startDate: MON, endDate: SUN } }))
    ).json();

    expect((await tasksRoute.POST(req("POST", "/", { token: b.token, body: { title: "t", date: MON, weeklyPlanId: plan.id } }))).status).toBe(400);
    expect(
      (await weeklyPlansRoute.POST(req("POST", "/", { token: b.token, body: { title: "p", startDate: MON, endDate: SUN, yearlyGoalId: goal.id } })))
        .status,
    ).toBe(400);

    expect((await weeklyPlanRoute.GET(req("GET", "/", { token: b.token }), ctx(plan.id))).status).toBe(404);
    expect((await weeklyPlanRoute.PATCH(req("PATCH", "/", { token: b.token, body: { title: "x" } }), ctx(plan.id))).status).toBe(404);
    expect((await weeklyPlanRoute.DELETE(req("DELETE", "/", { token: b.token }), ctx(plan.id))).status).toBe(404);
    expect((await yearlyGoalRoute.GET(req("GET", "/", { token: b.token }), ctx(goal.id))).status).toBe(404);
    expect((await yearlyGoalRoute.PATCH(req("PATCH", "/", { token: b.token, body: { title: "x" } }), ctx(goal.id))).status).toBe(404);
    expect((await yearlyGoalRoute.DELETE(req("DELETE", "/", { token: b.token }), ctx(goal.id))).status).toBe(404);
    expect(await (await weeklyPlansRoute.GET(req("GET", "/", { token: b.token }))).json()).toEqual([]);
    expect(await (await yearlyGoalsRoute.GET(req("GET", "/", { token: b.token }))).json()).toEqual([]);
  });

  it("서로 다른 사용자는 같은 주에 각자 주간 계획을 만들고, 같은 사용자는 409다", async () => {
    const a = await login(1, "alice");
    const b = await login(2, "bob");
    const body = { title: "p", startDate: MON, endDate: SUN };
    expect((await weeklyPlansRoute.POST(req("POST", "/", { token: a.token, body }))).status).toBe(201);
    expect((await weeklyPlansRoute.POST(req("POST", "/", { token: b.token, body }))).status).toBe(201);
    expect((await weeklyPlansRoute.POST(req("POST", "/", { token: a.token, body }))).status).toBe(409);
  });
});

describe("GitHub OAuth", () => {
  beforeEach(() => {
    vi.stubEnv("GITHUB_CLIENT_ID", "test-client-id");
    vi.stubEnv("GITHUB_CLIENT_SECRET", "test-client-secret");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("/auth/github는 state 쿠키를 설정하고 GitHub authorize로 302 리다이렉트한다", async () => {
    const res = await githubRoute.GET(req("GET", "/auth/github"));
    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("location")!);
    expect(location.origin + location.pathname).toBe("https://github.com/login/oauth/authorize");
    expect(location.searchParams.get("client_id")).toBe("test-client-id");
    expect(location.searchParams.get("redirect_uri")).toBe("http://localhost/auth/github/callback");
    const state = location.searchParams.get("state");
    expect(state).toMatch(/^[0-9a-f]{64}$/);
    const cookie = res.headers.get("set-cookie")!;
    expect(cookie).toContain(`oauth_state=${state}`);
    expect(cookie.toLowerCase()).toContain("httponly");
    expect(location.toString()).not.toContain("test-client-secret");
  });

  it("환경 변수가 없으면 /login?error=config로 보낸다", async () => {
    vi.stubEnv("GITHUB_CLIENT_SECRET", "");
    const res = await githubRoute.GET(req("GET", "/auth/github"));
    expect(res.headers.get("location")).toBe("http://localhost/login?error=config");
  });

  it("state가 쿠키와 다르거나 없으면 세션을 만들지 않는다", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    for (const cookie of ["oauth_state=other", undefined]) {
      const res = await callbackRoute.GET(req("GET", "/auth/github/callback?code=c&state=expected", { cookie }));
      expect(res.headers.get("location")).toBe("http://localhost/login?error=state");
    }
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await Session.countDocuments()).toBe(0);
  });

  it("사용자가 거부하면 /login?error=denied", async () => {
    const res = await callbackRoute.GET(req("GET", "/auth/github/callback?error=access_denied&state=s", { cookie: "oauth_state=s" }));
    expect(res.headers.get("location")).toBe("http://localhost/login?error=denied");
  });

  it("성공하면 username/avatar_url을 저장(재로그인 시 갱신)하고 해시된 세션과 httpOnly 쿠키를 만든다", async () => {
    let login = "octocat";
    const fetchMock = vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "https://github.com/login/oauth/access_token") {
        const body = JSON.parse(String(init!.body));
        expect(body).toMatchObject({ client_id: "test-client-id", client_secret: "test-client-secret", code: "good-code" });
        return Response.json({ access_token: "gho_test" });
      }
      if (url === "https://api.github.com/user") {
        expect((init!.headers as Record<string, string>).Authorization).toBe("Bearer gho_test");
        return Response.json({ id: 583231, login, avatar_url: "https://avatars.githubusercontent.com/u/583231" });
      }
      throw new Error(`unexpected fetch ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const callback = () =>
      callbackRoute.GET(req("GET", "/auth/github/callback?code=good-code&state=s1", { cookie: "oauth_state=s1" }));
    const res = await callback();
    expect(res.headers.get("location")).toBe("http://localhost/board");

    const users = await User.find().lean();
    expect(users).toHaveLength(1);
    expect(users[0]).toMatchObject({ githubId: 583231, username: "octocat", avatarUrl: "https://avatars.githubusercontent.com/u/583231" });

    const setCookie = res.headers.get("set-cookie")!;
    const token = /session=([0-9a-f]{64})/.exec(setCookie)![1];
    expect(setCookie.toLowerCase()).toContain("httponly");
    const session = await Session.findOne().lean();
    expect(session!.tokenHash).toBe(hashToken(token));
    expect(session!.tokenHash).not.toBe(token);
    expect(session!.expiresAt.getTime()).toBeGreaterThan(Date.now());

    const me = await (await meRoute.GET(req("GET", "/api/me", { token }))).json();
    expect(me).toEqual({ id: users[0]._id.toString(), username: "octocat", avatarUrl: "https://avatars.githubusercontent.com/u/583231" });

    // 같은 GitHub 계정으로 다시 로그인하면 사용자를 새로 만들지 않고 username만 갱신한다.
    login = "octocat-renamed";
    await callback();
    expect(await User.countDocuments()).toBe(1);
    expect((await User.findOne().lean())!.username).toBe("octocat-renamed");
  });

  it("GitHub 토큰 교환이 실패하면 /login?error=github", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: "bad_verification_code" })));
    const res = await callbackRoute.GET(req("GET", "/auth/github/callback?code=bad&state=s", { cookie: "oauth_state=s" }));
    expect(res.headers.get("location")).toBe("http://localhost/login?error=github");
    expect(await User.countDocuments()).toBe(0);
  });

  it("세션 컬렉션에 만료 TTL 인덱스가 있다", async () => {
    const indexes = await Session.collection.indexes();
    expect(indexes).toContainEqual(expect.objectContaining({ key: { expiresAt: 1 }, expireAfterSeconds: 0 }));
  });
});

describe("로그아웃", () => {
  it("DB 세션을 지우고 쿠키를 만료시키며, 이후 같은 토큰은 401이다", async () => {
    const { token } = await login(1, "alice");
    expect((await tasksRoute.GET(req("GET", "/api/tasks", { token }))).status).toBe(200);

    const res = await logoutRoute.POST(req("POST", "/auth/logout", { token }));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("http://localhost/login");
    expect(res.headers.get("set-cookie")).toMatch(/session=;.*Max-Age=0/i);
    expect(await Session.countDocuments({ tokenHash: hashToken(token) })).toBe(0);
    expect((await tasksRoute.GET(req("GET", "/api/tasks", { token }))).status).toBe(401);
  });
});

describe("client_secret 하드코딩 금지", () => {
  it("src 안에 GitHub client_secret 값이나 gho_ 토큰이 없다", () => {
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const p = path.join(dir, name);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.(ts|tsx|mjs)$/.test(name)) files.push(p);
      }
    };
    walk(path.resolve(__dirname, "../../src"));
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      expect(text, file).not.toMatch(/client_secret\s*[:=]\s*["'][^"']+["']/);
      expect(text, file).not.toMatch(/gho_[A-Za-z0-9]{10,}/);
    }
  });
});

describe("userId 마이그레이션", () => {
  it("소유자 없는 문서를 지정 사용자에게 할당하고, startDate_1 인덱스를 제거하며, 재실행해도 안전하다", async () => {
    const db = mongoose.connection.db!;
    const user = await User.create({ githubId: 7, username: "owner" });
    const other = new Types.ObjectId();

    // 로그인 도입 전 형태의 데이터와 인덱스
    await db.collection("weeklyplans").dropIndexes().catch(() => {});
    await db.collection("weeklyplans").createIndex({ startDate: 1 }, { unique: true });
    await db.collection("tasks").insertMany([
      { title: "old 1", date: MON, status: "todo" },
      { title: "old 2", date: MON, status: "done", userId: null },
      { title: "mine already", date: MON, status: "todo", userId: other },
    ]);
    await db.collection("weeklyplans").insertOne({ title: "old plan", startDate: MON, endDate: SUN });
    await db.collection("yearlygoals").insertOne({ title: "old goal", year: 2026 });

    const dry = await migrateUserId(db);
    expect(dry.droppedIndex).toBe(true);
    expect(dry.ownerless).toEqual({ tasks: 2, weeklyplans: 1, yearlygoals: 1 });
    expect(await db.collection("tasks").countDocuments({ userId: user._id })).toBe(0);

    await expect(migrateUserId(db, { assignTo: "nobody" })).rejects.toThrow("찾을 수 없습니다");

    const run = await migrateUserId(db, { assignTo: "owner" });
    expect(run.assigned).toEqual({ tasks: 2, weeklyplans: 1, yearlygoals: 1 });
    expect(run.ownerless).toEqual({ tasks: 0, weeklyplans: 0, yearlygoals: 0 });
    expect(await db.collection("tasks").countDocuments({ userId: other })).toBe(1);

    const names = (await db.collection("weeklyplans").indexes()).map((i) => i.name);
    expect(names).not.toContain("startDate_1");
    expect(names).toContain("userId_1_startDate_1");

    const again = await migrateUserId(db, { assignTo: "owner" });
    expect(again).toEqual({
      droppedIndex: false,
      assigned: { tasks: 0, weeklyplans: 0, yearlygoals: 0 },
      ownerless: { tasks: 0, weeklyplans: 0, yearlygoals: 0 },
    });
  });
});

describe("리뷰 반영", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("이미 로그인된 브라우저로 다시 로그인하면 이전 세션은 삭제된다", async () => {
    vi.stubEnv("GITHUB_CLIENT_ID", "id");
    vi.stubEnv("GITHUB_CLIENT_SECRET", "secret");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL) =>
        String(input).endsWith("/access_token") ? Response.json({ access_token: "t" }) : Response.json({ id: 1, login: "alice" }),
      ),
    );
    const old = await login(1, "alice");
    const res = await callbackRoute.GET(
      req("GET", "/auth/github/callback?code=c&state=s", { cookie: `oauth_state=s; session=${old.token}` }),
    );
    expect(res.headers.get("location")).toBe("http://localhost/board");
    expect(await Session.countDocuments({ tokenHash: hashToken(old.token) })).toBe(0);
    expect(await Session.countDocuments()).toBe(1);
  });

  it("다른 사용자의 할 일이 내 주간 계획에 연결돼 있어도(이전 데이터) 내 진행률에 들어가지 않는다", async () => {
    const a = await login(1, "alice");
    const plan = await (
      await weeklyPlansRoute.POST(req("POST", "/", { token: a.token, body: { title: "p", startDate: MON, endDate: SUN } }))
    ).json();
    await tasksRoute.POST(req("POST", "/", { token: a.token, body: { title: "mine", date: MON, weeklyPlanId: plan.id } }));
    await mongoose.connection.db!.collection("tasks").insertOne({
      userId: new Types.ObjectId(),
      title: "someone else",
      date: MON,
      status: "done",
      weeklyPlanId: new Types.ObjectId(plan.id),
    });
    const [listed] = await (await weeklyPlansRoute.GET(req("GET", "/", { token: a.token }))).json();
    expect(listed.progress).toBe(0);
  });
});
