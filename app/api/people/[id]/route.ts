import { NextResponse } from "next/server";
import { getDb, COLLECTIONS } from "@/lib/mongodb";
import { getAuthContext } from "@/lib/auth-middleware";
import { canManagePerson, canViewPerson } from "@/lib/permissions";
import { resolveAuthUserId, inviteUser } from "@/lib/auth";

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
    // Prevent changing sensitive fields directly
    delete patch._id;
    delete patch.authUserId;

    // If an email is being set, make sure the person has a PropelAuth sign-in
    // account (login matches employees by email, but the account must exist).
    // Create + invite if none exists yet.
    const email = typeof patch.email === "string" ? patch.email.trim() : "";
    if (email) {
      try {
        const existing = await resolveAuthUserId(email);
        if (!existing) await inviteUser(email, patch.name ?? target.name);
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
