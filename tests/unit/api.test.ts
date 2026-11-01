import { beforeEach, describe, expect, it } from "vitest";
import * as tasksRoute from "@/app/api/tasks/route";
import * as taskRoute from "@/app/api/tasks/[id]/route";
import * as weeklyPlansRoute from "@/app/api/weekly-plans/route";
import * as weeklyPlanRoute from "@/app/api/weekly-plans/[id]/route";
import * as yearlyGoalsRoute from "@/app/api/yearly-goals/route";
import * as yearlyGoalRoute from "@/app/api/yearly-goals/[id]/route";
import { createSession } from "@/lib/auth";
import { User } from "@/models/User";

const MON = "2026-10-26";
const SUN = "2026-11-01";
const MISSING_ID = "64b000000000000000000000";

// 모든 API는 로그인이 필요하므로 테스트마다 사용자와 세션을 만들고 쿠키를 붙인다.
let token = "";
beforeEach(async () => {
  const user = await User.create({ githubId: 1, username: "tester" });
  token = (await createSession(user._id.toString())).token;
});

const req = (method: string, path: string, body?: unknown) =>
  new Request(`http://localhost${path}`, {
    method,
    headers: { "Content-Type": "application/json", Cookie: `session=${token}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

async function postPlan(body: Record<string, unknown> = {}) {
  return weeklyPlansRoute.POST(req("POST", "/api/weekly-plans", { title: "주간", startDate: MON, endDate: SUN, ...body }));
}
async function postTask(body: Record<string, unknown>) {
  return tasksRoute.POST(req("POST", "/api/tasks", body));
}

describe("POST /api/tasks", () => {
  it("201과 id 문자열(_id 없음)을 반환한다", async () => {
    const res = await postTask({ title: "t", date: MON });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(typeof body.id).toBe("string");
    expect(body).not.toHaveProperty("_id");
    expect(body).not.toHaveProperty("__v");
    expect(body.status).toBe("todo");
  });

  it("제목/날짜 누락, 잘못된 상태, 잘못된 JSON은 400", async () => {
    for (const body of [{ date: MON }, { title: "t" }, { title: "t", date: MON, status: "x" }]) {
      const res = await postTask(body);
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBeTruthy();
    }
    const bad = await tasksRoute.POST(
      new Request("http://localhost/api/tasks", { method: "POST", body: "{oops", headers: { Cookie: `session=${token}` } }),
    );
    expect(bad.status).toBe(400);
  });

  it("없는 주간 계획으로 연결하면 400, 기간 밖 날짜로 연결해도 400", async () => {
    expect((await postTask({ title: "t", date: MON, weeklyPlanId: MISSING_ID })).status).toBe(400);
    const plan = await (await postPlan()).json();
    expect((await postTask({ title: "t", date: "2026-11-02", weeklyPlanId: plan.id })).status).toBe(400);
  });
});

describe("PATCH/DELETE /api/tasks/[id]", () => {
  it("연결된 할 일 날짜를 기간 밖으로 바꾸면 400", async () => {
    const plan = await (await postPlan()).json();
    const task = await (await postTask({ title: "t", date: MON, weeklyPlanId: plan.id })).json();
    const res = await taskRoute.PATCH(req("PATCH", "/", { date: "2026-11-02" }), ctx(task.id));
    expect(res.status).toBe(400);
  });

  it("상태를 바꾸면 200과 바뀐 값", async () => {
    const task = await (await postTask({ title: "t", date: MON })).json();
    const res = await taskRoute.PATCH(req("PATCH", "/", { status: "done" }), ctx(task.id));
    expect(res.status).toBe(200);
    expect((await res.json()).status).toBe("done");
  });

  it("없는 id와 잘못된 형식의 id는 404", async () => {
    for (const id of [MISSING_ID, "not-an-id"]) {
      expect((await taskRoute.PATCH(req("PATCH", "/", { status: "done" }), ctx(id))).status).toBe(404);
      expect((await taskRoute.DELETE(req("DELETE", "/"), ctx(id))).status).toBe(404);
    }
  });

  it("DELETE는 204", async () => {
    const task = await (await postTask({ title: "t", date: MON })).json();
    expect((await taskRoute.DELETE(req("DELETE", "/"), ctx(task.id))).status).toBe(204);
  });
});

describe("GET /api/tasks", () => {
  it("date, from/to, weeklyPlanId, unlinked 쿼리를 지원한다", async () => {
    const plan = await (await postPlan()).json();
    await postTask({ title: "a", date: MON, weeklyPlanId: plan.id });
    await postTask({ title: "b", date: SUN });
    await postTask({ title: "c", date: "2026-11-05" });
    const titles = async (qs: string) => {
      const res = await tasksRoute.GET(req("GET", `/api/tasks?${qs}`));
      expect(res.status).toBe(200);
      return ((await res.json()) as { title: string }[]).map((t) => t.title).sort();
    };
    expect(await titles(`date=${MON}`)).toEqual(["a"]);
    expect(await titles(`from=${MON}&to=${SUN}`)).toEqual(["a", "b"]);
    expect(await titles(`weeklyPlanId=${plan.id}`)).toEqual(["a"]);
    expect(await titles("unlinked=1")).toEqual(["b", "c"]);
    expect((await tasksRoute.GET(req("GET", "/api/tasks?date=2026-13-01"))).status).toBe(400);
  });
});

describe("/api/weekly-plans", () => {
  it("월요일이 아니거나 7일이 아니면 400, 같은 주 중복은 409", async () => {
    expect((await postPlan({ startDate: "2026-10-27", endDate: "2026-11-02" })).status).toBe(400);
    expect((await postPlan({ endDate: "2026-10-31" })).status).toBe(400);
    expect((await postPlan()).status).toBe(201);
    expect((await postPlan()).status).toBe(409);
  });

  it("없는 1년 목표로 연결하면 400", async () => {
    expect((await postPlan({ yearlyGoalId: MISSING_ID })).status).toBe(400);
  });

  it("목록 응답 항목에 progress가 있다", async () => {
    const plan = await (await postPlan()).json();
    await postTask({ title: "t", date: MON, status: "done", weeklyPlanId: plan.id });
    await postTask({ title: "t", date: MON, weeklyPlanId: plan.id });
    const list = await (await weeklyPlansRoute.GET(req("GET", "/api/weekly-plans"))).json();
    expect(list).toEqual([expect.objectContaining({ id: plan.id, progress: 50 })]);
  });

  it("PATCH 기간 변경은 400, 없는 id는 404, DELETE는 204", async () => {
    const plan = await (await postPlan()).json();
    expect((await weeklyPlanRoute.PATCH(req("PATCH", "/", { startDate: "2026-11-02" }), ctx(plan.id))).status).toBe(400);
    expect((await weeklyPlanRoute.PATCH(req("PATCH", "/", { title: "x" }), ctx(MISSING_ID))).status).toBe(404);
    expect((await weeklyPlanRoute.DELETE(req("DELETE", "/"), ctx(plan.id))).status).toBe(204);
    expect((await weeklyPlanRoute.GET(req("GET", "/"), ctx(plan.id))).status).toBe(404);
  });
});

describe("/api/yearly-goals", () => {
  it("CRUD와 검증", async () => {
    expect((await yearlyGoalsRoute.POST(req("POST", "/", { title: "g" }))).status).toBe(400);
    const res = await yearlyGoalsRoute.POST(req("POST", "/", { title: "g", year: 2026 }));
    expect(res.status).toBe(201);
    const goal = await res.json();
    expect(goal).toEqual({ id: goal.id, title: "g", year: 2026, memo: "", progress: 0 });

    const patched = await yearlyGoalRoute.PATCH(req("PATCH", "/", { title: "g2" }), ctx(goal.id));
    expect((await patched.json()).title).toBe("g2");
    expect((await yearlyGoalsRoute.GET(req("GET", "/"))).status).toBe(200);
    expect((await yearlyGoalRoute.DELETE(req("DELETE", "/"), ctx(goal.id))).status).toBe(204);
    expect((await yearlyGoalRoute.DELETE(req("DELETE", "/"), ctx(goal.id))).status).toBe(404);
  });
});
