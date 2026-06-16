// ───────────────────────────────────────────────────────────────────────────
// Helpers for the priority / action "goal" model. Records may be in the legacy
// shape (topPriority: string, actions: string[]) or the new shape
// (topPriority: GoalItem, actions: GoalItem[]). These accessors read both, and
// the toggle helpers always WRITE the new shape — so any completion toggle
// transparently migrates an old record to the new model.
// ───────────────────────────────────────────────────────────────────────────

import type { GoalItem, GoalValue, WeeklySubmission } from "./types";

/** The display text of a priority/action, regardless of legacy/new shape. */
export function goalText(v: GoalValue | null | undefined): string {
  if (v == null) return "";
  return typeof v === "string" ? v : v.text ?? "";
}

/** Whether a priority/action is marked complete (legacy strings are never complete). */
export function goalDone(v: GoalValue | null | undefined): boolean {
  return typeof v === "object" && v != null ? !!v.completed : false;
}

/** Coerce any value into a GoalItem (legacy string → not-completed item). */
export function toGoalItem(v: GoalValue | null | undefined): GoalItem {
  if (v == null) return { text: "", completed: false };
  return typeof v === "string"
    ? { text: v, completed: false }
    : { text: v.text ?? "", completed: !!v.completed };
}

/** All top-priority items normalized to GoalItem[] (handles single or array, legacy or new). */
export function priorityItems(s: { topPriority: WeeklySubmission["topPriority"] }): GoalItem[] {
  const p = s.topPriority;
  const list = Array.isArray(p) ? p : [p];
  return list.map(toGoalItem).filter((i) => i.text.trim().length > 0);
}

/** Combined priority text (joined) — for search, export, scoring, summaries. */
export function priorityText(s: { topPriority: WeeklySubmission["topPriority"] }): string {
  return priorityItems(s).map((i) => i.text).join("; ");
}

/** True only when there is at least one priority and all are complete. */
export function priorityDone(s: { topPriority: WeeklySubmission["topPriority"] }): boolean {
  const items = priorityItems(s);
  return items.length > 0 && items.every((i) => i.completed);
}

/** All action items normalized to GoalItem[], dropping empties. */
export function actionItems(s: { actions: WeeklySubmission["actions"] }): GoalItem[] {
  return (s.actions ?? []).map(toGoalItem).filter((a) => a.text.trim().length > 0);
}

/** Just the action texts (for search, export, scoring). */
export function actionTexts(s: { actions: WeeklySubmission["actions"] }): string[] {
  return actionItems(s).map((a) => a.text);
}

/** True if this record still uses the legacy string shape anywhere. */
export function isLegacyGoalModel(s: WeeklySubmission): boolean {
  if (typeof s.topPriority === "string" && s.topPriority.trim()) return true;
  return (s.actions ?? []).some((a) => typeof a === "string" && a.trim());
}

/**
 * Patch that toggles priority #idx's completed state AND normalizes the whole
 * record to the new model (so a legacy record is migrated on first toggle).
 */
export function withToggledPriority(s: WeeklySubmission, idx: number): Partial<WeeklySubmission> {
  const items = priorityItems(s);
  if (!items[idx]) return {};
  items[idx] = { ...items[idx], completed: !items[idx].completed };
  return { topPriority: items, actions: actionItems(s) };
}

/** Patch that toggles action #idx's completed state and normalizes the record. */
export function withToggledAction(s: WeeklySubmission, idx: number): Partial<WeeklySubmission> {
  const items = actionItems(s);
  if (!items[idx]) return {};
  items[idx] = { ...items[idx], completed: !items[idx].completed };
  return { topPriority: priorityItems(s), actions: items };
}
