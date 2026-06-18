import { NextResponse } from "next/server";
import { getDb, COLLECTIONS } from "@/lib/mongodb";
import { normalizePerson } from "@/lib/normalize";
import { uid } from "@/lib/utils";
import { getAuthContext } from "@/lib/auth-middleware";
import { filterVisiblePeople, canInviteEmployee } from "@/lib/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const ctx = await getAuthContext(req);
    if (ctx instanceof NextResponse) return ctx;

    const db = await getDb();
    const docs = await db.collection(COLLECTIONS.people).find({}).toArray();
    const normalized = docs.map(normalizePerson);

    // Filter based on hierarchy visibility
    const visible = filterVisiblePeople(ctx.employee, normalized, ctx.allPeople);
    return NextResponse.json(visible);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await getAuthContext(req);
    if (ctx instanceof NextResponse) return ctx;

    // Only leadership (level 1-3) can add people
    if (!canInviteEmployee(ctx.employee)) {
      return NextResponse.json(
        { error: "You do not have permission to add employees." },
        { status: 403 }
      );
    }

    const db = await getDb();
    const body = await req.json();
    const rows = Array.isArray(body) ? body : [body];

    // Enforce email uniqueness — login matches employees by email, so two
    // people sharing one email would make sign-in ambiguous. Check both against
    // existing people and for duplicates within this batch.
    const seen = new Set<string>();
    for (const r of rows) {
      const email = typeof r.email === "string" ? r.email.trim().toLowerCase() : "";
      if (!email) continue;
      const taken = ctx.allPeople.find((p) => p.email && p.email.toLowerCase() === email);
      if (taken || seen.has(email)) {
        return NextResponse.json(
          { error: `The email "${r.email.trim()}" is already in use${taken ? ` by ${taken.name}` : ""}.` },
          { status: 409 }
        );
      }
      seen.add(email);
    }

    const docs = rows.map((r) => ({ ...r, _id: r._id ?? uid("p") }));
    if (docs.length) await db.collection(COLLECTIONS.people).insertMany(docs as any[]);
    return NextResponse.json(Array.isArray(body) ? docs : docs[0]);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
