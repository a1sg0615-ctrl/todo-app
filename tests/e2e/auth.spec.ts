import { expect, test } from "@playwright/test";
import mongoose from "mongoose";
import { E2E_DB_URI } from "./env";
import { resetDb } from "./helpers";

// 이 파일은 로그인하지 않은 상태에서 시작한다.
test.use({ storageState: { cookies: [], origins: [] } });

test.beforeEach(async () => {
  await resetDb();
});

test("로그인하지 않으면 모든 화면이 /login으로 리다이렉트된다", async ({ page, request }) => {
  for (const path of ["/", "/board", "/tasks", "/weekly", "/yearly"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login$/);
  }
  await expect(page.getByRole("link", { name: "GitHub로 로그인" })).toBeVisible();
  expect((await request.get("/api/tasks")).status()).toBe(401);
});

test("GitHub로 로그인하면 사용자 정보가 저장되고 보드로 이동하며, 로그아웃하면 세션이 지워진다", async ({ page, context, request }) => {
  await page.goto("/login");
  await page.getByRole("link", { name: "GitHub로 로그인" }).click();

  // 모의 GitHub → /auth/github/callback → /board
  await expect(page).toHaveURL(/\/board$/);
  const user = page.getByTestId("current-user");
  await expect(user).toContainText("mock-octocat");
  await expect(user.getByRole("img", { name: "mock-octocat 아바타" })).toBeVisible();

  const conn = await mongoose.createConnection(E2E_DB_URI).asPromise();
  try {
    const saved = await conn.db!.collection("users").findOne({ githubId: 4242 });
    expect(saved).toMatchObject({ username: "mock-octocat", avatarUrl: "http://localhost:3200/avatar.png" });

    // 로그인한 사용자로 할 일을 만들 수 있다.
    await page.goto("/tasks");
    await page.getByLabel("새 할 일 제목").fill("로그인 후 할 일");
    await page.getByRole("button", { name: "추가" }).click();
    await expect(page.getByTestId("task-row").filter({ hasText: "로그인 후 할 일" })).toBeVisible();

    const token = (await context.cookies()).find((c) => c.name === "session")!.value;
    expect(await conn.db!.collection("sessions").countDocuments({ userId: saved!._id })).toBe(1);

    await page.getByRole("button", { name: "로그아웃" }).click();
    await expect(page).toHaveURL(/\/login$/);
    expect((await context.cookies()).find((c) => c.name === "session")).toBeUndefined();
    expect(await conn.db!.collection("sessions").countDocuments({ userId: saved!._id })).toBe(0);

    // 지운 세션 토큰은 더 이상 쓸 수 없다.
    expect((await request.get("/api/tasks", { headers: { Cookie: `session=${token}` } })).status()).toBe(401);

    await page.goto("/board");
    await expect(page).toHaveURL(/\/login$/);
  } finally {
    await conn.close();
  }
});

test("다른 사용자로 로그인하면 기존 사용자의 할 일이 보이지 않는다", async ({ page }) => {
  // resetDb가 넣은 e2e-user의 할 일
  const conn = await mongoose.createConnection(E2E_DB_URI).asPromise();
  const owner = await conn.db!.collection("users").findOne({ username: "e2e-user" });
  await conn.db!.collection("tasks").insertOne({
    userId: owner!._id,
    title: "남의 할 일",
    date: new Date().toISOString().slice(0, 10),
    status: "todo",
    weeklyPlanId: null,
    memo: "",
    order: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  await conn.close();

  await page.goto("/login");
  await page.getByRole("link", { name: "GitHub로 로그인" }).click();
  await expect(page).toHaveURL(/\/board$/);
  await expect(page.getByTestId("current-user")).toContainText("mock-octocat");
  await expect(page.getByText("남의 할 일")).toHaveCount(0);
});

test("세션이 만료되면 API 401을 받고 /login으로 이동한다", async ({ page, context }) => {
  await context.addCookies([{ name: "session", value: "stale-token", domain: "localhost", path: "/" }]);
  await page.goto("/board"); // 쿠키는 있으므로 middleware는 통과
  await expect(page).toHaveURL(/\/login$/);
});
