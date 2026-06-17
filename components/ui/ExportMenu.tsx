"use client";

import { Download } from "lucide-react";
import { useState } from "react";

export type ExportOption = {
  label: string;
  hint?: string;
  onSelect: () => void;
};

/**
 * Shared Export button + dropdown.
 * Anchors to the LEFT edge of the trigger so the menu opens rightward and never
 * clips off-screen on narrow / mobile viewports. Single-option menus fire directly.
 */
export function ExportMenu({
  options,
  label = "Export",
}: {
  options: ExportOption[];
  label?: string;
}) {
  const [open, setOpen] = useState(false);

  if (options.length === 0) return null;

  return (
    <div className="relative">
      <button
        className="btn-outline"
        onClick={() => {
          if (options.length === 1) {
            options[0].onSelect();
          } else {
            setOpen((o) => !o);
          }
        }}
      >
        <Download size={16} /> {label}
      </button>

      {open && options.length > 1 && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-0 top-full z-20 mt-2 w-64 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-ink-200 bg-white py-1 shadow-pop">
            {options.map((opt, i) => (
              <button
                key={i}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-ink-700 hover:bg-ink-50"
                onClick={() => {
                  opt.onSelect();
                  setOpen(false);
                }}
              >
                <Download size={15} className="shrink-0 text-ink-400" />
                <div className="min-w-0">
                  <p className="font-medium">{opt.label}</p>
                  {opt.hint && (
                    <p className="truncate text-[11px] text-ink-400">{opt.hint}</p>
                  )}
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
