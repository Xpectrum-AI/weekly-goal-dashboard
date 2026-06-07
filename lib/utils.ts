import { clsx, type ClassValue } from "clsx";
import type { SubmissionStatus } from "./types";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

// ── Display helpers ─────────────────────────────────────────────────────────
export function initials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function weekLabel(week: string): string {
  const m = week.match(/W(\d+)/);
  return m ? `Week ${m[1]}` : week;
}

export function weekShort(week: string): string {
  const m = week.match(/W(\d+)/);
  return m ? `W${m[1]}` : week;
}

export function weekNum(week: string): number {
  const m = week.match(/W(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

export function formatDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function formatDateTime(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function relativeWeeks(week: string, currentWeek: string): string {
  const diff = weekNum(currentWeek) - weekNum(week);
  if (diff <= 0) return "this week";
  if (diff === 1) return "last week";
  return `${diff} weeks ago`;
}

// ── Visual tokens ───────────────────────────────────────────────────────────
export const STATUS_STYLES: Record<SubmissionStatus, { bg: string; text: string; dot: string }> = {
  Complete: { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" },
  Partial: { bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500" },
  Weak: { bg: "bg-rose-50", text: "text-rose-700", dot: "bg-rose-500" },
};

export function completenessColor(value: number): string {
  if (value >= 80) return "bg-emerald-500";
  if (value >= 50) return "bg-amber-500";
  return "bg-rose-500";
}

export function complianceColor(value: number): string {
  if (value >= 85) return "text-emerald-600";
  if (value >= 60) return "text-amber-600";
  return "text-rose-600";
}

// Stable-ish color per theme name for chips/charts.
const THEME_PALETTE = [
  "#6366f1",
  "#0ea5e9",
  "#ec4899",
  "#10b981",
  "#f59e0b",
  "#8b5cf6",
  "#ef4444",
  "#14b8a6",
];
export function themeColor(theme: string): string {
  let h = 0;
  for (let i = 0; i < theme.length; i++) h = (h * 31 + theme.charCodeAt(i)) >>> 0;
  return THEME_PALETTE[h % THEME_PALETTE.length];
}
