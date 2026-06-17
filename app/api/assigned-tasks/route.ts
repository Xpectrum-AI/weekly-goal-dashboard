import { NextResponse } from "next/server";
import { getDb, COLLECTIONS } from "@/lib/mongodb";
import { normalizeAssignedTask } from "@/lib/normalize";
import { uid } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = await getDb();
    const docs = await db
      .collection(COLLECTIONS.assignedTasks)
      .find({})
      .sort({ createdAt: -1 })
      .toArray();
    return NextResponse.json(docs.map(normalizeAssignedTask));
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
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
      assignedBy: body.assignedBy ?? "",
      assignedByLevel: typeof body.assignedByLevel === "number" ? body.assignedByLevel : 1,
      notes: body.notes ?? "",
      createdAt: now,
    };
    await db.collection(COLLECTIONS.assignedTasks).insertOne(doc as any);
    return NextResponse.json(normalizeAssignedTask(doc));
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
