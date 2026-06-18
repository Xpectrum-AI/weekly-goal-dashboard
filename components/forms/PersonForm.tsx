"use client";

import { useStore } from "@/lib/store";
import { useFacets } from "@/lib/hooks";
import { Field, TextInput, Select } from "@/components/ui/Form";
import { cn, phoneLocalDigits } from "@/lib/utils";
import type { Person } from "@/lib/types";

export type PersonDraft = Omit<Person, "_id">;

const PALETTE = ["#6366f1", "#0ea5e9", "#ec4899", "#10b981", "#f59e0b", "#8b5cf6"];
const LEVELS = [
  { value: 1, label: "Level 1 — Founder / CEO" },
  { value: 2, label: "Level 2 — Executive Leadership" },
  { value: 3, label: "Level 3 — Department Head" },
  { value: 4, label: "Level 4 — Team Lead" },
  { value: 5, label: "Level 5 — Employee" },
];

export function emptyPerson(): PersonDraft {
  return {
    name: "",
    email: "",
    phone: "",
    department: "",
    teamLead: "",
    title: "",
    active: true,
    level: 5,
    joinedAt: new Date().toISOString().slice(0, 10),
    avatarColor: PALETTE[0],
  };
}

export function PersonForm({ value, onChange }: { value: PersonDraft; onChange: (v: PersonDraft) => void }) {
  const people = useStore((s) => s.people);
  const { departments, teamLeads } = useFacets();
  const set = <K extends keyof PersonDraft>(k: K, v: PersonDraft[K]) => onChange({ ...value, [k]: v });

  // The +91 country code is fixed; the user edits only the 10-digit local number.
  const localDigits = phoneLocalDigits(value.phone);
  const setLocal = (input: string) => {
    const digits = input.replace(/\D/g, "").slice(0, 10);
    set("phone", digits ? `+91 ${digits}` : "");
  };
  const phoneInvalid = localDigits.length > 0 && localDigits.length !== 10;

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
        <Field label="Email" required>
          <TextInput
            type="email"
            value={value.email || ""}
            onChange={(e) => set("email", e.target.value)}
            placeholder="jordan@company.com"
          />
        </Field>
        <Field
          label="WhatsApp number"
          required
          hint={phoneInvalid ? undefined : "10-digit Indian mobile number."}
        >
          <div
            className={cn(
              "flex items-stretch overflow-hidden rounded-lg border bg-white focus-within:ring-2",
              phoneInvalid
                ? "border-rose-300 focus-within:border-rose-400 focus-within:ring-rose-500/15"
                : "border-ink-200 focus-within:border-emerald-400 focus-within:ring-emerald-500/15"
            )}
          >
            <span className="flex select-none items-center border-r border-ink-200 bg-ink-50 px-3 text-sm font-medium text-ink-500">
              +91
            </span>
            <input
              type="tel"
              inputMode="numeric"
              value={localDigits}
              onChange={(e) => setLocal(e.target.value)}
              placeholder="9876543210"
              className="w-full border-0 bg-transparent px-3 py-2 text-sm text-ink-700 outline-none placeholder:text-ink-400"
            />
          </div>
          {phoneInvalid && (
            <p className="mt-1 text-xs text-rose-500">Enter exactly 10 digits ({localDigits.length}/10).</p>
          )}
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Department" required>
          <Select value={value.department} onChange={(e) => set("department", e.target.value)}>
            <option value="">— Select —</option>
            {departments.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </Select>
        </Field>
        <Field label="Team lead" required>
          <Select value={value.teamLead ?? ""} onChange={(e) => set("teamLead", e.target.value)}>
            <option value="">— Select —</option>
            {leadOptions.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Level" required>
          <Select value={String(value.level ?? 5)} onChange={(e) => set("level", Number(e.target.value))}>
            {LEVELS.map((l) => (
              <option key={l.value} value={l.value}>{l.label}</option>
            ))}
          </Select>
        </Field>
        <Field label="Title">
          <TextInput value={value.title} onChange={(e) => set("title", e.target.value)} placeholder="Software Engineer" />
        </Field>
      </div>
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
