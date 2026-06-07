import { NextResponse } from "next/server";
import { getDb, COLLECTIONS } from "@/lib/mongodb";
import { normalizeSubmission } from "@/lib/normalize";
import { uid } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = await getDb();
    const docs = await db.collection(COLLECTIONS.submissions).find({}).toArray();
    return NextResponse.json(docs.map(normalizeSubmission));
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const db = await getDb();
    const body = await req.json();
    const rows = Array.isArray(body) ? body : [body];
    const docs = rows.map((r) => ({ ...r, _id: r._id ?? uid("ws") }));
    if (docs.length) await db.collection(COLLECTIONS.submissions).insertMany(docs as any[]);
    return NextResponse.json(Array.isArray(body) ? docs : docs[0]);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
