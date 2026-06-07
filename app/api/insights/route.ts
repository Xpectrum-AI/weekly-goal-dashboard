import { NextResponse } from "next/server";
import { getDb, COLLECTIONS } from "@/lib/mongodb";
import { normalizeInsights } from "@/lib/insights-normalize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = await getDb();
    const docs = await db.collection(COLLECTIONS.insights).find({}).toArray();
    return NextResponse.json(normalizeInsights(docs));
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
