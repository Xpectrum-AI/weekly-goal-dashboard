import { NextResponse } from "next/server";
import { getDb, COLLECTIONS } from "@/lib/mongodb";
import { getAuthContext } from "@/lib/auth-middleware";
import { canManagePerson, canViewPerson } from "@/lib/permissions";
import { resolveAuthUserId, inviteUser, resendInviteEmail } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getAuthContext(req);
    if (ctx instanceof NextResponse) return ctx;

    const { id } = await params;

    // Find target employee
    const target = ctx.allPeople.find((p) => p._id === id);
    if (!target) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    // Permission check: must be able to manage this person
    if (!canManagePerson(ctx.employee, target, ctx.allPeople)) {
      return NextResponse.json(
        { error: "You do not have permission to edit this employee." },
        { status: 403 }
      );
    }

    const db = await getDb();
    const patch = await req.json();
    // `invite` is a control flag, not a stored field — extract then strip it.
    // Saving a record and sending an invite are separate intentions: editing a
    // person never emails them unless the client explicitly asks (invite: true).
    const sendInvite = patch.invite === true;
    delete patch.invite;
    // Prevent changing sensitive fields directly
    delete patch._id;
    delete patch.authUserId;

    const email = typeof patch.email === "string" ? patch.email.trim() : "";
    if (email) {
      // Keep email unique across people (for invites/display, not identity).
      const taken = ctx.allPeople.find(
        (p) => p._id !== id && p.email && p.email.toLowerCase() === email.toLowerCase()
      );
      if (taken) {
        return NextResponse.json(
          { error: `The email "${email}" is already in use by ${taken.name}.` },
          { status: 409 }
        );
      }
      try {
        const existing = await resolveAuthUserId(email);
        if (sendInvite) {
          // Explicit invite: link an existing account (and re-send its confirm/
          // set-password email), or create a fresh one which emails the invite.
          if (existing) {
            try {
              await resendInviteEmail({ authUserId: existing, email });
            } catch {
              /* already-confirmed accounts can't be re-sent — that's fine */
            }
            patch.authUserId = existing;
          } else {
            patch.authUserId = await inviteUser(email, patch.name ?? target.name);
          }
        } else if (existing) {
          // No invite requested: never create an account or send email, but keep
          // identity correct by linking an account that already exists.
          patch.authUserId = existing;
        }
      } catch {
        return NextResponse.json(
          { error: "Save failed: could not create a sign-in account for this email." },
          { status: 500 }
        );
      }
    }

    await db.collection(COLLECTIONS.people).updateOne({ _id: id as any }, { $set: patch });
    const doc = await db.collection(COLLECTIONS.people).findOne({ _id: id as any });
    return NextResponse.json(doc);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getAuthContext(_req);
    if (ctx instanceof NextResponse) return ctx;

    const { id } = await params;

    // Find target employee
    const target = ctx.allPeople.find((p) => p._id === id);
    if (!target) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    // Permission check
    if (!canManagePerson(ctx.employee, target, ctx.allPeople)) {
      return NextResponse.json(
        { error: "You do not have permission to delete this employee." },
        { status: 403 }
      );
    }

    const db = await getDb();
    await db.collection(COLLECTIONS.people).deleteOne({ _id: id as any });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
