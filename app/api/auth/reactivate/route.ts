import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-middleware";
import { canManagePerson } from "@/lib/permissions";
import { enableUser, resolveAuthUserId } from "@/lib/auth";
import { getDb, COLLECTIONS } from "@/lib/mongodb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ───────────────────────────────────────────────────────────────────────────
// POST /api/auth/reactivate
// Reactivate a deactivated employee.
//
// Body: { employeeId: string }
// ───────────────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const ctx = await getAuthContext(request);
  if (ctx instanceof NextResponse) return ctx;

  const body = await request.json();
  const { employeeId } = body;

  if (!employeeId) {
    return NextResponse.json(
      { error: "Missing required field: employeeId" },
      { status: 400 }
    );
  }

  // Find the target employee
  const target = ctx.allPeople.find((p) => p._id === employeeId);
  if (!target) {
    return NextResponse.json(
      { error: "Employee not found." },
      { status: 404 }
    );
  }

  // Permission check
  if (!canManagePerson(ctx.employee, target, ctx.allPeople)) {
    return NextResponse.json(
      { error: "You do not have permission to reactivate this employee." },
      { status: 403 }
    );
  }

  const db = await getDb();

  // Update MongoDB
  await db.collection(COLLECTIONS.people).updateOne(
    { _id: employeeId as any },
    { $set: { active: true } }
  );

  // Re-enable in PropelAuth (resolve the user id from their email).
  if (target.email) {
    try {
      const authUserId = await resolveAuthUserId(target.email);
      if (authUserId) await enableUser(authUserId);
    } catch (e: any) {
      console.error("Failed to enable PropelAuth account:", e.message);
    }
  }

  return NextResponse.json({ ok: true, employeeId, active: true });
}
