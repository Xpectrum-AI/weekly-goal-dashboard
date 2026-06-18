import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-middleware";
import { canManagePerson } from "@/lib/permissions";
import { inviteUser, resolveAuthUserId } from "@/lib/auth";
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
  // Optional override: reactivate with a fresh email instead of the stashed one.
  const newEmail = typeof body.email === "string" ? body.email.trim() : "";

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

  // Use an explicitly provided email, else the email still on the record, else
  // the legacy stashed former email (older records cleared email on deactivate).
  const email = newEmail || target.email || target.formerEmail || "";

  // Keep email unique across active people. Identity is keyed on authUserId now,
  // so this is no longer a login-correctness requirement, but a shared email is
  // still confusing for invites and display — reject it.
  if (email) {
    const taken = ctx.allPeople.find(
      (p) => p._id !== employeeId && p.email && p.email.toLowerCase() === email.toLowerCase()
    );
    if (taken) {
      return NextResponse.json(
        {
          error: `The email "${email}" is now used by ${taken.name}. Edit this person and assign a different email before reactivating.`,
        },
        { status: 409 }
      );
    }
  }

  const db = await getDb();

  // The PropelAuth account was deleted on deactivate, so re-invite by email to
  // create a fresh account (or reuse one if it already exists).
  let authUserId: string | undefined;
  if (email) {
    try {
      authUserId =
        (await resolveAuthUserId(email)) ?? (await inviteUser(email, target.name));
    } catch (e: any) {
      console.error("Failed to re-invite PropelAuth account:", e.message);
    }
  }

  // Mark active again, restore the email, and re-establish the authUserId link
  // (the new/resolved account) so the user matches on next login. Clear any
  // legacy formerEmail stash.
  await db.collection(COLLECTIONS.people).updateOne(
    { _id: employeeId as any },
    {
      $set: { active: true, email, ...(authUserId ? { authUserId } : {}) },
      $unset: { formerEmail: "" },
    }
  );

  return NextResponse.json({ ok: true, employeeId, active: true, email });
}
