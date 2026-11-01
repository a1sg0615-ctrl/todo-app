import { NextResponse } from "next/server";
import { authRoute, noContent, type IdContext } from "@/lib/route";
import { deleteYearlyGoal, getYearlyGoal, updateYearlyGoal } from "@/services/yearlyGoals";

export const GET = authRoute(async (userId, _req, { params }: IdContext) => {
  return NextResponse.json(await getYearlyGoal(userId, (await params).id));
});

export const PATCH = authRoute(async (userId, req, { params }: IdContext) => {
  const { id } = await params;
  return NextResponse.json(await updateYearlyGoal(userId, id, await req.json()));
});

export const DELETE = authRoute(async (userId, _req, { params }: IdContext) => {
  await deleteYearlyGoal(userId, (await params).id);
  return noContent();
});
