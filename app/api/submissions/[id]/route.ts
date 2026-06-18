import { NextResponse } from "next/server";
import { getDb, COLLECTIONS } from "@/lib/mongodb";
import { getAuthContext } from "@/lib/auth-middleware";
import { getVisibleNames, isSelfOnly } from "@/lib/permissions";
import { norm } from "@/lib/org";
import { getCurrentWeek } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getAuthContext(req);
    if (ctx instanceof NextResponse) return ctx;

    const { id } = await params;
    const db = await getDb();

    // Verify the submission belongs to someone in the viewer's scope
    const existing = await db.collection(COLLECTIONS.submissions).findOne({ _id: id as any });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const visibleNames = getVisibleNames(ctx.employee, ctx.allPeople);
    if (!visibleNames.has(norm(existing.personName as string))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Levels 4–5 may only edit the current week's goal — past weeks are read-only.
    if (isSelfOnly(ctx.employee) && existing.week !== getCurrentWeek()) {
      return NextResponse.json(
        { error: "Past weeks are read-only. You can only edit the current week's goal." },
        { status: 403 }
      );
    }

    const patch = await req.json();
    delete patch._id;
    await db.collection(COLLECTIONS.submissions).updateOne({ _id: id as any }, { $set: patch });
    const doc = await db.collection(COLLECTIONS.submissions).findOne({ _id: id as any });
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
    const db = await getDb();

    // Verify the submission belongs to someone in the viewer's scope
    const existing = await db.collection(COLLECTIONS.submissions).findOne({ _id: id as any });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const visibleNames = getVisibleNames(ctx.employee, ctx.allPeople);
    if (!visibleNames.has(norm(existing.personName as string))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await db.collection(COLLECTIONS.submissions).deleteOne({ _id: id as any });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
