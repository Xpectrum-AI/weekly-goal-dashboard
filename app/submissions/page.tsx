"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  Target,
  Pencil,
  Trash2,
  Plus,
  CheckCircle2,
  Circle,
  ChevronRight,
  ChevronDown,
  Save,
  Loader2,
  UserPlus,
  AlertTriangle,
  CalendarClock,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { ExportMenu } from "@/components/ui/ExportMenu";
import { Card } from "@/components/ui/Card";
import { FilterBar } from "@/components/ui/FilterBar";
import { Avatar } from "@/components/ui/Avatar";
import { Modal, ConfirmDialog } from "@/components/ui/Modal";
import { EmptyState, TableSkeleton } from "@/components/ui/States";
import { SubmissionForm, emptySubmission, type SubmissionDraft } from "@/components/forms/SubmissionForm";
import { AssignTaskForm, emptyAssignTask, type AssignTaskDraft } from "@/components/forms/AssignTaskForm";
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
import { weekLabel, formatDateTime, formatDate, cn } from "@/lib/utils";
import type { WeeklySubmission, AssignedTask } from "@/lib/types";

/** One person's combined weekly card data: their submission + assigned tasks. */
interface PersonGroup {
  key: string;
  name: string;
  submission?: WeeklySubmission;
  tasks: AssignedTask[];
}

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
  const { submissions, roster, assignedTasks, viewer } = useScope();
  const people = useStore((s) => s.people);
  const addSubmission = useStore((s) => s.addSubmission);
  const updateSubmission = useStore((s) => s.updateSubmission);
  const deleteSubmission = useStore((s) => s.deleteSubmission);
  const addAssignedTask = useStore((s) => s.addAssignedTask);
  const updateAssignedTask = useStore((s) => s.updateAssignedTask);
  const deleteAssignedTask = useStore((s) => s.deleteAssignedTask);

  // The current persona is the assigner. Org-wide view = level 1 (can assign to all).
  const assignerLevel = viewer?.level ?? 1;
  const assignerName = viewer?.name ?? "Leadership";

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
  const [assignDraft, setAssignDraft] = useState<AssignTaskDraft | null>(null);
  const [deleteTaskId, setDeleteTaskId] = useState<string | null>(null);

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

  const filteredTasks = useMemo(() => {
    return assignedTasks
      .filter((t) => {
        if (filters.week && filters.week !== "all" && t.week !== filters.week) return false;
        if (filters.dept && filters.dept !== "all" && t.department !== filters.dept) return false;
        if (filters.lead && filters.lead !== "all" && t.teamLead !== filters.lead) return false;
        if (filters.person && filters.person !== "all" && t.personName !== filters.person) return false;
        if (search) {
          const blob = `${t.personName} ${t.text} ${t.assignedBy}`.toLowerCase();
          if (!blob.includes(search.toLowerCase())) return false;
        }
        return true;
      })
      .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  }, [assignedTasks, filters, search]);

  // Group by week → by person, so each person shows ONE card combining their
  // weekly submission and any tasks assigned to them that week.
  const byWeek = useMemo(() => {
    const weeks = new Map<string, Map<string, PersonGroup>>();
    const ensureWeek = (w: string) => {
      if (!weeks.has(w)) weeks.set(w, new Map());
      return weeks.get(w)!;
    };
    const ensurePerson = (w: string, name: string) => {
      const wk = ensureWeek(w);
      const key = name.trim().toLowerCase();
      if (!wk.has(key)) wk.set(key, { key, name, submission: undefined, tasks: [] });
      return wk.get(key)!;
    };
    for (const s of filtered) {
      const g = ensurePerson(s.week, s.personName);
      g.submission = s; // newest already first; keep the first seen
      if (!g.name) g.name = s.personName;
    }
    for (const t of filteredTasks) ensurePerson(t.week, t.personName).tasks.push(t);

    return [...weeks.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([week, people]) => {
        const list = [...people.values()].sort((a, b) => a.name.localeCompare(b.name));
        return { week, people: list, taskCount: list.reduce((n, p) => n + p.tasks.length, 0) };
      });
  }, [filtered, filteredTasks]);

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

  function openAssign() {
    setAssignDraft(emptyAssignTask({ assignedBy: assignerName, assignedByLevel: assignerLevel, week: currentWeek }));
  }
  function saveAssign() {
    if (!assignDraft) return;
    addAssignedTask(assignDraft);
    // Notify the assignee on WhatsApp that a priority task was assigned to them.
    const assignee = people.find((p) => p._id === assignDraft.personId);
    if (assignee?.phone) {
      fetch("/api/nudge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "task-assigned",
          phone: assignee.phone,
          assigneeName: assignDraft.personName,
          assignerName: assignDraft.assignedBy || "Leadership",
          priority: assignDraft.text,
        }),
      });
    }
    setAssignDraft(null);
  }
  const toggleTask = (t: AssignedTask) => updateAssignedTask(t._id, { completed: !t.completed });

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Weekly Goals"
        description="Each person's weekly priority and action items, grouped by week. Tick items off as they're done."
        actions={
          <>
            <ExportMenu
              options={[
                {
                  label: "Template format",
                  hint: "Compatible with import",
                  onSelect: () => exportSubmissionsCSV(filtered, "weekly_goals"),
                },
                {
                  label: "Full export",
                  hint: "Includes all metadata",
                  onSelect: () => exportSubmissionsFullCSV(scoreAll(filtered), "weekly_goals_full"),
                },
              ]}
            />
            <button className="btn-outline" onClick={openAssign}>
              <UserPlus size={16} /> Assign
            </button>
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
          {byWeek.map(({ week, people: persons, taskCount }) => (
            <section key={week}>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-bold uppercase tracking-wide text-ink-700">{weekLabel(week)}</h2>
                <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[11px] font-medium text-ink-500">
                  {persons.length} {persons.length === 1 ? "person" : "people"}
                </span>
                {taskCount > 0 && (
                  <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-medium text-violet-700">
                    {taskCount} assigned
                  </span>
                )}
                <div className="h-px flex-1 bg-ink-100" />
              </div>
              <div className="grid items-start gap-4 lg:grid-cols-2">
                {persons.map((g) => (
                  <GoalCard
                    key={g.key}
                    s={g.submission}
                    name={g.name}
                    tasks={g.tasks}
                    onSave={(patch) => g.submission && updateSubmission(g.submission._id, patch)}
                    onEdit={() => g.submission && openEdit(g.submission)}
                    onDelete={() => g.submission && setDeleteId(g.submission._id)}
                    onToggleTask={(t) => toggleTask(t)}
                    onDeleteTask={(id) => setDeleteTaskId(id)}
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

      {/* Assign a task */}
      <Modal
        open={!!assignDraft}
        onClose={() => setAssignDraft(null)}
        title="Assign a task"
        subtitle="Writes to the assigned_tasks collection"
        size="lg"
        footer={
          <>
            <button className="btn-outline" onClick={() => setAssignDraft(null)}>Cancel</button>
            <button
              className="btn-primary"
              onClick={saveAssign}
              disabled={!assignDraft?.personId || !assignDraft?.text.trim()}
            >
              Assign task
            </button>
          </>
        }
      >
        {assignDraft && (
          <AssignTaskForm value={assignDraft} onChange={setAssignDraft} assignerName={assignerName} />
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleteTaskId}
        onClose={() => setDeleteTaskId(null)}
        onConfirm={() => deleteTaskId && deleteAssignedTask(deleteTaskId)}
        title="Remove assigned task?"
        message="This assigned task will be permanently removed."
      />
    </div>
  );
}

function GoalCard({
  s,
  name,
  tasks,
  onSave,
  onEdit,
  onDelete,
  onToggleTask,
  onDeleteTask,
}: {
  s?: WeeklySubmission;
  name: string;
  tasks: AssignedTask[];
  onSave: (patch: Partial<WeeklySubmission>) => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleTask: (t: AssignedTask) => void;
  onDeleteTask: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const people = useStore((st) => st.people);
  const person =
    (s && people.find((p) => p._id === s.personId)) ??
    people.find((p) => p.name.toLowerCase() === name.toLowerCase());
  const department = s?.department ?? person?.department ?? tasks[0]?.department ?? "";
  const teamLead = s?.teamLead ?? person?.teamLead ?? tasks[0]?.teamLead ?? "";

  // Local, editable copies of the submission's goals — toggles update these
  // instantly (no network), a Save button persists them.
  const storedPriorities = useMemo(() => (s ? priorityItems(s) : []), [s]);
  const storedActions = useMemo(() => (s ? actionItems(s) : []), [s]);
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
  const tasksDoneCount = tasks.filter((t) => t.completed).length;
  const tasksTotal = tasks.length;
  const allDone =
    priorityTotal + actionsTotal + tasksTotal > 0 &&
    priorityDoneCount === priorityTotal &&
    actionsDoneCount === actionsTotal &&
    tasksDoneCount === tasksTotal;
  const hasUrgent = tasks.some((t) => !t.completed && t.urgency === "urgent");

  const summary = priorities[0]?.text || actions[0]?.text || tasks[0]?.text || "No goals logged";

  return (
    <Card className={cn("group flex min-w-0 flex-col p-0", tasksTotal > 0 && "border-l-4 border-l-violet-500")}>
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
          <Avatar name={name} color={person?.avatarColor} size="md" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <p className="truncate font-semibold text-ink-900">{name}</p>
              {allDone && <CheckCircle2 size={15} className="shrink-0 text-emerald-500" />}
              {!s && tasksTotal > 0 && (
                <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-700">
                  Assigned only
                </span>
              )}
              {hasUrgent && (
                <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-700">
                  <AlertTriangle size={10} /> Urgent
                </span>
              )}
            </div>
            <p className="truncate text-[11px] text-ink-400">
              {department}
              {teamLead ? ` · ${teamLead}` : ""}
            </p>
            {!open && <p className="mt-1 truncate text-xs text-ink-500">{summary}</p>}
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {priorityTotal > 0 && <CountChip label="Priority" done={priorityDoneCount} total={priorityTotal} />}
              {actionsTotal > 0 && <CountChip label="Actions" done={actionsDoneCount} total={actionsTotal} />}
              {tasksTotal > 0 && <CountChip label="Assigned" done={tasksDoneCount} total={tasksTotal} tone="violet" />}
              {s && s.blockers.length > 0 && (
                <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-600">
                  {s.blockers.length} blocker{s.blockers.length > 1 ? "s" : ""}
                </span>
              )}
              {dirty && (
                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">Unsaved</span>
              )}
            </div>
          </div>
        </button>
        {s && (
          <div className="flex shrink-0 items-center gap-1">
            <button onClick={onEdit} className="rounded-lg p-1.5 text-ink-400 opacity-100 transition hover:bg-ink-100 hover:text-ink-700 sm:opacity-0 sm:group-hover:opacity-100">
              <Pencil size={15} />
            </button>
            <button onClick={onDelete} className="rounded-lg p-1.5 text-ink-400 opacity-100 transition hover:bg-rose-50 hover:text-rose-600 sm:opacity-0 sm:group-hover:opacity-100">
              <Trash2 size={15} />
            </button>
          </div>
        )}
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

          {tasks.length > 0 && (
            <div className="mb-3">
              <p className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-violet-500">
                <UserPlus size={11} /> Assigned tasks
              </p>
              <div className="space-y-1.5">
                {tasks.map((t) => (
                  <TaskRow key={t._id} t={t} onToggle={() => onToggleTask(t)} onDelete={() => onDeleteTask(t._id)} />
                ))}
              </div>
            </div>
          )}

          {s && s.outcomes.length > 0 && (
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

          {s && s.blockers.length > 0 && (
            <div className="mb-3">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-ink-400">Blockers</p>
              <div className="flex flex-wrap gap-1.5">
                {s.blockers.map((b, i) => (
                  <span key={i} className="max-w-full break-words rounded-md bg-rose-50 px-2 py-1 text-xs text-rose-700">{b}</span>
                ))}
              </div>
            </div>
          )}

          {s && s.notes && (
            <p className="mb-2 rounded-lg bg-ink-50 px-3 py-2 text-xs leading-relaxed text-ink-600">{s.notes}</p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <p className="text-[11px] text-ink-300">{s ? `Received ${formatDateTime(s.submittedAt)}` : "No weekly update logged"}</p>
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

function TaskRow({ t, onToggle, onDelete }: { t: AssignedTask; onToggle: () => void; onDelete: () => void }) {
  const overdue = !t.completed && !!t.deadline && t.deadline < new Date().toISOString().slice(0, 10);
  return (
    <div
      className={cn(
        "rounded-lg border px-2 py-1.5",
        t.completed ? "border-emerald-200 bg-emerald-50/70" : "border-violet-200 bg-violet-50/50"
      )}
    >
      <div className="flex items-start gap-2">
        <button type="button" onClick={onToggle} className="mt-0.5 shrink-0">
          {t.completed ? (
            <CheckCircle2 size={17} className="text-emerald-500" />
          ) : (
            <Circle size={17} className="text-violet-400" />
          )}
        </button>
        <button type="button" onClick={onToggle} className="min-w-0 flex-1 text-left">
          <span className={cn("block break-words text-sm leading-snug", t.completed ? "text-emerald-700 line-through" : "font-medium text-ink-800")}>
            {t.text}
          </span>
        </button>
        {t.urgency === "urgent" && !t.completed && (
          <span className="mt-0.5 inline-flex shrink-0 items-center gap-0.5 rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-rose-700">
            <AlertTriangle size={9} /> Urgent
          </span>
        )}
        <button onClick={onDelete} className="mt-0.5 shrink-0 rounded p-0.5 text-ink-300 hover:bg-rose-50 hover:text-rose-600">
          <Trash2 size={13} />
        </button>
      </div>
      <div className="ml-7 mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-ink-400">
        <span>by {t.assignedBy || "Leadership"}</span>
        {t.deadline && (
          <span className={cn("inline-flex items-center gap-1", overdue && "font-semibold text-rose-600")}>
            <CalendarClock size={11} /> Due {formatDate(t.deadline)}{overdue ? " · overdue" : ""}
          </span>
        )}
      </div>
      {t.notes && <p className="ml-7 mt-1 text-[11px] leading-relaxed text-ink-500">{t.notes}</p>}
    </div>
  );
}

function CountChip({ label, done, total, tone = "ink" }: { label: string; done: number; total: number; tone?: "ink" | "violet" }) {
  const complete = done === total;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums",
        complete
          ? "bg-emerald-50 text-emerald-700"
          : tone === "violet"
            ? "bg-violet-100 text-violet-700"
            : "bg-ink-100 text-ink-500"
      )}
    >
      <span className={tone === "violet" && !complete ? "text-violet-500" : "text-ink-400"}>{label}</span>
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
