import { Types } from "mongoose";
import { Task } from "@/models/Task";

export function percent(done: number, total: number): number {
  return total === 0 ? 0 : Math.round((done / total) * 100);
}

export function average(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((sum, v) => sum + v, 0) / values.length);
}

/**
 * 주간 계획별 진행률 = 연결된 할 일 중 done 수 / 전체 수 × 100.
 * 목록 전체를 한 번의 aggregate로 계산한다. 할 일이 없는 계획은 0.
 */
export async function calcWeeklyProgress(
  userId: string,
  weeklyPlanIds: (Types.ObjectId | string)[],
): Promise<Map<string, number>> {
  const ids = weeklyPlanIds.map((id) => new Types.ObjectId(String(id)));
  const progress = new Map(ids.map((id) => [id.toString(), 0]));
  if (ids.length === 0) return progress;

  const rows: { _id: Types.ObjectId; total: number; done: number }[] = await Task.aggregate([
    { $match: { userId: new Types.ObjectId(userId), weeklyPlanId: { $in: ids } } },
    {
      $group: {
        _id: "$weeklyPlanId",
        total: { $sum: 1 },
        done: { $sum: { $cond: [{ $eq: ["$status", "done"] }, 1, 0] } },
      },
    },
  ]);
  for (const row of rows) progress.set(row._id.toString(), percent(row.done, row.total));
  return progress;
}
