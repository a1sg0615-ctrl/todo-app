import { isValidObjectId } from "mongoose";
import { isValidDate } from "@/lib/date";
import { badRequest, notFound } from "@/lib/errors";
import type { TaskDTO } from "@/lib/types";
import { parse, taskCreateSchema, taskReorderSchema, taskUpdateSchema } from "@/lib/validation";
import { Task, type TaskDoc } from "@/models/Task";
import { WeeklyPlan } from "@/models/WeeklyPlan";

function toDTO(t: TaskDoc): TaskDTO {
  return {
    id: t._id.toString(),
    title: t.title,
    date: t.date,
    status: t.status,
    weeklyPlanId: t.weeklyPlanId?.toString() ?? null,
    memo: t.memo ?? "",
    order: t.order,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}

async function findTask(userId: string, id: string): Promise<TaskDoc> {
  const task = isValidObjectId(id) ? await Task.findOne({ _id: id, userId }).lean<TaskDoc>() : null;
  if (!task) throw notFound("할 일을 찾을 수 없습니다");
  return task;
}

/** 연결하려는 주간 계획이 있고, 할 일 날짜가 그 기간 안에 있는지 확인한다. */
async function assertLinkable(userId: string, weeklyPlanId: string, date: string): Promise<void> {
  const plan = await WeeklyPlan.findOne({ _id: weeklyPlanId, userId }).lean();
  if (!plan) throw badRequest("연결할 주간 계획이 없습니다");
  if (date < plan.startDate || date > plan.endDate) {
    throw badRequest(
      `할 일 날짜(${date})가 주간 계획 기간(${plan.startDate} ~ ${plan.endDate}) 밖입니다. 주간 계획 연결을 해제하거나 다른 주로 옮기세요`,
    );
  }
}

interface TaskQuery {
  date?: string;
  from?: string;
  to?: string;
  weeklyPlanId?: string;
  unlinked?: boolean;
}

export async function listTasks(userId: string, query: TaskQuery = {}): Promise<TaskDTO[]> {
  for (const value of [query.date, query.from, query.to]) {
    if (value !== undefined && !isValidDate(value)) {
      throw badRequest("날짜는 YYYY-MM-DD 형식이어야 합니다");
    }
  }
  if (query.weeklyPlanId !== undefined && !isValidObjectId(query.weeklyPlanId)) {
    throw badRequest("주간 계획 id 형식이 올바르지 않습니다");
  }

  const filter: Record<string, unknown> = { userId };
  if (query.date) filter.date = query.date;
  else if (query.from || query.to) {
    filter.date = {
      ...(query.from && { $gte: query.from }),
      ...(query.to && { $lte: query.to }),
    };
  }
  if (query.unlinked) filter.weeklyPlanId = null;
  else if (query.weeklyPlanId) filter.weeklyPlanId = query.weeklyPlanId;

  const tasks = await Task.find(filter).sort({ order: 1, createdAt: 1 }).lean<TaskDoc[]>();
  return tasks.map(toDTO);
}

export async function createTask(userId: string, body: unknown): Promise<TaskDTO> {
  const input = parse(taskCreateSchema, body);
  if (input.weeklyPlanId) await assertLinkable(userId, input.weeklyPlanId, input.date);
  const task = await Task.create({ ...input, userId });
  return toDTO(task.toObject());
}

export async function updateTask(userId: string, id: string, body: unknown): Promise<TaskDTO> {
  const task = await findTask(userId, id);
  const input = parse(taskUpdateSchema, body);

  const date = input.date ?? task.date;
  const weeklyPlanId =
    input.weeklyPlanId !== undefined ? input.weeklyPlanId : (task.weeklyPlanId?.toString() ?? null);
  if (weeklyPlanId && (input.date !== undefined || input.weeklyPlanId !== undefined)) {
    await assertLinkable(userId, weeklyPlanId, date);
  }

  // 다른 컬럼으로 옮긴 카드는 그 컬럼 맨 아래에 놓는다.
  const order = input.status && input.status !== task.status ? Date.now() : undefined;
  const updated = await Task.findOneAndUpdate(
    { _id: id, userId },
    { ...input, ...(order !== undefined && { order }) },
    { new: true, runValidators: true },
  ).lean<TaskDoc>();
  if (!updated) throw notFound("할 일을 찾을 수 없습니다");
  return toDTO(updated);
}

export async function deleteTask(userId: string, id: string): Promise<void> {
  await findTask(userId, id);
  await Task.deleteOne({ _id: id, userId });
}

/** 한 컬럼 안의 카드 순서를 ids 순서대로 저장한다 (P1). */
export async function reorderTasks(userId: string, body: unknown): Promise<void> {
  const { ids } = parse(taskReorderSchema, body);
  const found = await Task.countDocuments({ _id: { $in: ids }, userId });
  if (found !== new Set(ids).size) throw badRequest("존재하지 않는 할 일이 포함되어 있습니다");
  await Task.bulkWrite(
    ids.map((id, index) => ({
      updateOne: { filter: { _id: id, userId }, update: { $set: { order: index } }, timestamps: false },
    })),
  );
}
