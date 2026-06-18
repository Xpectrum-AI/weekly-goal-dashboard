import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ───────────────────────────────────────────────────────────────────────────
// GET /api/auth/config
// Returns PropelAuth configuration for the frontend client.
// ───────────────────────────────────────────────────────────────────────────

export async function GET() {
  const authUrl = process.env.NEXT_PUBLIC_PROPELAUTH_AUTH_URL;

  if (!authUrl) {
    return NextResponse.json(
      { error: "PropelAuth is not configured" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    authUrl,
  });
}
