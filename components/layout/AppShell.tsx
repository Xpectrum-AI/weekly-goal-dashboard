"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { Toasts } from "@/components/ui/Toasts";
import { useStore } from "@/lib/store";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const load = useStore((s) => s.load);
  const reload = useStore((s) => s.reload);
  const error = useStore((s) => s.error);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="min-h-screen">
      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      <div className="lg:pl-64">
        <Topbar onMenu={() => setMobileOpen(true)} />
        {error && (
          <div className="flex items-center gap-2 border-b border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700 lg:px-8">
            <AlertTriangle size={15} className="shrink-0" />
            <span className="flex-1">Could not load data from MongoDB. Check the connection string and that your IP is allowlisted in Atlas.</span>
            <button onClick={() => reload()} className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-100">
              <RefreshCw size={12} /> Retry
            </button>
          </div>
        )}
        <main className="mx-auto max-w-[1400px] px-4 py-6 lg:px-8 lg:py-8">{children}</main>
      </div>
      <Toasts />
    </div>
  );
}
