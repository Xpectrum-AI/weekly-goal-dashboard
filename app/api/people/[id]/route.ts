import { NextResponse } from "next/server";
import { getDb, COLLECTIONS } from "@/lib/mongodb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const db = await getDb();
    const patch = await req.json();
    delete patch._id;
    await db.collection(COLLECTIONS.people).updateOne({ _id: id as any }, { $set: patch });
    const doc = await db.collection(COLLECTIONS.people).findOne({ _id: id as any });
    return NextResponse.json(doc);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const db = await getDb();
    await db.collection(COLLECTIONS.people).deleteOne({ _id: id as any });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
