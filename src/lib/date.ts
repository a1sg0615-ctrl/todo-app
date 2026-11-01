// 날짜는 시간대 영향을 받지 않도록 'YYYY-MM-DD' 문자열로 다룬다.
// 내부 계산은 UTC 자정 기준 Date로만 한다.

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function toUTC(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}

function format(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function isValidDate(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const d = toUTC(value);
  return !Number.isNaN(d.getTime()) && format(d) === value;
}

export function addDays(date: string, days: number): string {
  const d = toUTC(date);
  d.setUTCDate(d.getUTCDate() + days);
  return format(d);
}

export function isMonday(date: string): boolean {
  return toUTC(date).getUTCDay() === 1;
}

/** date가 속한 주의 월요일 */
export function weekStart(date: string): string {
  const day = toUTC(date).getUTCDay(); // 0=일 ... 6=토
  return addDays(date, -((day + 6) % 7));
}

/** 사용자 로컬 시간 기준 오늘 */
export function today(): string {
  const now = new Date();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${m}-${d}`;
}
