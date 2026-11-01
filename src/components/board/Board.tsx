"use client";

import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ProgressBar } from "@/components/ProgressBar";
import { useToast } from "@/components/Toast";
import { api, errorMessage } from "@/lib/api";
import { addDays, isMonday, isValidDate, today, weekStart } from "@/lib/date";
import { TASK_STATUSES, type TaskDTO, type TaskStatus, type WeeklyPlanDTO } from "@/lib/types";
import { Column } from "./Column";

const isStatus = (value: unknown): value is TaskStatus => TASK_STATUSES.includes(value as TaskStatus);
const byOrder = (a: TaskDTO, b: TaskDTO) => a.order - b.order || a.createdAt.localeCompare(b.createdAt);

export function Board() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const toast = useToast();

  const weekParam = params.get("week") ?? "";
  const week = isValidDate(weekParam) && isMonday(weekParam) ? weekParam : weekStart(today());
  const planFilter = params.get("plan") ?? "";

  const [tasks, setTasks] = useState<TaskDTO[]>([]);
  const [plans, setPlans] = useState<WeeklyPlanDTO[]>([]);
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const loadPlans = useCallback(async () => {
    setPlans(await api<WeeklyPlanDTO[]>("/api/weekly-plans"));
  }, []);

  useEffect(() => {
    let cancelled = false;
    const query = planFilter
      ? `weeklyPlanId=${planFilter}`
      : `from=${week}&to=${addDays(week, 6)}`;
    setLoading(true);
    Promise.all([api<TaskDTO[]>(`/api/tasks?${query}`), api<WeeklyPlanDTO[]>("/api/weekly-plans")])
      .then(([taskList, planList]) => {
        if (cancelled) return;
        setTasks(taskList);
        setPlans(planList);
      })
      .catch((err) => !cancelled && toast(errorMessage(err)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [week, planFilter, toast]);

  const setQuery = (next: { week?: string; plan?: string }) => {
    const q = new URLSearchParams();
    const nextWeek = next.week ?? week;
    if (nextWeek !== weekStart(today())) q.set("week", nextWeek);
    if (next.plan) q.set("plan", next.plan);
    router.push(q.size ? `${pathname}?${q}` : pathname);
  };

  const columns = useMemo(() => {
    const grouped: Record<TaskStatus, TaskDTO[]> = { todo: [], doing: [], done: [] };
    for (const task of tasks) grouped[task.status].push(task);
    for (const status of TASK_STATUSES) grouped[status].sort(byOrder);
    return grouped;
  }, [tasks]);

  const weekPlan = plans.find((p) => (planFilter ? p.id === planFilter : p.startDate === week));

  const markPending = (id: string, on: boolean) =>
    setPending((set) => {
      const next = new Set(set);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  async function moveTask(task: TaskDTO, status: TaskStatus) {
    // 낙관적 업데이트: 화면을 먼저 바꾸고, 실패하면 이 카드만 원래대로 되돌린다.
    setTasks((list) => list.map((t) => (t.id === task.id ? { ...t, status, order: Number.MAX_SAFE_INTEGER } : t)));
    markPending(task.id, true);
    try {
      const saved = await api<TaskDTO>(`/api/tasks/${task.id}`, { method: "PATCH", body: { status } });
      setTasks((list) => list.map((t) => (t.id === saved.id ? saved : t)));
      if (task.weeklyPlanId) await loadPlans();
    } catch (err) {
      setTasks((list) => list.map((t) => (t.id === task.id ? task : t)));
      toast(`상태를 바꾸지 못했습니다: ${errorMessage(err)}`);
    } finally {
      markPending(task.id, false);
    }
  }

  async function reorder(status: TaskStatus, activeId: string, overId: string) {
    const column = columns[status];
    const from = column.findIndex((t) => t.id === activeId);
    const to = column.findIndex((t) => t.id === overId);
    if (from < 0 || to < 0 || from === to) return;

    const previous = new Map(column.map((t) => [t.id, t.order]));
    const moved = arrayMove(column, from, to);
    const order = new Map(moved.map((t, i) => [t.id, i]));
    setTasks((list) => list.map((t) => (order.has(t.id) ? { ...t, order: order.get(t.id)! } : t)));
    try {
      await api("/api/tasks/reorder", { method: "POST", body: { ids: moved.map((t) => t.id) } });
    } catch (err) {
      // 그 사이 끝난 다른 카드의 변경은 지우지 않도록, 순서를 바꾼 카드만 되돌린다.
      setTasks((list) => list.map((t) => (previous.has(t.id) ? { ...t, order: previous.get(t.id)! } : t)));
      toast(`순서를 바꾸지 못했습니다: ${errorMessage(err)}`);
    }
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over) return;
    const task = tasks.find((t) => t.id === active.id);
    const target = isStatus(over.id) ? over.id : tasks.find((t) => t.id === over.id)?.status;
    if (!task || !target) return;

    if (target !== task.status) void moveTask(task, target);
    else if (!isStatus(over.id) && over.id !== active.id) void reorder(target, task.id, String(over.id));
    // 같은 컬럼의 빈 곳이나 제자리에 놓으면 아무 요청도 보내지 않는다.
  }

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    // 터치는 바로 끌면 화면 스크롤이 되도록 두고, 살짝 길게 누르면 드래그를 시작한다.
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn" onClick={() => setQuery({ week: addDays(week, -7) })}>
          이전 주
        </button>
        <button className="btn" onClick={() => setQuery({ week: weekStart(today()) })}>
          이번 주
        </button>
        <button className="btn" onClick={() => setQuery({ week: addDays(week, 7) })}>
          다음 주
        </button>
        <span data-testid="week-range" className="ml-2 font-medium tabular-nums">
          {planFilter && weekPlan
            ? `${weekPlan.startDate} ~ ${weekPlan.endDate}`
            : `${week} ~ ${addDays(week, 6)}`}
        </span>

        <label className="ml-auto flex items-center gap-2 text-sm">
          주간 계획 필터
          <select
            className="input"
            aria-label="주간 계획 필터"
            value={planFilter}
            onChange={(e) => {
              const plan = plans.find((p) => p.id === e.target.value);
              setQuery(plan ? { week: plan.startDate, plan: plan.id } : { plan: "" });
            }}
          >
            <option value="">전체 (주 단위)</option>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title} ({p.startDate})
              </option>
            ))}
          </select>
        </label>
      </div>

      {weekPlan && (
        <div className="card flex items-center gap-4 py-3">
          <span className="text-sm text-slate-500">주간 계획</span>
          <span className="font-medium">{weekPlan.title}</span>
          <div className="flex-1">
            <ProgressBar value={weekPlan.progress} label={`${weekPlan.title} 진행률`} />
          </div>
        </div>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={onDragEnd}>
        <div className={`grid gap-4 md:grid-cols-3 ${loading ? "opacity-60" : ""}`}>
          {TASK_STATUSES.map((status) => (
            <Column key={status} status={status} tasks={columns[status]} pending={pending} />
          ))}
        </div>
      </DndContext>
    </div>
  );
}
