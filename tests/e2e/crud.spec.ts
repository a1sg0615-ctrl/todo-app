import { expect, test } from "@playwright/test";
import { addDays } from "../../src/lib/date";
import { THIS_MONDAY, TODAY, authHeaders, createGoal, createPlan, createTask, resetDb } from "./helpers";

test.beforeEach(async () => {
  await resetDb();
});

test("1년 목표 생성/수정/삭제와 연결된 주간 계획 목록", async ({ page, request }) => {
  await page.goto("/yearly");
  await page.getByLabel("새 1년 목표 제목").fill("건강해지기");
  await page.getByLabel("연도").fill("2026");
  await page.getByRole("button", { name: "추가" }).click();
  const goal = page.getByTestId("yearly-goal").filter({ hasText: "건강해지기" });
  await expect(goal).toBeVisible();

  await goal.getByRole("button", { name: "수정" }).click();
  await page.getByLabel("1년 목표 제목 수정").fill("더 건강해지기");
  await page.getByRole("button", { name: "저장" }).click();
  const renamed = page.getByTestId("yearly-goal").filter({ hasText: "더 건강해지기" });
  await expect(renamed).toBeVisible();

  const [created] = await (await request.get("/api/yearly-goals", { headers: authHeaders })).json();
  await createPlan(request, THIS_MONDAY, { title: "운동 주간", yearlyGoalId: created.id });
  await page.reload();
  await expect(renamed.getByLabel("더 건강해지기 연결된 주간 계획")).toContainText("운동 주간");

  // 확인 대화상자에서 취소하면 삭제되지 않는다.
  await renamed.getByRole("button", { name: "삭제" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "취소" }).click();
  await expect(renamed).toBeVisible();

  await renamed.getByRole("button", { name: "삭제" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "삭제" }).click();
  await expect(renamed).toHaveCount(0);
});

