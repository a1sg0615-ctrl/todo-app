import { Types } from "mongoose";
import { describe, expect, it } from "vitest";
import { addDays, isMonday, isValidDate, weekStart } from "@/lib/date";
import { AppError } from "@/lib/errors";
import { WeeklyPlan } from "@/models/WeeklyPlan";
import { average, percent } from "@/services/progress";
import { createTask, deleteTask, listTasks, reorderTasks, updateTask } from "@/services/tasks";
import {
  createWeeklyPlan,
  deleteWeeklyPlan,
  getWeeklyPlan,
  listWeeklyPlans,
  updateWeeklyPlan,
} from "@/services/weeklyPlans";
import { createYearlyGoal, deleteYearlyGoal, getYearlyGoal } from "@/services/yearlyGoals";

// 서비스는 userId 범위로 동작한다. 단일 사용자 시나리오는 모두 U로 실행한다.
const U = new Types.ObjectId().toString();

const MON_A = "2026-10-26";
const MON_B = "2026-11-02";

const plan = (startDate: string, extra: Record<string, unknown> = {}) =>
  createWeeklyPlan(U, { title: `주간 ${startDate}`, startDate, endDate: addDays(startDate, 6), ...extra });

async function expectStatus(promise: Promise<unknown>, status: number) {
  const err = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(AppError);
  expect((err as AppError).status).toBe(status);
}

const progressOf = async (id: string) => (await getWeeklyPlan(U, id)).progress;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("date utils", () => {
  it("월요일과 주 시작일을 계산한다", () => {
    expect(isMonday(MON_A)).toBe(true);
    expect(isMonday("2026-10-31")).toBe(false);
    expect(weekStart("2026-11-01")).toBe(MON_A); // 일요일
    expect(weekStart(MON_B)).toBe(MON_B);
    expect(isValidDate("2026-02-30")).toBe(false);
    expect(isValidDate("2026-2-3")).toBe(false);
  });
});

describe("progress", () => {
  it("percent/average", () => {
    expect(percent(0, 0)).toBe(0);
    expect(percent(1, 4)).toBe(25);
    expect(percent(1, 3)).toBe(33);
    expect(percent(2, 3)).toBe(67);
    expect(average([])).toBe(0);
    expect(average([25, 50])).toBe(38);
  });

  it("연결된 할 일이 없으면 0", async () => {
    const p = await plan(MON_A);
    expect(p.progress).toBe(0);
    expect(await progressOf(p.id)).toBe(0);
  });

  it("4개 중 done 1개면 25, 3개 중 done 1개면 33", async () => {
    const a = await plan(MON_A);
    for (const status of ["done", "todo", "doing", "todo"]) {
      await createTask(U, { title: "t", date: MON_A, status, weeklyPlanId: a.id });
    }
    const b = await plan(MON_B);
    for (const status of ["done", "todo", "doing"]) {
      await createTask(U, { title: "t", date: MON_B, status, weeklyPlanId: b.id });
    }
    const list = await listWeeklyPlans(U);
    expect(Object.fromEntries(list.map((p) => [p.id, p.progress]))).toEqual({ [a.id]: 25, [b.id]: 33 });
  });

  it("생성, 상태 변경, 삭제 직후 조회 결과가 바뀐다", async () => {
    const p = await plan(MON_A);
    const t1 = await createTask(U, { title: "a", date: MON_A, weeklyPlanId: p.id });
    expect(await progressOf(p.id)).toBe(0);
    await createTask(U, { title: "b", date: MON_A, status: "done", weeklyPlanId: p.id });
    expect(await progressOf(p.id)).toBe(50);
    await updateTask(U, t1.id, { status: "done" });
    expect(await progressOf(p.id)).toBe(100);
    await updateTask(U, t1.id, { status: "doing" });
    expect(await progressOf(p.id)).toBe(50);
    await deleteTask(U, t1.id);
    expect(await progressOf(p.id)).toBe(100);
  });

  it("A에서 B로 옮기면 둘 다 바뀌고, 연결 해제 시 이전 계획이 바뀐다", async () => {
    const a = await plan(MON_A);
    const b = await plan(MON_B);
    await createTask(U, { title: "a-todo", date: MON_A, weeklyPlanId: a.id });
    await createTask(U, { title: "b-todo", date: MON_B, weeklyPlanId: b.id });
    const moving = await createTask(U, { title: "m", date: MON_A, status: "done", weeklyPlanId: a.id });
    expect([await progressOf(a.id), await progressOf(b.id)]).toEqual([50, 0]);

    await updateTask(U, moving.id, { date: MON_B, weeklyPlanId: b.id });
    expect([await progressOf(a.id), await progressOf(b.id)]).toEqual([0, 50]);

    await updateTask(U, moving.id, { weeklyPlanId: null });
    expect(await progressOf(b.id)).toBe(0);
  });

  it("WeeklyPlan 문서에 progress를 저장하지 않는다", async () => {
    const p = await plan(MON_A);
    await createTask(U, { title: "t", date: MON_A, status: "done", weeklyPlanId: p.id });
    const raw = await WeeklyPlan.collection.findOne({});
    expect(raw).not.toBeNull();
    expect(raw).not.toHaveProperty("progress");
  });

  it("1년 목표 진행률은 연결된 주간 계획 진행률 평균 (P1)", async () => {
    const goal = await createYearlyGoal(U, { title: "g", year: 2026 });
    expect(goal.progress).toBe(0);
    const a = await plan(MON_A, { yearlyGoalId: goal.id });
    const b = await plan(MON_B, { yearlyGoalId: goal.id });
    await createTask(U, { title: "t", date: MON_A, status: "done", weeklyPlanId: a.id });
    await createTask(U, { title: "t", date: MON_B, status: "done", weeklyPlanId: b.id });
    await createTask(U, { title: "t", date: MON_B, weeklyPlanId: b.id });
    await createTask(U, { title: "t", date: MON_B, weeklyPlanId: b.id });
    // a=100, b=33 → 평균 66.5 → 67
    expect((await getYearlyGoal(U, goal.id)).progress).toBe(67);
  });
});

