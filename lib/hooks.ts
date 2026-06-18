"use client";

import { useEffect, useMemo } from "react";
import { useStore } from "./store";
import { useAuth } from "@/components/auth/AuthProvider";
import { weekNum, getCurrentWeek } from "./utils";
import {
  buildRoster,
  scopeSubmissions,
  scopePeople,
  scopeRoster,
  scopeByPerson,
  leaders,
  isTopLeader,
  type Submitter,
} from "./org";
import type { Person, WeeklySubmission, AssignedTask } from "./types";
import type { ThemeIndex } from "./analytics";

/**
 * Triggers the one-time load from MongoDB and returns the loaded flag.
 * Pages use this to drive skeleton / empty states.
 */
export function useLoaded(): boolean {
  const loaded = useStore((s) => s.loaded);
  const load = useStore((s) => s.load);
  const { accessToken } = useAuth();
  // Only load once the auth token is wired into the API client. When PropelAuth
  // isn't configured (dev fallback), there's no token — load immediately.
  const authConfigured = !!process.env.NEXT_PUBLIC_PROPELAUTH_AUTH_URL;
  useEffect(() => {
    if (!authConfigured || accessToken) load();
  }, [load, accessToken, authConfigured]);
  return loaded;
}

/** Weeks present in the data (sorted), plus the selected/latest as "current". */
export function useWeeks(): {
  weeks: string[];
  currentWeek: string;
  selectedWeek: string | null;
  setSelectedWeek: (week: string | null) => void;
} {
  const submissions = useStore((s) => s.submissions);
  const insights = useStore((s) => s.insights);
  const selectedWeek = useStore((s) => s.selectedWeek);
  const setSelectedWeek = useStore((s) => s.setSelectedWeek);
  return useMemo(() => {
    const set = new Set<string>();
    submissions.forEach((s) => s.week && set.add(s.week));
    insights.forEach((i) => i.week && set.add(i.week));
    // Always include the actual calendar week so the selector offers it and
    // pages default to it — even before any data exists for the new week.
    const dynamicCurrentWeek = getCurrentWeek();
    set.add(dynamicCurrentWeek);
    const weeks = [...set].sort((a, b) => weekNum(a) - weekNum(b));
    return {
      weeks,
      // Default to the real current week (shows "no data" if empty) rather than
      // the latest week that happens to have data.
      currentWeek: selectedWeek ?? dynamicCurrentWeek,
      selectedWeek,
      setSelectedWeek,
    };
  }, [submissions, insights, selectedWeek, setSelectedWeek]);
}

export interface Scope {
  viewer: Person | null;
  people: Person[];
  submissions: WeeklySubmission[];
  assignedTasks: AssignedTask[];
  roster: Submitter[];
  leaders: Person[];
  label: string;
  isOrgWide: boolean;
}

/** Scopes all data to the selected leader persona (their reporting sub-tree). */
export function useScope(): Scope {
  const allPeople = useStore((s) => s.people);
  const allSubs = useStore((s) => s.submissions);
  const allTasks = useStore((s) => s.assignedTasks);
  const viewerId = useStore((s) => s.viewerId);
  return useMemo(() => {
    const viewer = viewerId ? allPeople.find((p) => p._id === viewerId) ?? null : null;
    return {
      viewer,
      people: scopePeople(allPeople, viewer),
      submissions: scopeSubmissions(allSubs, viewer, allPeople),
      assignedTasks: scopeByPerson(allTasks, viewer, allPeople),
      roster: scopeRoster(buildRoster(allSubs, allPeople), viewer, allPeople),
      leaders: leaders(allPeople),
      label: viewer ? `${viewer.name} · ${viewer.title}` : "Organization-wide",
      isOrgWide: !viewer || isTopLeader(viewer),
    };
  }, [allPeople, allSubs, allTasks, viewerId]);
}

/** Combined per-submission AI theme maps across all weekly_insights docs. */
export function useThemeIndex(): ThemeIndex {
  const insights = useStore((s) => s.insights);
  return useMemo(() => {
    const priority: Record<string, string> = {};
    const blocker: Record<string, string> = {};
    insights.forEach((i) => {
      Object.assign(priority, i.priorityBySubmission ?? {});
      Object.assign(blocker, i.blockerBySubmission ?? {});
    });
    return { priority, blocker };
  }, [insights]);
}

/**
 * Returns the stored weekly insight for a specific week.
 * If no stored insight exists, returns null (caller should fall back to live computation).
 */
export function useInsightForWeek(week: string): import("./types").WeeklyInsight | null {
  const insights = useStore((s) => s.insights);
  return useMemo(() => insights.find((i) => i.week === week) ?? null, [insights, week]);
}

/**
 * Returns insights scoped to specified weeks.
 * Useful for deriving themes and metrics from stored AI-derived data.
 */
export function useInsightsForWeeks(weeks: string[]): import("./types").WeeklyInsight[] {
  const insights = useStore((s) => s.insights);
  return useMemo(() => {
    const set = new Set(weeks);
    return insights.filter((i) => set.has(i.week));
  }, [insights, weeks]);
}

/**
 * Returns an insight scoped to the current viewer's team.
 * For org-wide (level 1) viewers, returns the raw stored insight unchanged.
 * For sub-managers, filters the per-submission theme maps to only include
 * submissions belonging to their team, then recomputes metrics accordingly.
 */
