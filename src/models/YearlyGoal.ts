import { Schema, model, models, type InferSchemaType, type Model, type Types } from "mongoose";

const yearlyGoalSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  title: { type: String, required: true, trim: true },
  year: { type: Number, required: true },
  memo: { type: String, default: "" },
});

export type YearlyGoalDoc = InferSchemaType<typeof yearlyGoalSchema> & { _id: Types.ObjectId };

export const YearlyGoal: Model<InferSchemaType<typeof yearlyGoalSchema>> =
  models.YearlyGoal ?? model("YearlyGoal", yearlyGoalSchema);
