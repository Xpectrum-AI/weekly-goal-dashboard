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

// Org depth at/below which people are leads/managers we do NOT expect weekly
// updates from. We expect submissions from everyone *below* this level, i.e.
// level > SUBMITTER_MAX_LEAD_LEVEL. Level 1 = Founder/CEO (top).
export const SUBMITTER_MAX_LEAD_LEVEL = 3;

/** Whether we expect a weekly submission from this person (below level 3). */
export function expectsSubmission(p: Person): boolean {
  if (typeof p.level === "number") return p.level > SUBMITTER_MAX_LEAD_LEVEL;
  // People added through the UI have no org level yet. Treat anyone who reports
  // to a team lead (i.e. is not a top-level leader) as an expected submitter so
  // they immediately appear on Missing Updates.
  return !isTopLeader(p);
}

export function buildRoster(subs: WeeklySubmission[], people: Person[]): Submitter[] {
  const map = new Map<string, Submitter>();

  // Expected submitters are grounded in the people collection: everyone below
  // level 3 (level > 3). Level 1 = top of org; level ≤ 3 are leads/managers we
  // do not expect weekly updates from.
  const expected = people.filter(expectsSubmission);
  if (expected.length > 0) {
    expected.forEach((p) => {
      const key = norm(p.name);
      if (!key) return;
      map.set(key, {
        id: key,
        name: p.name,
        department: p.department,
        teamLead: p.teamLead ?? "",
        person: p,
      });
    });
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  // Fallback (no level data yet): derive the roster from actual submitters.
  const byName = new Map(people.map((p) => [norm(p.name), p]));
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

/**
 * Auto-detect a person's org level from their team lead. Level 1 = top (CEO,
 * no team lead); each step down the reporting chain adds 1. So someone reporting
 * directly to the CEO is level 2, their reports are level 3, etc.
 */
export function computeLevel(teamLead: string | null | undefined, people: Person[], _depth = 0): number {
  if (!teamLead || !teamLead.trim()) return 1; // top of the org
  if (_depth > 20) return _depth + 1; // cycle guard
  const byName = new Map(people.map((p) => [norm(p.name), p]));
  const firstLead = teamLead.split("/")[0].trim();
  const lead = byName.get(norm(firstLead));
  if (!lead) return 2; // lead not in roster yet — assume one below the top
  if (typeof lead.level === "number") return lead.level + 1;
  return computeLevel(lead.teamLead ?? null, people, _depth + 1) + 1;
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

/** A person's level, using the stored value or auto-detecting from team lead. */
export function effectiveLevel(p: Person, people: Person[]): number {
  return typeof p.level === "number" ? p.level : computeLevel(p.teamLead ?? null, people);
}

/** Scope any rows carrying personName/teamLead to the viewer's sub-tree. */
export function scopeByPerson<T extends { personName: string; teamLead: string }>(
  rows: T[],
  viewer: Person | null,
  people: Person[]
): T[] {
  if (!viewer || isTopLeader(viewer)) return rows;
  const names = descendantNames(people, viewer.name);
  return rows.filter((r) => names.has(norm(r.personName)) || teamLeadInScope(r.teamLead, names));
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

export interface RecurringBlocker {
  name: string;
  department: string;
  teamLead: string;
  text: string;      // representative text of the recurring blocker
  weeks: string[];   // distinct weeks the blocker appeared in, sorted
  span: number;      // weeks.length (how many distinct weeks it persisted)
}

export interface RepeatBlocker {
  name: string;
  department: string;
  teamLead: string;
  total: number;
  weeks: string[];
}

// Reduce a free-text blocker to a comparable token set: lowercase, strip
// punctuation, drop very common filler words, collapse whitespace.
const BLOCKER_STOPWORDS = new Set([
  "the", "a", "an", "to", "of", "for", "and", "or", "is", "are", "was", "were",
  "on", "in", "at", "by", "with", "we", "i", "my", "our", "this", "that", "it",
  "from", "as", "be", "still", "yet", "blocked", "blocker", "issue",
]);

function blockerTokens(text: string): Set<string> {
  return new Set(
    norm(text)
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !BLOCKER_STOPWORDS.has(w))
  );
}

// Jaccard similarity between two token sets (0..1).
function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

// Two blockers are "the same" when their token sets overlap enough. 0.5 means
// roughly half the meaningful words match — tolerant of small rewordings while
// still separating genuinely different blockers.
const SAME_BLOCKER_THRESHOLD = 0.5;

/** Whether two free-text blockers describe the same thing (see threshold). */
export function sameBlocker(a: string, b: string): boolean {
  return jaccard(blockerTokens(a), blockerTokens(b)) >= SAME_BLOCKER_THRESHOLD;
}

interface BlockerCluster {
  text: string;          // representative (first-seen) text
  tokens: Set<string>;
  weeks: Set<string>;
}

/**
 * Recurring blockers: the SAME blocker reported by a person across 2+ distinct
 * weeks (i.e. it was never resolved). Free-text blockers are clustered per
 * person by token-set similarity; a cluster spanning ≥2 weeks is "recurring".
 * One returned row per recurring blocker, most-persistent first.
 */
export function recurringBlockers(subs: WeeklySubmission[]): RecurringBlocker[] {
  // Per person: greedily cluster their blocker texts across all weeks.
  const byPerson = new Map<
    string,
    { name: string; department: string; teamLead: string; clusters: BlockerCluster[] }
  >();

  subs.forEach((s) => {
    if (s.blockers.length === 0) return;
    const k = norm(s.personName);
    if (!byPerson.has(k)) {
      byPerson.set(k, { name: s.personName, department: s.department, teamLead: s.teamLead, clusters: [] });
    }
    const entry = byPerson.get(k)!;
    s.blockers.forEach((raw) => {
      const tokens = blockerTokens(raw);
      if (tokens.size === 0) return; // nothing meaningful to match on
      // Attach to the best-matching existing cluster, else start a new one.
      let best: BlockerCluster | null = null;
      let bestSim = 0;
      for (const c of entry.clusters) {
        const sim = jaccard(tokens, c.tokens);
        if (sim > bestSim) { bestSim = sim; best = c; }
      }
      if (best && bestSim >= SAME_BLOCKER_THRESHOLD) {
        best.weeks.add(s.week);
      } else {
        entry.clusters.push({ text: raw.trim(), tokens, weeks: new Set([s.week]) });
      }
    });
  });

  const out: RecurringBlocker[] = [];
  for (const p of byPerson.values()) {
    for (const c of p.clusters) {
      if (c.weeks.size < 2) continue; // appeared in only one week → not recurring
      out.push({
        name: p.name,
        department: p.department,
        teamLead: p.teamLead,
        text: c.text,
        weeks: [...c.weeks].sort(),
        span: c.weeks.size,
      });
    }
  }
  return out.sort((a, b) => b.span - a.span);
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
