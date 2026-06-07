import { cn, completenessColor as progressColor } from "@/lib/utils";

export function ProgressBar({
  value,
  className,
  showLabel = false,
}: {
  value: number;
  className?: string;
  showLabel?: boolean;
}) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-ink-100">
        <div
          className={cn("h-full rounded-full transition-all", progressColor(v))}
          style={{ width: `${v}%` }}
        />
      </div>
      {showLabel && (
        <span className="w-9 text-right text-xs font-semibold tabular-nums text-ink-600">
          {v}%
        </span>
      )}
    </div>
  );
}

export function Ring({
  value,
  size = 56,
  stroke = 6,
  color = "#4f46e5",
  label,
}: {
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  label?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, value));
  const offset = c - (v / 100) * c;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#e2e8f0" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-500"
        />
      </svg>
      <span className="absolute text-xs font-bold text-ink-800">
        {label ?? `${v}%`}
      </span>
    </div>
  );
}
