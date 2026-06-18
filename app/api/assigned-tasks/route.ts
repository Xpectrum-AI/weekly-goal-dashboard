import { NextResponse } from "next/server";
import { getDb, COLLECTIONS } from "@/lib/mongodb";
import { normalizeAssignedTask } from "@/lib/normalize";
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
    const docs = await db
      .collection(COLLECTIONS.assignedTasks)
      .find({})
      .sort({ createdAt: -1 })
      .toArray();
    const normalized = docs.map(normalizeAssignedTask);

    // Filter based on hierarchy visibility
    const visible = filterVisibleByName(ctx.employee, normalized, ctx.allPeople);
    return NextResponse.json(visible);
  } catch (e) {
    console.error("[GET /api/assigned-tasks] 500:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await getAuthContext(req);
    if (ctx instanceof NextResponse) return ctx;

    const db = await getDb();
    const body = await req.json();
    const now = new Date().toISOString();
    const doc = {
      _id: uid("task"),
      personId: body.personId ?? null,
      personName: body.personName ?? "",
      department: body.department ?? "Unassigned",
      teamLead: body.teamLead ?? "",
      week: body.week ?? "",
      text: body.text ?? "",
      urgency: body.urgency === "urgent" ? "urgent" : "normal",
      deadline: body.deadline ?? "",
      completed: body.completed === true,
      assignedBy: body.assignedBy ?? ctx.employee.name,
      assignedByLevel: typeof body.assignedByLevel === "number" ? body.assignedByLevel : (ctx.employee.level ?? 1),
      notes: body.notes ?? "",
      createdAt: now,
    };
    await db.collection(COLLECTIONS.assignedTasks).insertOne(doc as any);
    return NextResponse.json(normalizeAssignedTask(doc));
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
