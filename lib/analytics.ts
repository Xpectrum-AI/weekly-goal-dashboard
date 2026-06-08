import type {
  Person,
  WeeklySubmission,
  ScoredSubmission,
  Theme,
  WeeklyInsight,
} from "./types";
import { scoreSubmission } from "./scoring";
import { weekNum } from "./utils";

// ── Scoring ─────────────────────────────────────────────────────────────────
export function score(sub: WeeklySubmission): ScoredSubmission {
  const { completeness, status } = scoreSubmission(sub);
  return {
    ...sub,
    completeness,
    status,
    actionCount: (sub.actions ?? []).filter((a) => (a ?? "").trim()).length,
    outcomeCount: (sub.outcomes ?? []).filter((o) => (o ?? "").trim()).length,
    blockerCount: (sub.blockers ?? []).length,
  };
}

export function scoreAll(subs: WeeklySubmission[]): ScoredSubmission[] {
  return subs.map(score);
}

// ── Compliance / missing ────────────────────────────────────────────────────
export function activePeople(people: Person[]): Person[] {
  return people.filter((p) => p.active);
}

/** A submission belongs to a person by id, or by name when personId is null. */
export function belongsTo(sub: WeeklySubmission, person: Person): boolean {
  if (sub.personId && sub.personId === person._id) return true;
  if (!sub.personId && sub.personName && sub.personName.toLowerCase() === person.name.toLowerCase())
    return true;
  return false;
}

export function compliance(people: Person[], subs: WeeklySubmission[], week: string) {
  const expected = activePeople(people).length;
  const received = subs.filter((s) => s.week === week).length;
  return {
    expected,
    received,
    missing: Math.max(0, expected - received),
    rate: expected ? Math.round((received / expected) * 100) : 0,
  };
}

export function missingForWeek(people: Person[], subs: WeeklySubmission[], week: string): Person[] {
  const wk = subs.filter((s) => s.week === week);
  return activePeople(people).filter((p) => !wk.some((s) => belongsTo(s, p)));
}

// ── Completeness ────────────────────────────────────────────────────────────
export function avgCompleteness(subs: WeeklySubmission[]): number {
  if (subs.length === 0) return 0;
  return Math.round(subs.reduce((a, s) => a + scoreSubmission(s).completeness, 0) / subs.length);
}

export function weakSubmissions(subs: WeeklySubmission[]): ScoredSubmission[] {
  return scoreAll(subs).filter((s) => s.status === "Weak");
}

// ── Themes (from MongoDB only) ─────────────────────────────────────────────
function toThemes(counts: Record<string, number>): Theme[] {
  return Object.entries(counts)
    .map(([theme, count]) => ({ theme, count }))
    .sort((a, b) => b.count - a.count);
}

export interface ThemeIndex {
  priority: Record<string, string>;
  blocker: Record<string, string>;
}

/** Priority themes for a scoped set of submissions (from MongoDB themes only). */
export function priorityThemesScoped(subs: WeeklySubmission[], idx: ThemeIndex): Theme[] {
  const counts: Record<string, number> = {};
  subs.forEach((s) => {
    const t = idx.priority[s._id];
    if (t) counts[t] = (counts[t] ?? 0) + 1;
  });
  return toThemes(counts);
}

/** Blocker themes for a scoped set (from MongoDB themes only; "No Blocker" excluded). */
export function blockerThemesScoped(subs: WeeklySubmission[], idx: ThemeIndex): Theme[] {
  const counts: Record<string, number> = {};
  subs.forEach((s) => {
    const t = idx.blocker[s._id];
    if (t && t.toLowerCase() !== "no blocker") counts[t] = (counts[t] ?? 0) + 1;
  });
  return toThemes(counts);
}

export interface RawBlocker {
  text: string;
  theme: string;
  personName: string;
  teamLead: string;
  department: string;
  week: string;
  submittedAt: string;
}

export function rawBlockers(subs: WeeklySubmission[], idx: ThemeIndex): RawBlocker[] {
  const out: RawBlocker[] = [];
  subs.forEach((s) =>
    (s.blockers ?? []).forEach((b) =>
      out.push({
        text: b,
        theme: idx.blocker[s._id] ?? "",
        personName: s.personName,
        teamLead: s.teamLead,
        department: s.department,
        week: s.week,
        submittedAt: s.submittedAt,
      })
    )
  );
  return out.sort((a, b) => (b.submittedAt || "").localeCompare(a.submittedAt || ""));
}

export interface RepeatBlocker {
  person: Person;
  weeks: string[];
  total: number;
}

