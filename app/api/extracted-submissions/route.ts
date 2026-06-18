import { NextResponse } from "next/server";
import { getDb, COLLECTIONS } from "@/lib/mongodb";
import { uid } from "@/lib/utils";
import type { ExtractedSubmission } from "@/lib/types";
import { getAuthContext } from "@/lib/auth-middleware";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const ctx = await getAuthContext(req);
    if (ctx instanceof NextResponse) return ctx;

    const { searchParams } = new URL(req.url);
    const uploadId = searchParams.get("uploadId");
    
    const db = await getDb();
    const filter = uploadId ? { uploadId } : {};
    const docs = await db
      .collection(COLLECTIONS.extractedSubmissions)
      .find(filter)
      .sort({ rowIndex: 1 })
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
    const rows = Array.isArray(body) ? body : [body];
    const docs = rows.map((r) => ({ ...r, _id: r._id ?? uid("draft") }));
    if (docs.length) await db.collection(COLLECTIONS.extractedSubmissions).insertMany(docs as any[]);
    return NextResponse.json(Array.isArray(body) ? docs : docs[0]);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
