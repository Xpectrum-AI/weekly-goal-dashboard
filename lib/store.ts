"use client";

import { create } from "zustand";
import type { Person, WeeklySubmission, WeeklyInsight, ImportBatch } from "./types";
import { api } from "./api";
import { uid } from "./utils";

export interface Toast {
  id: string;
  message: string;
  tone: "success" | "error" | "info";
}

interface StoreState {
  people: Person[];
  submissions: WeeklySubmission[];
  insights: WeeklyInsight[];
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
  updatePerson: (id: string, patch: Partial<Person>) => Promise<void>;
  deletePerson: (id: string) => Promise<void>;
  bulkAddPeople: (rows: Omit<Person, "_id">[]) => Promise<void>;

  recordImportBatch: (b: Omit<ImportBatch, "_id">) => void;
}

export const useStore = create<StoreState>((set, get) => ({
  people: [],
  submissions: [],
  insights: [],
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
      const [people, submissions, insights] = await Promise.all([
        api.listPeople(),
        api.listSubmissions(),
        api.listInsights(),
      ]);
      set({ people, submissions, insights, loaded: true, loading: false });
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
  updatePerson: async (id, patch) => {
    try {
      const doc = await api.updatePerson(id, patch);
      set((st) => ({ people: st.people.map((x) => (x._id === id ? doc : x)) }));
      get().pushToast("Person updated");
    } catch {
      get().pushToast("Update failed", "error");
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

  recordImportBatch: (b) => {
    set((st) => ({ importBatches: [{ ...b, _id: uid("imp") }, ...st.importBatches] }));
  },
}));
