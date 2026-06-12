import type { Person, WeeklySubmission } from "./types";

// ───────────────────────────────────────────────────────────────────────────
// Normalizes raw Mongo documents into clean, fully-populated shapes so the rest
// of the app never has to defend against nulls. Real data has null
// department / teamLead / personId / topPriority and occasionally null arrays.
// ───────────────────────────────────────────────────────────────────────────

const PALETTE = ["#6366f1", "#0ea5e9", "#ec4899", "#10b981", "#f59e0b", "#8b5cf6", "#14b8a6", "#ef4444"];

export function colorFor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

const strArray = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x) => x != null && String(x).trim()).map((x) => String(x)) : [];

export function normalizeSubmission(d: any): WeeklySubmission {
  return {
    _id: String(d._id),
    personId: d.personId ?? null,
    personName: d.personName ?? "",
    department: d.department ?? "Unassigned",
    teamLead: d.teamLead ?? "",
    week: d.week ?? "",
    submittedAt: d.submittedAt ?? "",
    topPriority: d.topPriority ?? "",
    actions: strArray(d.actions),
    outcomes: strArray(d.outcomes),
    blockers: strArray(d.blockers),
    notes: d.notes ?? "",
  };
}

export function normalizePerson(d: any): Person {
  const name = d.name ?? "";
  return {
    _id: String(d._id),
    name,
    phone: d.phone ?? "",
    department: d.department ?? "Unassigned",
    teamLead: d.teamLead ?? null,
    title: d.title ?? "",
    active: d.active !== false,
    joinedAt: d.joinedAt ?? "",
    avatarColor: d.avatarColor || colorFor(name),
    employeeId: d.employeeId ?? undefined,
    level: typeof d.level === "number" ? d.level : undefined,
  };
}
