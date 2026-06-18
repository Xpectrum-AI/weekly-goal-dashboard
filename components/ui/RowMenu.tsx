"use client";

import { MoreVertical, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export type RowMenuItem = {
  label: string;
  icon?: LucideIcon;
  onSelect: () => void;
  /** Renders the item in a destructive (red) style. */
  danger?: boolean;
  disabled?: boolean;
  /** Hide this item entirely. */
  hidden?: boolean;
};

/**
 * Shared kebab (3-dot) row-actions menu. Anchors to the RIGHT edge of the
 * trigger so it opens leftward and never clips off-screen at the end of a row.
 */
export function RowMenu({ items, label = "Row actions" }: { items: RowMenuItem[]; label?: string }) {
  const [open, setOpen] = useState(false);
  const visible = items.filter((i) => !i.hidden);
  if (visible.length === 0) return null;

  return (
    <div className="relative">
      <button
        aria-label={label}
        className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
        onClick={() => setOpen((o) => !o)}
      >
        <MoreVertical size={16} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-20 mt-1 w-48 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-ink-200 bg-white py-1 shadow-pop">
            {visible.map((item, i) => {
              const Icon = item.icon;
              return (
                <button
                  key={i}
                  disabled={item.disabled}
                  className={cn(
                    "flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm",
                    item.disabled
                      ? "cursor-not-allowed text-ink-300"
                      : item.danger
                        ? "text-rose-600 hover:bg-rose-50"
                        : "text-ink-700 hover:bg-ink-50"
                  )}
                  onClick={() => {
                    if (item.disabled) return;
                    item.onSelect();
                    setOpen(false);
                  }}
                >
                  {Icon && (
                    <Icon
                      size={15}
                      className={cn("shrink-0", item.danger ? "text-rose-500" : "text-ink-400")}
                    />
                  )}
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
