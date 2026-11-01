import { isValidObjectId } from "mongoose";
import { notFound } from "@/lib/errors";
import type { YearlyGoalDTO } from "@/lib/types";
import { parse, yearlyGoalCreateSchema, yearlyGoalUpdateSchema } from "@/lib/validation";
import { WeeklyPlan, type WeeklyPlanDoc } from "@/models/WeeklyPlan";
import { YearlyGoal, type YearlyGoalDoc } from "@/models/YearlyGoal";
import { average, calcWeeklyProgress } from "./progress";

/** 1년 목표 진행률 = 연결된 주간 계획 진행률의 평균 (P1). 연결이 없으면 0. */
async function withProgress(userId: string, goals: YearlyGoalDoc[]): Promise<YearlyGoalDTO[]> {
  const plans = await WeeklyPlan.find({ userId, yearlyGoalId: { $in: goals.map((g) => g._id) } })
    .select({ _id: 1, yearlyGoalId: 1 })
    .lean<Pick<WeeklyPlanDoc, "_id" | "yearlyGoalId">[]>();
  const weekly = await calcWeeklyProgress(userId, plans.map((p) => p._id));

  const byGoal = new Map<string, number[]>();
  for (const plan of plans) {
    const key = plan.yearlyGoalId!.toString();
    byGoal.set(key, [...(byGoal.get(key) ?? []), weekly.get(plan._id.toString()) ?? 0]);
  }

  return goals.map((g) => ({
    id: g._id.toString(),
    title: g.title,
    year: g.year,
    memo: g.memo ?? "",
    progress: average(byGoal.get(g._id.toString()) ?? []),
  }));
}

async function findGoal(userId: string, id: string): Promise<YearlyGoalDoc> {
  const goal = isValidObjectId(id)
    ? await YearlyGoal.findOne({ _id: id, userId }).lean<YearlyGoalDoc>()
    : null;
  if (!goal) throw notFound("1년 목표를 찾을 수 없습니다");
  return goal;
}

export async function listYearlyGoals(userId: string): Promise<YearlyGoalDTO[]> {
  const goals = await YearlyGoal.find({ userId }).sort({ year: -1, _id: 1 }).lean<YearlyGoalDoc[]>();
  return withProgress(userId, goals);
}

export async function getYearlyGoal(userId: string, id: string): Promise<YearlyGoalDTO> {
  const [goal] = await withProgress(userId, [await findGoal(userId, id)]);
  return goal;
}

export async function createYearlyGoal(userId: string, body: unknown): Promise<YearlyGoalDTO> {
  const input = parse(yearlyGoalCreateSchema, body);
  const goal = await YearlyGoal.create({ ...input, userId });
  const [dto] = await withProgress(userId, [goal.toObject()]);
  return dto;
}

export async function updateYearlyGoal(userId: string, id: string, body: unknown): Promise<YearlyGoalDTO> {
  await findGoal(userId, id);
  const input = parse(yearlyGoalUpdateSchema, body);
  await YearlyGoal.updateOne({ _id: id, userId }, input, { runValidators: true });
  return getYearlyGoal(userId, id);
}

/** 1년 목표를 삭제한다. 연결된 주간 계획은 남기고 연결만 해제한다. */
export async function deleteYearlyGoal(userId: string, id: string): Promise<void> {
  await findGoal(userId, id);
  await YearlyGoal.deleteOne({ _id: id, userId });
  await WeeklyPlan.updateMany({ yearlyGoalId: id, userId }, { yearlyGoalId: null });
}
