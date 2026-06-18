"use client";

import type { Person, WeeklySubmission, WeeklyInsight, Upload, ExtractedSubmission, Note, AssignedTask } from "./types";

// ─── Token management ────────────────────────────────────────────────────────
// The auth token is set by the AuthProvider once the user is authenticated.
// All API calls automatically include it in the Authorization header.
let _accessToken: string | null = null;

export function setApiToken(token: string | null) {
  _accessToken = token;
}

export function getApiToken(): string | null {
  return _accessToken;
}

// ─── Auth-failure handler ────────────────────────────────────────────────────
// Registered by AuthProvider. Fires when the server rejects the session itself
// (token no longer valid, or access revoked server-side) so the app can send the
// user back to login. NOT fired for ordinary permission denials (e.g. trying to
// edit someone you don't manage) — those stay as normal errors.
export type AuthFailureReason = "unauthorized" | "revoked";
let _onAuthFailure: ((reason: AuthFailureReason) => void) | null = null;

export function setAuthFailureHandler(fn: ((reason: AuthFailureReason) => void) | null) {
  _onAuthFailure = fn;
}

async function req<T>(url: string, opts?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(opts?.headers as Record<string, string> ?? {}),
  };

  // Attach auth token if available
  if (_accessToken) {
    headers["Authorization"] = `Bearer ${_accessToken}`;
  }

  const res = await fetch(url, {
    ...opts,
    headers,
  });
  if (!res.ok) {
    let msg = res.statusText;
    let errText = "";
    try {
      errText = (await res.json()).error ?? "";
      if (errText) msg = errText;
    } catch {
      /* ignore */
    }
    // The session itself is no longer valid → bounce to login.
    if (res.status === 401) {
      _onAuthFailure?.("unauthorized");
      msg = "Session expired. Please log in again.";
    } else if (res.status === 403 && /deactivated|no employee record/i.test(errText)) {
      // Access was revoked while the user was active (deactivated / unlinked).
      // Distinct from a plain permission denial, which keeps showing as an error.
      _onAuthFailure?.("revoked");
    }
    throw new Error(msg);
  }
  return res.json();
}

export const api = {
  // people
  listPeople: () => req<Person[]>("/api/people"),
  createPerson: (p: Omit<Person, "_id">) => req<Person>("/api/people", { method: "POST", body: JSON.stringify(p) }),
  bulkPeople: (rows: Omit<Person, "_id">[]) => req<Person[]>("/api/people", { method: "POST", body: JSON.stringify(rows) }),
  updatePerson: (id: string, patch: Partial<Person>, opts?: { invite?: boolean }) =>
    req<Person>(`/api/people/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ ...patch, ...(opts?.invite ? { invite: true } : {}) }),
    }),
  deletePerson: (id: string) => req<{ ok: boolean }>(`/api/people/${id}`, { method: "DELETE" }),

  // submissions
  listSubmissions: () => req<WeeklySubmission[]>("/api/submissions"),
  createSubmission: (s: Omit<WeeklySubmission, "_id">) => req<WeeklySubmission>("/api/submissions", { method: "POST", body: JSON.stringify(s) }),
  bulkSubmissions: (rows: Omit<WeeklySubmission, "_id">[]) => req<WeeklySubmission[]>("/api/submissions", { method: "POST", body: JSON.stringify(rows) }),
  updateSubmission: (id: string, patch: Partial<WeeklySubmission>) => req<WeeklySubmission>(`/api/submissions/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  deleteSubmission: (id: string) => req<{ ok: boolean }>(`/api/submissions/${id}`, { method: "DELETE" }),

  // assigned tasks (leadership-assigned, separate collection)
  listAssignedTasks: () => req<AssignedTask[]>("/api/assigned-tasks"),
  createAssignedTask: (t: Omit<AssignedTask, "_id" | "createdAt">) => req<AssignedTask>("/api/assigned-tasks", { method: "POST", body: JSON.stringify(t) }),
  updateAssignedTask: (id: string, patch: Partial<AssignedTask>) => req<AssignedTask>(`/api/assigned-tasks/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  deleteAssignedTask: (id: string) => req<{ ok: boolean }>(`/api/assigned-tasks/${id}`, { method: "DELETE" }),

  // insights (read-only, normalized server-side)
  listInsights: () => req<WeeklyInsight[]>("/api/insights"),
  
  // uploads
  listUploads: () => req<Upload[]>("/api/uploads"),
  createUpload: (u: Omit<Upload, "_id">) => req<Upload>("/api/uploads", { method: "POST", body: JSON.stringify(u) }),
  getUpload: (id: string) => req<Upload>(`/api/uploads/${id}`),
  updateUpload: (id: string, patch: Partial<Upload>) => req<Upload>(`/api/uploads/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  deleteUpload: (id: string) => req<{ ok: boolean }>(`/api/uploads/${id}`, { method: "DELETE" }),
  
  // extracted submissions (drafts)
  listExtractedSubmissions: (uploadId?: string) => 
    req<ExtractedSubmission[]>(`/api/extracted-submissions${uploadId ? `?uploadId=${uploadId}` : ""}`),
  createExtractedSubmissions: (rows: Omit<ExtractedSubmission, "_id">[]) => 
    req<ExtractedSubmission[]>("/api/extracted-submissions", { method: "POST", body: JSON.stringify(rows) }),
  getExtractedSubmission: (id: string) => req<ExtractedSubmission>(`/api/extracted-submissions/${id}`),
  updateExtractedSubmission: (id: string, patch: Partial<ExtractedSubmission>) => 
    req<ExtractedSubmission>(`/api/extracted-submissions/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  deleteExtractedSubmission: (id: string) => req<{ ok: boolean }>(`/api/extracted-submissions/${id}`, { method: "DELETE" }),
  approveExtractedSubmissions: (payload: { ids?: string[]; uploadId?: string }) => 
    req<{ approved: number; submissions: WeeklySubmission[] }>("/api/extracted-submissions/approve", { method: "POST", body: JSON.stringify(payload) }),

  // notes (free-form notepad, scoped per persona/owner)
  listNotes: (owner: string) => req<Note[]>(`/api/notes?owner=${encodeURIComponent(owner)}`),
  createNote: (n: Pick<Note, "title" | "content" | "owner" | "ownerName">) => req<Note>("/api/notes", { method: "POST", body: JSON.stringify(n) }),
  updateNote: (id: string, patch: Partial<Pick<Note, "title" | "content">>) => req<Note>(`/api/notes/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  deleteNote: (id: string) => req<{ ok: boolean }>(`/api/notes/${id}`, { method: "DELETE" }),

  // auth / employee management
  inviteEmployee: (data: { name: string; email: string; phone?: string; department: string; teamLead?: string; level: number; title?: string }) =>
    req<Person>("/api/auth/invite", { method: "POST", body: JSON.stringify(data) }),
  deactivateEmployee: (employeeId: string, disableAuth = true) =>
    req<{ ok: boolean }>("/api/auth/deactivate", { method: "POST", body: JSON.stringify({ employeeId, disableAuth }) }),
  reactivateEmployee: (employeeId: string, email?: string) =>
    req<{ ok: boolean }>("/api/auth/reactivate", { method: "POST", body: JSON.stringify({ employeeId, ...(email ? { email } : {}) }) }),
  resendInvite: (employeeId: string) =>
    req<{ ok: boolean }>("/api/auth/resend-invite", { method: "POST", body: JSON.stringify({ employeeId }) }),
  checkAuthEmail: (email: string) =>
    req<{ exists: boolean }>(`/api/auth/check-email?email=${encodeURIComponent(email)}`),
};
