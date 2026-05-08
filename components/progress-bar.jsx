export function ProgressBar({ billed = 0, collected = 0 }) {
  return (
    <div className="relative h-2 rounded-full bg-muted overflow-hidden">
      <div className="absolute inset-y-0 left-0 bg-sky-500" style={{ width: `${billed}%` }} />
      <div className="absolute inset-y-0 left-0 bg-emerald-500" style={{ width: `${collected}%` }} />
    </div>
  );
}
