"use client";

import { useMemo, useState } from "react";
import { AlertOctagon, Flag, Repeat, MessageCircle, Sparkles } from "lucide-react";
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
import { useLoaded, useWeeks, useScope, useInsightForWeek, useThemeIndex } from "@/lib/hooks";
import {
  rawBlockers,
  combineThemes,
} from "@/lib/analytics";
import { repeatedBlockerSubmitters } from "@/lib/org";
import { exportBlockersCSV, type BlockerExportRow } from "@/lib/export";
import { weekLabel, weekShort } from "@/lib/utils";

export default function BlockersPage() {
  const hydrated = useLoaded();
  const { submissions, isOrgWide } = useScope();
  const insights = useStore((s) => s.insights);
  const themeIdx = useThemeIndex();
  const { weeks } = useWeeks();
  const [week, setWeek] = useState("all");
  
  // Get stored insight for the selected week (null if "all" or not found)
  const storedInsight = useInsightForWeek(week === "all" ? "" : week);

  const scoped = useMemo(
    () => (week === "all" ? submissions : submissions.filter((s) => s.week === week)),
    [submissions, week]
  );

  // Only use AI themes from stored insights in MongoDB - no fallback
  const relevant = week === "all" ? insights : insights.filter((i) => i.week === week);
  const hasInsights = relevant.length > 0;
  
  const aiBlocker = combineThemes(relevant.map((i) => i.blockerThemes)).filter(
    (t) => t.theme && t.theme.toLowerCase() !== "no blocker"
  );
  const aiPriority = combineThemes(relevant.map((i) => i.priorityThemes)).filter((t) => t.theme);

  // Only show themes from MongoDB - no local fallback
  const bThemes = hasInsights ? aiBlocker : [];
  const pThemes = hasInsights ? aiPriority : [];
  const raw = rawBlockers(scoped, themeIdx);
  const repeats = repeatedBlockerSubmitters(scoped);
  
  // Use stored blocker count when viewing a single week at org level
  const totalBlockers = (week !== "all" && storedInsight && isOrgWide)
    ? storedInsight.blockerCount
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
        <KpiCard label="People with repeat blockers" value={repeats.length} icon={Repeat} tone="violet" deltaLabel="2+ weeks blocked" />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Recurring blocker themes" subtitle="Raw blocker text grouped by theme" />
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

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Recent blocker text" subtitle="Raw blockers as reported over WhatsApp" />
          <CardBody className="p-0">
            {raw.length === 0 ? (
              <EmptyState icon={AlertOctagon} title="No blocker text" />
            ) : (
              <ul className="divide-y divide-ink-100">
                {raw.slice(0, 12).map((b, i) => (
                  <li key={i} className="flex items-start gap-3 px-5 py-3">
                    <Avatar name={b.personName} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-ink-700">{b.text}</p>
                      <p className="mt-0.5 text-[11px] text-ink-400">
                        {b.personName} · {b.department} · {weekShort(b.week)}
                      </p>
                    </div>
                    <ThemeChip theme={b.theme} />
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Repeated blockers" subtitle="People blocked in 2+ weeks" />
          <CardBody className="p-0">
            {repeats.length === 0 ? (
              <EmptyState icon={Repeat} title="No repeat blockers" />
            ) : (
              <ul className="divide-y divide-ink-100">
                {repeats.map((r) => (
                  <li key={r.name} className="flex items-center gap-3 px-5 py-3">
                    <Avatar name={r.name} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink-800">{r.name}</p>
                      <p className="text-[11px] text-ink-400">{r.department} · {r.teamLead}</p>
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700">
                      {r.total}× weeks
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
