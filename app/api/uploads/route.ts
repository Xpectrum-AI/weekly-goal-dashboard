import { NextResponse } from "next/server";
import { getDb, COLLECTIONS } from "@/lib/mongodb";
import { uid } from "@/lib/utils";
import type { Upload } from "@/lib/types";
import { getAuthContext } from "@/lib/auth-middleware";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const ctx = await getAuthContext(req);
    if (ctx instanceof NextResponse) return ctx;

    const db = await getDb();
    const docs = await db
      .collection(COLLECTIONS.uploads)
      .find({})
      .sort({ uploadedAt: -1 })
      .toArray();
    return NextResponse.json(docs);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await getAuthContext(req);
    if (ctx instanceof NextResponse) return ctx;

    const db = await getDb();
    const body = await req.json();
    const doc = { ...body, _id: body._id ?? uid("upload") };
    await db.collection(COLLECTIONS.uploads).insertOne(doc as any);
    return NextResponse.json(doc);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
