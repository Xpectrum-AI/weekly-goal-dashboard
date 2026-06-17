// ───────────────────────────────────────────────────────────────────────────
// Data model — shaped as MongoDB documents.
//
// This is a LEADERSHIP console (founders, department heads, team leads). Every
// metric is grounded strictly in three collections that come from the weekly
// WhatsApp intake. No goal %, AI adoption, scorecards, or KPIs — only what the
// stored documents actually contain.
//
// Collections:
//   people              — the people-mapping roster (who → team lead → dept)
//   weekly_submissions  — one document per person per week, from WhatsApp
//   weekly_insights     — precomputed per-week aggregates
// ───────────────────────────────────────────────────────────────────────────

/** Derived from how complete a weekly submission is. */
export type SubmissionStatus = "Complete" | "Partial" | "Weak";

// ── people ──────────────────────────────────────────────────────────────────
export interface Person {
  _id: string;
  name: string;
  phone: string; // WhatsApp number
  department: string;
  teamLead: string | null; // name of the person's team lead (null = top of org)
  title: string;
  active: boolean;
  joinedAt: string; // ISO date
  avatarColor: string;
  employeeId?: string;
  /** Org depth: 1 = Founder/CEO (top). Higher number = further down the org. */
  level?: number;
}

// ── weekly_submissions ──────────────────────────────────────────────────────
/** A goal-style item that can be marked complete. New model for priority/actions. */
export interface GoalItem {
  text: string;
  completed: boolean;
}

/**
 * A priority or action value. New records store a {text, completed} GoalItem;
 * legacy records store a plain string. Read these through lib/goals helpers
 * (goalText / goalDone) so both shapes are handled transparently.
 */
export type GoalValue = string | GoalItem;

export interface WeeklySubmission {
  _id: string;
  personId: string | null; // ref → people._id (may be null if unmatched)
  personName: string; // denormalized for fast reads (Mongo-style)
  department: string;
  teamLead: string;
  week: string; // ISO week label e.g. "2026-W23"
  submittedAt: string; // ISO datetime
  // The person's top priorities this week. Legacy records store a single string
  // or GoalItem; new records may store an array of GoalItems (multiple priorities).
  topPriority: GoalValue | GoalValue[];
  actions: GoalValue[]; // what they did / action items (string[]=legacy, GoalItem[]=new)
  outcomes: string[]; // results delivered
  blockers: string[]; // raw blocker texts (may be empty)
  notes: string; // any extra context
}

// ── assigned_tasks (leadership-assigned priority tasks) ─────────────────────
// A task a leader assigns to someone below their level. Stored separately from
// weekly_submissions but shown alongside them in the Weekly Goals UI.
export type TaskUrgency = "urgent" | "normal";

export interface AssignedTask {
  _id: string;
  personId: string | null; // assignee ref → people._id
  personName: string; // assignee (denormalized)
  department: string;
  teamLead: string;
  week: string; // ISO week the task belongs to
  text: string; // the task / priority text
  urgency: TaskUrgency;
  deadline: string; // ISO date (yyyy-mm-dd) or "" if none
  completed: boolean;
  assignedBy: string; // leader name who assigned it
  assignedByLevel: number; // assigner's org level at time of assignment
  notes: string;
  createdAt: string; // ISO datetime
}

/** A submission enriched with its derived completeness + status. */
export interface ScoredSubmission extends WeeklySubmission {
  completeness: number; // 0–100
  status: SubmissionStatus;
  actionCount: number;
  outcomeCount: number;
  blockerCount: number;
}

// ── Themes (derived from raw text) ──────────────────────────────────────────
export interface Theme {
  theme: string;
  count: number;
}

// ── weekly_insights ─────────────────────────────────────────────────────────
export interface WeeklyInsight {
  _id: string;
  week: string;
  expected: number;
  received: number;
  missing: number;
  complianceRate: number; // %
  blockerCount: number;
  avgCompleteness: number; // %
  weakCount: number;
  topPriorityTheme: string;
  priorityThemes: Theme[];
  blockerThemes: Theme[];
  /** Per-submission AI theme (submissionId → theme) for scoped re-aggregation. */
  priorityBySubmission?: Record<string, string>;
  blockerBySubmission?: Record<string, string>;
}

// ── Import history (kept for the Data Import page) ──────────────────────────
export type ImportStatus = "Completed" | "Partial" | "Failed";

export interface ImportBatch {
  _id: string;
  fileName: string;
  importedBy: string;
  importedAt: string;
  collection: "weekly_submissions" | "people";
  totalRows: number;
  successCount: number;
  failureCount: number;
  status: ImportStatus;
}

// ── uploads ─────────────────────────────────────────────────────────────────
export type UploadStatus = "processing" | "review_pending" | "approved" | "partial" | "rejected";

export interface Upload {
  _id: string;
  fileName: string;
  uploadedAt: string;
  uploadedBy: string;
  status: UploadStatus;
  totalRows: number;
  readyCount: number;
  warningCount: number;
  errorCount: number;
}

// ── extracted_submissions (draft submissions pending review) ────────────────
export type ValidationStatus = "ready" | "warning" | "error";

export interface ValidationIssue {
  code: string;
  message: string;
  severity: "warning" | "error";
  field?: string;
}

export interface ExtractedSubmission {
  _id: string;
  uploadId: string;
  rowIndex: number;

  // Extracted data
  personId: string | null;
  personName: string;
  department: string;
  teamLead: string;
  week: string;
  topPriority: string;
  actions: string[];
  outcomes: string[];
  blockers: string[];
  notes: string;

  // Raw cell data for side-by-side comparison
  rawData: Record<string, any>;
  mapping: Record<string, string>;

  // Validation state
  validation: {
    status: ValidationStatus;
    issues: ValidationIssue[];
  };

  // Review state
  reviewed: boolean;
  reviewedAt?: string;
  reviewedBy?: string;
}

// ── Filters shared across pages ─────────────────────────────────────────────
export interface SubmissionFilters {
  week: string; // "all" or a week
  department: string; // "all" or a dept
  teamLead: string; // "all" or a lead name
  personId: string; // "all" or a person id
}

// ── Notepad notes (free-form team-lead notes) ───────────────────────────────
export interface Note {
  _id: string;
  title: string;
  content: string;
  /** Owner persona id ("__org__" for the organization-wide / founder view). Each owner sees only their own notes. */
  owner: string;
  ownerName: string;
  createdAt: string;
  updatedAt: string;
}
