import { NextResponse } from "next/server";
import { authRoute } from "@/lib/route";
import { createYearlyGoal, listYearlyGoals } from "@/services/yearlyGoals";

export const GET = authRoute(async (userId) => NextResponse.json(await listYearlyGoals(userId)));

export const POST = authRoute(async (userId, req) => {
  return NextResponse.json(await createYearlyGoal(userId, await req.json()), { status: 201 });
});
