/**
 * CSV Export utilities - matches the import template format
 * This ensures exported data can be re-imported seamlessly using the same template format.
 */

import type { WeeklySubmission, ScoredSubmission, Person, ExtractedSubmission } from "./types";
import type { Submitter } from "./org";
import { priorityText, actionTexts } from "./goals";

// ── CSV escaping utility ────────────────────────────────────────────────────
function escapeCSV(value: string | number | undefined | null): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  // Escape quotes and wrap in quotes if contains special characters
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function arrayToString(arr: string[]): string {
  return arr.join("; ");
}

function csvLine(values: (string | number | undefined | null)[]): string {
  return values.map(escapeCSV).join(",");
}

function downloadCSV(content: string, filename: string): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Submissions Export (matches import template) ────────────────────────────
// Import template columns: Person, Week, Top Priority, Actions, Outcomes, Blockers
export function exportSubmissionsCSV(
  submissions: (WeeklySubmission | ScoredSubmission)[],
  filename = "weekly_submissions"
): void {
  const header = ["Person", "Week", "Top Priority", "Actions", "Outcomes", "Blockers", "Notes"];
  
  const lines = submissions.map((s) =>
    csvLine([
      s.personName,
      s.week,
      priorityText(s),
      arrayToString(actionTexts(s)),
      arrayToString(s.outcomes),
      arrayToString(s.blockers),
      s.notes || "",
    ])
  );

  const csv = [header.join(","), ...lines].join("\n");
  downloadCSV(csv, filename);
}

// Extended export with additional metadata (for analytics)
export function exportSubmissionsFullCSV(
  submissions: ScoredSubmission[],
  filename = "weekly_submissions_full"
): void {
  const header = [
    "Person",
    "Department",
    "Team Lead",
    "Week",
    "Top Priority",
    "Actions",
    "Outcomes",
    "Blockers",
    "Notes",
    "Completeness",
    "Status",
    "Action Count",
    "Outcome Count",
    "Blocker Count",
    "Submitted At",
  ];

  const lines = submissions.map((s) =>
    csvLine([
      s.personName,
      s.department,
      s.teamLead,
      s.week,
      priorityText(s),
      arrayToString(actionTexts(s)),
      arrayToString(s.outcomes),
      arrayToString(s.blockers),
      s.notes || "",
      `${s.completeness}%`,
      s.status,
      s.actionCount,
      s.outcomeCount,
      s.blockerCount,
      s.submittedAt,
    ])
  );

  const csv = [header.join(","), ...lines].join("\n");
  downloadCSV(csv, filename);
}

// ── People Export (matches import template) ─────────────────────────────────
// Import template columns: Name, Phone, Department, Team Lead, Title
export function exportPeopleCSV(
  people: Person[],
  filename = "people"
): void {
  const header = ["Name", "Phone", "Department", "Team Lead", "Title"];

  const lines = people.map((p) =>
    csvLine([p.name, p.phone, p.department, p.teamLead || "", p.title])
  );

  const csv = [header.join(","), ...lines].join("\n");
  downloadCSV(csv, filename);
}

// Extended people export with consistency data
export interface PeopleExportRow {
  name: string;
  phone: string;
  department: string;
  teamLead: string;
  title: string;
  active?: boolean;
  consistencyRate?: number;
  submissionCount?: number;
}

export function exportPeopleFullCSV(
  rows: PeopleExportRow[],
  filename = "people_full"
): void {
  const header = [
    "Name",
    "Phone",
    "Department",
    "Team Lead",
    "Title",
    "Active",
    "Consistency Rate",
    "Submissions",
  ];

  const lines = rows.map((r) =>
    csvLine([
      r.name,
      r.phone,
      r.department,
      r.teamLead,
      r.title,
      r.active !== undefined ? (r.active ? "Yes" : "No") : "",
      r.consistencyRate !== undefined ? `${r.consistencyRate}%` : "",
      r.submissionCount ?? "",
    ])
  );

  const csv = [header.join(","), ...lines].join("\n");
  downloadCSV(csv, filename);
}

// ── Blockers Export ─────────────────────────────────────────────────────────
export interface BlockerExportRow {
  personName: string;
  department: string;
  teamLead: string;
  week: string;
  blocker: string;
  theme?: string;
}

export function exportBlockersCSV(
  blockers: BlockerExportRow[],
  filename = "blockers"
): void {
  const header = ["Person", "Department", "Team Lead", "Week", "Blocker", "Theme"];

  const lines = blockers.map((b) =>
    csvLine([b.personName, b.department, b.teamLead, b.week, b.blocker, b.theme || ""])
  );

  const csv = [header.join(","), ...lines].join("\n");
  downloadCSV(csv, filename);
}

// ── Missing Updates Export ──────────────────────────────────────────────────
export function exportMissingCSV(
  missing: Submitter[],
  week: string,
  filename = "missing_updates"
): void {
  const header = ["Person", "Department", "Team Lead", "Phone", "Week"];

  const lines = missing.map((m) =>
    csvLine([m.name, m.department, m.teamLead || "", m.person?.phone || "", week])
  );

  const csv = [header.join(","), ...lines].join("\n");
  downloadCSV(csv, filename);
}

// ── Extracted Submissions Export (for review page) ──────────────────────────
export function exportExtractedSubmissionsCSV(
  submissions: ExtractedSubmission[],
  filename = "extracted_submissions"
): void {
  const header = [
    "Person",
    "Week",
    "Top Priority",
    "Actions",
    "Outcomes",
    "Blockers",
    "Notes",
    "Status",
    "Reviewed",
  ];

  const lines = submissions.map((s) =>
    csvLine([
      s.personName,
      s.week,
      s.topPriority,
      arrayToString(s.actions),
      arrayToString(s.outcomes),
      arrayToString(s.blockers),
      s.notes || "",
      s.validation.status,
      s.reviewed ? "Yes" : "No",
    ])
  );

  const csv = [header.join(","), ...lines].join("\n");
  downloadCSV(csv, filename);
}

// ── Generic CSV Export ──────────────────────────────────────────────────────
export function exportGenericCSV<T extends Record<string, any>>(
  data: T[],
  columns: { key: keyof T; label: string; format?: (val: any) => string }[],
  filename: string
): void {
  const header = columns.map((c) => c.label);

  const lines = data.map((row) =>
    csvLine(
      columns.map((col) => {
        const val = row[col.key];
        return col.format ? col.format(val) : val;
      })
    )
  );

  const csv = [header.join(","), ...lines].join("\n");
  downloadCSV(csv, filename);
}
