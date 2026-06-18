"use client";

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import {
  AuthProvider as PropelAuthProvider,
  useUser,
  useLogoutFunction,
  useRedirectFunctions,
} from "@propelauth/nextjs/client";
import type { Person } from "@/lib/types";
import { setApiToken } from "@/lib/api";

// ───────────────────────────────────────────────────────────────────────────
// Authentication context for the frontend.
//
// Wraps the PropelAuth Next.js client SDK and provides:
//   - Current user session state
//   - Employee data from MongoDB
//   - Login/logout helpers
//   - Token accessor for API requests
// ───────────────────────────────────────────────────────────────────────────

interface AuthState {
  isLoading: boolean;
  isAuthenticated: boolean;
  /** True when authenticated with PropelAuth but NOT an authorized employee/super-admin. */
  accessDenied: boolean;
  user: { userId: string; email: string } | null;
  employee: Person | null;
  accessToken: string | null;
  login: () => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  isLoading: true,
  isAuthenticated: false,
  accessDenied: false,
  user: null,
  employee: null,
  accessToken: null,
  login: () => {},
  logout: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

/**
 * Inner component that uses PropelAuth hooks (must be inside PropelAuthProvider).
 */
function AuthInner({ children }: { children: ReactNode }) {
  const userInfo = useUser();
  const logout = useLogoutFunction();
  const { redirectToLoginPage } = useRedirectFunctions();
  const [employee, setEmployee] = useState<Person | null>(null);
  const [employeeLoading, setEmployeeLoading] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);

  const isLoading = userInfo.loading === true;
  const isLoggedIn = !isLoading && userInfo.isLoggedIn === true;
  const accessToken = isLoggedIn ? userInfo.accessToken : null;
  const user = isLoggedIn
    ? { userId: userInfo.user.userId, email: userInfo.user.email }
    : null;

  // Sync the access token to the API client DURING render (not in an effect):
  // the parent renders before child components, so the token is in place before
  // any child page effect fires its first data fetch. Doing this in an effect
  // would run after child effects, causing an initial 401 → retry → 200 race.
  setApiToken(accessToken ?? null);

  // Fetch employee record when authenticated
  useEffect(() => {
    if (!isLoggedIn || !accessToken) {
      setEmployee(null);
      setAccessDenied(false);
      return;
    }

    let cancelled = false;
    setEmployeeLoading(true);

    fetch("/api/auth/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then(async (res) => {
        if (cancelled) return;
        if (res.ok) {
          const data = await res.json();
          if (data?.employee) {
            setEmployee(data.employee);
            setAccessDenied(false);
          }
        } else {
          // Authenticated with PropelAuth, but not an authorized employee.
          setEmployee(null);
          setAccessDenied(true);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setEmployeeLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isLoggedIn, accessToken]);

  const login = useCallback(() => {
    redirectToLoginPage();
  }, [redirectToLoginPage]);

  const handleLogout = useCallback(async () => {
    await logout();
    setEmployee(null);
    setAccessDenied(false);
    setApiToken(null);
  }, [logout]);

  return (
    <AuthContext.Provider
      value={{
        isLoading: isLoading || employeeLoading,
        isAuthenticated: isLoggedIn,
        accessDenied,
        user,
        employee,
        accessToken,
        login,
        logout: handleLogout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Top-level AuthProvider that wraps PropelAuth's AuthProvider.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const authUrl = process.env.NEXT_PUBLIC_PROPELAUTH_AUTH_URL;

  if (!authUrl) {
    // PropelAuth not configured — render children without auth
    // (useful for development without PropelAuth credentials)
    return (
      <AuthContext.Provider
        value={{
          isLoading: false,
          isAuthenticated: true,
          accessDenied: false,
          user: null,
          employee: null,
          accessToken: null,
          login: () => {},
          logout: async () => {},
        }}
      >
        {children}
      </AuthContext.Provider>
    );
  }

  return (
    <PropelAuthProvider authUrl={authUrl}>
      <AuthInner>{children}</AuthInner>
    </PropelAuthProvider>
  );
}

