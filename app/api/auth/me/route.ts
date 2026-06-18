import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-middleware";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ───────────────────────────────────────────────────────────────────────────
// GET /api/auth/me
// Returns the current authenticated user's employee record.
// Used by the frontend to hydrate the session.
//
// Uses the shared requireAuth() so super-admins (per PropelAuth metadata) get
// the same level-1 bypass as every other protected route.
// ───────────────────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  const result = await requireAuth(request);
  if (!result.ok) return result.response;

  const { user, employee, isSuperAdmin } = result.ctx;
  return NextResponse.json({
    user,
    employee,
    isSuperAdmin,
  });
}
