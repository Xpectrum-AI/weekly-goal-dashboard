import type { WeeklyInsight, Theme } from "./types";

// ───────────────────────────────────────────────────────────────────────────
// Normalizes a raw weekly_insights document into the flat WeeklyInsight the UI
// expects. Handles the actual stored shape, where the payload is a JSON string
// under `result`, with metrics + structured_output nested inside:
//
//   { "result": "{ \"_id\":..., \"metrics\": {...}, \"structured_output\": {...} }" }
//
// It also tolerates already-parsed / already-flat documents.
// ───────────────────────────────────────────────────────────────────────────

function aggregateThemes(arr: any): Theme[] {
  if (!Array.isArray(arr)) return [];
  // Aggregated form: [{ theme, count }]
  if (arr.length > 0 && arr[0] && typeof arr[0].count === "number") {
    return arr
      .filter((x) => x && x.theme)
      .map((x) => ({ theme: String(x.theme), count: Number(x.count) }))
      .sort((a, b) => b.count - a.count);
  }
  // Per-submission form: [{ submissionId, theme, confidence }] → count by theme
  const counts: Record<string, number> = {};
  arr.forEach((x: any) => {
    if (x && x.theme) counts[x.theme] = (counts[x.theme] ?? 0) + 1;
  });
  return Object.entries(counts)
    .map(([theme, count]) => ({ theme, count }))
    .sort((a, b) => b.count - a.count);
}

function perSubmissionMap(arr: any): Record<string, string> {
  const m: Record<string, string> = {};
  if (Array.isArray(arr)) {
    arr.forEach((x: any) => {
      if (x && x.submissionId && x.theme) m[x.submissionId] = String(x.theme);
    });
  }
  return m;
}

export function normalizeInsight(doc: any): WeeklyInsight | null {
  let inner: any = doc;
  if (doc && typeof doc.result === "string") {
    try {
      inner = JSON.parse(doc.result);
    } catch {
      inner = {};
    }
  } else if (doc && typeof doc.result === "object" && doc.result) {
    inner = doc.result;
  }

  const week: string | undefined = inner.week ?? doc?.week;
  if (!week) return null;

  const m = inner.metrics ?? inner ?? {};
  const so = inner.structured_output ?? inner ?? {};

  // Prefer pre-aggregated themes at root level if available, otherwise aggregate from structured_output
  const rootPThemes = aggregateThemes(inner.priorityThemes);
  const rootBThemes = aggregateThemes(inner.blockerThemes);
  const priorityThemes = rootPThemes.length > 0 ? rootPThemes : aggregateThemes(so.priorityThemes);
  const blockerThemes = rootBThemes.length > 0 ? rootBThemes : aggregateThemes(so.blockerThemes);
  
  // Per-submission maps come from structured_output (per-submission form)
  const priorityBySubmission = perSubmissionMap(so.priorityThemes);
  const blockerBySubmission = perSubmissionMap(so.blockerThemes);

  return {
    _id: inner._id ?? doc?._id ?? `wi_${week}`,
    week,
    expected: Number(m.expected ?? 0),
    received: Number(m.received ?? 0),
    missing: Number(m.missing ?? 0),
    complianceRate: Number(m.complianceRate ?? 0),
    blockerCount: Number(m.blockerCount ?? 0),
    avgCompleteness: Number(m.avgCompleteness ?? 0),
    weakCount: Number(m.weakCount ?? 0),
    topPriorityTheme: inner.topPriorityTheme ?? so.topPriorityTheme ?? priorityThemes[0]?.theme ?? "—",
    priorityThemes,
    blockerThemes,
    priorityBySubmission,
    blockerBySubmission,
  };
}

export function normalizeInsights(docs: any[]): WeeklyInsight[] {
  return docs
    .map(normalizeInsight)
    .filter((x): x is WeeklyInsight => !!x)
    .sort((a, b) => a.week.localeCompare(b.week));
}
