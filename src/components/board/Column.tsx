"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { TaskDTO, TaskStatus } from "@/lib/types";

const TITLES: Record<TaskStatus, string> = { todo: "할 일", doing: "진행 중", done: "완료" };

export function Column({ status, tasks, pending }: { status: TaskStatus; tasks: TaskDTO[]; pending: Set<string> }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <section
      ref={setNodeRef}
      data-testid={`column-${status}`}
      aria-label={`${TITLES[status]} 컬럼`}
      className={`flex min-h-64 flex-col rounded-lg border p-3 ${
        isOver ? "border-sky-400 bg-sky-50" : "border-slate-200 bg-slate-100"
      }`}
    >
      <h2 className="mb-3 flex items-center justify-between text-sm font-semibold text-slate-700">
        {TITLES[status]} <span className="text-xs text-slate-500">{tasks.length}</span>
      </h2>
      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <ul className="flex flex-1 flex-col gap-2">
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} disabled={pending.has(task.id)} />
          ))}
        </ul>
      </SortableContext>
    </section>
  );
}

function TaskCard({ task, disabled }: { task: TaskDTO; disabled: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    disabled, // 저장 중인 카드는 다시 끌 수 없다.
  });

  return (
    <li
      ref={setNodeRef}
      data-testid="task-card"
      data-task-id={task.id}
      aria-busy={disabled}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`touch-manipulation select-none rounded-md border border-slate-200 bg-white p-3 shadow-sm [-webkit-touch-callout:none] ${
        isDragging ? "z-10 opacity-70 shadow-lg" : ""
      } ${disabled ? "cursor-wait opacity-60" : "cursor-grab"}`}
      {...attributes}
      {...listeners}
    >
      <p className="text-sm font-medium">{task.title}</p>
      <p className="mt-1 text-xs text-slate-500">{task.date}</p>
    </li>
  );
}
