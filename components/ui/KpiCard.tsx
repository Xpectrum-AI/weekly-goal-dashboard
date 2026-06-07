import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

export function KpiCard({
  label,
  value,
  icon: Icon,
  delta,
  deltaLabel,
  tone = "brand",
  suffix,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  delta?: number;
  deltaLabel?: string;
  tone?: "brand" | "emerald" | "amber" | "rose" | "sky" | "violet";
  suffix?: string;
}) {
  const tones: Record<string, string> = {
    brand: "bg-brand-50 text-brand-600",
    emerald: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    rose: "bg-rose-50 text-rose-600",
    sky: "bg-sky-50 text-sky-600",
    violet: "bg-violet-50 text-violet-600",
  };
  const positive = (delta ?? 0) >= 0;
  return (
    <div className="card p-5 transition hover:shadow-card-hover">
      <div className="flex items-start justify-between">
        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-xl",
            tones[tone]
          )}
        >
          <Icon size={20} />
        </div>
        {delta !== undefined && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-xs font-semibold",
              positive
                ? "bg-emerald-50 text-emerald-600"
                : "bg-rose-50 text-rose-600"
            )}
          >
            {positive ? (
              <ArrowUpRight size={13} />
            ) : (
              <ArrowDownRight size={13} />
            )}
            {Math.abs(delta)}%
          </span>
        )}
      </div>
      <div className="mt-4">
        <p className="text-3xl font-bold tracking-tight text-ink-900">
          {value}
          {suffix && (
            <span className="text-lg font-semibold text-ink-400">{suffix}</span>
          )}
        </p>
        <p className="mt-1 text-sm font-medium text-ink-500">{label}</p>
        {deltaLabel && (
          <p className="mt-0.5 text-xs text-ink-400">{deltaLabel}</p>
        )}
      </div>
    </div>
  );
}
