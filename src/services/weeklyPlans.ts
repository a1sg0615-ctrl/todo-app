import { isValidObjectId } from "mongoose";
import { addDays, isMonday } from "@/lib/date";
import { badRequest, conflict, notFound } from "@/lib/errors";
import type { WeeklyPlanDTO } from "@/lib/types";
import { parse, weeklyPlanCreateSchema, weeklyPlanUpdateSchema } from "@/lib/validation";
import { Task } from "@/models/Task";
import { WeeklyPlan, type WeeklyPlanDoc } from "@/models/WeeklyPlan";
import { YearlyGoal } from "@/models/YearlyGoal";
import { calcWeeklyProgress } from "./progress";

async function withProgress(userId: string, plans: WeeklyPlanDoc[]): Promise<WeeklyPlanDTO[]> {
  const progress = await calcWeeklyProgress(userId, plans.map((p) => p._id));
  return plans.map((p) => ({
    id: p._id.toString(),
    title: p.title,
    startDate: p.startDate,
    endDate: p.endDate,
    yearlyGoalId: p.yearlyGoalId?.toString() ?? null,
    memo: p.memo ?? "",
    progress: progress.get(p._id.toString()) ?? 0,
  }));
}

async function findPlan(userId: string, id: string): Promise<WeeklyPlanDoc> {
  const plan = isValidObjectId(id)
    ? await WeeklyPlan.findOne({ _id: id, userId }).lean<WeeklyPlanDoc>()
    : null;
  if (!plan) throw notFound("주간 계획을 찾을 수 없습니다");
  return plan;
}

async function assertGoalExists(userId: string, yearlyGoalId: string): Promise<void> {
  if (!(await YearlyGoal.exists({ _id: yearlyGoalId, userId }))) {
    throw badRequest("연결할 1년 목표가 없습니다");
  }
}

export async function listWeeklyPlans(
  userId: string,
  query: { yearlyGoalId?: string } = {},
): Promise<WeeklyPlanDTO[]> {
  if (query.yearlyGoalId !== undefined && !isValidObjectId(query.yearlyGoalId)) {
    throw badRequest("1년 목표 id 형식이 올바르지 않습니다");
  }
  const filter = query.yearlyGoalId ? { userId, yearlyGoalId: query.yearlyGoalId } : { userId };
  const plans = await WeeklyPlan.find(filter).sort({ startDate: -1 }).lean<WeeklyPlanDoc[]>();
  return withProgress(userId, plans);
}

export async function getWeeklyPlan(userId: string, id: string): Promise<WeeklyPlanDTO> {
  const [plan] = await withProgress(userId, [await findPlan(userId, id)]);
  return plan;
}

export async function createWeeklyPlan(userId: string, body: unknown): Promise<WeeklyPlanDTO> {
  const input = parse(weeklyPlanCreateSchema, body);
  if (!isMonday(input.startDate)) throw badRequest("주간 계획은 월요일에 시작해야 합니다");
  if (input.endDate !== addDays(input.startDate, 6)) {
    throw badRequest("주간 계획 기간은 월요일부터 일요일까지 7일이어야 합니다");
  }
  if (input.yearlyGoalId) await assertGoalExists(userId, input.yearlyGoalId);

  const duplicate = () => conflict(`이미 이 주(${input.startDate} ~ ${input.endDate})에 주간 계획이 있습니다`);
  if (await WeeklyPlan.exists({ userId, startDate: input.startDate })) throw duplicate();
  try {
    const plan = await WeeklyPlan.create({ ...input, userId });
    const [dto] = await withProgress(userId, [plan.toObject()]);
    return dto;
  } catch (err) {
    // 동시에 같은 주를 생성한 경우 unique 인덱스가 막는다.
    if ((err as { code?: number }).code === 11000) throw duplicate();
    throw err;
  }
}

export async function updateWeeklyPlan(userId: string, id: string, body: unknown): Promise<WeeklyPlanDTO> {
  await findPlan(userId, id);
  const input = parse(weeklyPlanUpdateSchema, body);
  if (input.yearlyGoalId) await assertGoalExists(userId, input.yearlyGoalId);
  await WeeklyPlan.updateOne({ _id: id, userId }, input, { runValidators: true });
  return getWeeklyPlan(userId, id);
}

/** 주간 계획을 삭제한다. 연결된 할 일은 남기고 연결만 해제한다. */
export async function deleteWeeklyPlan(userId: string, id: string): Promise<void> {
  await findPlan(userId, id);
  await WeeklyPlan.deleteOne({ _id: id, userId });
  await Task.updateMany({ weeklyPlanId: id, userId }, { weeklyPlanId: null });
}
