"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  Target,
  Pencil,
  Trash2,
  Plus,
  Download,
  CheckCircle2,
  Circle,
  ChevronRight,
  ChevronDown,
  Save,
  Loader2,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { FilterBar } from "@/components/ui/FilterBar";
import { Avatar } from "@/components/ui/Avatar";
import { Modal, ConfirmDialog } from "@/components/ui/Modal";
import { EmptyState, TableSkeleton } from "@/components/ui/States";
import { SubmissionForm, emptySubmission, type SubmissionDraft } from "@/components/forms/SubmissionForm";
import { useStore } from "@/lib/store";
import { useLoaded, useWeeks, useFacets, useScope } from "@/lib/hooks";
import {
  priorityText,
  priorityItems,
  actionItems,
  actionTexts,
} from "@/lib/goals";
import { exportSubmissionsCSV, exportSubmissionsFullCSV } from "@/lib/export";
import { scoreAll } from "@/lib/analytics";
import { weekLabel, formatDateTime, cn } from "@/lib/utils";
import type { WeeklySubmission } from "@/lib/types";

export default function SubmissionsPage() {
  return (
    <Suspense fallback={<div className="animate-fade-in"><PageHeader title="Weekly Goals" description="Loading…" /><Card><TableSkeleton /></Card></div>}>
      <SubmissionsPageContent />
    </Suspense>
  );
}

