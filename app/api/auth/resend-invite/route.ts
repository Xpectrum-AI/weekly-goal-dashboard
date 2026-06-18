import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-middleware";
import { canManagePerson } from "@/lib/permissions";
import { resendInviteEmail, resolveAuthUserId, inviteUser } from "@/lib/auth";
import { getDb, COLLECTIONS } from "@/lib/mongodb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ───────────────────────────────────────────────────────────────────────────
// POST /api/auth/resend-invite
// Re-send an invitation to an employee (via PropelAuth magic link).
//
// Body: { employeeId: string }
// ───────────────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const ctx = await getAuthContext(request);
  if (ctx instanceof NextResponse) return ctx;

  const body = await request.json();
  const { employeeId, createAccount } = body;

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
      { error: "You do not have permission to resend invitations for this employee." },
      { status: 403 }
    );
  }

  if (!target.email) {
    return NextResponse.json(
      { error: "Employee has no email address." },
      { status: 400 }
    );
  }

  // Ensure the Mongo record is linked to its PropelAuth account. Records created
  // before auth linking (or whose original invite write failed) have no
  // authUserId, which makes every API call return 403 even though the account
  // exists and is confirmed. Backfill it here.
  let authUserId = target.authUserId;
  if (!authUserId) {
    const resolved = await resolveAuthUserId(target.email);
    if (resolved) {
      authUserId = resolved;
      const db = await getDb();
      await db
        .collection(COLLECTIONS.people)
        .updateOne({ _id: target._id as any }, { $set: { authUserId } });
    }
  }

  // No auth account exists yet. If the caller didn't explicitly request account
  // creation, respond with a specific code so the frontend can confirm.
  if (!authUserId && !createAccount) {
    return NextResponse.json(
      { error: "No sign-in account exists for this email yet.", code: "NO_ACCOUNT" },
      { status: 409 }
    );
  }

  // Caller confirmed: create the PropelAuth account now.
  if (!authUserId && createAccount) {
    try {
      authUserId = await inviteUser(target.email, target.name);
      const db = await getDb();
      await db
        .collection(COLLECTIONS.people)
        .updateOne({ _id: target._id as any }, { $set: { authUserId } });
      return NextResponse.json({ ok: true, created: true, email: target.email, message: "Account created and invite sent." });
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      return NextResponse.json(
        { error: `Could not create the sign-in account: ${raw}` },
        { status: 500 }
      );
    }
  }

  try {
    const sent = await resendInviteEmail({ authUserId, email: target.email });
    if (!sent) {
      // PropelAuth declined — usually because the user already confirmed.
      return NextResponse.json(
        {
          ok: true,
          linked: Boolean(authUserId),
          message:
            "This user has already confirmed their account and can sign in directly." +
            (authUserId ? " Their account is now linked." : ""),
        },
        { status: 200 }
      );
    }
  } catch (e: unknown) {
    const raw = e instanceof Error ? e.message : String(e);
    console.error("[resend-invite] failed:", raw);
    // PropelAuth returns raw JSON; surface a human-readable reason.
    // `already_confirmed` and `user_already_exists` both mean the account is
    // present and usable — treat them as success (the link was backfilled above).
    const alreadyConfirmed = /already_confirmed|already.*confirmed|already_exists|user_account_already_exists/i.test(raw);
    if (alreadyConfirmed) {
      return NextResponse.json(
        {
          ok: true,
          linked: Boolean(authUserId),
          message:
            "This user has already confirmed their account and can sign in directly." +
            (authUserId ? " Their account is now linked." : ""),
        },
        { status: 200 }
      );
    }
    return NextResponse.json(
      { error: `Could not re-send the invite: ${raw}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, email: target.email });
}
