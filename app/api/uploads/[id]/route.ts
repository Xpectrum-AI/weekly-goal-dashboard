import { NextResponse } from "next/server";
import { getDb, COLLECTIONS } from "@/lib/mongodb";
import { getAuthContext } from "@/lib/auth-middleware";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getAuthContext(req);
    if (ctx instanceof NextResponse) return ctx;

    const { id } = await params;
    const db = await getDb();
    const doc = await db.collection(COLLECTIONS.uploads).findOne({ _id: id } as any);
    if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(doc);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getAuthContext(req);
    if (ctx instanceof NextResponse) return ctx;

    const { id } = await params;
    const db = await getDb();
    const patch = await req.json();
    await db.collection(COLLECTIONS.uploads).updateOne({ _id: id } as any, { $set: patch });
    const doc = await db.collection(COLLECTIONS.uploads).findOne({ _id: id } as any);
    return NextResponse.json(doc);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getAuthContext(req);
    if (ctx instanceof NextResponse) return ctx;

    const { id } = await params;
    const db = await getDb();
    
    // Delete associated extracted submissions first
    await db.collection(COLLECTIONS.extractedSubmissions).deleteMany({ uploadId: id });
    
    // Delete the upload
    await db.collection(COLLECTIONS.uploads).deleteOne({ _id: id } as any);
    
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
