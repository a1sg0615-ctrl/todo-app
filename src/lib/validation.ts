import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { isValidDate } from "./date";
import { badRequest } from "./errors";
import { TASK_STATUSES } from "./types";

/** 검증에 실패하면 첫 번째 오류 메시지로 400 AppError를 던진다. */
export function parse<T extends z.ZodTypeAny>(schema: T, input: unknown): z.output<T> {
  const result = schema.safeParse(input);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw badRequest(
      issue.code === "unrecognized_keys"
        ? `수정할 수 없는 항목입니다: ${issue.keys.join(", ")}`
        : issue.message,
    );
  }
  return result.data;
}

const title = z
  .string({ required_error: "제목은 필수입니다" })
  .trim()
  .min(1, "제목은 필수입니다")
  .max(200, "제목은 200자 이하여야 합니다");

const date = z
  .string({ required_error: "날짜는 필수입니다" })
  .refine(isValidDate, "날짜는 YYYY-MM-DD 형식이어야 합니다");

const memo = z.string({ invalid_type_error: "메모는 문자열이어야 합니다" }).max(2000, "메모는 2000자 이하여야 합니다");

const ref = (label: string) =>
  z.string().refine((v) => isValidObjectId(v), `${label} id 형식이 올바르지 않습니다`).nullable();

const status = z.enum(TASK_STATUSES, {
  errorMap: () => ({ message: "상태는 todo, doing, done 중 하나여야 합니다" }),
});

export const taskCreateSchema = z.object({
  title,
  date,
  status: status.default("todo"),
  weeklyPlanId: ref("주간 계획").optional(),
  memo: memo.optional(),
});

export const taskUpdateSchema = z
  .object({
    title: title.optional(),
    date: date.optional(),
    status: status.optional(),
    weeklyPlanId: ref("주간 계획").optional(),
    memo: memo.optional(),
  })
  .strict();

export const taskReorderSchema = z.object({
  ids: z.array(z.string().refine((v) => isValidObjectId(v), "할 일 id 형식이 올바르지 않습니다")).min(1),
});

export const weeklyPlanCreateSchema = z.object({
  title,
  startDate: date,
  endDate: date,
  yearlyGoalId: ref("1년 목표").optional(),
  memo: memo.optional(),
});

// 기간(startDate/endDate)은 월요일 7일 고정이므로 수정할 수 없다.
export const weeklyPlanUpdateSchema = z
  .object({
    title: title.optional(),
    yearlyGoalId: ref("1년 목표").optional(),
    memo: memo.optional(),
  })
  .strict();

const year = z
  .number({ required_error: "연도는 필수입니다", invalid_type_error: "연도는 숫자여야 합니다" })
  .int("연도는 정수여야 합니다")
  .min(1900, "연도가 올바르지 않습니다")
  .max(9999, "연도가 올바르지 않습니다");

export const yearlyGoalCreateSchema = z.object({ title, year, memo: memo.optional() });
export const yearlyGoalUpdateSchema = z
  .object({ title: title.optional(), year: year.optional(), memo: memo.optional() })
  .strict();
