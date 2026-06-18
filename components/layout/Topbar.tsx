"use client";

import { Menu, Search, Bell, LogOut } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { useScope } from "@/lib/hooks";
import { useAuth } from "@/components/auth";

export function Topbar({ onMenu }: { onMenu: () => void }) {
  const { viewer } = useScope();
  const { employee, logout } = useAuth();

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
        <button className="relative rounded-lg p-2 text-ink-500 hover:bg-ink-100">
          <Bell size={19} />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white" />
        </button>
        <div className="flex items-center gap-2 rounded-lg py-1 pl-1 pr-2">
          <Avatar name={employee?.name ?? viewer?.name ?? "Leadership"} color={employee?.avatarColor ?? viewer?.avatarColor ?? "#4f46e5"} size="sm" />
          <div className="hidden text-left sm:block">
            <p className="text-xs font-semibold leading-tight text-ink-800">{employee?.name ?? viewer?.name ?? "All leadership"}</p>
            <p className="text-[11px] leading-tight text-ink-400">{employee?.title ?? viewer?.title ?? "Organization-wide"}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="rounded-lg p-2 text-ink-400 hover:bg-ink-100 hover:text-ink-600"
          title="Sign out"
        >
          <LogOut size={17} />
        </button>
      </div>
    </header>
  );
}
