"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useConfirm } from "@/components/ConfirmDialog";
import { MemoInput, MemoText } from "@/components/Memo";
import { ProgressBar } from "@/components/ProgressBar";
import { useToast } from "@/components/Toast";
import { api, errorMessage } from "@/lib/api";
import { addDays, isMonday, isValidDate, today, weekStart } from "@/lib/date";
import type { WeeklyPlanDTO, YearlyGoalDTO } from "@/lib/types";

// date input의 step은 min 기준이므로 월요일(2001-01-01)을 min으로 두면 월요일만 고를 수 있다.
const MONDAY_MIN = "2001-01-01";

function GoalSelect({
  goals,
  value,
  onChange,
  label,
}: {
  goals: YearlyGoalDTO[];
  value: string;
  onChange: (value: string) => void;
  label: string;
}) {
  return (
    <select className="input" aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">1년 목표 연결 안 함</option>
      {goals.map((g) => (
        <option key={g.id} value={g.id}>
          {g.year} · {g.title}
        </option>
      ))}
    </select>
  );
}

export default function WeeklyPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const [plans, setPlans] = useState<WeeklyPlanDTO[]>([]);
  const [goals, setGoals] = useState<YearlyGoalDTO[]>([]);
  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState(() => weekStart(today()));
  const [goalId, setGoalId] = useState("");
  const [memo, setMemo] = useState("");

  const load = useCallback(async () => {
    try {
      const [planList, goalList] = await Promise.all([
        api<WeeklyPlanDTO[]>("/api/weekly-plans"),
        api<YearlyGoalDTO[]>("/api/yearly-goals"),
      ]);
      setPlans(planList);
      setGoals(goalList);
    } catch (err) {
      toast(errorMessage(err));
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const validStart = isValidDate(startDate);

  async function create(e: FormEvent) {
    e.preventDefault();
    try {
      await api("/api/weekly-plans", {
        method: "POST",
        body: { title, startDate, endDate: validStart ? addDays(startDate, 6) : "", yearlyGoalId: goalId || null, memo },
      });
      setTitle("");
      setMemo("");
      await load();
    } catch (err) {
      toast(errorMessage(err));
    }
  }

  async function remove(plan: WeeklyPlanDTO) {
    if (!(await confirm(`"${plan.title}" 주간 계획을 삭제할까요? 연결된 할 일은 남고 연결만 해제됩니다.`))) return;
    try {
      await api(`/api/weekly-plans/${plan.id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      toast(errorMessage(err));
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="page-title">주간 계획</h1>

      <form onSubmit={create} className="card flex flex-wrap items-center gap-3">
        <input
          className="input flex-1"
          placeholder="주간 계획 제목"
          aria-label="새 주간 계획 제목"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <input
          type="date"
          className="input"
          aria-label="시작일 (월요일)"
          min={MONDAY_MIN}
          step={7}
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
        />
        <span className="text-sm text-muted">
          ~ {validStart ? addDays(startDate, 6) : "-"}
          {validStart && !isMonday(startDate) && <span className="ml-2 text-error">월요일을 선택하세요</span>}
        </span>
        <GoalSelect goals={goals} value={goalId} onChange={setGoalId} label="새 주간 계획 1년 목표" />
        <button className="btn btn-primary" type="submit">
          추가
        </button>
        <MemoInput value={memo} onChange={setMemo} label="새 주간 계획 메모" />
      </form>

      <ul className="space-y-3" aria-label="주간 계획 목록">
        {plans.length === 0 && <li className="text-sm text-muted">주간 계획이 없습니다.</li>}
        {plans.map((plan) => (
          <PlanRow key={plan.id} plan={plan} goals={goals} onSaved={load} onDelete={() => remove(plan)} />
        ))}
      </ul>
    </div>
  );
}

function PlanRow({
  plan,
  goals,
  onSaved,
  onDelete,
}: {
  plan: WeeklyPlanDTO;
  goals: YearlyGoalDTO[];
  onSaved: () => Promise<void>;
  onDelete: () => void;
}) {
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(plan.title);
  const [goalId, setGoalId] = useState(plan.yearlyGoalId ?? "");
  const [memo, setMemo] = useState(plan.memo);
  const goal = goals.find((g) => g.id === plan.yearlyGoalId);

  async function save(e: FormEvent) {
    e.preventDefault();
    try {
      await api(`/api/weekly-plans/${plan.id}`, { method: "PATCH", body: { title, yearlyGoalId: goalId || null, memo } });
      setEditing(false);
      await onSaved();
    } catch (err) {
      toast(errorMessage(err));
    }
  }

  return (
    <li className="card space-y-3" data-testid="weekly-plan">
      {editing ? (
        <form onSubmit={save} className="flex flex-wrap items-center gap-2">
          <input
            className="input flex-1"
            aria-label="주간 계획 제목 수정"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <GoalSelect goals={goals} value={goalId} onChange={setGoalId} label="주간 계획 1년 목표 수정" />
          <MemoInput value={memo} onChange={setMemo} label="주간 계획 메모 수정" />
          <button className="btn btn-primary" type="submit">
            저장
          </button>
          <button className="btn" type="button" onClick={() => setEditing(false)}>
            취소
          </button>
        </form>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-base font-semibold">{plan.title}</span>
          <span className="text-sm text-muted">
            {plan.startDate} ~ {plan.endDate}
          </span>
          <span className="text-sm text-muted">{goal ? `${goal.year} · ${goal.title}` : "1년 목표 미연결"}</span>
          <span className="ml-auto flex gap-2">
            <button
              className="btn-text"
              onClick={() => {
                setTitle(plan.title);
                setGoalId(plan.yearlyGoalId ?? "");
                setMemo(plan.memo);
                setEditing(true);
              }}
            >
              수정
            </button>
            <button className="btn-text" onClick={onDelete}>
              삭제
            </button>
          </span>
        </div>
      )}
      {!editing && <MemoText memo={plan.memo} />}
      <ProgressBar value={plan.progress} label={`${plan.title} 진행률`} />
    </li>
  );
}
