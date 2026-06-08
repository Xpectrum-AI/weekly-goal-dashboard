import * as XLSX from "xlsx";
import type { WeeklySubmission, Person } from "./types";
import { getCurrentWeek } from "./utils";

export type TargetCollection = "weekly_submissions" | "people";

export interface FieldDef {
  key: string;
  label: string;
  required?: boolean;
  aliases: string[];
}

export const SUBMISSION_FIELDS: FieldDef[] = [
  { key: "person", label: "Person (name or phone)", required: true, aliases: ["person", "name", "from", "phone", "number", "whatsapp", "sender"] },
  { key: "week", label: "Week", required: true, aliases: ["week", "period", "sprint"] },
  { key: "topPriority", label: "Top priority", aliases: ["priority", "top priority", "focus", "main"] },
  { key: "actions", label: "Actions / did", aliases: ["actions", "did", "done", "progress", "work", "update"] },
  { key: "outcomes", label: "Outcomes", aliases: ["outcomes", "results", "wins", "delivered"] },
  { key: "blockers", label: "Blockers", aliases: ["blockers", "blocker", "blocked", "risks", "issues"] },
  { key: "notes", label: "Notes", aliases: ["notes", "comments", "remarks"] },
];

export const PEOPLE_FIELDS: FieldDef[] = [
  { key: "name", label: "Name", required: true, aliases: ["name", "person", "full name"] },
  { key: "phone", label: "Phone (WhatsApp)", required: true, aliases: ["phone", "number", "whatsapp", "mobile"] },
  { key: "department", label: "Department", aliases: ["department", "dept", "team"] },
  { key: "teamLead", label: "Team lead", aliases: ["team lead", "lead", "manager", "reports to"] },
  { key: "title", label: "Title", aliases: ["title", "role", "position"] },
];

export interface ParsedSheet {
  headers: string[];
  rows: Record<string, any>[];
  sheetName: string;
  sheetNames: string[];
}

export async function parseWorkbook(file: File, sheetName?: string): Promise<ParsedSheet> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const name = sheetName ?? wb.SheetNames[0];
  const ws = wb.Sheets[name];
  const json = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: "", raw: false });
  const headers = json.length > 0 ? Object.keys(json[0]) : [];
  return { headers, rows: json, sheetName: name, sheetNames: wb.SheetNames };
}

export function autoMap(headers: string[], fields: FieldDef[]): Record<string, string> {
  const map: Record<string, string> = {};
  const used = new Set<string>();
  fields.forEach((field) => {
    const match = headers.find((h) => {
      const hl = h.toLowerCase().trim();
      return (
        !used.has(h) &&
        (hl === field.key.toLowerCase() ||
          hl === field.label.toLowerCase() ||
          field.aliases.some((a) => hl === a || hl.includes(a)))
      );
    });
    if (match) {
      map[field.key] = match;
      used.add(match);
    }
  });
  return map;
}

const splitList = (v: string): string[] =>
  v ? v.split(/[;|]|(?:,(?=\s))/).map((x) => x.trim()).filter(Boolean) : [];

function normalizeWeek(v: string): string {
  const s = (v || "").trim();
  const ww = s.match(/W?\s*(\d{1,2})/i);
  if (ww) {
    const weekNum = parseInt(ww[1], 10);
    // Accept any week 1-53
    if (weekNum >= 1 && weekNum <= 53) {
      const year = new Date().getFullYear();
      return `${year}-W${String(weekNum).padStart(2, "0")}`;
    }
  }
  return getCurrentWeek();
}

// ── Validation ──────────────────────────────────────────────────────────────
export interface ValidatedSubmission {
  index: number;
  data: Omit<WeeklySubmission, "_id"> | null;
  errors: string[];
  raw: Record<string, any>;
  resolvedName?: string;
}

