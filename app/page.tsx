"use client";

import { useState } from "react";
import Link from "next/link";
import {
  MessageCircle,
  UserX,
  AlertOctagon,
  GaugeCircle,
  Flag,
  ArrowRight,
  Clock,
  Sparkles,
  Loader2,
  ChevronDown,
  RefreshCw,
  Info,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { KpiCard } from "@/components/ui/KpiCard";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { StatusBadge, ThemeChip } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/Progress";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState, Skeleton } from "@/components/ui/States";
import { TrendArea } from "@/components/charts/Charts";
import { useLoaded, useWeeks, useScope, useInsightForWeek, useInsightsForWeeks } from "@/lib/hooks";
import {
  recentSubmissions,
  weakSubmissions,
} from "@/lib/analytics";
import { missingSubmitters } from "@/lib/org";
import { weekLabel, weekShort } from "@/lib/utils";

export default function OverviewPage() {
  const hydrated = useLoaded();
  const { submissions, roster, label, isOrgWide } = useScope();
  const { weeks, currentWeek, setSelectedWeek } = useWeeks();
  const storedInsight = useInsightForWeek(currentWeek);
  const allInsights = useInsightsForWeeks(weeks);

  const [generatingInsights, setGeneratingInsights] = useState(false);
  const [insightStatus, setInsightStatus] = useState<"idle" | "success" | "error">("idle");
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<"idle" | "success" | "error">("idle");

  const handleGenerateInsights = async () => {
    setGeneratingInsights(true);
    setInsightStatus("idle");
    try {
      const response = await fetch("https://apps-v2-dev.xpectrum-ai.com/v1/workflows/run", {
        method: "POST",
        headers: {
          "Authorization": "Bearer app-6486IPF8NNEATQ7mXGUr9det",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inputs: { week: currentWeek },
          response_mode: "streaming",
          user: "abc-123",
        }),
      });
      if (!response.ok) throw new Error("Failed to generate insights");
      setInsightStatus("success");
      setTimeout(() => setInsightStatus("idle"), 3000);
    } catch (error) {
      console.error("Error generating insights:", error);
      setInsightStatus("error");
      setTimeout(() => setInsightStatus("idle"), 3000);
    } finally {
      setGeneratingInsights(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncStatus("idle");
    try {
      const response = await fetch("https://apps-v2-dev.xpectrum-ai.com/v1/workflows/run", {
        method: "POST",
        headers: {
          "Authorization": "Bearer app-48KCeoZ491YOqaOHEBZTLzJ8",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inputs: {},
          response_mode: "streaming",
          user: "abc-123",
        }),
      });
      if (!response.ok) throw new Error("Failed to sync");
      setSyncStatus("success");
      setTimeout(() => setSyncStatus("idle"), 3000);
    } catch (error) {
      console.error("Error syncing:", error);
      setSyncStatus("error");
      setTimeout(() => setSyncStatus("idle"), 3000);
    } finally {
      setSyncing(false);
    }
  };

  const thisWeek = submissions.filter((s) => s.week === currentWeek);
  
  // Only use stored insight metrics from MongoDB - no fallback
  const hasStoredInsight = storedInsight && isOrgWide;
  
  const c = hasStoredInsight
    ? {
        expected: storedInsight.expected,
        received: storedInsight.received,
        missing: storedInsight.missing,
        rate: storedInsight.complianceRate,
      }
    : { expected: 0, received: 0, missing: 0, rate: 0 };
  
  const avgComplete = hasStoredInsight ? storedInsight.avgCompleteness : null;
  const blockerCount = hasStoredInsight ? storedInsight.blockerCount : null;
  
  // Keep the full array for displaying in the UI
  const weakThisWeek = weakSubmissions(thisWeek);
  const weakCount = hasStoredInsight ? storedInsight.weakCount : null;
  
  // Use stored AI-derived priority themes when available (only from MongoDB)
  const pThemes = hasStoredInsight ? storedInsight.priorityThemes : [];
  
  const recent = recentSubmissions(submissions, 7);
  const missing = missingSubmitters(roster, submissions, currentWeek);
  
  // Build trend using only stored insights from MongoDB
  const insightByWeek = new Map(allInsights.map((i) => [i.week, i]));
  const trend = weeks.map((w) => {
    const insight = insightByWeek.get(w);
    const received = insight ? insight.received : 0;
    return { week: weekShort(w), received };
  });

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Overview"
        description={`${weekLabel(currentWeek)} · ${label}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <select
                value={currentWeek}
                onChange={(e) => setSelectedWeek(e.target.value)}
                className="appearance-none rounded-lg border border-ink-200 bg-white px-3 py-2 pr-8 text-sm font-medium text-ink-700 shadow-sm hover:border-ink-300 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              >
                {weeks.map((w) => (
                  <option key={w} value={w}>
                    {weekLabel(w)}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={14}
                className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-400"
              />
            </div>
            <div className="relative group">
              <button
                onClick={handleSync}
                disabled={syncing}
                className={`btn-outline flex items-center gap-2 ${
                  syncStatus === "success"
                    ? "!bg-emerald-100 !text-emerald-700 !border-emerald-300"
                    : syncStatus === "error"
                    ? "!bg-rose-100 !text-rose-700 !border-rose-300"
                    : ""
                }`}
              >
                {syncing ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <RefreshCw size={16} />
                )}
                {syncing
                  ? "Syncing..."
                  : syncStatus === "success"
                  ? "Synced!"
                  : syncStatus === "error"
                  ? "Failed"
                  : "Sync"}
                <Info size={14} className="text-ink-400" />
              </button>
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-ink-800 text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50 shadow-lg">
                Transform raw submissions to structured data
                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-ink-800" />
              </div>
            </div>
            <button
              onClick={handleGenerateInsights}
              disabled={generatingInsights}
              className={`btn-primary flex items-center gap-2 ${
                insightStatus === "success"
                  ? "!bg-emerald-600"
                  : insightStatus === "error"
                  ? "!bg-rose-600"
                  : ""
              }`}
            >
              {generatingInsights ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Sparkles size={16} />
              )}
              {generatingInsights
                ? `Generating ${weekLabel(currentWeek)}...`
                : insightStatus === "success"
                ? "Insights Sent!"
                : insightStatus === "error"
                ? "Failed"
                : `Generate Insights (${weekLabel(currentWeek)})`}
            </button>
            <Link href="/submissions" className="btn-primary">
              <MessageCircle size={16} /> View submissions
            </Link>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {!hydrated ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[132px]" />)
        ) : (
          <>
            <KpiCard 
              label="Submission compliance" 
              value={hasStoredInsight ? c.rate : "—"} 
              suffix={hasStoredInsight ? "%" : ""} 
              icon={MessageCircle} 
              tone="emerald" 
              deltaLabel={hasStoredInsight ? `${c.received} of ${c.expected} submitted` : "Generate insights"} 
            />
            <KpiCard 
              label="Missing updates" 
              value={hasStoredInsight ? c.missing : "—"} 
              icon={UserX} 
              tone="amber" 
              deltaLabel={hasStoredInsight ? `for ${weekLabel(currentWeek)}` : "Generate insights"} 
            />
            <KpiCard 
              label="Blockers raised" 
              value={blockerCount !== null ? blockerCount : "—"} 
              icon={AlertOctagon} 
              tone="rose" 
              deltaLabel={blockerCount !== null ? "this week" : "Generate insights"} 
            />
            <KpiCard 
              label="Response completeness" 
              value={avgComplete !== null ? avgComplete : "—"} 
              suffix={avgComplete !== null ? "%" : ""} 
              icon={GaugeCircle} 
              tone="brand" 
              deltaLabel={avgComplete !== null ? `${weakCount} weak / vague` : "Generate insights"} 
            />
          </>
        )}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Submissions received per week" subtitle="Volume of weekly WhatsApp updates over time" />
          <CardBody>
            {hydrated ? <TrendArea data={trend} dataKey="received" color="#10b981" unit="" /> : <Skeleton className="h-[240px]" />}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Top priority theme" subtitle={weekLabel(currentWeek)} action={<Flag size={16} className="text-ink-300" />} />
          <CardBody>
            {!hasStoredInsight ? (
              <EmptyState icon={Sparkles} title="Insights not generated" description="Click 'Generate Insights' to analyze themes" />
            ) : pThemes.length === 0 ? (
              <EmptyState icon={Flag} title="No priorities found" description="No priority themes detected in submissions" />
            ) : (
              <>
                <div className="mb-4">
                  <ThemeChip theme={pThemes[0].theme} />
                  <p className="mt-2 text-xs text-ink-400">Most common stated priority this week</p>
                </div>
                <div className="space-y-2.5">
                  {pThemes.slice(0, 6).map((t) => (
                    <div key={t.theme}>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="font-medium text-ink-700">{t.theme}</span>
                        <span className="text-ink-400">{t.count}</span>
                      </div>
                      <ProgressBar value={Math.round((t.count / pThemes[0].count) * 100)} />
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Recent submissions"
            subtitle="Latest weekly updates received"
            action={
              <Link href="/submissions" className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 hover:text-emerald-700">
                View all <ArrowRight size={13} />
              </Link>
            }
          />
          <CardBody className="p-0">
            {recent.length === 0 ? (
              <EmptyState icon={MessageCircle} title="No submissions yet" />
            ) : (
              <ul className="divide-y divide-ink-100">
                {recent.map((s) => (
                  <li key={s._id}>
                    <Link
                      href={`/submissions?person=${encodeURIComponent(s.personName)}`}
                      className="flex items-center gap-3 px-5 py-3 transition hover:bg-ink-50/60"
                    >
                      <Avatar name={s.personName} size="sm" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-medium text-ink-800">{s.personName}</p>
                          <span className="text-[11px] text-ink-400">{s.department}</span>
                        </div>
                        <p className="mt-0.5 truncate text-[11px] text-ink-400">{s.topPriority || s.actions[0] || "—"}</p>
                      </div>
                      <span className="hidden text-[11px] text-ink-400 sm:block">{weekShort(s.week)}</span>
                      <StatusBadge status={s.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Needs attention" subtitle={`${missing.length} missing · ${weakCount} weak`} />
          <CardBody className="p-0">
            {missing.length === 0 && weakCount === 0 ? (
              <EmptyState icon={MessageCircle} title="All caught up" description="Everyone submitted a solid update." />
            ) : (
              <ul className="divide-y divide-ink-100">
                {missing.slice(0, 5).map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/missing?week=${currentWeek}`}
                      className="flex items-center gap-3 px-5 py-2.5 transition hover:bg-ink-50/60"
                    >
                      <Avatar name={p.name} color={p.person?.avatarColor} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-ink-700">{p.name}</p>
                        <p className="text-[11px] text-ink-400">{p.department} · {p.teamLead || "—"}</p>
                      </div>
                      <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                        <Clock size={11} /> Missing
                      </span>
                    </Link>
                  </li>
                ))}
                {weakThisWeek.slice(0, 3).map((s) => (
                  <li key={s._id}>
                    <Link
                      href={`/submissions?person=${encodeURIComponent(s.personName)}&status=Weak`}
                      className="flex items-center gap-3 px-5 py-2.5 transition hover:bg-ink-50/60"
                    >
                      <Avatar name={s.personName} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-ink-700">{s.personName}</p>
                        <p className="text-[11px] text-ink-400">{s.department} · {s.teamLead}</p>
                      </div>
                      <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-700">
                        weak
                      </span>
                    </Link>
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
