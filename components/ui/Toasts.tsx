"use client";

import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

const TONE = {
  success: { icon: CheckCircle2, ring: "border-emerald-200", iconColor: "text-emerald-500" },
  error: { icon: AlertCircle, ring: "border-rose-200", iconColor: "text-rose-500" },
  info: { icon: Info, ring: "border-brand-200", iconColor: "text-brand-500" },
};

export function Toasts() {
  const toasts = useStore((s) => s.toasts);
  const dismiss = useStore((s) => s.dismissToast);

  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-[60] flex w-80 flex-col gap-2">
      {toasts.map((t) => {
        const tone = TONE[t.tone];
        const Icon = tone.icon;
        return (
          <div
            key={t.id}
            className={cn(
              "pointer-events-auto flex items-start gap-3 rounded-xl border bg-white px-4 py-3 shadow-pop animate-fade-in",
              tone.ring
            )}
          >
            <Icon size={18} className={cn("mt-0.5 shrink-0", tone.iconColor)} />
            <p className="flex-1 text-sm text-ink-700">{t.message}</p>
            <button
              onClick={() => dismiss(t.id)}
              className="text-ink-300 transition hover:text-ink-600"
            >
              <X size={15} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