describe("연결과 삭제", () => {
  it("미연결 할 일과 주간 계획을 만들 수 있다", async () => {
    const t = await createTask(U, { title: "t", date: MON_A });
    expect(t.weeklyPlanId).toBeNull();
    const p = await plan(MON_A);
    expect(p.yearlyGoalId).toBeNull();
  });

  it("주간 계획을 삭제하면 할 일은 남고 연결만 해제된다", async () => {
    const p = await plan(MON_A);
    const t = await createTask(U, { title: "t", date: MON_A, weeklyPlanId: p.id });
    await deleteWeeklyPlan(U, p.id);
    const [left] = await listTasks(U);
    expect(left.id).toBe(t.id);
    expect(left.weeklyPlanId).toBeNull();
    await expectStatus(getWeeklyPlan(U, p.id), 404);
  });

  it("1년 목표를 삭제하면 주간 계획은 남고 연결만 해제된다", async () => {
    const goal = await createYearlyGoal(U, { title: "g", year: 2026 });
    const p = await plan(MON_A, { yearlyGoalId: goal.id });
    await deleteYearlyGoal(U, goal.id);
    expect((await getWeeklyPlan(U, p.id)).yearlyGoalId).toBeNull();
  });
});

describe("검증", () => {
  it("월요일이 아닌 시작일, 7일이 아닌 기간은 400", async () => {
    await expectStatus(createWeeklyPlan(U, { title: "x", startDate: "2026-10-27", endDate: "2026-11-02" }), 400);
    await expectStatus(createWeeklyPlan(U, { title: "x", startDate: MON_A, endDate: addDays(MON_A, 5) }), 400);
  });

  it("같은 주에 다시 만들면 409", async () => {
    await plan(MON_A);
    await expectStatus(plan(MON_A), 409);
  });

  it("주간 계획 기간은 수정할 수 없다", async () => {
    const p = await plan(MON_A);
    await expectStatus(updateWeeklyPlan(U, p.id, { startDate: MON_B }), 400);
    expect((await updateWeeklyPlan(U, p.id, { title: "새 제목" })).title).toBe("새 제목");
  });

  it("없는 상위 항목으로 연결하면 400", async () => {
    await expectStatus(createTask(U, { title: "t", date: MON_A, weeklyPlanId: "64b000000000000000000000" }), 400);
    await expectStatus(plan(MON_A, { yearlyGoalId: "64b000000000000000000000" }), 400);
  });

  it("기간 밖 날짜로 연결하거나 연결된 할 일 날짜를 기간 밖으로 바꾸면 400이고 값이 유지된다", async () => {
    const p = await plan(MON_A);
    await expectStatus(createTask(U, { title: "t", date: MON_B, weeklyPlanId: p.id }), 400);

    const t = await createTask(U, { title: "t", date: MON_A, weeklyPlanId: p.id });
    await expectStatus(updateTask(U, t.id, { date: MON_B }), 400);
    const [unchanged] = await listTasks(U);
    expect(unchanged.date).toBe(MON_A);
    expect(unchanged.weeklyPlanId).toBe(p.id);

    // 연결을 함께 해제하면 날짜를 바꿀 수 있다.
    expect((await updateTask(U, t.id, { date: MON_B, weeklyPlanId: null })).date).toBe(MON_B);
  });

  it("status 생략 시 todo, 상태 변경 시 updatedAt이 커진다", async () => {
    const t = await createTask(U, { title: "t", date: MON_A });
    expect(t.status).toBe("todo");
    await sleep(5);
    const u = await updateTask(U, t.id, { status: "doing" });
    expect(new Date(u.updatedAt).getTime()).toBeGreaterThan(new Date(t.updatedAt).getTime());
  });

  it("제목/날짜 누락, 잘못된 상태는 400", async () => {
    await expectStatus(createTask(U, { date: MON_A }), 400);
    await expectStatus(createTask(U, { title: "  ", date: MON_A }), 400);
    await expectStatus(createTask(U, { title: "t" }), 400);
    await expectStatus(createTask(U, { title: "t", date: MON_A, status: "blocked" }), 400);
  });
});

