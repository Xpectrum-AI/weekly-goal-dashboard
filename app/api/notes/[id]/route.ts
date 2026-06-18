import { NextResponse } from "next/server";
import { getDb, COLLECTIONS } from "@/lib/mongodb";
import { getAuthContext } from "@/lib/auth-middleware";
import { isSelfOnly } from "@/lib/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Levels 4–5 may only act on notes they own. Returns an error response if not. */
async function ensureOwnNote(
  db: Awaited<ReturnType<typeof getDb>>,
  ctx: Exclude<Awaited<ReturnType<typeof getAuthContext>>, NextResponse>,
  id: string
): Promise<NextResponse | null> {
  if (!isSelfOnly(ctx.employee)) return null;
  const existing = await db.collection(COLLECTIONS.notes).findOne({ _id: id as any });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.owner !== ctx.employee._id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getAuthContext(req);
    if (ctx instanceof NextResponse) return ctx;

    const { id } = await params;
    const db = await getDb();
    const denied = await ensureOwnNote(db, ctx, id);
    if (denied) return denied;
    const patch = await req.json();
    delete patch._id;
    delete patch.owner;
    delete patch.createdAt;
    patch.updatedAt = new Date().toISOString();
    await db.collection(COLLECTIONS.notes).updateOne({ _id: id as any }, { $set: patch });
    const doc = await db.collection(COLLECTIONS.notes).findOne({ _id: id as any });
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
    const denied = await ensureOwnNote(db, ctx, id);
    if (denied) return denied;
    await db.collection(COLLECTIONS.notes).deleteOne({ _id: id as any });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
