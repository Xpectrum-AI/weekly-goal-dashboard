import { NextRequest, NextResponse } from "next/server";
import { sendNudge, sendTaskAssigned } from "@/lib/nudge";

export async function POST(req: NextRequest) {
  const body = await req.json();

  if (body.type === "task-assigned") {
    const { phone, assigneeName, assignerName, priority } = body;
    const ok = await sendTaskAssigned({ phone, assigneeName, assignerName, priority });
    return NextResponse.json({ ok }, { status: ok ? 200 : 500 });
  }

  // default: weekly alignment nudge
  const { name, phone } = body;
  const ok = await sendNudge(name, phone);
  return NextResponse.json({ ok }, { status: ok ? 200 : 500 });
}