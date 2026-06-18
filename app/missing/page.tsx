"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { UserX, CheckCircle2, ChevronLeft, ChevronRight, Download } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { KpiCard } from "@/components/ui/KpiCard";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Ring } from "@/components/ui/Progress";
import { EmptyState } from "@/components/ui/States";
import { useLoaded, useWeeks, useScope } from "@/lib/hooks";
import { missingSubmitters, rosterCompliance } from "@/lib/org";
import { exportMissingCSV } from "@/lib/export";
import type { Submitter } from "@/lib/org";
import { weekLabel, weekShort, cn } from "@/lib/utils";

export default function MissingPage() {
  return (
    <Suspense fallback={<div className="animate-fade-in"><PageHeader title="Missing Updates" description="Loading…" /></div>}>
      <MissingPageContent />
    </Suspense>
  );
}

function MissingPageContent() {
  const searchParams = useSearchParams();
  useLoaded();
  const { roster, submissions, label } = useScope();
  const { weeks, currentWeek } = useWeeks();
  const [picked, setPicked] = useState(() => searchParams.get("week") || "");
  const week = picked || currentWeek;
  const setWeek = setPicked;

  // Compliance is grounded on the expected-submitter roster (everyone below
  // level 3), so Expected/Missing match the list below rather than the stored
  // MongoDB aggregate which counts all submitters.
  const c = rosterCompliance(roster, submissions, week);

  const missing = missingSubmitters(roster, submissions, week);

  // Build trend from the same roster so weekly bars stay consistent.
  const trend = weeks.map((w) => {
    const { received, expected } = rosterCompliance(roster, submissions, w);
    return { week: w, received, expected };
  });

  const idx = weeks.indexOf(week);
  const goPrev = () => idx > 0 && setWeek(weeks[idx - 1]);
  const goNext = () => idx < weeks.length - 1 && setWeek(weeks[idx + 1]);

  // Group missing by department for a leadership-friendly breakdown.
  const departments = Array.from(new Set(missing.map((m) => m.department))).sort();
  const byDept = departments
    .map((d) => ({ dept: d, people: missing.filter((p) => p.department === d) }))
    .filter((g) => g.people.length > 0);

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Missing Updates"
        description={`Who has not submitted, by week · ${label}`}
        actions={
          <div className="flex items-center gap-2">
            <button
              className="btn-outline"
              onClick={() => exportMissingCSV(missing, week, `missing_updates_${week}`)}
              disabled={missing.length === 0}
            >
              <Download size={16} /> Export
            </button>
            <div className="flex items-center gap-1 rounded-lg border border-ink-200 bg-white p-0.5">
              <button onClick={goPrev} disabled={idx === 0} className="rounded-md p-1.5 text-ink-500 hover:bg-ink-100 disabled:opacity-40">
                <ChevronLeft size={16} />
              </button>
              <select value={week} onChange={(e) => setWeek(e.target.value)} className="cursor-pointer rounded-md px-2 py-1 text-sm font-medium text-ink-700 outline-none">
                {weeks.map((w) => (
                  <option key={w} value={w}>{weekLabel(w)}</option>
                ))}
              </select>
              <button onClick={goNext} disabled={idx === weeks.length - 1} className="rounded-md p-1.5 text-ink-500 hover:bg-ink-100 disabled:opacity-40">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        {/* Compliance summary */}
        <div className="space-y-4">
          <Card>
            <CardBody className="flex flex-col items-center py-6 text-center">
              <Ring value={c.rate} size={120} stroke={10} color={c.rate >= 85 ? "#10b981" : c.rate >= 60 ? "#f59e0b" : "#f43f5e"} />
              <p className="mt-4 text-sm font-semibold text-ink-800">{weekLabel(week)} compliance</p>
              <p className="text-xs text-ink-400">{c.received} of {c.expected} submitted</p>
            </CardBody>
          </Card>
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <KpiCard label="Expected" value={c.expected} icon={CheckCircle2} tone="sky" />
            <KpiCard label="Missing" value={c.missing} icon={UserX} tone="rose" />
          </div>
          {/* mini weekly compliance bars */}
          <Card>
            <CardHeader title="Compliance by week" />
            <CardBody className="space-y-2">
              {trend.map((t) => {
                const rate = t.expected ? Math.round((t.received / t.expected) * 100) : 0;
                const active = t.week === week;
                return (
                  <button
                    key={t.week}
                    onClick={() => setWeek(t.week)}
                    className={cn("flex w-full items-center gap-3 rounded-lg px-2 py-1.5 transition hover:bg-ink-50", active && "bg-ink-50")}
                  >
                    <span className={cn("w-10 text-left text-xs font-medium", active ? "text-ink-900" : "text-ink-500")}>{weekShort(t.week)}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-ink-100">
                      <div className={cn("h-full rounded-full", rate >= 85 ? "bg-emerald-500" : rate >= 60 ? "bg-amber-500" : "bg-rose-500")} style={{ width: `${rate}%` }} />
                    </div>
                    <span className="w-14 text-right text-[11px] tabular-nums text-ink-400">{t.received}/{t.expected}</span>
                  </button>
                );
              })}
            </CardBody>
          </Card>
        </div>

        {/* Missing list */}
        <Card>
          <CardHeader
            title={`Not submitted — ${weekLabel(week)}`}
            subtitle={`${missing.length} ${missing.length === 1 ? "person has" : "people have"} not submitted`}
          />
          <CardBody className="p-0">
            {missing.length === 0 ? (
              <EmptyState icon={CheckCircle2} title="100% submitted" description={`Everyone submitted for ${weekLabel(week)}.`} />
            ) : (
              <div>
                {byDept.map((g) => (
                  <div key={g.dept}>
                    <div className="flex items-center justify-between border-b border-ink-100 bg-ink-50/60 px-5 py-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">{g.dept}</p>
                      <span className="text-xs text-ink-400">{g.people.length} missing</span>
                    </div>
                    <ul className="divide-y divide-ink-100">
                      {g.people.map((p) => (
                        <li key={p.id} className="flex items-center gap-3 px-5 py-3">
                          <Avatar name={p.name} color={p.person?.avatarColor} size="sm" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-ink-800">{p.name}</p>
                            <p className="text-[11px] text-ink-400">
                              {p.person?.title ? `${p.person.title} · ` : ""}lead {p.teamLead || "—"}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
