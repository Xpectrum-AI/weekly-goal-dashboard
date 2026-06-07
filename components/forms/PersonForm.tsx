"use client";

import { useStore } from "@/lib/store";
import { useFacets } from "@/lib/hooks";
import { Field, TextInput, Select } from "@/components/ui/Form";
import { cn } from "@/lib/utils";
import type { Person } from "@/lib/types";

export type PersonDraft = Omit<Person, "_id">;

const PALETTE = ["#6366f1", "#0ea5e9", "#ec4899", "#10b981", "#f59e0b", "#8b5cf6"];

export function emptyPerson(): PersonDraft {
  return {
    name: "",
    phone: "",
    department: "",
    teamLead: "",
    title: "",
    active: true,
    joinedAt: new Date().toISOString().slice(0, 10),
    avatarColor: PALETTE[0],
  };
}

export function PersonForm({ value, onChange }: { value: PersonDraft; onChange: (v: PersonDraft) => void }) {
  const people = useStore((s) => s.people);
  const { departments, teamLeads } = useFacets();
  const set = <K extends keyof PersonDraft>(k: K, v: PersonDraft[K]) => onChange({ ...value, [k]: v });

  // Leads available within the chosen department (falls back to all known leads).
  const deptLeads = Array.from(
    new Set(people.filter((p) => p.department === value.department).map((p) => p.teamLead))
  ).filter((l): l is string => !!l);
  const leadOptions = deptLeads.length ? deptLeads : teamLeads;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" required>
          <TextInput value={value.name} onChange={(e) => set("name", e.target.value)} placeholder="Jordan Avery" />
        </Field>
        <Field label="WhatsApp number" required>
          <TextInput value={value.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+1-555-0123" />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Department">
          <Select value={value.department} onChange={(e) => set("department", e.target.value)}>
            <option value="">— Select —</option>
            {departments.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </Select>
        </Field>
        <Field label="Team lead">
          <Select value={value.teamLead ?? ""} onChange={(e) => set("teamLead", e.target.value)}>
            <option value="">— Select —</option>
            {leadOptions.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Title">
        <TextInput value={value.title} onChange={(e) => set("title", e.target.value)} placeholder="Software Engineer" />
      </Field>
      <Field label="Avatar color">
        <div className="flex gap-2">
          {PALETTE.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => set("avatarColor", c)}
              className={cn("h-8 w-8 rounded-full ring-offset-2 transition", value.avatarColor === c && "ring-2 ring-ink-400")}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </Field>
    </div>
  );
}
