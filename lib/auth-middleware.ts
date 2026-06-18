import { NextResponse } from "next/server";
import { verifyToken, isSuperAdmin, type AuthUser } from "./auth";
import { getDb, COLLECTIONS } from "./mongodb";
import type { Person } from "./types";

// ───────────────────────────────────────────────────────────────────────────
// Authorization middleware for API routes.
//
// Every protected API handler calls `requireAuth(request)` which:
//   1. Verifies the PropelAuth JWT
//   2. Loads the employee from MongoDB (via authUserId)
//   3. Returns the employee with their hierarchy context
//
// If auth fails at any stage, a NextResponse error is thrown/returned.
// ───────────────────────────────────────────────────────────────────────────

/** Escape a string for safe use inside a RegExp (for case-insensitive matching). */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export interface AuthContext {
  user: AuthUser;
  employee: Person;
  /** True when the user is a PropelAuth super-admin (full level-1 access). */
  isSuperAdmin: boolean;
  /** All people in the org (cached for hierarchy lookups). */
  allPeople: Person[];
}

/**
 * Build a synthetic level-1 employee record for a super-admin who has no
 * MongoDB `people` record. Used only as an in-memory access context — it is
 * never persisted to the database.
 */
function syntheticSuperAdmin(authUser: AuthUser): Person {
  return {
    _id: `superadmin:${authUser.userId}`,
    name: authUser.email,
    phone: "",
    department: "Administration",
    teamLead: null,
    title: "Super Admin",
    active: true,
    joinedAt: new Date(0).toISOString(),
    avatarColor: "#6366f1",
    level: 1,
    email: authUser.email,
    authUserId: authUser.userId,
  };
}

export type AuthResult =
  | { ok: true; ctx: AuthContext }
  | { ok: false; response: NextResponse };

/**
 * Authenticate and authorize a request.
 * Returns the auth context or an error response.
 */
export async function requireAuth(request: Request): Promise<AuthResult> {
  // 1. Verify JWT
  const authUser = await verifyToken(request);
  if (!authUser) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Unauthorized. Valid authentication token required." },
        { status: 401 }
      ),
    };
  }

  // 2. Determine super-admin status from PropelAuth (authoritative, server-side).
  const superAdmin = await isSuperAdmin(authUser.userId);

  // 3. Find employee in MongoDB by email (case-insensitive). The email comes
  // from the verified PropelAuth token, so it cannot be forged. We match on
  // email rather than authUserId so records don't need to be pre-linked.
  const db = await getDb();
  const employee = await db.collection(COLLECTIONS.people).findOne({
    email: { $regex: `^${escapeRegex(authUser.email)}$`, $options: "i" },
  });

  // Load all people for hierarchy checks (also used by super-admin context).
  const allPeople = (await db
    .collection(COLLECTIONS.people)
    .find({})
    .toArray()) as unknown as Person[];

  if (!employee) {
    console.error(
      `[auth] no people record matching email=${authUser.email} (userId=${authUser.userId})`
    );
    // Super-admins are allowed in without a MongoDB record — treated as level 1.
    if (superAdmin) {
      return {
        ok: true,
        ctx: {
          user: authUser,
          employee: syntheticSuperAdmin(authUser),
          isSuperAdmin: true,
          allPeople,
        },
      };
    }
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Forbidden. No employee record found for this user." },
        { status: 403 }
      ),
    };
  }

  // 4. Check if employee is active (super-admins bypass deactivation).
  if (employee.active === false && !superAdmin) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Forbidden. Your account has been deactivated." },
        { status: 403 }
      ),
    };
  }

  // A super-admin with a real record is elevated to level 1.
  const resolvedEmployee = (
    superAdmin ? { ...employee, level: 1 } : employee
  ) as unknown as Person;

  return {
    ok: true,
    ctx: {
      user: authUser,
      employee: resolvedEmployee,
      isSuperAdmin: superAdmin,
      allPeople,
    },
  };
}

/**
 * Helper: unwrap AuthResult or throw the error response.
 * Use in API handlers:
 *   const ctx = await getAuthContext(request);
 *   if (ctx instanceof NextResponse) return ctx;
 */
export async function getAuthContext(request: Request): Promise<AuthContext | NextResponse> {
  const result = await requireAuth(request);
  if (!result.ok) return result.response;
  return result.ctx;
}
