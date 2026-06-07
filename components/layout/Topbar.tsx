"use client";

import { useState, useRef, useEffect } from "react";
import { Menu, Search, Bell, ChevronDown, Check, Eye, Building2 } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { useStore } from "@/lib/store";
import { useScope } from "@/lib/hooks";
import { isTopLeader } from "@/lib/org";

export function Topbar({ onMenu }: { onMenu: () => void }) {
  const { viewer, leaders, label } = useScope();
  const setViewer = useStore((s) => s.setViewer);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-ink-200 bg-white/80 px-4 backdrop-blur lg:px-6">
      <button onClick={onMenu} className="rounded-lg p-2 text-ink-500 hover:bg-ink-100 lg:hidden">
        <Menu size={20} />
      </button>

      <div className="relative hidden max-w-sm flex-1 sm:block">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
        <input
          placeholder="Search people, priorities, blockers…"
          className="w-full rounded-lg border border-ink-200 bg-ink-50 py-2 pl-9 pr-3 text-sm text-ink-700 outline-none transition placeholder:text-ink-400 focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-500/15"
        />
      </div>

      <div className="ml-auto flex items-center gap-2">
        <ScopeSwitcher viewer={viewer} leaders={leaders} label={label} onPick={setViewer} />
        <button className="relative rounded-lg p-2 text-ink-500 hover:bg-ink-100">
          <Bell size={19} />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white" />
        </button>
        <div className="flex items-center gap-2 rounded-lg py-1 pl-1 pr-2">
          <Avatar name={viewer?.name ?? "Leadership"} color={viewer?.avatarColor ?? "#4f46e5"} size="sm" />
          <div className="hidden text-left sm:block">
            <p className="text-xs font-semibold leading-tight text-ink-800">{viewer?.name ?? "All leadership"}</p>
            <p className="text-[11px] leading-tight text-ink-400">{viewer?.title ?? "Organization-wide"}</p>
          </div>
        </div>
      </div>
    </header>
  );
}

function ScopeSwitcher({
  viewer,
  leaders,
  label,
  onPick,
}: {
  viewer: ReturnType<typeof useScope>["viewer"];
  leaders: ReturnType<typeof useScope>["leaders"];
  label: string;
  onPick: (id: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div ref={ref} className="relative hidden md:block">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-sm font-medium text-ink-700 hover:bg-ink-50"
      >
        <Eye size={14} className="text-ink-400" />
        <span className="text-xs text-ink-400">Viewing as</span>
        <span className="max-w-[160px] truncate">{viewer ? viewer.name : "Organization"}</span>
        <ChevronDown size={14} className="text-ink-400" />
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-80 overflow-hidden rounded-xl border border-ink-200 bg-white shadow-pop animate-scale-in">
          <div className="border-b border-ink-100 px-4 py-2.5">
            <p className="text-xs font-semibold text-ink-700">Scope the console to a leader</p>
            <p className="text-[11px] text-ink-400">Each leader sees only their reporting sub-tree</p>
          </div>
          <div className="max-h-80 overflow-y-auto py-1">
            <button
              onClick={() => {
                onPick(null);
                setOpen(false);
              }}
              className="flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-ink-50"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <Building2 size={15} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-ink-700">Organization-wide</p>
                <p className="text-[11px] text-ink-400">Founder view · everyone</p>
              </div>
              {!viewer && <Check size={14} className="text-emerald-600" />}
            </button>
            {leaders.map((l) => (
              <button
                key={l._id}
                onClick={() => {
                  onPick(l._id);
                  setOpen(false);
                }}
                className="flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-ink-50"
              >
                <Avatar name={l.name} color={l.avatarColor} size="sm" />
                <div className="flex-1">
                  <p className="text-sm text-ink-700">{l.name}</p>
                  <p className="text-[11px] text-ink-400">
                    {l.title} · {isTopLeader(l) ? "Leadership" : l.department}
                  </p>
                </div>
                {viewer?._id === l._id && <Check size={14} className="text-emerald-600" />}
              </button>
            ))}
          </div>
          <div className="border-t border-ink-100 px-4 py-2 text-[11px] text-ink-400">{label}</div>
        </div>
      )}
    </div>
  );
}