/** People who reported blockers in 2+ distinct weeks. */
export function repeatedBlockers(people: Person[], subs: WeeklySubmission[]): RepeatBlocker[] {
  return people
    .map((person) => {
      const weeks = new Set(
        subs.filter((s) => s.blockers.length > 0 && belongsTo(s, person)).map((s) => s.week)
      );
      return { person, weeks: [...weeks].sort(), total: weeks.size };
    })
    .filter((x) => x.total >= 2)
    .sort((a, b) => b.total - a.total);
}

// ── Recent ──────────────────────────────────────────────────────────────────
export function recentSubmissions(subs: WeeklySubmission[], n = 8): ScoredSubmission[] {
  return scoreAll(subs)
    .sort((a, b) => (b.submittedAt || "").localeCompare(a.submittedAt || ""))
    .slice(0, n);
}

// ── Per-person consistency ──────────────────────────────────────────────────
export interface PersonConsistency {
  person: Person;
  submittedWeeks: string[];
  expectedWeeks: number;
  rate: number; // %
  lastSubmission?: WeeklySubmission;
  perWeek: { week: string; submitted: boolean }[];
}

export function personConsistency(
  person: Person,
  subs: WeeklySubmission[],
  weeks: string[] = []
): PersonConsistency {
  const mine = subs.filter((s) => belongsTo(s, person));
  const joinedWeek = isoWeekFromDate(person.joinedAt);
  // Only count weeks on/after the person joined as "expected".
  const expectedWeeks = weeks.filter((w) => weekNum(w) >= weekNum(joinedWeek));
  const submittedSet = new Set(mine.map((s) => s.week));
  const submittedWeeks = expectedWeeks.filter((w) => submittedSet.has(w));
  const last = [...mine].sort((a, b) => weekNum(b.week) - weekNum(a.week))[0];
  return {
    person,
    submittedWeeks,
    expectedWeeks: expectedWeeks.length,
    rate: expectedWeeks.length ? Math.round((submittedWeeks.length / expectedWeeks.length) * 100) : 0,
    lastSubmission: last,
    perWeek: weeks.map((w) => ({ week: w, submitted: submittedSet.has(w) })),
  };
}

function isoWeekFromDate(date: string): string {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "2026-W01";
  
  // Calculate ISO week number
  const year = d.getFullYear();
  const dayNum = d.getDay() || 7;
  const dt = new Date(d);
  dt.setDate(dt.getDate() + 4 - dayNum);
  const yearStart = new Date(dt.getFullYear(), 0, 1);
  const weekNo = Math.ceil(((dt.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${year}-W${String(weekNo).padStart(2, "0")}`;
}
function bump(d: string): string {
  const dt = new Date(d);
  dt.setDate(dt.getDate() + 7);
  return dt.toISOString().slice(0, 10);
}

// ── Trend ───────────────────────────────────────────────────────────────────
export interface TrendPoint {
  week: string;
  received: number;
  missing: number;
  expected: number;
  completeness: number;
  blockers: number;
}

export function submissionTrend(people: Person[], subs: WeeklySubmission[], weeks: string[] = []): TrendPoint[] {
  const expected = activePeople(people).length;
  return weeks.map((week: string) => {
    const ws = subs.filter((s) => s.week === week);
    return {
      week,
      received: ws.length,
      missing: Math.max(0, expected - ws.length),
      expected,
      completeness: avgCompleteness(ws),
      blockers: ws.reduce((a, s) => a + s.blockers.length, 0),
    };
  });
}

// ── Prefer the stored weekly_insights doc; fall back to live derivation ─────
export function insightForWeek(
  insights: WeeklyInsight[],
  people: Person[],
  subs: WeeklySubmission[],
  week: string
): WeeklyInsight {
  const stored = insights.find((i) => i.week === week);
  return stored ?? deriveInsight(people, subs, week);
}

/** Merge {theme,count} arrays from several weeks into one ranked list. */
export function combineThemes(lists: Theme[][]): Theme[] {
  const counts: Record<string, number> = {};
  lists.flat().forEach((t) => {
    counts[t.theme] = (counts[t.theme] ?? 0) + t.count;
  });
  return Object.entries(counts)
    .map(([theme, count]) => ({ theme, count }))
    .sort((a, b) => b.count - a.count);
}

// ── Live per-week insight (mirrors the weekly_insights collection) ──────────
// Note: themes are always empty as they come from MongoDB AI analysis only
export function deriveInsight(people: Person[], subs: WeeklySubmission[], week: string): WeeklyInsight {
  const c = compliance(people, subs, week);
  const ws = subs.filter((s) => s.week === week);
  return {
    _id: `wi_${week}`,
    week,
    expected: c.expected,
    received: c.received,
    missing: c.missing,
    complianceRate: c.rate,
    blockerCount: ws.reduce((a, s) => a + s.blockers.length, 0),
    avgCompleteness: avgCompleteness(ws),
    weakCount: weakSubmissions(ws).length,
    topPriorityTheme: "—",
    priorityThemes: [],
    blockerThemes: [],
  };
}
