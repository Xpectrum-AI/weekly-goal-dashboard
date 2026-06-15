"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { NotebookPen, Plus, Trash2, Search } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { EmptyState, Skeleton } from "@/components/ui/States";
import { api } from "@/lib/api";
import { useScope } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import type { Note } from "@/lib/types";

const ORG_OWNER = "__org__";

function formatWhen(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function previewOf(content: string): string {
  const line = content.split("\n").find((l) => l.trim().length > 0);
  return line ? line.trim() : "No additional text";
}

export default function NotepadPage() {
  const { viewer } = useScope();
  const owner = viewer?._id ?? ORG_OWNER;
  const ownerName = viewer?.name ?? "Organization-wide";

  const [notes, setNotes] = useState<Note[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load notes for the current persona — reloads whenever "viewing as" changes,
  // so a lead only ever sees their own notes.
  useEffect(() => {
    setNotes(null);
    setActiveId(null);
    api
      .listNotes(owner)
      .then((rows) => {
        setNotes(rows);
        if (rows.length) setActiveId(rows[0]._id);
      })
      .catch(() => setNotes([]));
  }, [owner]);

  const active = useMemo(
    () => notes?.find((n) => n._id === activeId) ?? null,
    [notes, activeId]
  );

  const filtered = useMemo(() => {
    if (!notes) return [];
    const q = query.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q)
    );
  }, [notes, query]);

  async function handleNew() {
    const created = await api.createNote({ title: "", content: "", owner, ownerName });
    setNotes((prev) => [created, ...(prev ?? [])]);
    setActiveId(created._id);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this note?")) return;
    await api.deleteNote(id);
    setNotes((prev) => {
      const next = (prev ?? []).filter((n) => n._id !== id);
      if (id === activeId) setActiveId(next[0]?._id ?? null);
      return next;
    });
  }

  // Debounced autosave on edit
  function patchActive(patch: Partial<Pick<Note, "title" | "content">>) {
    if (!active) return;
    const id = active._id;
    setNotes((prev) =>
      (prev ?? []).map((n) =>
        n._id === id ? { ...n, ...patch } : n
      )
    );
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaving(true);
    saveTimer.current = setTimeout(async () => {
      try {
        const saved = await api.updateNote(id, patch);
        setNotes((prev) =>
          (prev ?? []).map((n) =>
            n._id === id ? { ...n, updatedAt: saved.updatedAt } : n
          )
        );
      } finally {
        setSaving(false);
      }
    }, 600);
  }

  return (
    <div>
      <PageHeader
        title="Notepad"
        description={`Private notepad for ${ownerName} — jot headings, bullet points, and reminders. Only you see these notes, and they save automatically.`}
        actions={
          <button onClick={handleNew} className="btn-primary gap-1.5">
            <Plus size={16} /> New note
          </button>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
        {/* List */}
        <Card className="flex max-h-[70vh] flex-col overflow-hidden">
          <div className="border-b border-ink-100 p-3">
            <div className="relative">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400"
              />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search notes…"
                className="input pl-9"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {notes === null ? (
              <div className="space-y-2 p-3">
                <Skeleton className="h-14" />
                <Skeleton className="h-14" />
                <Skeleton className="h-14" />
              </div>
            ) : filtered.length === 0 ? (
              <EmptyState
                icon={NotebookPen}
                title={query ? "No matches" : "No notes yet"}
                description={
                  query
                    ? "Try a different search."
                    : "Create your first note to get started."
                }
              />
            ) : (
              <ul className="divide-y divide-ink-50">
                {filtered.map((n) => {
                  const isActive = n._id === activeId;
                  return (
                    <li key={n._id}>
                      <button
                        onClick={() => setActiveId(n._id)}
                        className={cn(
                          "group flex w-full items-start gap-2 px-4 py-3 text-left transition",
                          isActive ? "bg-emerald-50" : "hover:bg-ink-50"
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <p
                            className={cn(
                              "truncate text-sm font-semibold",
                              isActive ? "text-emerald-700" : "text-ink-800"
                            )}
                          >
                            {n.title.trim() || "Untitled note"}
                          </p>
                          <p className="mt-0.5 truncate text-xs text-ink-400">
                            {previewOf(n.content)}
                          </p>
                          <p className="mt-1 text-[11px] text-ink-300">
                            {formatWhen(n.updatedAt)}
                          </p>
                        </div>
                        <span
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(n._id);
                          }}
                          className="rounded-md p-1 text-ink-300 opacity-0 hover:bg-rose-50 hover:text-rose-500 group-hover:opacity-100"
                        >
                          <Trash2 size={14} />
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </Card>

        {/* Editor */}
        <Card className="flex max-h-[70vh] flex-col overflow-hidden">
          {active ? (
            <>
              <div className="flex items-center justify-between border-b border-ink-100 px-5 py-3">
                <input
                  value={active.title}
                  onChange={(e) => patchActive({ title: e.target.value })}
                  placeholder="Heading…"
                  className="w-full border-0 bg-transparent text-lg font-bold text-ink-900 outline-none placeholder:text-ink-300"
                />
                <span className="ml-3 shrink-0 text-xs text-ink-400">
                  {saving ? "Saving…" : "Saved"}
                </span>
              </div>
              <textarea
                value={active.content}
                onChange={(e) => patchActive({ content: e.target.value })}
                placeholder={
                  "Write freely…\n\n• Point one\n• Point two\n\nUse headings and bullets however you like."
                }
                className="flex-1 resize-none border-0 bg-transparent p-5 font-mono text-sm leading-relaxed text-ink-800 outline-none placeholder:text-ink-300"
              />
            </>
          ) : (
            <EmptyState
              icon={NotebookPen}
              title="Nothing selected"
              description="Pick a note from the list, or create a new one."
            />
          )}
        </Card>
      </div>
    </div>
  );
}
