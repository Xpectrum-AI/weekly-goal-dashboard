"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { useWeeks } from "@/lib/hooks";
import { Field, TextInput, TextArea, Select } from "@/components/ui/Form";
import { weekLabel, getCurrentWeek } from "@/lib/utils";
import type { WeeklySubmission } from "@/lib/types";

export type SubmissionDraft = Omit<WeeklySubmission, "_id">;

export function emptySubmission(person?: {
  _id: string;
  name: string;
  department: string;
  teamLead: string | null;
}, week?: string): SubmissionDraft {
  return {
    personId: person?._id ?? null,
    personName: person?.name ?? "",
    department: person?.department ?? "",
    teamLead: person?.teamLead ?? "",
    week: week ?? getCurrentWeek(),
    submittedAt: new Date().toISOString(),
    topPriority: "",
    actions: [],
    outcomes: [],
    blockers: [],
    notes: "",
  };
}

/** Reusable add/remove list editor for actions / outcomes / blockers. */
function ListInput({
  value,
  onChange,
  placeholder,
  tone = "ink",
}: {
  value: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
  tone?: "ink" | "rose" | "emerald";
}) {
  const [input, setInput] = useState("");
  const tones = {
    ink: "bg-ink-100 text-ink-700",
    rose: "bg-rose-50 text-rose-700",
    emerald: "bg-emerald-50 text-emerald-700",
  };
  function add() {
    if (input.trim()) {
      onChange([...value, input.trim()]);
      setInput("");
    }
  }
  return (
    <div>
      <div className="flex gap-2">
        <TextInput
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder={placeholder}
        />
        <button type="button" className="btn-outline shrink-0" onClick={add}>
          <Plus size={16} />
        </button>
      </div>
      {value.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {value.map((v, i) => (
            <span key={i} className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs ${tones[tone]}`}>
              {v}
              <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))}>
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function SubmissionForm({
  value,
  onChange,
}: {
  value: SubmissionDraft;
  onChange: (v: SubmissionDraft) => void;
}) {
  const people = useStore((s) => s.people);
  const { weeks } = useWeeks();
  const set = <K extends keyof SubmissionDraft>(k: K, v: SubmissionDraft[K]) => onChange({ ...value, [k]: v });

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
        Updates normally arrive over WhatsApp. Use this form to log or correct an
        update on a person&apos;s behalf — it writes to <code>weekly_submissions</code>.
        Completeness is scored from the priority, actions, and outcomes below.
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Person" required>
          <Select
            value={value.personId ?? ""}
            onChange={(e) => {
              const p = people.find((x) => x._id === e.target.value);
              onChange({
                ...value,
                personId: e.target.value,
                personName: p?.name ?? "",
                department: p?.department ?? value.department,
                teamLead: p?.teamLead ?? value.teamLead,
              });
            }}
          >
            <option value="">— Select person —</option>
            {people.map((p) => (
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

      <Field label="Top priority this week">
        <TextInput
          value={value.topPriority}
          onChange={(e) => set("topPriority", e.target.value)}
          placeholder="Ship the billing event schema"
        />
      </Field>

      <Field label="Actions / what they did" hint="Press Enter to add each item">
        <ListInput value={value.actions} onChange={(v) => set("actions", v)} placeholder="Refactored the billing producer" />
      </Field>

      <Field label="Outcomes / results" hint="Concrete results delivered">
        <ListInput value={value.outcomes} onChange={(v) => set("outcomes", v)} placeholder="p95 latency down 15%" tone="emerald" />
      </Field>

      <Field label="Blockers" hint="Leave empty if none">
        <ListInput value={value.blockers} onChange={(v) => set("blockers", v)} placeholder="Waiting on infra capacity approval" tone="rose" />
      </Field>

      <Field label="Notes">
        <TextArea value={value.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Anything leadership should know…" />
      </Field>
    </div>
  );
}
