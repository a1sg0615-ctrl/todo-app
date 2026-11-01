import { NextResponse } from "next/server";
import { authRoute, noContent, type IdContext } from "@/lib/route";
import { deleteWeeklyPlan, getWeeklyPlan, updateWeeklyPlan } from "@/services/weeklyPlans";

export const GET = authRoute(async (userId, _req, { params }: IdContext) => {
  return NextResponse.json(await getWeeklyPlan(userId, (await params).id));
});

export const PATCH = authRoute(async (userId, req, { params }: IdContext) => {
  const { id } = await params;
  return NextResponse.json(await updateWeeklyPlan(userId, id, await req.json()));
});

export const DELETE = authRoute(async (userId, _req, { params }: IdContext) => {
  await deleteWeeklyPlan(userId, (await params).id);
  return noContent();
});
