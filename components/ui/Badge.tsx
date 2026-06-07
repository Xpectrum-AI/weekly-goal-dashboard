import { cn, STATUS_STYLES, themeColor } from "@/lib/utils";
import type { SubmissionStatus } from "@/lib/types";

export function StatusBadge({ status }: { status: SubmissionStatus }) {
  const s = STATUS_STYLES[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium", s.bg, s.text)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} />
      {status}
    </span>
  );
}

export function ThemeChip({ theme, count }: { theme: string; count?: number }) {
  const color = themeColor(theme);
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium"
      style={{ backgroundColor: `${color}1a`, color }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
      {theme}
      {count !== undefined && <span className="font-semibold">{count}</span>}
    </span>
  );
}

export function Pill({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-md bg-ink-100 px-2 py-0.5 text-xs font-medium text-ink-600", className)}>
      {children}
    </span>
  );
}

export function CountPill({
  value,
  label,
  tone = "ink",
}: {
  value: number;
  label: string;
  tone?: "ink" | "rose" | "emerald" | "amber";
}) {
  const tones = {
    ink: "bg-ink-100 text-ink-600",
    rose: "bg-rose-50 text-rose-700",
    emerald: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
  };
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium", tones[tone])}>
      <span className="font-semibold tabular-nums">{value}</span>
      <span className="text-[11px] opacity-80">{label}</span>
    </span>
  );
}
