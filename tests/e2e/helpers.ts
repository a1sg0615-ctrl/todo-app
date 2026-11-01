import { createHash } from "node:crypto";
import type { APIRequestContext, Locator, Page } from "@playwright/test";
import mongoose from "mongoose";
import { addDays, today, weekStart } from "../../src/lib/date";
import type { TaskDTO, WeeklyPlanDTO, YearlyGoalDTO } from "../../src/lib/types";
import { E2E_DB_URI, E2E_SESSION_TOKEN, E2E_USER } from "./env";

export const TODAY = today();
export const THIS_MONDAY = weekStart(TODAY);
export const LAST_MONDAY = addDays(THIS_MONDAY, -7);

/** 컬렉션(과 인덱스)은 두고 문서만 지운 뒤, 기본 E2E 사용자와 세션을 다시 넣는다. */
export async function resetDb() {
  const conn = await mongoose.createConnection(E2E_DB_URI).asPromise();
  const db = conn.db!;
  for (const collection of await db.collections()) await collection.deleteMany({});
  const { insertedId } = await db.collection("users").insertOne({ ...E2E_USER, avatarUrl: "", createdAt: new Date(), updatedAt: new Date() });
  await db.collection("sessions").insertOne({
    tokenHash: createHash("sha256").update(E2E_SESSION_TOKEN).digest("hex"),
    userId: insertedId,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  });
  await conn.close();
}

/** request 픽스처는 브라우저 쿠키를 공유하지 않으므로 세션 쿠키를 직접 붙인다. */
export const authHeaders = { Cookie: `session=${E2E_SESSION_TOKEN}` };

async function post<T>(request: APIRequestContext, url: string, data: unknown): Promise<T> {
  const res = await request.post(url, { data, headers: authHeaders });
  if (!res.ok()) throw new Error(`${url} ${res.status()} ${await res.text()}`);
  return res.json();
}

export const createTask = (request: APIRequestContext, data: Partial<TaskDTO> & { title: string; date: string }) =>
  post<TaskDTO>(request, "/api/tasks", data);

export const createPlan = (request: APIRequestContext, startDate: string, data: Partial<WeeklyPlanDTO> = {}) =>
  post<WeeklyPlanDTO>(request, "/api/weekly-plans", {
    title: `주간 ${startDate}`,
    startDate,
    endDate: addDays(startDate, 6),
    ...data,
  });

export const createGoal = (request: APIRequestContext, title: string, year = 2026) =>
  post<YearlyGoalDTO>(request, "/api/yearly-goals", { title, year });

export const card = (page: Page, title: string) => page.getByTestId("task-card").filter({ hasText: title });
export const column = (page: Page, status: string) => page.getByTestId(`column-${status}`);

/** dnd-kit PointerSensor(distance 5px)가 인식하도록 단계적으로 마우스를 움직인다. */
export async function drag(page: Page, source: Locator, target: Locator, position: "center" | "bottom" = "center") {
  const s = (await source.boundingBox())!;
  const t = (await target.boundingBox())!;
  const sx = s.x + s.width / 2;
  const sy = s.y + s.height / 2;
  const tx = t.x + t.width / 2;
  const ty = position === "bottom" ? t.y + t.height - 15 : t.y + t.height / 2;

  await page.mouse.move(sx, sy);
  await page.mouse.down();
  await page.mouse.move(sx + 10, sy + 10, { steps: 5 });
  await page.mouse.move(tx, ty, { steps: 20 });
  await page.mouse.move(tx, ty + 1, { steps: 2 });
  await page.mouse.up();
}