export function useScopedInsight(
  insight: import("./types").WeeklyInsight | null,
  week: string
): import("./types").WeeklyInsight | null {
  const { viewer, submissions, roster, isOrgWide } = useScope();
  return useMemo(() => {
    if (!insight) return null;
    // Org-wide viewers get the full insight as-is
    if (isOrgWide) return insight;

    // Get submission IDs that belong to the viewer's scoped team for this week
    const weekSubs = submissions.filter((s) => s.week === week);
    const scopedIds = new Set(weekSubs.map((s) => s._id));

    // Filter per-submission theme maps to only in-scope submissions
    const scopedPriority: Record<string, string> = {};
    if (insight.priorityBySubmission) {
      for (const [id, theme] of Object.entries(insight.priorityBySubmission)) {
        if (scopedIds.has(id)) scopedPriority[id] = theme;
      }
    }
    const scopedBlocker: Record<string, string> = {};
    if (insight.blockerBySubmission) {
      for (const [id, theme] of Object.entries(insight.blockerBySubmission)) {
        if (scopedIds.has(id)) scopedBlocker[id] = theme;
      }
    }

    // Re-aggregate themes from the filtered maps
    const pCounts: Record<string, number> = {};
    Object.values(scopedPriority).forEach((t) => { pCounts[t] = (pCounts[t] ?? 0) + 1; });
    const priorityThemes = Object.entries(pCounts)
      .map(([theme, count]) => ({ theme, count }))
      .sort((a, b) => b.count - a.count);

    const bCounts: Record<string, number> = {};
    Object.values(scopedBlocker).forEach((t) => { bCounts[t] = (bCounts[t] ?? 0) + 1; });
    const blockerThemes = Object.entries(bCounts)
      .map(([theme, count]) => ({ theme, count }))
      .sort((a, b) => b.count - a.count);

    // Recompute compliance metrics from the scoped roster
    const expected = roster.length;
    const received = weekSubs.length;
    const missing = Math.max(0, expected - received);
    const complianceRate = expected ? Math.round((received / expected) * 100) : 0;

    // Blocker count from scoped submissions
    const blockerCount = weekSubs.reduce(
      (sum, s) => sum + (s.blockers?.length ?? 0),
      0
    );

    return {
      ...insight,
      expected,
      received,
      missing,
      complianceRate,
      blockerCount,
      topPriorityTheme: priorityThemes[0]?.theme ?? "—",
      priorityThemes,
      blockerThemes,
      priorityBySubmission: scopedPriority,
      blockerBySubmission: scopedBlocker,
    };
  }, [insight, week, submissions, roster, isOrgWide]);
}

/**
 * Returns multiple insights scoped to the current viewer's team.
 * For org-wide viewers, returns the raw insights unchanged.
 * For sub-managers, filters per-submission theme maps to only their team's
 * submissions, then re-aggregates the theme counts.
 */
export function useScopedInsights(
  rawInsights: import("./types").WeeklyInsight[]
): import("./types").WeeklyInsight[] {
  const { submissions, roster, isOrgWide } = useScope();
  return useMemo(() => {
    if (isOrgWide) return rawInsights;

    return rawInsights.map((insight) => {
      const weekSubs = submissions.filter((s) => s.week === insight.week);
      const scopedIds = new Set(weekSubs.map((s) => s._id));

      const scopedPriority: Record<string, string> = {};
      if (insight.priorityBySubmission) {
        for (const [id, theme] of Object.entries(insight.priorityBySubmission)) {
          if (scopedIds.has(id)) scopedPriority[id] = theme;
        }
      }
      const scopedBlocker: Record<string, string> = {};
      if (insight.blockerBySubmission) {
        for (const [id, theme] of Object.entries(insight.blockerBySubmission)) {
          if (scopedIds.has(id)) scopedBlocker[id] = theme;
        }
      }

      const pCounts: Record<string, number> = {};
      Object.values(scopedPriority).forEach((t) => { pCounts[t] = (pCounts[t] ?? 0) + 1; });
      const priorityThemes = Object.entries(pCounts)
        .map(([theme, count]) => ({ theme, count }))
        .sort((a, b) => b.count - a.count);

      const bCounts: Record<string, number> = {};
      Object.values(scopedBlocker).forEach((t) => { bCounts[t] = (bCounts[t] ?? 0) + 1; });
      const blockerThemes = Object.entries(bCounts)
        .map(([theme, count]) => ({ theme, count }))
        .sort((a, b) => b.count - a.count);

      const expected = roster.length;
      const received = weekSubs.length;
      const missing = Math.max(0, expected - received);
      const complianceRate = expected ? Math.round((received / expected) * 100) : 0;
      const blockerCount = weekSubs.reduce(
        (sum, s) => sum + (s.blockers?.length ?? 0),
        0
      );

      return {
        ...insight,
        expected,
        received,
        missing,
        complianceRate,
        blockerCount,
        topPriorityTheme: priorityThemes[0]?.theme ?? "—",
        priorityThemes,
        blockerThemes,
        priorityBySubmission: scopedPriority,
        blockerBySubmission: scopedBlocker,
      };
    });
  }, [rawInsights, submissions, roster, isOrgWide]);
}

/** Departments and team leads present in the roster (derived facets for filters). */
export function useFacets(): { departments: string[]; teamLeads: string[] } {
  const people = useStore((s) => s.people);
  const submissions = useStore((s) => s.submissions);
  return useMemo(() => {
    const depts = new Set<string>();
    const leads = new Set<string>();
    people.forEach((p) => {
      if (p.department) depts.add(p.department);
      if (p.teamLead) leads.add(p.teamLead);
    });
    // Include any only present on submissions (e.g. unmatched personId rows)
    submissions.forEach((s) => {
      if (s.department) depts.add(s.department);
      if (s.teamLead) leads.add(s.teamLead);
    });
    return {
      departments: [...depts].sort(),
      teamLeads: [...leads].sort(),
    };
  }, [people, submissions]);
}
