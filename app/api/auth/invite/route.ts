import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-middleware";
import { canInviteEmployee } from "@/lib/permissions";
import { inviteUser, resolveAuthUserId } from "@/lib/auth";
import { getDb, COLLECTIONS } from "@/lib/mongodb";
import { uid } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ───────────────────────────────────────────────────────────────────────────
// POST /api/auth/invite
// Invite a new employee: creates MongoDB record + PropelAuth user.
//
// Body: { name, email, phone?, department, teamLead, level, title? }
// ───────────────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const ctx = await getAuthContext(request);
  if (ctx instanceof NextResponse) return ctx;

  // Permission check: only levels 1-3 can invite
  if (!canInviteEmployee(ctx.employee)) {
    return NextResponse.json(
      { error: "You do not have permission to invite employees." },
      { status: 403 }
    );
  }

  const body = await request.json();
  const { name, email, phone, department, teamLead, level, title } = body;

  // Validation
  if (!name || !email || !department || level === undefined) {
    return NextResponse.json(
      { error: "Missing required fields: name, email, department, level" },
      { status: 400 }
    );
  }

  const db = await getDb();

  // Check for duplicate email
  const existing = await db.collection(COLLECTIONS.people).findOne({ email });
  if (existing) {
    return NextResponse.json(
      { error: "An employee with this email already exists." },
      { status: 409 }
    );
  }

  // 1. Create user in PropelAuth (sends invite email). If an account already
  // exists for this email, that's fine — login matches by email, so we just
  // proceed to create the employee record.
  try {
    await inviteUser(email, name);
  } catch {
    const existing = await resolveAuthUserId(email);
    if (!existing) {
      return NextResponse.json(
        { error: "Could not create the sign-in account. Please verify the email and try again." },
        { status: 500 }
      );
    }
  }

  // 2. Create employee record in MongoDB
  const PALETTE = ["#6366f1", "#0ea5e9", "#ec4899", "#10b981", "#f59e0b", "#8b5cf6"];
  const employeeDoc = {
    _id: uid("p"),
    employeeId: `GUC${String(Date.now()).slice(-3)}`,
    name,
    email,
    phone: phone || "",
    department,
    teamLead: teamLead || null,
    title: title || "",
    active: true,
    level: Number(level),
    joinedAt: new Date().toISOString().slice(0, 10),
    avatarColor: PALETTE[Math.floor(Math.random() * PALETTE.length)],
  };

  await db.collection(COLLECTIONS.people).insertOne(employeeDoc as any);

  return NextResponse.json(employeeDoc, { status: 201 });
}
