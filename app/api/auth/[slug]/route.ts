import { getRouteHandlers } from "@propelauth/nextjs/server/app-router";

// ───────────────────────────────────────────────────────────────────────────
// PropelAuth catch-all route handler.
//
// Handles the following paths (via the [slug] parameter):
//   GET  /api/auth/login    → redirects to PropelAuth hosted login
//   GET  /api/auth/signup   → redirects to PropelAuth hosted signup
//   GET  /api/auth/callback → handles OAuth callback, sets cookies
//   GET  /api/auth/userinfo → returns current user info from token
//   GET  /api/auth/logout   → handles logout redirect
//   POST /api/auth/logout   → clears auth cookies
// ───────────────────────────────────────────────────────────────────────────

const handlers = getRouteHandlers({
  postLoginRedirectPathFn: () => "/",
});

export const GET = handlers.getRouteHandlerAsync;
export const POST = handlers.postRouteHandlerAsync;
