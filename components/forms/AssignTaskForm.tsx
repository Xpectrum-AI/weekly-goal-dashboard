"use client";

import { useMemo } from "react";
import { AlertTriangle } from "lucide-react";
import { useStore } from "@/lib/store";
import { useWeeks } from "@/lib/hooks";
import { Field, TextInput, TextArea, Select } from "@/components/ui/Form";
import { descendantNames, norm } from "@/lib/org";
import { weekLabel, getCurrentWeek, cn } from "@/lib/utils";
import type { AssignedTask } from "@/lib/types";

export type AssignTaskDraft = Omit<AssignedTask, "_id" | "createdAt">;

export function emptyAssignTask(opts: { assignedBy: string; assignedByLevel: number; week?: string }): AssignTaskDraft {
  return {
    personId: null,
    personName: "",
    department: "",
    teamLead: "",
    week: opts.week ?? getCurrentWeek(),
    text: "",
    urgency: "normal",
    deadline: "",
    completed: false,
    assignedBy: opts.assignedBy,
    assignedByLevel: opts.assignedByLevel,
    notes: "",
  };
}

export function AssignTaskForm({
  value,
  onChange,
  assignerName,
}: {
  value: AssignTaskDraft;
  onChange: (v: AssignTaskDraft) => void;
  assignerName: string;
}) {
  const people = useStore((s) => s.people);
  const { weeks } = useWeeks();
  const set = <K extends keyof AssignTaskDraft>(k: K, v: AssignTaskDraft[K]) => onChange({ ...value, [k]: v });

  // Only people in the assigner's own reporting sub-tree (excluding themselves)
  // can be assigned a task.
  const eligible = useMemo(() => {
    const subtree = descendantNames(people, assignerName);
    return people
      .filter((p) => subtree.has(norm(p.name)) && norm(p.name) !== norm(assignerName))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [people, assignerName]);

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-violet-50 px-3 py-2 text-xs text-violet-800">
        Assign a priority task to anyone in your team. It's tracked separately from
        their weekly update and shown on their Weekly Goals.
      </div>

      {eligible.length === 0 && (
        <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          No one reports to you, so there's no one to assign a task to.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Assign to" required>
          <Select
            value={value.personId ?? ""}
            onChange={(e) => {
              const p = people.find((x) => x._id === e.target.value);
              onChange({
                ...value,
                personId: e.target.value || null,
                personName: p?.name ?? "",
                department: p?.department ?? "",
                teamLead: p?.teamLead ?? "",
              });
            }}
          >
            <option value="">— Select person —</option>
            {eligible.map((p) => (
              <option key={p._id} value={p._id}>
                {p.name} — {p.department}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Week" required>
          <Select value={value.week} onChange={(e) => set("week", e.target.value)}>
            {(weeks.includes(value.week) ? weeks : [value.week, ...weeks]).map((w) => (
              <option key={w} value={w}>
                {weekLabel(w)}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="Task" required>
        <TextArea
          value={value.text}
          onChange={(e) => set("text", e.target.value)}
          placeholder="Ship the billing event schema by Friday"
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Urgency">
          <div className="flex gap-2">
            {(["normal", "urgent"] as const).map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => set("urgency", u)}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium capitalize transition",
                  value.urgency === u
                    ? u === "urgent"
                      ? "border-rose-300 bg-rose-50 text-rose-700"
                      : "border-emerald-300 bg-emerald-50 text-emerald-700"
                    : "border-ink-200 text-ink-600 hover:bg-ink-50"
                )}
              >
                {u === "urgent" && <AlertTriangle size={14} />}
                {u}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Deadline" hint="Optional">
          <TextInput type="date" value={value.deadline} onChange={(e) => set("deadline", e.target.value)} />
        </Field>
      </div>

      <Field label="Notes" hint="Optional context for the assignee">
        <TextArea value={value.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Anything they should know…" />
      </Field>
    </div>
  );
}
