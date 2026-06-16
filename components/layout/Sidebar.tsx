"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  MessageSquareText,
  AlertOctagon,
  UserX,
  Users,
  Upload,
  MessageCircle,
  X,
  ClipboardCheck,
  NotebookPen,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/submissions", label: "Weekly Goals", icon: MessageSquareText },
  { href: "/blockers", label: "Blockers & Themes", icon: AlertOctagon },
  { href: "/missing", label: "Missing Updates", icon: UserX },
  { href: "/people", label: "People & Teams", icon: Users },
  { href: "/import", label: "Data Import", icon: Upload },
  { href: "/review", label: "Review Queue", icon: ClipboardCheck },
  { href: "/notepad", label: "Notepad", icon: NotebookPen },
];

export function Sidebar({ mobileOpen, onClose }: { mobileOpen: boolean; onClose: () => void }) {
  const pathname = usePathname();

  return (
    <>
      {mobileOpen && <div className="fixed inset-0 z-40 bg-ink-950/40 lg:hidden" onClick={onClose} />}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-ink-200 bg-white transition-transform lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-16 items-center justify-between gap-2 border-b border-ink-100 px-5">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm shadow-emerald-600/30">
              <MessageCircle size={19} />
            </div>
            <div className="leading-tight">
              <p className="text-sm font-bold text-ink-900">PulseOps</p>
              <p className="text-[11px] text-ink-400">WhatsApp alignment console</p>
            </div>
          </Link>
          <button onClick={onClose} className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 lg:hidden">
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <div className="space-y-0.5">
            {NAV.map((item) => {
              const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className={cn(
                    "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
                    active ? "bg-emerald-50 text-emerald-700" : "text-ink-600 hover:bg-ink-50 hover:text-ink-900"
                  )}
                >
                  <Icon size={18} className={cn(active ? "text-emerald-600" : "text-ink-400 group-hover:text-ink-600")} />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="border-t border-ink-100 p-3">
          <div className="rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-800 p-4 text-white">
            <p className="text-xs font-semibold">Leadership console</p>
            <p className="mt-0.5 text-[11px] text-emerald-100">Grounded in weekly WhatsApp data</p>
          </div>
        </div>
      </aside>
    </>
  );
}
