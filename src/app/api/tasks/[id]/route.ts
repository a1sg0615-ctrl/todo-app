import { NextResponse } from "next/server";
import { authRoute, noContent, type IdContext } from "@/lib/route";
import { deleteTask, updateTask } from "@/services/tasks";

export const PATCH = authRoute(async (userId, req, { params }: IdContext) => {
  const { id } = await params;
  return NextResponse.json(await updateTask(userId, id, await req.json()));
});

export const DELETE = authRoute(async (userId, _req, { params }: IdContext) => {
  await deleteTask(userId, (await params).id);
  return noContent();
});
