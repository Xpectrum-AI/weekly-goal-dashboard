import { NextResponse } from "next/server";
import { getDb, COLLECTIONS } from "@/lib/mongodb";
import { normalizeInsights } from "@/lib/insights-normalize";
import { getAuthContext } from "@/lib/auth-middleware";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const ctx = await getAuthContext(req);
    if (ctx instanceof NextResponse) return ctx;

    const db = await getDb();
    const docs = await db.collection(COLLECTIONS.insights).find({}).toArray();
    return NextResponse.json(normalizeInsights(docs));
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