test("주간 계획 생성/수정/삭제, 진행률 표시, 중복 오류 메시지", async ({ page, request }) => {
  await createGoal(request, "독서", 2026);
  await page.goto("/weekly");

  const start = page.getByLabel("시작일 (월요일)");
  await expect(start).toHaveValue(THIS_MONDAY);
  await expect(start).toHaveAttribute("step", "7");
  await expect(page.getByText(`~ ${addDays(THIS_MONDAY, 6)}`)).toBeVisible();

  await page.getByLabel("새 주간 계획 제목").fill("책 2권");
  await page.getByLabel("새 주간 계획 1년 목표").selectOption({ label: "2026 · 독서" });
  await page.getByRole("button", { name: "추가" }).click();
  const plan = page.getByTestId("weekly-plan").filter({ hasText: "책 2권" });
  await expect(plan).toContainText("2026 · 독서");
  await expect(plan.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");

  // 같은 주에 다시 만들면 서버의 409 메시지가 보인다.
  await page.getByLabel("새 주간 계획 제목").fill("중복");
  await page.getByRole("button", { name: "추가" }).click();
  await expect(page.getByTestId("toast")).toContainText("이미 이 주");

  await plan.getByRole("button", { name: "수정" }).click();
  await page.getByLabel("주간 계획 제목 수정").fill("책 3권");
  await page.getByLabel("주간 계획 1년 목표 수정").selectOption("");
  await page.getByRole("button", { name: "저장" }).click();
  const edited = page.getByTestId("weekly-plan").filter({ hasText: "책 3권" });
  await expect(edited).toContainText("1년 목표 미연결");

  await edited.getByRole("button", { name: "삭제" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "삭제" }).click();
  await expect(edited).toHaveCount(0);
});

test("일일 할 일 생성/수정/삭제와 주간 계획 선택지", async ({ page, request }) => {
  await createPlan(request, THIS_MONDAY, { title: "이번 주 계획" });
  await createPlan(request, addDays(THIS_MONDAY, 7), { title: "다음 주 계획" });

  await page.goto(`/tasks?date=${TODAY}`);
  const planSelect = page.getByLabel("새 할 일 주간 계획");
  await expect(planSelect.locator("option")).toHaveText(["주간 계획 연결 안 함", "이번 주 계획"]);

  await page.getByLabel("새 할 일 제목").fill("장보기");
  await planSelect.selectOption({ label: "이번 주 계획" });
  await page.getByRole("button", { name: "추가" }).click();
  const row = page.getByTestId("task-row").filter({ hasText: "장보기" });
  await expect(row).toContainText("이번 주 계획");

  await row.getByRole("button", { name: "수정" }).click();
  await page.getByLabel("할 일 제목 수정").fill("장보기 (우유)");
  await page.getByLabel("할 일 상태 수정").selectOption("doing");
  await page.getByRole("button", { name: "저장" }).click();
  const edited = page.getByTestId("task-row").filter({ hasText: "장보기 (우유)" });
  await expect(edited).toContainText("진행 중");

  // 연결된 상태로 날짜를 다음 주로 바꾸면 서버 오류가 보이고 저장되지 않는다.
  await edited.getByRole("button", { name: "수정" }).click();
  await page.getByLabel("할 일 날짜 수정").fill(addDays(THIS_MONDAY, 8));
  await page.getByRole("button", { name: "저장" }).click();
  await expect(page.getByTestId("toast")).toContainText("주간 계획 기간");
  await page.getByRole("button", { name: "취소" }).click();
  await expect(edited).toBeVisible();

  await edited.getByRole("button", { name: "삭제" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "취소" }).click();
  await expect(edited).toBeVisible();
  await edited.getByRole("button", { name: "삭제" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "삭제" }).click();
  await expect(edited).toHaveCount(0);
});

test("제목 없이 추가하면 검증 오류 메시지가 보인다", async ({ page }) => {
  await page.goto("/tasks");
  await page.getByRole("button", { name: "추가" }).click();
  await expect(page.getByTestId("toast")).toContainText("제목은 필수입니다");
});

test("미연결 할 일 목록을 따로 보여준다 (P1)", async ({ page, request }) => {
  const plan = await createPlan(request, THIS_MONDAY);
  await createTask(request, { title: "연결된 일", date: TODAY, weeklyPlanId: plan.id });
  await createTask(request, { title: "떠도는 일", date: addDays(TODAY, -30) });

  await page.goto("/tasks");
  const unlinked = page.getByLabel("미연결 할 일 목록");
  await expect(unlinked).toContainText("떠도는 일");
  await expect(unlinked).not.toContainText("연결된 일");
});

test("할 일, 주간 계획, 1년 목표에 메모를 적을 수 있다", async ({ page, request }) => {
  await createTask(request, { title: "메모 할 일", date: TODAY });
  await createPlan(request, THIS_MONDAY, { title: "메모 주간" });
  await createGoal(request, "메모 목표");

  await page.goto(`/tasks?date=${TODAY}`);
  const row = page.getByTestId("task-row").filter({ hasText: "메모 할 일" });
  await row.getByRole("button", { name: "수정" }).click();
  await page.getByLabel("할 일 메모 수정").fill("첫 줄\n둘째 줄");
  await page.getByRole("button", { name: "저장" }).click();
  await expect(row.getByTestId("memo")).toHaveText("첫 줄\n둘째 줄");

  await page.goto("/weekly");
  const plan = page.getByTestId("weekly-plan").filter({ hasText: "메모 주간" });
  await plan.getByRole("button", { name: "수정" }).click();
  await page.getByLabel("주간 계획 메모 수정").fill("주간 메모");
  await page.getByRole("button", { name: "저장" }).click();
  await expect(plan.getByTestId("memo")).toHaveText("주간 메모");

  await page.goto("/yearly");
  const goal = page.getByTestId("yearly-goal").filter({ hasText: "메모 목표" });
  await goal.getByRole("button", { name: "수정" }).click();
  await page.getByLabel("1년 목표 메모 수정").fill("연간 메모");
  await page.getByRole("button", { name: "저장" }).click();
  await expect(goal.getByTestId("memo")).toHaveText("연간 메모");

  await page.reload();
  await expect(goal.getByTestId("memo")).toHaveText("연간 메모");
});

test("추가할 때 바로 메모를 적을 수 있다", async ({ page }) => {
  await page.goto("/yearly");
  await page.getByLabel("새 1년 목표 제목").fill("새 목표");
  await page.getByLabel("새 1년 목표 메모").fill("목표 메모");
  await page.getByRole("button", { name: "추가" }).click();
  await expect(page.getByTestId("yearly-goal").filter({ hasText: "새 목표" }).getByTestId("memo")).toHaveText("목표 메모");
  await expect(page.getByLabel("새 1년 목표 메모")).toHaveValue("");

  await page.goto("/weekly");
  await page.getByLabel("새 주간 계획 제목").fill("새 주간");
  await page.getByLabel("새 주간 계획 메모").fill("주간 메모");
  await page.getByRole("button", { name: "추가" }).click();
  await expect(page.getByTestId("weekly-plan").filter({ hasText: "새 주간" }).getByTestId("memo")).toHaveText("주간 메모");

  await page.goto(`/tasks?date=${TODAY}`);
  await page.getByLabel("새 할 일 제목").fill("새 할 일");
  await page.getByLabel("새 할 일 메모").fill("할 일 메모");
  await page.getByRole("button", { name: "추가" }).click();
  await expect(page.getByTestId("task-row").filter({ hasText: "새 할 일" }).getByTestId("memo")).toHaveText("할 일 메모");
});
