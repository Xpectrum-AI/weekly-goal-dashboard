"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { Toasts } from "@/components/ui/Toasts";
import { ScrollToTop } from "@/components/ui/ScrollToTop";
import { useStore } from "@/lib/store";
import { useAuth } from "@/components/auth";

// Levels 4–5 may only reach the Weekly Goals and Notepad pages.
const SELF_ONLY_PATHS = ["/submissions", "/notepad"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const load = useStore((s) => s.load);
  const reload = useStore((s) => s.reload);
  const error = useStore((s) => s.error);
  const { isLoading, isAuthenticated, accessToken, employee } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  // Only load data once authenticated and token is available
  useEffect(() => {
    if (isAuthenticated && accessToken) {
      load();
    }
  }, [isAuthenticated, accessToken, load]);

  // Restrict levels 4–5 to their allowed pages, even on direct URL access.
  const selfOnly = typeof employee?.level === "number" && employee.level >= 4;
  const allowedPath = SELF_ONLY_PATHS.some((p) => pathname.startsWith(p));
  useEffect(() => {
    if (isAuthenticated && selfOnly && !allowedPath) {
      router.replace("/submissions");
    }
  }, [isAuthenticated, selfOnly, allowedPath, router]);

  // Show loading state while auth is being checked
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
          <p className="text-sm text-slate-500">Loading...</p>
        </div>
      </div>
    );
  }

  // If not authenticated, just render children (the login page or AuthGuard will handle)
  if (!isAuthenticated) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen">
      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      <div className="lg:pl-64">
        <Topbar onMenu={() => setMobileOpen(true)} />
        {error && (() => {
          // Distinguish authorization failures (403/Forbidden) from genuine
          // backend/DB connectivity errors so the banner doesn't always blame
          // MongoDB. The store stores the server's error text verbatim.
          const isForbidden = /forbidden|permission|no employee record|deactivated/i.test(error);
          const isUnauthorized = /unauthorized|session expired|token/i.test(error);
          const message = isForbidden
            ? error.replace(/^Error:\s*/, "")
            : isUnauthorized
              ? "Your session is no longer valid. Please sign in again."
              : "Could not load data from MongoDB. Check the connection string and that your IP is allowlisted in Atlas.";
          return (
            <div className="flex items-center gap-2 border-b border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700 lg:px-8">
              <AlertTriangle size={15} className="shrink-0" />
              <span className="flex-1">{message}</span>
              <button onClick={() => reload()} className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-100">
                <RefreshCw size={12} /> Retry
              </button>
            </div>
          );
        })()}
        <main className="mx-auto max-w-[1400px] px-4 py-6 lg:px-8 lg:py-8">
          {selfOnly && !allowedPath ? null : children}
        </main>
      </div>
      <Toasts />
      <ScrollToTop />
    </div>
  );
}
