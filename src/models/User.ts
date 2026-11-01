import { Schema, model, models, type InferSchemaType, type Model, type Types } from "mongoose";

const userSchema = new Schema(
  {
    githubId: { type: Number, required: true, unique: true },
    username: { type: String, required: true },
    avatarUrl: { type: String, default: "" },
  },
  { timestamps: true },
);

export type UserDoc = InferSchemaType<typeof userSchema> & { _id: Types.ObjectId };

export const User: Model<InferSchemaType<typeof userSchema>> = models.User ?? model("User", userSchema);
