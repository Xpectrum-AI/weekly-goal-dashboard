import { NextResponse } from "next/server";
import { getDb, COLLECTIONS } from "@/lib/mongodb";
import { uid } from "@/lib/utils";
import { getAuthContext } from "@/lib/auth-middleware";
import { isSelfOnly } from "@/lib/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const ctx = await getAuthContext(req);
    if (ctx instanceof NextResponse) return ctx;

    // Levels 4–5 can only ever read their own notes, regardless of the
    // requested owner.
    const owner = isSelfOnly(ctx.employee)
      ? ctx.employee._id
      : new URL(req.url).searchParams.get("owner");
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
    const ctx = await getAuthContext(req);
    if (ctx instanceof NextResponse) return ctx;

    const db = await getDb();
    const body = await req.json();
    // Levels 4–5 can only create notes owned by themselves.
    const selfOnly = isSelfOnly(ctx.employee);
    const owner = selfOnly
      ? ctx.employee._id
      : typeof body.owner === "string" && body.owner
        ? body.owner
        : null;
    if (!owner) {
      return NextResponse.json({ error: "owner is required" }, { status: 400 });
    }
    const ownerName = selfOnly
      ? ctx.employee.name
      : typeof body.ownerName === "string"
        ? body.ownerName
        : "";
    const now = new Date().toISOString();
    const doc = {
      _id: uid("note"),
      title: typeof body.title === "string" ? body.title : "",
      content: typeof body.content === "string" ? body.content : "",
      owner,
      ownerName,
      createdAt: now,
      updatedAt: now,
    };
    await db.collection(COLLECTIONS.notes).insertOne(doc as any);
    return NextResponse.json(doc);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
