import mongoose from "mongoose";
import { afterAll, afterEach, beforeAll } from "vitest";
import { connectDB, disconnectDB } from "@/lib/db";
import { Task } from "@/models/Task";
import { WeeklyPlan } from "@/models/WeeklyPlan";
import { Session } from "@/models/Session";
import { User } from "@/models/User";
import { YearlyGoal } from "@/models/YearlyGoal";

beforeAll(async () => {
  await connectDB();
  await Promise.all([Task.init(), WeeklyPlan.init(), YearlyGoal.init(), User.init(), Session.init()]);
});

afterEach(async () => {
  await Promise.all(Object.values(mongoose.connection.collections).map((c) => c.deleteMany({})));
});

afterAll(async () => {
  await disconnectDB();
});
