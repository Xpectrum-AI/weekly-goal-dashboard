"use client";

import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FilterDef {
  key: string;
  label: string;
  options: { value: string; label: string }[];
}

export function FilterBar({
  search,
  onSearch,
  searchPlaceholder = "Search…",
  filters,
  values,
  onChange,
  onClear,
  right,
}: {
  search: string;
  onSearch: (v: string) => void;
  searchPlaceholder?: string;
  filters: FilterDef[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  onClear: () => void;
  right?: React.ReactNode;
}) {
  const activeCount =
    Object.values(values).filter((v) => v && v !== "all").length +
    (search ? 1 : 0);

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      <div className="relative w-full sm:w-auto sm:min-w-[200px] sm:flex-1">
        <Search
          size={15}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400"
        />
        <input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder={searchPlaceholder}
          className="w-full rounded-lg border border-ink-200 bg-white py-2 pl-9 pr-3 text-sm outline-none transition placeholder:text-ink-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-500/15"
        />
      </div>
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
        {filters.map((f) => (
          <select
            key={f.key}
            value={values[f.key] ?? "all"}
            onChange={(e) => onChange(f.key, e.target.value)}
            className={cn(
              "min-w-0 cursor-pointer truncate rounded-lg border bg-white px-3 py-2 text-sm outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-500/15",
              values[f.key] && values[f.key] !== "all"
                ? "border-brand-300 text-brand-700"
                : "border-ink-200 text-ink-600"
            )}
          >
            <option value="all">{f.label}: All</option>
            {f.options.map((o) => (
              <option key={o.value} value={o.value}>
                {f.label}: {o.label}
              </option>
            ))}
          </select>
        ))}
        {activeCount > 0 && (
          <button
            onClick={onClear}
            className="col-span-2 inline-flex items-center justify-center gap-1 rounded-lg border border-ink-200 px-2.5 py-2 text-sm font-medium text-ink-500 hover:bg-ink-100 sm:col-span-1 sm:border-0"
          >
            <X size={14} /> Clear ({activeCount})
          </button>
        )}
      </div>
      {right && <div className="sm:ml-auto">{right}</div>}
    </div>
  );
}
