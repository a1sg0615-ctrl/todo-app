// 서버 응답 형태. 클라이언트에서도 import하므로 mongoose에 의존하지 않는다.

export const TASK_STATUSES = ["todo", "doing", "done"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export interface TaskDTO {
  id: string;
  title: string;
  date: string;
  status: TaskStatus;
  weeklyPlanId: string | null;
  memo: string;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface WeeklyPlanDTO {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  yearlyGoalId: string | null;
  memo: string;
  progress: number;
}

export interface YearlyGoalDTO {
  id: string;
  title: string;
  year: number;
  memo: string;
  progress: number;
}

export interface UserDTO {
  id: string;
  username: string;
  avatarUrl: string;
}
