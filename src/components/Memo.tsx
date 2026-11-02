export function MemoText({ memo }: { memo: string }) {
  if (!memo) return null;
  return (
    <p data-testid="memo" className="whitespace-pre-wrap border-l-2 border-hairline pl-3 text-sm text-muted">
      {memo}
    </p>
  );
}

export function MemoInput({ value, onChange, label }: { value: string; onChange: (value: string) => void; label: string }) {
  return (
    <textarea
      className="input w-full basis-full"
      rows={3}
      maxLength={2000}
      placeholder="메모"
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
