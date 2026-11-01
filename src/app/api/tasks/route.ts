import { NextResponse } from "next/server";
import { authRoute } from "@/lib/route";
import { createTask, listTasks } from "@/services/tasks";

export const GET = authRoute(async (userId, req) => {
  const params = new URL(req.url).searchParams;
  const tasks = await listTasks(userId, {
    date: params.get("date") ?? undefined,
    from: params.get("from") ?? undefined,
    to: params.get("to") ?? undefined,
    weeklyPlanId: params.get("weeklyPlanId") ?? undefined,
    unlinked: params.get("unlinked") === "1",
  });
  return NextResponse.json(tasks);
});

export const POST = authRoute(async (userId, req) => {
  return NextResponse.json(await createTask(userId, await req.json()), { status: 201 });
});