function SubmissionsPageContent() {
  const searchParams = useSearchParams();
  const hydrated = useLoaded();
  const { weeks, currentWeek } = useWeeks();
  const { departments, teamLeads } = useFacets();
  const { submissions, roster } = useScope();
  const people = useStore((s) => s.people);
  const addSubmission = useStore((s) => s.addSubmission);
  const updateSubmission = useStore((s) => s.updateSubmission);
  const deleteSubmission = useStore((s) => s.deleteSubmission);

  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    const person = searchParams.get("person");
    const week = searchParams.get("week");
    if (person) init.person = person;
    if (week) init.week = week;
    return init;
  });
  const [draft, setDraft] = useState<SubmissionDraft | null>(null);
  const [editing, setEditing] = useState<WeeklySubmission | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);

  const filtered = useMemo(() => {
    return submissions
      .filter((s) => {
        if (filters.week && filters.week !== "all" && s.week !== filters.week) return false;
        if (filters.dept && filters.dept !== "all" && s.department !== filters.dept) return false;
        if (filters.lead && filters.lead !== "all" && s.teamLead !== filters.lead) return false;
        if (filters.person && filters.person !== "all" && s.personName !== filters.person) return false;
        if (search) {
          const blob = `${s.personName} ${priorityText(s)} ${actionTexts(s).join(" ")} ${s.blockers.join(" ")}`.toLowerCase();
          if (!blob.includes(search.toLowerCase())) return false;
        }
        return true;
      })
      .sort((a, b) => (b.submittedAt || "").localeCompare(a.submittedAt || ""));
  }, [submissions, filters, search]);

  // Group by week (most recent first); within a week, most recent submission first.
  const byWeek = useMemo(() => {
    const groups = new Map<string, WeeklySubmission[]>();
    for (const s of filtered) {
      if (!groups.has(s.week)) groups.set(s.week, []);
      groups.get(s.week)!.push(s);
    }
    return [...groups.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  function openNew() {
    setEditing(null);
    setDraft(emptySubmission(people[0], currentWeek));
  }
  function openEdit(s: WeeklySubmission) {
    setEditing(s);
    const { _id, ...rest } = s;
    setDraft(rest);
  }
  function save() {
    if (!draft) return;
    if (editing) updateSubmission(editing._id, draft);
    else addSubmission(draft);
    setDraft(null);
    setEditing(null);
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Weekly Goals"
        description="Each person's weekly priority and action items, grouped by week. Tick items off as they're done."
        actions={
          <>
            <div className="relative">
              <button className="btn-outline" onClick={() => setShowExportMenu(!showExportMenu)}>
                <Download size={16} /> Export
              </button>
              {showExportMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowExportMenu(false)} />
                  <div className="absolute right-0 top-full z-20 mt-1 w-56 rounded-lg border border-ink-200 bg-white py-1 shadow-lg">
                    <button
                      className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-ink-700 hover:bg-ink-50"
                      onClick={() => {
                        exportSubmissionsCSV(filtered, "weekly_goals");
                        setShowExportMenu(false);
                      }}
                    >
                      <Download size={14} />
                      <div>
                        <p className="font-medium">Template format</p>
                        <p className="text-[11px] text-ink-400">Compatible with import</p>
                      </div>
                    </button>
                    <button
                      className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-ink-700 hover:bg-ink-50"
                      onClick={() => {
                        exportSubmissionsFullCSV(scoreAll(filtered), "weekly_goals_full");
                        setShowExportMenu(false);
                      }}
                    >
                      <Download size={14} />
                      <div>
                        <p className="font-medium">Full export</p>
                        <p className="text-[11px] text-ink-400">Includes all metadata</p>
                      </div>
                    </button>
                  </div>
                </>
              )}
            </div>
            <button className="btn-primary" onClick={openNew}>
              <Plus size={16} /> Log goals
            </button>
          </>
        }
      />

      <Card className="mb-4 p-4">
        <FilterBar
          search={search}
          onSearch={setSearch}
          searchPlaceholder="Search person, priority, action…"
          values={filters}
          onChange={(k, v) => setFilters((f) => ({ ...f, [k]: v }))}
          onClear={() => {
            setFilters({});
            setSearch("");
          }}
          filters={[
            { key: "week", label: "Week", options: weeks.map((w) => ({ value: w, label: weekLabel(w) })) },
            { key: "dept", label: "Dept", options: departments.map((d) => ({ value: d, label: d })) },
            { key: "lead", label: "Lead", options: teamLeads.map((l) => ({ value: l, label: l })) },
            { key: "person", label: "Person", options: roster.map((r) => ({ value: r.name, label: r.name })) },
          ]}
        />
      </Card>

      {!hydrated ? (
        <Card><TableSkeleton /></Card>
      ) : byWeek.length === 0 ? (
        <Card>
          <EmptyState
            icon={Target}
            title="No goals found"
            description="Adjust your filters, or log a person's weekly goals manually."
            action={<button className="btn-primary" onClick={openNew}><Plus size={16} /> Log goals</button>}
          />
        </Card>
      ) : (
        <div className="space-y-8">
          {byWeek.map(([week, subs]) => (
            <section key={week}>
              <div className="mb-3 flex items-center gap-2">
                <h2 className="text-sm font-bold uppercase tracking-wide text-ink-700">{weekLabel(week)}</h2>
                <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[11px] font-medium text-ink-500">
                  {subs.length} {subs.length === 1 ? "person" : "people"}
                </span>
                <div className="h-px flex-1 bg-ink-100" />
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                {subs.map((s) => (
                  <GoalCard
                    key={s._id}
                    s={s}
                    onSave={(patch) => updateSubmission(s._id, patch)}
                    onEdit={() => openEdit(s)}
                    onDelete={() => setDeleteId(s._id)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Create / edit */}
      <Modal
        open={!!draft}
        onClose={() => setDraft(null)}
        title={editing ? "Edit weekly goals" : "Log weekly goals"}
        subtitle="Writes to the weekly_submissions collection"
        size="lg"
        footer={
          <>
            <button className="btn-outline" onClick={() => setDraft(null)}>Cancel</button>
            <button
              className="btn-primary"
              onClick={save}
              disabled={!draft?.personId || ((draft ? priorityItems(draft).length : 0) === 0 && (draft?.actions.length ?? 0) === 0)}
            >
              {editing ? "Save changes" : "Add goals"}
            </button>
          </>
        }
      >
        {draft && <SubmissionForm value={draft} onChange={setDraft} />}
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && deleteSubmission(deleteId)}
        title="Delete weekly goals?"
        message="This person's goals for this week will be permanently removed."
      />
    </div>
  );
}

function GoalCard({
  s,
  onSave,
  onEdit,
  onDelete,
}: {
  s: WeeklySubmission;
  onSave: (patch: Partial<WeeklySubmission>) => Promise<void>;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const people = useStore((st) => st.people);
  const person =
    people.find((p) => p._id === s.personId) ??
    people.find((p) => p.name.toLowerCase() === s.personName.toLowerCase());

  // Local, editable copies — toggles update these instantly (no network), and a
  // Save button persists them. Re-sync when the stored record changes.
  const storedPriorities = useMemo(() => priorityItems(s), [s]);
  const storedActions = useMemo(() => actionItems(s), [s]);
  const [priorities, setPriorities] = useState(storedPriorities);
  const [actions, setActions] = useState(storedActions);
  useEffect(() => {
    setPriorities(storedPriorities);
    setActions(storedActions);
  }, [storedPriorities, storedActions]);

  const dirty =
    JSON.stringify(priorities) !== JSON.stringify(storedPriorities) ||
    JSON.stringify(actions) !== JSON.stringify(storedActions);

  const togglePriority = (idx: number) =>
    setPriorities((prev) => prev.map((p, i) => (i === idx ? { ...p, completed: !p.completed } : p)));
  const toggleAction = (idx: number) =>
    setActions((prev) => prev.map((a, i) => (i === idx ? { ...a, completed: !a.completed } : a)));

  const save = async () => {
    setSaving(true);
    try {
      await onSave({ topPriority: priorities, actions });
    } finally {
      setSaving(false);
    }
  };

  const priorityDoneCount = priorities.filter((p) => p.completed).length;
  const priorityTotal = priorities.length;
  const actionsDoneCount = actions.filter((a) => a.completed).length;
  const actionsTotal = actions.length;
  const allDone = priorityTotal + actionsTotal > 0 && priorityDoneCount === priorityTotal && actionsDoneCount === actionsTotal;

  const summary = priorities[0]?.text || actions[0]?.text || "No goals logged";

  return (
    <Card className="group flex min-w-0 flex-col p-0">
      {/* Collapsed header — click to expand */}
      <div className="flex items-start gap-3 p-4">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-start gap-3 text-left"
        >
          <ChevronDown
            size={16}
            className={cn("mt-1 shrink-0 text-ink-400 transition-transform", open ? "rotate-0" : "-rotate-90")}
          />
          <Avatar name={s.personName} color={person?.avatarColor} size="md" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate font-semibold text-ink-900">{s.personName}</p>
              {allDone && <CheckCircle2 size={15} className="shrink-0 text-emerald-500" />}
            </div>
            <p className="truncate text-[11px] text-ink-400">
              {s.department}
              {s.teamLead ? ` · ${s.teamLead}` : ""}
            </p>
            {!open && (
              <p className="mt-1 truncate text-xs text-ink-500">{summary}</p>
            )}
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {priorityTotal > 0 && (
                <CountChip label="Priority" done={priorityDoneCount} total={priorityTotal} />
              )}
              {actionsTotal > 0 && (
                <CountChip label="Actions" done={actionsDoneCount} total={actionsTotal} />
              )}
              {s.blockers.length > 0 && (
                <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-600">
                  {s.blockers.length} blocker{s.blockers.length > 1 ? "s" : ""}
                </span>
              )}
              {dirty && (
                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                  Unsaved
                </span>
              )}
            </div>
          </div>
        </button>
        <div className="flex shrink-0 items-center gap-1">
          <button onClick={onEdit} className="rounded-lg p-1.5 text-ink-400 opacity-100 transition hover:bg-ink-100 hover:text-ink-700 sm:opacity-0 sm:group-hover:opacity-100">
            <Pencil size={15} />
          </button>
          <button onClick={onDelete} className="rounded-lg p-1.5 text-ink-400 opacity-100 transition hover:bg-rose-50 hover:text-rose-600 sm:opacity-0 sm:group-hover:opacity-100">
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {/* Expanded body */}
      {open && (
        <div className="border-t border-ink-100 px-4 pb-4 pt-3">
          {priorities.length > 0 && (
            <div className="mb-3">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-ink-400">
                {priorities.length > 1 ? "Top priorities" : "Top priority"}
              </p>
              <div className="space-y-1">
                {priorities.map((p, i) => (
                  <GoalRow key={i} text={p.text} done={p.completed} onToggle={() => togglePriority(i)} emphasis />
                ))}
              </div>
            </div>
          )}

          {actions.length > 0 && (
            <div className="mb-3">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-ink-400">Actions</p>
              <div className="space-y-1">
                {actions.map((a, i) => (
                  <GoalRow key={i} text={a.text} done={a.completed} onToggle={() => toggleAction(i)} />
                ))}
              </div>
            </div>
          )}

          {s.outcomes.length > 0 && (
            <div className="mb-3">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-ink-400">Outcomes</p>
              <ul className="space-y-0.5">
                {s.outcomes.map((o, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-sm text-ink-700">
                    <ChevronRight size={14} className="mt-0.5 shrink-0 text-emerald-500" />
                    <span className="min-w-0 break-words">{o}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {s.blockers.length > 0 && (
            <div className="mb-3">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-ink-400">Blockers</p>
              <div className="flex flex-wrap gap-1.5">
                {s.blockers.map((b, i) => (
                  <span key={i} className="max-w-full break-words rounded-md bg-rose-50 px-2 py-1 text-xs text-rose-700">{b}</span>
                ))}
              </div>
            </div>
          )}

          {s.notes && (
            <p className="mb-2 rounded-lg bg-ink-50 px-3 py-2 text-xs leading-relaxed text-ink-600">{s.notes}</p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <p className="text-[11px] text-ink-300">Received {formatDateTime(s.submittedAt)}</p>
            {dirty && (
              <button onClick={save} disabled={saving} className="btn-primary flex items-center gap-1.5 px-3 py-1.5 text-xs">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {saving ? "Saving…" : "Save changes"}
              </button>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

function CountChip({ label, done, total }: { label: string; done: number; total: number }) {
  const complete = done === total;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums",
        complete ? "bg-emerald-50 text-emerald-700" : "bg-ink-100 text-ink-500"
      )}
    >
      <span className="text-ink-400">{label}</span>
      {done}/{total}
    </span>
  );
}

function GoalRow({
  text,
  done,
  onToggle,
  emphasis,
}: {
  text: string;
  done: boolean;
  onToggle: () => void;
  emphasis?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "flex w-full items-start gap-2 rounded-lg border px-2 py-1.5 text-left transition",
        done
          ? "border-emerald-200 bg-emerald-50/70 hover:bg-emerald-50"
          : "border-amber-200 bg-amber-50/70 hover:bg-amber-50"
      )}
    >
      {done ? (
        <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-emerald-500" />
      ) : (
        <Circle size={17} className="mt-0.5 shrink-0 text-amber-500" />
      )}
      <span
        className={cn(
          "min-w-0 flex-1 break-words text-sm leading-snug",
          done ? "text-emerald-700 line-through" : emphasis ? "font-medium text-ink-800" : "text-ink-700"
        )}
      >
        {text}
      </span>
      <span
        className={cn(
          "mt-0.5 shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
          done ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
        )}
      >
        {done ? "Done" : "Pending"}
      </span>
    </button>
  );
}
