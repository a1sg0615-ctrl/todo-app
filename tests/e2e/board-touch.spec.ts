import { devices, expect, test, type Locator, type Page } from "@playwright/test";
import { TODAY, card, column, createTask, resetDb } from "./helpers";

test.use({ ...devices["Pixel 7"] });

test.beforeEach(async () => {
  await resetDb();
});

/** CDP로 실제 터치 이벤트를 보낸다. holdMs만큼 누르고 있다가 target으로 끌어 놓는다. */
async function touchDrag(page: Page, source: Locator, target: Locator, holdMs: number) {
  const cdp = await page.context().newCDPSession(page);
  const s = (await source.boundingBox())!;
  const t = (await target.boundingBox())!;
  const from = { x: s.x + s.width / 2, y: s.y + s.height / 2 };
  const to = { x: t.x + t.width / 2, y: t.y + t.height / 2 };
  const touch = (type: "touchStart" | "touchMove" | "touchEnd", p: { x: number; y: number } | null) =>
    cdp.send("Input.dispatchTouchEvent", { type, touchPoints: p ? [{ x: p.x, y: p.y }] : [] });

  await touch("touchStart", from);
  await page.waitForTimeout(holdMs);
  for (let i = 1; i <= 15; i++) {
    await touch("touchMove", { x: from.x + ((to.x - from.x) * i) / 15, y: from.y + ((to.y - from.y) * i) / 15 });
  }
  await touch("touchEnd", null);
}

test("휴대폰에서 카드를 길게 눌러 끌면 상태가 바뀐다", async ({ page, request }) => {
  await createTask(request, { title: "터치 카드", date: TODAY });
  await page.goto("/board");
  await expect(column(page, "todo").getByText("터치 카드")).toBeVisible();

  const patch = page.waitForResponse((r) => r.request().method() === "PATCH");
  await touchDrag(page, card(page, "터치 카드"), column(page, "done"), 400);
  expect((await patch).status()).toBe(200);

  await page.reload();
  await expect(column(page, "done").getByText("터치 카드")).toBeVisible();
});

test("휴대폰에서 바로 쓸어 넘기면 드래그되지 않는다 (스크롤 우선)", async ({ page, request }) => {
  await createTask(request, { title: "스크롤 카드", date: TODAY });
  await page.goto("/board");
  await expect(card(page, "스크롤 카드")).toBeVisible();

  let patches = 0;
  page.on("request", (r) => {
    if (r.method() === "PATCH") patches++;
  });
  await touchDrag(page, card(page, "스크롤 카드"), column(page, "done"), 0);
  await page.waitForTimeout(1000);
  expect(patches).toBe(0);
  await expect(column(page, "todo").getByText("스크롤 카드")).toBeVisible();
});
