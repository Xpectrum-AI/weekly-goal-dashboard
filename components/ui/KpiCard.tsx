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
    <div className="card p-4 transition hover:shadow-card-hover sm:p-5">
      <div className="flex items-start justify-between">
        <div
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-xl sm:h-10 sm:w-10",
            tones[tone]
          )}
        >
          <Icon className="h-[18px] w-[18px] sm:h-5 sm:w-5" />
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
      <div className="mt-3 sm:mt-4">
        <p className="text-2xl font-bold tracking-tight text-ink-900 sm:text-3xl">
          {value}
          {suffix && (
            <span className="text-base font-semibold text-ink-400 sm:text-lg">
              {suffix}
            </span>
          )}
        </p>
        <p className="mt-1 text-[13px] font-medium leading-snug text-ink-500 sm:text-sm">
          {label}
        </p>
        {deltaLabel && (
          <p className="mt-0.5 text-[11px] text-ink-400 sm:text-xs">{deltaLabel}</p>
        )}
      </div>
    </div>
  );
}
