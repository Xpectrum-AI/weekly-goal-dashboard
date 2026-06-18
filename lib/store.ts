"use client";

import { create } from "zustand";
import type { Person, WeeklySubmission, WeeklyInsight, ImportBatch, AssignedTask } from "./types";
import { api } from "./api";
import { uid } from "./utils";
import { isTopLeader, leaders } from "./org";

/** The default persona when none is selected: the top leader (CEO). */
function defaultViewerId(people: Person[]): string | null {
  const top = people.find((p) => !p.teamLead) ?? people.find(isTopLeader) ?? leaders(people)[0];
  return top?._id ?? null;
}

export interface Toast {
  id: string;
  message: string;
  tone: "success" | "error" | "info";
}

interface StoreState {
  people: Person[];
  submissions: WeeklySubmission[];
  insights: WeeklyInsight[];
  assignedTasks: AssignedTask[];
  importBatches: ImportBatch[]; // import history (client-side only)

  loaded: boolean;
  loading: boolean;
  error: string | null;

  /** Selected leader persona (null = organization-wide / founder view). */
  viewerId: string | null;
  setViewer: (id: string | null) => void;

  /** Selected week for viewing data (null = latest week). */
  selectedWeek: string | null;
  setSelectedWeek: (week: string | null) => void;

  toasts: Toast[];
  pushToast: (message: string, tone?: Toast["tone"]) => void;
  dismissToast: (id: string) => void;

  load: () => Promise<void>;
  reload: () => Promise<void>;

  // weekly_submissions
  addSubmission: (s: Omit<WeeklySubmission, "_id">) => Promise<void>;
  updateSubmission: (id: string, patch: Partial<WeeklySubmission>) => Promise<void>;
  deleteSubmission: (id: string) => Promise<void>;
  bulkAddSubmissions: (rows: Omit<WeeklySubmission, "_id">[]) => Promise<void>;

  // people
  addPerson: (p: Omit<Person, "_id">) => Promise<void>;
  invitePerson: (p: Omit<Person, "_id">) => Promise<Person | null>;
  resendInvite: (employeeId: string) => Promise<void>;
  setPersonActive: (employeeId: string, active: boolean) => Promise<void>;
  updatePerson: (id: string, patch: Partial<Person>, opts?: { invite?: boolean }) => Promise<void>;
  deletePerson: (id: string) => Promise<void>;
  bulkAddPeople: (rows: Omit<Person, "_id">[]) => Promise<void>;

  // assigned tasks
  addAssignedTask: (t: Omit<AssignedTask, "_id" | "createdAt">) => Promise<void>;
  updateAssignedTask: (id: string, patch: Partial<AssignedTask>) => Promise<void>;
  deleteAssignedTask: (id: string) => Promise<void>;

  recordImportBatch: (b: Omit<ImportBatch, "_id">) => void;
}

