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
      className={`flex min-h-64 flex-col rounded-md border-2 p-3 transition-colors ${
        isOver ? "border-ink bg-surface-strong" : "border-transparent bg-surface-soft"
      }`}
    >
      <h2 className="mb-3 flex items-center justify-between px-1 text-base font-semibold text-ink">
        {TITLES[status]} <span className="chip">{tasks.length}</span>
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
      className={`touch-manipulation select-none rounded-md border border-hairline bg-canvas p-4 transition-shadow hover:shadow-float [-webkit-touch-callout:none] ${
        isDragging ? "z-10 opacity-80 shadow-float" : ""
      } ${disabled ? "cursor-wait opacity-60" : "cursor-grab"}`}
      {...attributes}
      {...listeners}
    >
      <p className="text-base font-semibold text-ink">{task.title}</p>
      <p className="mt-1 text-sm text-muted">{task.date}</p>
    </li>
  );
}
