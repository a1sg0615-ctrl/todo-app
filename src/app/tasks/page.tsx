"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState, type FormEvent } from "react";
import { useConfirm } from "@/components/ConfirmDialog";
import { MemoInput, MemoText } from "@/components/Memo";
import { useToast } from "@/components/Toast";
import { api, errorMessage } from "@/lib/api";
import { isValidDate, today, weekStart } from "@/lib/date";
import { TASK_STATUSES, type TaskDTO, type TaskStatus, type WeeklyPlanDTO } from "@/lib/types";

const STATUS_LABEL: Record<TaskStatus, string> = { todo: "할 일", doing: "진행 중", done: "완료" };

export default function TasksPage() {
  return (
    <Suspense>
      <TasksView />
    </Suspense>
  );
}

/** 해당 날짜가 포함된 주의 주간 계획만 선택지로 보여준다. */
function PlanSelect({
  date,
  plans,
  value,
  onChange,
  label,
}: {
  date: string;
  plans: WeeklyPlanDTO[];
  value: string;
  onChange: (value: string) => void;
  label: string;
}) {
  const options = isValidDate(date) ? plans.filter((p) => p.startDate === weekStart(date)) : [];
  return (
    <select className="input" aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">주간 계획 연결 안 함</option>
      {options.map((p) => (
        <option key={p.id} value={p.id}>
          {p.title}
        </option>
      ))}
    </select>
  );
}

function TasksView() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const toast = useToast();
  const confirm = useConfirm();

  const dateParam = params.get("date") ?? "";
  const date = isValidDate(dateParam) ? dateParam : today();

  const [tasks, setTasks] = useState<TaskDTO[]>([]);
  const [unlinked, setUnlinked] = useState<TaskDTO[]>([]);
  const [plans, setPlans] = useState<WeeklyPlanDTO[]>([]);
  const [title, setTitle] = useState("");
  const [planId, setPlanId] = useState("");
  const [memo, setMemo] = useState("");

  const load = useCallback(async () => {
    try {
      const [dayTasks, unlinkedTasks, planList] = await Promise.all([
        api<TaskDTO[]>(`/api/tasks?date=${date}`),
        api<TaskDTO[]>("/api/tasks?unlinked=1"),
        api<WeeklyPlanDTO[]>("/api/weekly-plans"),
      ]);
      setTasks(dayTasks);
      setUnlinked(unlinkedTasks);
      setPlans(planList);
    } catch (err) {
      toast(errorMessage(err));
    }
  }, [date, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  // 날짜를 바꾸면 이전 주의 계획 선택은 의미가 없어지므로 초기화한다.
  useEffect(() => setPlanId(""), [date]);

  async function create(e: FormEvent) {
    e.preventDefault();
    try {
      await api("/api/tasks", { method: "POST", body: { title, date, weeklyPlanId: planId || null, memo } });
      setTitle("");
      setMemo("");
      await load();
    } catch (err) {
      toast(errorMessage(err));
    }
  }

  async function remove(task: TaskDTO) {
    if (!(await confirm(`"${task.title}" 할 일을 삭제할까요?`))) return;
    try {
      await api(`/api/tasks/${task.id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      toast(errorMessage(err));
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold">일일 할 일</h1>
          <input
            type="date"
            className="input"
            aria-label="날짜 선택"
            value={date}
            onChange={(e) => e.target.value && router.replace(`${pathname}?date=${e.target.value}`)}
          />
        </div>

        <form onSubmit={create} className="card flex flex-wrap items-center gap-2">
          <input
            className="input flex-1"
            placeholder="할 일 제목"
            aria-label="새 할 일 제목"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <PlanSelect date={date} plans={plans} value={planId} onChange={setPlanId} label="새 할 일 주간 계획" />
          <button className="btn btn-primary" type="submit">
            추가
          </button>
          <MemoInput value={memo} onChange={setMemo} label="새 할 일 메모" />
        </form>

        <ul className="space-y-2" aria-label="할 일 목록">
          {tasks.length === 0 && <li className="text-sm text-slate-500">이 날짜에 할 일이 없습니다.</li>}
          {tasks.map((task) => (
            <TaskRow key={task.id} task={task} plans={plans} onSaved={load} onDelete={() => remove(task)} />
          ))}
        </ul>
      </section>

      <aside className="space-y-3">
        <h2 className="font-semibold">미연결 할 일</h2>
        <ul className="card space-y-1 text-sm" aria-label="미연결 할 일 목록">
          {unlinked.length === 0 && <li className="text-slate-500">모든 할 일이 주간 계획에 연결되어 있습니다.</li>}
          {unlinked.map((task) => (
            <li key={task.id} className="flex justify-between gap-2">
              <span>{task.title}</span>
              <span className="tabular-nums text-slate-500">{task.date}</span>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}

function TaskRow({
  task,
  plans,
  onSaved,
  onDelete,
}: {
  task: TaskDTO;
  plans: WeeklyPlanDTO[];
  onSaved: () => Promise<void>;
  onDelete: () => void;
}) {
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task);

  const planTitle = plans.find((p) => p.id === task.weeklyPlanId)?.title;

  async function save(e: FormEvent) {
    e.preventDefault();
    try {
      await api(`/api/tasks/${task.id}`, {
        method: "PATCH",
        body: {
          title: draft.title,
          date: draft.date,
          status: draft.status,
          weeklyPlanId: draft.weeklyPlanId,
          memo: draft.memo,
        },
      });
      setEditing(false);
      await onSaved();
    } catch (err) {
      toast(errorMessage(err));
    }
  }

  if (editing) {
    return (
      <li className="card">
        <form onSubmit={save} className="flex flex-wrap items-center gap-2">
          <input
            className="input flex-1"
            aria-label="할 일 제목 수정"
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          />
          <input
            type="date"
            className="input"
            aria-label="할 일 날짜 수정"
            value={draft.date}
            onChange={(e) => setDraft({ ...draft, date: e.target.value })}
          />
          <select
            className="input"
            aria-label="할 일 상태 수정"
            value={draft.status}
            onChange={(e) => setDraft({ ...draft, status: e.target.value as TaskStatus })}
          >
            {TASK_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
          <PlanSelect
            date={draft.date}
            plans={plans}
            value={draft.weeklyPlanId ?? ""}
            onChange={(v) => setDraft({ ...draft, weeklyPlanId: v || null })}
            label="할 일 주간 계획 수정"
          />
          <MemoInput value={draft.memo} onChange={(memo) => setDraft({ ...draft, memo })} label="할 일 메모 수정" />
          <button className="btn btn-primary" type="submit">
            저장
          </button>
          <button className="btn" type="button" onClick={() => setEditing(false)}>
            취소
          </button>
        </form>
      </li>
    );
  }

  return (
    <li className="card space-y-2" data-testid="task-row">
      <div className="flex items-center gap-3">
        <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{STATUS_LABEL[task.status]}</span>
        <span className="flex-1">{task.title}</span>
        <span className="text-xs text-slate-500">{planTitle ?? "미연결"}</span>
        <button
          className="btn"
          onClick={() => {
            setDraft(task);
            setEditing(true);
          }}
        >
          수정
        </button>
        <button className="btn" onClick={onDelete}>
          삭제
        </button>
      </div>
      <MemoText memo={task.memo} />
    </li>
  );
}
