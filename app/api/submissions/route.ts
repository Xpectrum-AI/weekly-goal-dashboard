import { NextResponse } from "next/server";
import { getDb, COLLECTIONS } from "@/lib/mongodb";
import { normalizeSubmission } from "@/lib/normalize";
import { uid } from "@/lib/utils";
import { getAuthContext } from "@/lib/auth-middleware";
import { filterVisibleByName } from "@/lib/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const ctx = await getAuthContext(req);
    if (ctx instanceof NextResponse) return ctx;

    const db = await getDb();
    const docs = await db.collection(COLLECTIONS.submissions).find({}).toArray();
    const normalized = docs.map(normalizeSubmission);

    // Filter based on hierarchy visibility
    const visible = filterVisibleByName(ctx.employee, normalized, ctx.allPeople);
    return NextResponse.json(visible);
  } catch (e) {
    console.error("[GET /api/submissions] 500:", e);
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
    const docs = rows.map((r) => ({ ...r, _id: r._id ?? uid("ws") }));
    if (docs.length) await db.collection(COLLECTIONS.submissions).insertMany(docs as any[]);
    return NextResponse.json(Array.isArray(body) ? docs : docs[0]);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
