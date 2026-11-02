"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useConfirm } from "@/components/ConfirmDialog";
import { MemoInput, MemoText } from "@/components/Memo";
import { ProgressBar } from "@/components/ProgressBar";
import { useToast } from "@/components/Toast";
import { api, errorMessage } from "@/lib/api";
import type { WeeklyPlanDTO, YearlyGoalDTO } from "@/lib/types";

export default function YearlyPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const [goals, setGoals] = useState<YearlyGoalDTO[]>([]);
  const [plans, setPlans] = useState<WeeklyPlanDTO[]>([]);
  const [title, setTitle] = useState("");
  const [memo, setMemo] = useState("");
  const [year, setYear] = useState(() => String(new Date().getFullYear()));

  const load = useCallback(async () => {
    try {
      const [goalList, planList] = await Promise.all([
        api<YearlyGoalDTO[]>("/api/yearly-goals"),
        api<WeeklyPlanDTO[]>("/api/weekly-plans"),
      ]);
      setGoals(goalList);
      setPlans(planList);
    } catch (err) {
      toast(errorMessage(err));
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function create(e: FormEvent) {
    e.preventDefault();
    try {
      await api("/api/yearly-goals", { method: "POST", body: { title, year: Number(year), memo } });
      setTitle("");
      setMemo("");
      await load();
    } catch (err) {
      toast(errorMessage(err));
    }
  }

  async function remove(goal: YearlyGoalDTO) {
    if (!(await confirm(`"${goal.title}" 1년 목표를 삭제할까요? 연결된 주간 계획은 남고 연결만 해제됩니다.`))) return;
    try {
      await api(`/api/yearly-goals/${goal.id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      toast(errorMessage(err));
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="page-title">1년 목표</h1>

      <form onSubmit={create} className="card flex flex-wrap items-center gap-3">
        <input
          className="input flex-1"
          placeholder="1년 목표 제목"
          aria-label="새 1년 목표 제목"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <input
          type="number"
          className="input w-24"
          aria-label="연도"
          value={year}
          onChange={(e) => setYear(e.target.value)}
        />
        <button className="btn btn-primary" type="submit">
          추가
        </button>
        <MemoInput value={memo} onChange={setMemo} label="새 1년 목표 메모" />
      </form>

      <ul className="space-y-3" aria-label="1년 목표 목록">
        {goals.length === 0 && <li className="text-sm text-muted">1년 목표가 없습니다.</li>}
        {goals.map((goal) => (
          <GoalRow
            key={goal.id}
            goal={goal}
            plans={plans.filter((p) => p.yearlyGoalId === goal.id)}
            onSaved={load}
            onDelete={() => remove(goal)}
          />
        ))}
      </ul>
    </div>
  );
}

function GoalRow({
  goal,
  plans,
  onSaved,
  onDelete,
}: {
  goal: YearlyGoalDTO;
  plans: WeeklyPlanDTO[];
  onSaved: () => Promise<void>;
  onDelete: () => void;
}) {
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(goal.title);
  const [year, setYear] = useState(String(goal.year));
  const [memo, setMemo] = useState(goal.memo);

  async function save(e: FormEvent) {
    e.preventDefault();
    try {
      await api(`/api/yearly-goals/${goal.id}`, { method: "PATCH", body: { title, year: Number(year), memo } });
      setEditing(false);
      await onSaved();
    } catch (err) {
      toast(errorMessage(err));
    }
  }

  return (
    <li className="card space-y-3" data-testid="yearly-goal">
      {editing ? (
        <form onSubmit={save} className="flex flex-wrap items-center gap-2">
          <input
            className="input flex-1"
            aria-label="1년 목표 제목 수정"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <input
            type="number"
            className="input w-24"
            aria-label="연도 수정"
            value={year}
            onChange={(e) => setYear(e.target.value)}
          />
          <MemoInput value={memo} onChange={setMemo} label="1년 목표 메모 수정" />
          <button className="btn btn-primary" type="submit">
            저장
          </button>
          <button className="btn" type="button" onClick={() => setEditing(false)}>
            취소
          </button>
        </form>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <span className="chip">{goal.year}</span>
          <span className="text-base font-semibold">{goal.title}</span>
          <span className="ml-auto flex gap-2">
            <button
              className="btn-text"
              onClick={() => {
                setTitle(goal.title);
                setYear(String(goal.year));
                setMemo(goal.memo);
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
      {!editing && <MemoText memo={goal.memo} />}
      <ProgressBar value={goal.progress} label={`${goal.title} 진행률`} />
      <div>
        <p className="mb-2 text-sm font-medium text-muted">연결된 주간 계획 ({plans.length})</p>
        <ul className="space-y-1 text-sm" aria-label={`${goal.title} 연결된 주간 계획`}>
          {plans.length === 0 && <li className="text-muted-soft">없음</li>}
          {plans.map((p) => (
            <li key={p.id} className="flex justify-between gap-2">
              <span>
                {p.title} <span className="text-muted">({p.startDate} ~ {p.endDate})</span>
              </span>
              <span className="text-muted">{p.progress}%</span>
            </li>
          ))}
        </ul>
      </div>
    </li>
  );
}
