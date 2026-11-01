import { expect, test } from "@playwright/test";
import { addDays } from "../../src/lib/date";
import { LAST_MONDAY, THIS_MONDAY, TODAY, card, column, createPlan, createTask, drag, resetDb } from "./helpers";

test.beforeEach(async () => {
  await resetDb();
});

test("첫 진입 시 이번 주 할 일만 보인다", async ({ page, request }) => {
  await createTask(request, { title: "이번 주 할 일", date: TODAY });
  await createTask(request, { title: "지난주 할 일", date: addDays(TODAY, -7) });

  await page.goto("/board");
  await expect(card(page, "이번 주 할 일")).toBeVisible();
  await expect(card(page, "지난주 할 일")).toHaveCount(0);
  await expect(page.getByTestId("week-range")).toHaveText(`${THIS_MONDAY} ~ ${addDays(THIS_MONDAY, 6)}`);
});

test("이전 주로 이동하면 지난주 할 일이 보이고 새로고침 후에도 유지된다", async ({ page, request }) => {
  await createTask(request, { title: "이번 주 할 일", date: TODAY });
  await createTask(request, { title: "지난주 할 일", date: addDays(TODAY, -7) });

  await page.goto("/board");
  await expect(card(page, "이번 주 할 일")).toBeVisible();
  await page.getByRole("button", { name: "이전 주" }).click();
  await expect(page).toHaveURL(new RegExp(`week=${LAST_MONDAY}`));
  await expect(card(page, "지난주 할 일")).toBeVisible();
  await expect(card(page, "이번 주 할 일")).toHaveCount(0);

  await page.reload();
  await expect(card(page, "지난주 할 일")).toBeVisible();
  await expect(card(page, "이번 주 할 일")).toHaveCount(0);
});

test("todo 카드를 done에 드롭하면 저장되고 새로고침 후에도 done이다", async ({ page, request }) => {
  await createTask(request, { title: "끌 카드", date: TODAY });
  await page.goto("/board");
  await expect(column(page, "todo").getByText("끌 카드")).toBeVisible();

  const patch = page.waitForResponse((r) => r.request().method() === "PATCH" && r.url().includes("/api/tasks/"));
  await drag(page, card(page, "끌 카드"), column(page, "done"));
  expect((await patch).status()).toBe(200);

  await page.reload();
  await expect(column(page, "done").getByText("끌 카드")).toBeVisible();
  await expect(column(page, "todo").getByText("끌 카드")).toHaveCount(0);
});

test("같은 컬럼에 드롭하면 PATCH 요청을 보내지 않는다", async ({ page, request }) => {
  await createTask(request, { title: "제자리 카드", date: TODAY });
  await page.goto("/board");
  await expect(card(page, "제자리 카드")).toBeVisible();

  let writes = 0;
  page.on("request", (r) => {
    if (r.url().includes("/api/tasks") && r.method() !== "GET") writes++;
  });
  await drag(page, card(page, "제자리 카드"), column(page, "todo"), "bottom");
  await page.waitForTimeout(1000);
  expect(writes).toBe(0);
  await expect(column(page, "todo").getByText("제자리 카드")).toBeVisible();
});

test("저장이 실패하면 카드가 원래 컬럼으로 돌아가고 오류가 표시된다", async ({ page, request }) => {
  await createTask(request, { title: "실패 카드", date: TODAY });
  await page.route("**/api/tasks/*", (route) =>
    route.request().method() === "PATCH"
      ? route.fulfill({ status: 500, json: { error: "테스트용 서버 오류" } })
      : route.continue(),
  );
  await page.goto("/board");
  await expect(card(page, "실패 카드")).toBeVisible();

  await drag(page, card(page, "실패 카드"), column(page, "done"));
  await expect(page.getByTestId("toast")).toContainText("테스트용 서버 오류");
  await expect(column(page, "todo").getByText("실패 카드")).toBeVisible();
  await expect(column(page, "done").getByText("실패 카드")).toHaveCount(0);
});

test("저장 중인 카드는 다시 끌 수 없다", async ({ page, request }) => {
  await createTask(request, { title: "느린 카드", date: TODAY });
  let patches = 0;
  await page.route("**/api/tasks/*", async (route) => {
    if (route.request().method() !== "PATCH") return route.continue();
    patches++;
    await new Promise((r) => setTimeout(r, 2000));
    await route.continue();
  });
  await page.goto("/board");
  await expect(card(page, "느린 카드")).toBeVisible();

  await drag(page, card(page, "느린 카드"), column(page, "done"));
  await expect(card(page, "느린 카드")).toHaveAttribute("aria-busy", "true");
  await drag(page, card(page, "느린 카드"), column(page, "doing"));

  await expect(card(page, "느린 카드")).toHaveAttribute("aria-busy", "false", { timeout: 10_000 });
  await expect(column(page, "done").getByText("느린 카드")).toBeVisible();
  expect(patches).toBe(1);
});

test("보드에서 상태를 바꾸면 주간 계획 진행률에 반영된다", async ({ page, request }) => {
  const plan = await createPlan(request, THIS_MONDAY, { title: "이번 주 계획" });
  await createTask(request, { title: "연결 카드", date: TODAY, weeklyPlanId: plan.id });
  await createTask(request, { title: "다른 카드", date: TODAY, weeklyPlanId: plan.id });

  await page.goto("/board");
  await expect(card(page, "연결 카드")).toBeVisible();
  const patch = page.waitForResponse((r) => r.request().method() === "PATCH");
  await drag(page, card(page, "연결 카드"), column(page, "done"));
  await patch;

  await page.goto("/weekly");
  await expect(page.getByRole("progressbar", { name: "이번 주 계획 진행률" })).toHaveAttribute("aria-valuenow", "50");
});

test("같은 컬럼 안에서 순서를 바꾸면 새로고침 후에도 유지된다 (P1)", async ({ page, request }) => {
  for (const title of ["카드 A", "카드 B", "카드 C"]) await createTask(request, { title, date: TODAY });
  await page.goto("/board");
  const titles = column(page, "todo").getByTestId("task-card").locator("p:first-child");
  await expect(titles).toHaveText(["카드 A", "카드 B", "카드 C"]);

  const reorder = page.waitForResponse((r) => r.url().includes("/api/tasks/reorder"));
  await drag(page, card(page, "카드 C"), card(page, "카드 A"));
  expect((await reorder).status()).toBe(204);

  await page.reload();
  await expect(titles).toHaveText(["카드 C", "카드 A", "카드 B"]);
});

test("주간 계획으로 필터링하면 URL에 유지된다 (P1)", async ({ page, request }) => {
  const plan = await createPlan(request, LAST_MONDAY, { title: "지난주 계획" });
  await createTask(request, { title: "계획 카드", date: LAST_MONDAY, weeklyPlanId: plan.id });
  await createTask(request, { title: "미연결 카드", date: LAST_MONDAY });
  await createTask(request, { title: "이번 주 카드", date: TODAY });

  await page.goto("/board");
  await page.getByLabel("주간 계획 필터").selectOption(plan.id);
  await expect(page).toHaveURL(new RegExp(`plan=${plan.id}`));
  await expect(card(page, "계획 카드")).toBeVisible();
  await expect(card(page, "미연결 카드")).toHaveCount(0);
  await expect(card(page, "이번 주 카드")).toHaveCount(0);

  await page.reload();
  await expect(card(page, "계획 카드")).toBeVisible();
  await expect(page.getByLabel("주간 계획 필터")).toHaveValue(plan.id);
});
