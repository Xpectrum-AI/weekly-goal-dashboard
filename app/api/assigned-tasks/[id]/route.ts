import { NextResponse } from "next/server";
import { getDb, COLLECTIONS } from "@/lib/mongodb";
import { normalizeAssignedTask } from "@/lib/normalize";
import { getAuthContext } from "@/lib/auth-middleware";
import { getVisibleNames } from "@/lib/permissions";
import { norm } from "@/lib/org";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getAuthContext(req);
    if (ctx instanceof NextResponse) return ctx;

    const { id } = await params;
    const db = await getDb();

    const existing = await db.collection(COLLECTIONS.assignedTasks).findOne({ _id: id as any });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const visibleNames = getVisibleNames(ctx.employee, ctx.allPeople);
    if (!visibleNames.has(norm(existing.personName as string))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const patch = await req.json();
    delete patch._id;
    delete patch.createdAt;
    await db.collection(COLLECTIONS.assignedTasks).updateOne({ _id: id as any }, { $set: patch });
    const doc = await db.collection(COLLECTIONS.assignedTasks).findOne({ _id: id as any });
    return NextResponse.json(doc ? normalizeAssignedTask(doc) : null);
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

    const existing = await db.collection(COLLECTIONS.assignedTasks).findOne({ _id: id as any });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const visibleNames = getVisibleNames(ctx.employee, ctx.allPeople);
    if (!visibleNames.has(norm(existing.personName as string))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await db.collection(COLLECTIONS.assignedTasks).deleteOne({ _id: id as any });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
