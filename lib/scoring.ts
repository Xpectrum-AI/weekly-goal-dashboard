import type { WeeklySubmission, SubmissionStatus } from "./types";
import { priorityText, actionTexts } from "./goals";

// ───────────────────────────────────────────────────────────────────────────
// Pure functions: derive completeness, status, and themes from stored fields
// only. No external metrics. Shared by the seed data and the live analytics so
// what's displayed always matches what's stored.
// ───────────────────────────────────────────────────────────────────────────

export interface SubmissionScore {
  completeness: number; // 0–100
  status: SubmissionStatus;
}

/**
 * Response completeness from the structured fields a submission actually has:
 * a stated priority, action items, and outcomes. Blockers are optional context
 * and don't penalize the score.
 *
 *   topPriority present        → 30
 *   actions: 2+ → 40, exactly 1 → 22
 *   outcomes: 1+               → 30
 *
 * Status: Weak < 45, Partial 45–74, Complete 75+.
 */
export function scoreSubmission(sub: WeeklySubmission): SubmissionScore {
  let c = 0;
  if (priorityText(sub).trim().length > 3) c += 30;

  const acts = actionTexts(sub).filter((a) => a.trim()).length;
  if (acts >= 2) c += 40;
  else if (acts === 1) c += 22;

  if ((sub.outcomes ?? []).filter((o) => (o ?? "").trim()).length >= 1) c += 30;

  c = Math.max(0, Math.min(100, c));

  let status: SubmissionStatus;
  if (c < 45) status = "Weak";
  else if (c < 75) status = "Partial";
  else status = "Complete";

  return { completeness: c, status };
}
