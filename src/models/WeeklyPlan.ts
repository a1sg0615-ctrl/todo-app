import { Schema, model, models, type InferSchemaType, type Model, type Types } from "mongoose";

// progress는 저장하지 않는다. 조회 시 연결된 Task로 계산한다 (services/progress.ts).
const weeklyPlanSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  title: { type: String, required: true, trim: true },
  startDate: { type: String, required: true }, // 월요일
  endDate: { type: String, required: true }, // 일요일
  yearlyGoalId: { type: Schema.Types.ObjectId, ref: "YearlyGoal", default: null, index: true },
  memo: { type: String, default: "" },
});
// 같은 사용자는 한 주에 주간 계획을 하나만 만들 수 있다.
weeklyPlanSchema.index({ userId: 1, startDate: 1 }, { unique: true });

export type WeeklyPlanDoc = InferSchemaType<typeof weeklyPlanSchema> & { _id: Types.ObjectId };

export const WeeklyPlan: Model<InferSchemaType<typeof weeklyPlanSchema>> =
  models.WeeklyPlan ?? model("WeeklyPlan", weeklyPlanSchema);
