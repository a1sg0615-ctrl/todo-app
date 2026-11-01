import { NextResponse } from "next/server";
import { authRoute } from "@/lib/route";
import { createWeeklyPlan, listWeeklyPlans } from "@/services/weeklyPlans";

export const GET = authRoute(async (userId, req) => {
  const yearlyGoalId = new URL(req.url).searchParams.get("yearlyGoalId") ?? undefined;
  return NextResponse.json(await listWeeklyPlans(userId, { yearlyGoalId }));
});

export const POST = authRoute(async (userId, req) => {
  return NextResponse.json(await createWeeklyPlan(userId, await req.json()), { status: 201 });
});