export const useStore = create<StoreState>((set, get) => ({
  people: [],
  submissions: [],
  insights: [],
  assignedTasks: [],
  importBatches: [],
  loaded: false,
  loading: false,
  error: null,
  viewerId: null,
  selectedWeek: null,
  toasts: [],

  setViewer: (id) => set({ viewerId: id }),
  setSelectedWeek: (week) => set({ selectedWeek: week }),

  pushToast: (message, tone = "success") => {
    const id = uid("toast");
    set((s) => ({ toasts: [...s.toasts, { id, message, tone }] }));
    if (typeof window !== "undefined") setTimeout(() => get().dismissToast(id), 3800);
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  load: async () => {
    if (get().loaded || get().loading) return;
    set({ loading: true, error: null });
    try {
      const [people, submissions, insights, assignedTasks] = await Promise.all([
        api.listPeople(),
        api.listSubmissions(),
        api.listInsights(),
        api.listAssignedTasks().catch(() => [] as AssignedTask[]),
      ]);
      // Default to the top leader (CEO) — there is no organization-wide view.
      const viewerId = get().viewerId ?? defaultViewerId(people);
      set({ people, submissions, insights, assignedTasks, viewerId, loaded: true, loading: false });
    } catch (e) {
      set({ loading: false, error: String(e) });
      get().pushToast("Could not reach MongoDB — check the connection / IP allowlist", "error");
    }
  },
  reload: async () => {
    set({ loaded: false, loading: false });
    await get().load();
  },

  // ── weekly_submissions ──────────────────────────────────────────────────
  addSubmission: async (s) => {
    try {
      const doc = await api.createSubmission(s);
      set((st) => ({ submissions: [doc, ...st.submissions] }));
      get().pushToast("Submission added");
    } catch {
      get().pushToast("Save failed", "error");
    }
  },
  updateSubmission: async (id, patch) => {
    try {
      const doc = await api.updateSubmission(id, patch);
      set((st) => ({ submissions: st.submissions.map((x) => (x._id === id ? doc : x)) }));
      get().pushToast("Submission updated");
    } catch {
      get().pushToast("Update failed", "error");
    }
  },
  deleteSubmission: async (id) => {
    const prev = get().submissions;
    set((st) => ({ submissions: st.submissions.filter((x) => x._id !== id) }));
    try {
      await api.deleteSubmission(id);
      get().pushToast("Submission deleted", "info");
    } catch {
      set({ submissions: prev });
      get().pushToast("Delete failed", "error");
    }
  },
  bulkAddSubmissions: async (rows) => {
    try {
      const docs = await api.bulkSubmissions(rows);
      set((st) => ({ submissions: [...docs, ...st.submissions] }));
    } catch {
      get().pushToast("Bulk import failed", "error");
    }
  },

  // ── people ──────────────────────────────────────────────────────────────
  addPerson: async (p) => {
    try {
      const doc = await api.createPerson(p);
      set((st) => ({ people: [doc, ...st.people] }));
      get().pushToast("Person added");
    } catch {
      get().pushToast("Save failed", "error");
    }
  },
  invitePerson: async (p) => {
    try {
      const doc = await api.inviteEmployee({
        name: p.name,
        email: p.email ?? "",
        phone: p.phone,
        department: p.department,
        teamLead: p.teamLead ?? undefined,
        level: p.level ?? 5,
        title: p.title,
      });
      set((st) => ({ people: [doc, ...st.people] }));
      get().pushToast(`Invite sent to ${p.email}`);
      return doc;
    } catch (e) {
      const msg = e instanceof Error && e.message ? e.message : "Could not send invite";
      get().pushToast(msg, "error");
      return null;
    }
  },
  resendInvite: async (employeeId) => {
    try {
      const res = await api.resendInvite(employeeId);
      get().pushToast((res as { message?: string }).message ?? "Invite re-sent");
      // The account may have just been linked (authUserId backfilled); refresh
      // so the people list reflects it.
      if ((res as { linked?: boolean }).linked) get().reload();
    } catch (e) {
      const msg = e instanceof Error && e.message ? e.message : "Could not resend invite";
      get().pushToast(msg, "error");
    }
  },
  setPersonActive: async (id, active) => {
    try {
      // NOTE: the API param is named "employeeId" but the routes key on Mongo _id.
      if (active) await api.reactivateEmployee(id);
      else await api.deactivateEmployee(id);
      set((st) => ({
        people: st.people.map((x) => (x._id === id ? { ...x, active } : x)),
      }));
      get().pushToast(active ? "Employee reactivated" : "Employee deactivated", "info");
    } catch (e) {
      const msg = e instanceof Error && e.message ? e.message : "Action failed";
      get().pushToast(msg, "error");
    }
  },
  updatePerson: async (id, patch, opts) => {
    try {
      const doc = await api.updatePerson(id, patch, opts);
      set((st) => ({ people: st.people.map((x) => (x._id === id ? doc : x)) }));
      // The account link may have just been created/backfilled — refresh so the
      // list reflects it.
      get().pushToast(opts?.invite ? "Person updated · invite sent" : "Person updated");
    } catch (e) {
      const msg = e instanceof Error && e.message ? e.message : "Update failed";
      get().pushToast(msg, "error");
    }
  },
  deletePerson: async (id) => {
    const prev = get().people;
    set((st) => ({ people: st.people.filter((x) => x._id !== id) }));
    try {
      await api.deletePerson(id);
      get().pushToast("Person removed", "info");
    } catch {
      set({ people: prev });
      get().pushToast("Delete failed", "error");
    }
  },
  bulkAddPeople: async (rows) => {
    try {
      const docs = await api.bulkPeople(rows);
      set((st) => ({ people: [...docs, ...st.people] }));
    } catch {
      get().pushToast("Bulk import failed", "error");
    }
  },

  // ── assigned tasks ────────────────────────────────────────────────────────
  addAssignedTask: async (t) => {
    try {
      const doc = await api.createAssignedTask(t);
      set((st) => ({ assignedTasks: [doc, ...st.assignedTasks] }));
      get().pushToast("Task assigned");
    } catch {
      get().pushToast("Could not assign task", "error");
    }
  },
  updateAssignedTask: async (id, patch) => {
    const prev = get().assignedTasks;
    // optimistic
    set((st) => ({ assignedTasks: st.assignedTasks.map((x) => (x._id === id ? { ...x, ...patch } : x)) }));
    try {
      const doc = await api.updateAssignedTask(id, patch);
      if (doc) set((st) => ({ assignedTasks: st.assignedTasks.map((x) => (x._id === id ? doc : x)) }));
    } catch {
      set({ assignedTasks: prev });
      get().pushToast("Update failed", "error");
    }
  },
  deleteAssignedTask: async (id) => {
    const prev = get().assignedTasks;
    set((st) => ({ assignedTasks: st.assignedTasks.filter((x) => x._id !== id) }));
    try {
      await api.deleteAssignedTask(id);
      get().pushToast("Task removed", "info");
    } catch {
      set({ assignedTasks: prev });
      get().pushToast("Delete failed", "error");
    }
  },

  recordImportBatch: (b) => {
    set((st) => ({ importBatches: [{ ...b, _id: uid("imp") }, ...st.importBatches] }));
  },
}));
