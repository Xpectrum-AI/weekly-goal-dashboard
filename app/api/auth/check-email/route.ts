import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-middleware";
import { resolveAuthUserId } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ───────────────────────────────────────────────────────────────────────────
// GET /api/auth/check-email?email=...
// Returns whether a PropelAuth sign-in account already exists for an email.
// Used by the UI before inviting, to warn that an account is already present.
// ───────────────────────────────────────────────────────────────────────────

export async function GET(req: Request) {
  const ctx = await getAuthContext(req);
  if (ctx instanceof NextResponse) return ctx;

  const email = (new URL(req.url).searchParams.get("email") ?? "").trim();
  if (!email) return NextResponse.json({ exists: false });

  const authUserId = await resolveAuthUserId(email);
  return NextResponse.json({ exists: Boolean(authUserId) });
}
