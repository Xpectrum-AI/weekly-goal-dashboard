import type { Person, WeeklySubmission } from "./types";

// ───────────────────────────────────────────────────────────────────────────
// Organizational hierarchy + scoping.
//
// The reporting structure comes from `people.teamLead` (a manager's NAME;
// null/"Leadership" = top). Submitters live in `weekly_submissions` and carry
// their own `teamLead`. Leaders only see their own sub-tree:
//   Founder/CEO (top)  → everyone
//   Manager            → their whole sub-tree
//   Team Lead          → just their direct team
// ───────────────────────────────────────────────────────────────────────────

export const norm = (x: unknown): string => (x ?? "").toString().trim().toLowerCase();

/** One distinct weekly submitter (identity = normalized name). */
export interface Submitter {
  id: string;
  name: string;
  department: string;
  teamLead: string;
  person?: Person; // matched roster doc, if any
}

export function buildRoster(subs: WeeklySubmission[], people: Person[]): Submitter[] {
  const byName = new Map(people.map((p) => [norm(p.name), p]));
  const map = new Map<string, Submitter>();
  subs.forEach((s) => {
    const key = norm(s.personName);
    if (!key) return;
    if (!map.has(key)) {
      map.set(key, {
        id: key,
        name: s.personName,
        department: s.department,
        teamLead: s.teamLead,
        person: byName.get(key),
      });
    }
  });
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function isTopLeader(p: Person): boolean {
  return !p.teamLead || norm(p.department) === "leadership";
}

/** Normalized names of a viewer's whole sub-tree (viewer + all descendants). */
export function descendantNames(people: Person[], viewerName: string): Set<string> {
  const children = new Map<string, Person[]>();
  people.forEach((p) => {
    if (!p.teamLead) return;
    p.teamLead.split("/").forEach((mgr) => {
      const k = norm(mgr);
      if (!children.has(k)) children.set(k, []);
      children.get(k)!.push(p);
    });
  });
  const out = new Set<string>([norm(viewerName)]);
  const q = [norm(viewerName)];
  while (q.length) {
    const cur = q.shift()!;
    (children.get(cur) ?? []).forEach((c) => {
      const n = norm(c.name);
      if (!out.has(n)) {
        out.add(n);
        q.push(n);
      }
    });
  }
  return out;
}

/** Selectable personas = people who are actually a team lead in the roster
 *  (i.e. someone in `people` reports to them via `teamLead`). */
export function leaders(people: Person[]): Person[] {
  const managerNames = new Set<string>();
  people.forEach((p) => {
    if (p.teamLead) p.teamLead.split("/").forEach((n) => managerNames.add(norm(n)));
  });
  const result = people.filter((p) => managerNames.has(norm(p.name)));
  // Top leaders first, then those with the largest sub-tree.
  return result.sort((a, b) => {
    if (isTopLeader(a) !== isTopLeader(b)) return isTopLeader(a) ? -1 : 1;
    return descendantNames(people, b.name).size - descendantNames(people, a.name).size;
  });
}

function teamLeadInScope(teamLead: string, names: Set<string>): boolean {
  const t = norm(teamLead);
  for (const n of names) if (n && t.includes(n)) return true;
  return false;
}

export function scopeSubmissions(
  subs: WeeklySubmission[],
  viewer: Person | null,
  people: Person[]
): WeeklySubmission[] {
  if (!viewer || isTopLeader(viewer)) return subs;
  const names = descendantNames(people, viewer.name);
  return subs.filter(
    (s) => names.has(norm(s.personName)) || teamLeadInScope(s.teamLead, names)
  );
}

export function scopePeople(people: Person[], viewer: Person | null): Person[] {
  if (!viewer || isTopLeader(viewer)) return people;
  const names = descendantNames(people, viewer.name);
  return people.filter((p) => names.has(norm(p.name)));
}

export function scopeRoster(
  roster: Submitter[],
  viewer: Person | null,
  people: Person[]
): Submitter[] {
  if (!viewer || isTopLeader(viewer)) return roster;
  const names = descendantNames(people, viewer.name);
  return roster.filter(
    (r) => names.has(norm(r.name)) || teamLeadInScope(r.teamLead, names)
  );
}

// ── Compliance / missing, grounded in the submitter roster ──────────────────
export function rosterCompliance(roster: Submitter[], subs: WeeklySubmission[], week: string) {
  const expected = roster.length;
  const submitted = new Set(subs.filter((s) => s.week === week).map((s) => norm(s.personName)));
  const received = roster.filter((r) => submitted.has(norm(r.name))).length;
  return {
    expected,
    received,
    missing: Math.max(0, expected - received),
    rate: expected ? Math.round((received / expected) * 100) : 0,
  };
}

export function missingSubmitters(
  roster: Submitter[],
  subs: WeeklySubmission[],
  week: string
): Submitter[] {
  const submitted = new Set(subs.filter((s) => s.week === week).map((s) => norm(s.personName)));
  return roster.filter((r) => !submitted.has(norm(r.name)));
}

export interface RepeatBlocker {
  name: string;
  department: string;
  teamLead: string;
  total: number;
  weeks: string[];
}

/** Submitters who reported blockers in 2+ distinct weeks (by name). */
export function repeatedBlockerSubmitters(subs: WeeklySubmission[]): RepeatBlocker[] {
  const map = new Map<string, { name: string; department: string; teamLead: string; weeks: Set<string> }>();
  subs.forEach((s) => {
    if (s.blockers.length === 0) return;
    const k = norm(s.personName);
    if (!map.has(k)) map.set(k, { name: s.personName, department: s.department, teamLead: s.teamLead, weeks: new Set() });
    map.get(k)!.weeks.add(s.week);
  });
  return [...map.values()]
    .map((e) => ({ name: e.name, department: e.department, teamLead: e.teamLead, total: e.weeks.size, weeks: [...e.weeks].sort() }))
    .filter((x) => x.total >= 2)
    .sort((a, b) => b.total - a.total);
}

export function consistencyByName(name: string, subs: WeeklySubmission[], weeks: string[]) {
  const mine = subs.filter((s) => norm(s.personName) === norm(name));
  const submittedSet = new Set(mine.map((s) => s.week));
  const submittedWeeks = weeks.filter((w) => submittedSet.has(w));
  const last = [...mine].sort((a, b) => b.week.localeCompare(a.week))[0];
  return {
    count: mine.length,
    submittedWeeks,
    rate: weeks.length ? Math.round((submittedWeeks.length / weeks.length) * 100) : 0,
    lastSubmission: last,
    perWeek: weeks.map((w) => ({ week: w, submitted: submittedSet.has(w) })),
  };
}

/** How many people report (directly) to a given name. */
export function reportsCountByName(people: Person[], subs: WeeklySubmission[]): Map<string, number> {
  const counts = new Map<string, number>();
  const add = (tl?: string | null) => {
    if (!tl) return;
    tl.split("/").forEach((m) => {
      const k = norm(m);
      if (k) counts.set(k, (counts.get(k) ?? 0) + 1);
    });
  };
  people.forEach((p) => add(p.teamLead));
  subs.forEach((s) => add(s.teamLead));
  return counts;
}
