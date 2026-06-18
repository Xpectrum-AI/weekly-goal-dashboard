"use client";

import { useMemo, useRef, useState } from "react";
import { AlertOctagon, Flag, Repeat, MessageCircle, Sparkles, ChevronDown, X } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { KpiCard } from "@/components/ui/KpiCard";
import { ExportMenu } from "@/components/ui/ExportMenu";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { ThemeChip } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { ProgressBar } from "@/components/ui/Progress";
import { EmptyState, Skeleton } from "@/components/ui/States";
import { Select } from "@/components/ui/Form";
import { useStore } from "@/lib/store";
import { useLoaded, useWeeks, useScope, useInsightForWeek, useThemeIndex, useScopedInsight, useScopedInsights } from "@/lib/hooks";
import {
  rawBlockers,
  combineThemes,
} from "@/lib/analytics";
import { recurringBlockers, sameBlocker, norm } from "@/lib/org";
import { exportBlockersCSV, type BlockerExportRow } from "@/lib/export";
import { weekLabel, weekShort, cn } from "@/lib/utils";

export default function BlockersPage() {
  const hydrated = useLoaded();
  const { submissions } = useScope();
  const insights = useStore((s) => s.insights);
  const scopedInsights = useScopedInsights(insights);
  const themeIdx = useThemeIndex();
  const { weeks } = useWeeks();
  const [week, setWeek] = useState("all");
  // Clicking a recurring blocker theme filters the "Recent blocker submitted"
  // list below to that theme (null = show all).
  const [selectedTheme, setSelectedTheme] = useState<string | null>(null);
  // Clicking a recurring blocker filters the list below to that person's
  // occurrences of that blocker (null = not filtering by a recurring blocker).
  const [selectedRecurring, setSelectedRecurring] = useState<{ name: string; text: string } | null>(null);
  const recentRef = useRef<HTMLDivElement>(null);

  // Select a theme and scroll the recent-blockers list into view.
  function pickTheme(theme: string) {
    const next = selectedTheme === theme ? null : theme;
    setSelectedTheme(next);
    setSelectedRecurring(null);
    if (next) recentRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // Select a recurring blocker and scroll the list into view.
  function pickRecurring(r: { name: string; text: string }) {
    const next = selectedRecurring && selectedRecurring.name === r.name && selectedRecurring.text === r.text ? null : r;
    setSelectedRecurring(next);
    setSelectedTheme(null);
    if (next) recentRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // Get stored insight for the selected week (null if "all" or not found)
  const storedInsight = useInsightForWeek(week === "all" ? "" : week);
  const scopedInsight = useScopedInsight(storedInsight, week === "all" ? "" : week);

  const scoped = useMemo(
    () => (week === "all" ? submissions : submissions.filter((s) => s.week === week)),
    [submissions, week]
  );

  // Use scoped insights for themes (works for both org-wide and sub-managers)
  const relevant = week === "all" ? scopedInsights : scopedInsights.filter((i) => i.week === week);
  const hasInsights = relevant.length > 0;
  
  const aiBlocker = combineThemes(relevant.map((i) => i.blockerThemes)).filter(
    (t) => t.theme && t.theme.toLowerCase() !== "no blocker"
  );
  const aiPriority = combineThemes(relevant.map((i) => i.priorityThemes)).filter((t) => t.theme);

  // Only show themes from MongoDB - no local fallback
  const bThemes = hasInsights ? aiBlocker : [];
  const pThemes = hasInsights ? aiPriority : [];
  const raw = rawBlockers(scoped, themeIdx);
  // Filter the recent-blockers list by the selected theme (if any).
  const filteredRaw = useMemo(() => {
    if (selectedRecurring) {
      return raw.filter(
        (b) => norm(b.personName) === norm(selectedRecurring.name) && sameBlocker(b.text, selectedRecurring.text)
      );
    }
    return selectedTheme ? raw.filter((b) => b.theme === selectedTheme) : raw;
  }, [raw, selectedTheme, selectedRecurring]);
  const repeats = recurringBlockers(scoped);
  
  // Use scoped blocker count when viewing a single week
  const totalBlockers = (week !== "all" && scopedInsight)
    ? scopedInsight.blockerCount
    : scoped.reduce((a, s) => a + s.blockers.length, 0);

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Blockers & Themes"
        description="Recurring blockers and priority themes derived from raw WhatsApp text"
        actions={
          <div className="flex items-center gap-2">
            <ExportMenu
              options={[
                {
                  label: "Export blockers",
                  hint: `${raw.length} blocker${raw.length !== 1 ? "s" : ""} with themes`,
                  onSelect: () => {
                    const blockerRows: BlockerExportRow[] = raw.map((b) => ({
                      personName: b.personName,
                      department: b.department,
                      teamLead: b.teamLead || "",
                      week: b.week,
                      blocker: b.text,
                      theme: b.theme,
                    }));
                    exportBlockersCSV(blockerRows, `blockers${week !== "all" ? `_${week}` : ""}`);
                  },
                },
              ]}
            />
            <Select value={week} onChange={(e) => setWeek(e.target.value)} className="w-44">
              <option value="all">All weeks</option>
              {weeks.map((w) => (
                <option key={w} value={w}>{weekLabel(w)}</option>
              ))}
            </Select>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
        <KpiCard label="Blockers reported" value={totalBlockers} icon={AlertOctagon} tone="rose" deltaLabel={week === "all" ? "across all weeks" : weekLabel(week)} />
        <KpiCard label="Distinct blocker themes" value={bThemes.length} icon={Flag} tone="amber" />
        <KpiCard label="Recurring blockers" value={repeats.length} icon={Repeat} tone="violet" deltaLabel="unresolved across 2+ weeks" />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Recurring blocker themes" subtitle="Click a theme to filter recent blockers below" />
          <CardBody>
            {!hydrated ? (
              <Skeleton className="h-[220px]" />
            ) : !hasInsights ? (
              <EmptyState icon={Sparkles} title="Insights not generated" description="Generate insights to see AI-derived blocker themes" />
            ) : bThemes.length === 0 ? (
              <EmptyState icon={Flag} title="No blockers reported" description="Teams are unblocked for this period." />
            ) : (
              <div className="space-y-3">
                {bThemes.filter((t) => t.theme).map((t) => {
                  const max = bThemes[0].count || 1;
                  const selected = selectedTheme === t.theme;
                  return (
                    <button
                      key={t.theme}
                      type="button"
                      onClick={() => pickTheme(t.theme)}
                      className={cn(
                        "w-full rounded-lg border px-2 py-1.5 text-left transition",
                        selected ? "border-ink-300 bg-ink-50" : "border-transparent hover:bg-ink-50"
                      )}
                    >
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <ThemeChip theme={t.theme} />
                        <span className="font-semibold text-ink-500">{t.count}</span>
                      </div>
                      <ProgressBar value={Math.round((t.count / max) * 100)} />
                    </button>
                  );
                })}
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Most common priority themes" subtitle="What people said they were focused on" />
          <CardBody>
            {!hydrated ? (
              <Skeleton className="h-[220px]" />
            ) : !hasInsights ? (
              <EmptyState icon={Sparkles} title="Insights not generated" description="Generate insights to see AI-derived priority themes" />
            ) : pThemes.length === 0 ? (
              <EmptyState icon={Flag} title="No priorities found" description="No priority themes detected" />
            ) : (
              <div className="space-y-3">
                {pThemes.map((t) => {
                  const max = pThemes[0].count;
                  return (
                    <div key={t.theme}>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <ThemeChip theme={t.theme} />
                        <span className="font-semibold text-ink-500">{t.count}</span>
                      </div>
                      <ProgressBar value={Math.round((t.count / max) * 100)} />
                    </div>
                  );
                })}
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      <div ref={recentRef} className="mt-6 grid scroll-mt-28 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Blocker submitted"
            subtitle="Raw blockers as reported over WhatsApp"
            action={
              selectedRecurring ? (
                <button
                  type="button"
                  onClick={() => setSelectedRecurring(null)}
                  className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2 py-1 text-[11px] font-medium text-rose-700 hover:bg-rose-100"
                >
                  <Repeat size={12} />
                  <span className="max-w-[160px] truncate">{selectedRecurring.name}</span>
                  <X size={12} />
                </button>
              ) : selectedTheme ? (
                <button
                  type="button"
                  onClick={() => setSelectedTheme(null)}
                  className="inline-flex items-center gap-1 rounded-md bg-ink-100 px-2 py-1 text-[11px] font-medium text-ink-600 hover:bg-ink-200"
                >
                  <ThemeChip theme={selectedTheme} />
                  <X size={12} />
                </button>
              ) : undefined
            }
          />
          <CardBody className="p-0">
            {filteredRaw.length === 0 ? (
              <EmptyState
                icon={AlertOctagon}
                title={
                  selectedRecurring
                    ? `No blockers for "${selectedRecurring.name}"`
                    : selectedTheme
                    ? `No blockers for "${selectedTheme}"`
                    : "No blocker text"
                }
              />
            ) : (
              <ul className="divide-y divide-ink-100">
                {filteredRaw.slice(0, 20).map((b, i) => (
                  <BlockerRow key={i} b={b} />
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Recurring blockers" subtitle="Same blocker unresolved across 2+ weeks" />
          <CardBody className="p-0">
            {repeats.length === 0 ? (
              <EmptyState icon={Repeat} title="No recurring blockers" />
            ) : (
              <ul className="divide-y divide-ink-100">
                {repeats.map((r, i) => {
                  const active = !!selectedRecurring && selectedRecurring.name === r.name && selectedRecurring.text === r.text;
                  return (
                    <li key={`${r.name}-${i}`}>
                      <button
                        type="button"
                        onClick={() => pickRecurring({ name: r.name, text: r.text })}
                        className={cn(
                          "flex w-full items-start gap-3 px-5 py-3 text-left transition-colors hover:bg-ink-50",
                          active && "bg-rose-50/60"
                        )}
                      >
                        <Avatar name={r.name} size="sm" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-ink-700">{r.text}</p>
                          <p className="mt-0.5 text-[11px] text-ink-400">
                            {r.name} · {r.department} · {r.weeks.map(weekShort).join(", ")}
                          </p>
                        </div>
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700">
                          {r.span}× weeks
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

// Expandable row for a single raw blocker — collapsed shows a one-line preview,
// expanded reveals the full text and submission details (like the Weekly Goals
// cards).
function BlockerRow({ b }: { b: ReturnType<typeof rawBlockers>[number] }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="px-5 py-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-start gap-3 text-left"
      >
        <ChevronDown
          size={15}
          className={cn("mt-1 shrink-0 text-ink-400 transition-transform", open ? "rotate-0" : "-rotate-90")}
        />
        <Avatar name={b.personName} size="sm" />
        <div className="min-w-0 flex-1">
          <p className={cn("text-sm text-ink-700", !open && "truncate")}>{b.text}</p>
          <p className="mt-0.5 text-[11px] text-ink-400">
            {b.personName} · {b.department} · {weekShort(b.week)}
          </p>
        </div>
        <ThemeChip theme={b.theme} />
      </button>

      {open && (
        <div className="mt-2 ml-[2.1rem] space-y-2 rounded-lg bg-ink-50 px-3 py-2 text-xs text-ink-600">
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-ink-700">{b.text}</p>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
            <Detail label="Person" value={b.personName} />
            <Detail label="Team lead" value={b.teamLead || "—"} />
            <Detail label="Department" value={b.department} />
            <Detail label="Week" value={weekLabel(b.week)} />
          </dl>
        </div>
      )}
    </li>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-[10px] font-semibold uppercase tracking-wide text-ink-400">{label}</dt>
      <dd className="text-ink-700">{value}</dd>
    </div>
  );
}
