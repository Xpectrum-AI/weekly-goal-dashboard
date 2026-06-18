"use client";

import { useAuth } from "./AuthProvider";

// ───────────────────────────────────────────────────────────────────────────
// AuthGuard — wraps protected pages to ensure authentication.
//
// Shows a loading state while checking auth, redirects to login if not
// authenticated, and renders children when authenticated.
// ───────────────────────────────────────────────────────────────────────────

interface AuthGuardProps {
  children: React.ReactNode;
  /** Minimum level required (1 = CEO, 5 = employee). Defaults to 5 (any level). */
  maxLevel?: number;
}

export function AuthGuard({ children, maxLevel = 5 }: AuthGuardProps) {
  const { isLoading, isAuthenticated, accessDenied, employee, login, logout } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
          <p className="text-sm text-slate-500">Authenticating...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    // Redirect to login
    if (typeof window !== "undefined") {
      login();
    }
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-slate-500">Redirecting to login...</p>
      </div>
    );
  }

  // Authenticated with PropelAuth, but not an authorized employee/super-admin.
  if (accessDenied) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <h2 className="text-lg font-semibold text-slate-800">No access</h2>
          <p className="mt-1 text-sm text-slate-500">
            Your account isn&apos;t set up for this dashboard. Contact your admin for access.
          </p>
          <button
            onClick={() => logout()}
            className="mt-4 text-sm font-medium text-indigo-600 hover:text-indigo-700"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  // Check level-based access
  if (employee && typeof employee.level === "number" && employee.level > maxLevel) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h2 className="text-lg font-semibold text-slate-800">Access Denied</h2>
          <p className="mt-1 text-sm text-slate-500">
            You do not have the required permissions to view this page.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
