import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-middleware";
import { canManagePerson } from "@/lib/permissions";
import { deleteUser, resolveAuthUserId } from "@/lib/auth";
import { getDb, COLLECTIONS } from "@/lib/mongodb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ───────────────────────────────────────────────────────────────────────────
// POST /api/auth/deactivate
// Deactivate an employee: deletes their PropelAuth account and, in MongoDB,
// sets active=false and clears their email.
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
      { error: "You do not have permission to deactivate this employee." },
      { status: 403 }
    );
  }

  // Delete the user from PropelAuth (resolve the user id from their email).
  if (target.email) {
    try {
      const authUserId = await resolveAuthUserId(target.email);
      if (authUserId) await deleteUser(authUserId);
    } catch (e: any) {
      // Non-fatal: employee is still deactivated in our system
      console.error("Failed to delete PropelAuth account:", e.message);
    }
  }

  const db = await getDb();

  // Mark inactive and clear the email so the slot is freed up.
  await db.collection(COLLECTIONS.people).updateOne(
    { _id: employeeId as any },
    { $set: { active: false, email: "" } }
  );

  return NextResponse.json({ ok: true, employeeId, active: false });
}