describe("목록 조회와 정렬", () => {
  it("date, from/to, weeklyPlanId, unlinked로 거른다", async () => {
    const p = await plan(MON_A);
    await createTask(U, { title: "a", date: MON_A, weeklyPlanId: p.id });
    await createTask(U, { title: "b", date: addDays(MON_A, 3) });
    await createTask(U, { title: "c", date: MON_B });
    const titles = async (q: Parameters<typeof listTasks>[1]) => (await listTasks(U, q)).map((t) => t.title).sort();

    expect(await titles({ date: MON_A })).toEqual(["a"]);
    expect(await titles({ from: MON_A, to: addDays(MON_A, 6) })).toEqual(["a", "b"]);
    expect(await titles({ weeklyPlanId: p.id })).toEqual(["a"]);
    expect(await titles({ unlinked: true })).toEqual(["b", "c"]);
  });

  it("reorder는 ids 순서대로 정렬하고 updatedAt을 바꾸지 않는다 (P1)", async () => {
    const a = await createTask(U, { title: "a", date: MON_A });
    const b = await createTask(U, { title: "b", date: MON_A });
    const c = await createTask(U, { title: "c", date: MON_A });
    await reorderTasks(U, { ids: [c.id, a.id, b.id] });
    const list = await listTasks(U, { date: MON_A });
    expect(list.map((t) => t.title)).toEqual(["c", "a", "b"]);
    expect(list.find((t) => t.id === a.id)!.updatedAt).toBe(a.updatedAt);
  });
});

describe("메모", () => {
  it("생략하면 빈 문자열이고, 생성·수정할 수 있다", async () => {
    const t = await createTask(U, { title: "t", date: MON_A });
    expect(t.memo).toBe("");
    expect((await updateTask(U, t.id, { memo: "우유 2개\n계란" })).memo).toBe("우유 2개\n계란");

    const p = await plan(MON_A, { memo: "주간 메모" });
    expect(p.memo).toBe("주간 메모");
    expect((await updateWeeklyPlan(U, p.id, { memo: "" })).memo).toBe("");

    const g = await createYearlyGoal(U, { title: "g", year: 2026 });
    expect(g.memo).toBe("");
    const { updateYearlyGoal } = await import("@/services/yearlyGoals");
    expect((await updateYearlyGoal(U, g.id, { memo: "연간 메모" })).memo).toBe("연간 메모");
  });

  it("2000자를 넘거나 문자열이 아니면 400", async () => {
    await expectStatus(createTask(U, { title: "t", date: MON_A, memo: "a".repeat(2001) }), 400);
    await expectStatus(createYearlyGoal(U, { title: "g", year: 2026, memo: 1 }), 400);
  });

  it("memo 필드가 없는 기존 문서도 빈 문자열로 내보낸다", async () => {
    const { Task } = await import("@/models/Task");
    const now = new Date();
    await Task.collection.insertOne({ userId: new Types.ObjectId(U), title: "옛 할 일", date: MON_A, status: "todo", weeklyPlanId: null, order: 0, createdAt: now, updatedAt: now });
    const [old] = await listTasks(U);
    expect(old.memo).toBe("");
  });
});