export function validateSubmissions(
  rows: Record<string, any>[],
  mapping: Record<string, string>,
  people: Person[]
): ValidatedSubmission[] {
  return rows.map((raw, index) => {
    const errors: string[] = [];
    const get = (key: string) => {
      const col = mapping[key];
      return col ? String(raw[col] ?? "").trim() : "";
    };

    const ref = get("person").toLowerCase();
    let person: Person | undefined;
    if (!ref) errors.push("Missing person");
    else {
      const digits = ref.replace(/[^0-9]/g, "");
      person = people.find(
        (p) =>
          p.name.toLowerCase() === ref ||
          p.name.toLowerCase().includes(ref) ||
          (digits.length >= 4 && p.phone.replace(/[^0-9]/g, "").endsWith(digits))
      );
      if (!person) errors.push(`Unknown person: "${get("person")}"`);
    }

    // Need at least a priority or some actions to be a meaningful update.
    if (!get("topPriority").trim() && !get("actions").trim()) {
      errors.push("No priority or actions");
    }

    const data: Omit<WeeklySubmission, "_id"> | null =
      errors.length === 0 && person
        ? {
            personId: person._id,
            personName: person.name,
            department: person.department,
            teamLead: person.teamLead ?? "",
            week: normalizeWeek(get("week")),
            submittedAt: new Date().toISOString(),
            topPriority: get("topPriority"),
            actions: splitList(get("actions")),
            outcomes: splitList(get("outcomes")),
            blockers: splitList(get("blockers")),
            notes: get("notes"),
          }
        : null;

    return { index, data, errors, raw, resolvedName: person?.name };
  });
}

export interface ValidatedPerson {
  index: number;
  data: Omit<Person, "_id"> | null;
  errors: string[];
  raw: Record<string, any>;
}

const PALETTE = ["#6366f1", "#0ea5e9", "#ec4899", "#10b981", "#f59e0b", "#8b5cf6"];

export function validatePeople(
  rows: Record<string, any>[],
  mapping: Record<string, string>
): ValidatedPerson[] {
  return rows.map((raw, index) => {
    const errors: string[] = [];
    const get = (key: string) => {
      const col = mapping[key];
      return col ? String(raw[col] ?? "").trim() : "";
    };
    const name = get("name");
    const phone = get("phone");
    if (!name) errors.push("Missing name");
    if (!phone) errors.push("Missing phone");

    const data: Omit<Person, "_id"> | null =
      errors.length === 0
        ? {
            name,
            phone,
            department: get("department") || "Unassigned",
            teamLead: get("teamLead") || "Unassigned",
            title: get("title") || "Team Member",
            active: true,
            joinedAt: new Date().toISOString().slice(0, 10),
            avatarColor: PALETTE[name.length % PALETTE.length],
          }
        : null;
    return { index, data, errors, raw };
  });
}

// ── Template ────────────────────────────────────────────────────────────────
export function downloadTemplate(target: TargetCollection) {
  let sample: Record<string, string>[];
  let sheet: string;
  if (target === "people") {
    sheet = "people";
    sample = [
      { Name: "Jordan Avery", Phone: "+1-555-0123", Department: "Engineering", "Team Lead": "Marcus Chen", Title: "Software Engineer" },
      { Name: "Sam Rivera", Phone: "+1-555-0124", Department: "Product", "Team Lead": "James Wright", Title: "Product Analyst" },
    ];
  } else {
    sheet = "weekly_submissions";
    sample = [
      {
        Person: "David Okafor",
        Week: "W23",
        "Top Priority": "Ship the billing event schema",
        Actions: "Refactored the producer; Added tests",
        Outcomes: "Shipped behind a flag",
        Blockers: "Waiting on infra approval",
      },
      {
        Person: "+1-555-0117",
        Week: "W23",
        "Top Priority": "Onboarding usability study",
        Actions: "Ran 3 sessions; Synthesized notes",
        Outcomes: "Findings reshaped onboarding",
        Blockers: "",
      },
    ];
  }
  const ws = XLSX.utils.json_to_sheet(sample);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheet);
  XLSX.writeFile(wb, `${sheet}_template.xlsx`);
}
