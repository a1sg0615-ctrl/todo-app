import { Schema, model, models, type InferSchemaType, type Model, type Types } from "mongoose";
import { TASK_STATUSES } from "@/lib/types";

const taskSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true, trim: true },
    date: { type: String, required: true, index: true },
    status: { type: String, enum: TASK_STATUSES, default: "todo", required: true },
    weeklyPlanId: { type: Schema.Types.ObjectId, ref: "WeeklyPlan", default: null, index: true },
    memo: { type: String, default: "" },
    // 컬럼 안 정렬 순서 (P1). 새 카드는 맨 아래에 오도록 생성 시각을 쓴다.
    order: { type: Number, default: () => Date.now() },
  },
  { timestamps: true },
);

export type TaskDoc = InferSchemaType<typeof taskSchema> & { _id: Types.ObjectId };

export const Task: Model<InferSchemaType<typeof taskSchema>> =
  models.Task ?? model("Task", taskSchema);
