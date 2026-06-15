import { NextResponse } from "next/server";
import { getDb, COLLECTIONS } from "@/lib/mongodb";
import { uid } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const owner = new URL(req.url).searchParams.get("owner");
    // An owner is always required so a persona only ever sees their own notes.
    if (!owner) return NextResponse.json([]);
    const db = await getDb();
    const docs = await db
      .collection(COLLECTIONS.notes)
      .find({ owner })
      .sort({ updatedAt: -1 })
      .toArray();
    return NextResponse.json(docs);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const db = await getDb();
    const body = await req.json();
    const owner = typeof body.owner === "string" && body.owner ? body.owner : null;
    if (!owner) {
      return NextResponse.json({ error: "owner is required" }, { status: 400 });
    }
    const now = new Date().toISOString();
    const doc = {
      _id: uid("note"),
      title: typeof body.title === "string" ? body.title : "",
      content: typeof body.content === "string" ? body.content : "",
      owner,
      ownerName: typeof body.ownerName === "string" ? body.ownerName : "",
      createdAt: now,
      updatedAt: now,
    };
    await db.collection(COLLECTIONS.notes).insertOne(doc as any);
    return NextResponse.json(doc);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
