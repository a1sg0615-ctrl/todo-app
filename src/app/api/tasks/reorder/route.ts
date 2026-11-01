import { authRoute, noContent } from "@/lib/route";
import { reorderTasks } from "@/services/tasks";

export const POST = authRoute(async (userId, req) => {
  await reorderTasks(userId, await req.json());
  return noContent();
});
