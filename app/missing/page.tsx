"use client";

import { useState } from "react";
import { UserX, CheckCircle2, ChevronLeft, ChevronRight, Loader2, Download } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { KpiCard } from "@/components/ui/KpiCard";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Ring } from "@/components/ui/Progress";
import { EmptyState } from "@/components/ui/States";
import { useLoaded, useWeeks, useScope, useInsightForWeek, useInsightsForWeeks } from "@/lib/hooks";
import { rosterCompliance, missingSubmitters } from "@/lib/org";
import { exportMissingCSV } from "@/lib/export";
import type { Submitter } from "@/lib/org";
import { weekLabel, weekShort, cn } from "@/lib/utils";

const WhatsAppIcon = ({ size = 11 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

export default function MissingPage() {
  useLoaded();
  const { roster, submissions, label, isOrgWide } = useScope();
  const { weeks, currentWeek } = useWeeks();
  const [picked, setPicked] = useState("");
  const week = picked || currentWeek;
  const setWeek = setPicked;
  const [sendingTo, setSendingTo] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<Set<string>>(new Set());
  
  // Get stored insight for the selected week
  const storedInsight = useInsightForWeek(week);
  const allInsights = useInsightsForWeeks(weeks);

  const sendNudge = async (personId: string, name: string, phone: string) => {
    setSendingTo(personId);
    try {
      const res = await fetch("https://graph.facebook.com/v23.0/738320562700409/messages", {
        method: "POST",
        headers: {
          "Authorization": "Bearer EAA66pZAqI130BRmCj8wXFayUPxf4Bl4c2ofEGd5x5k4HD9Prg5tFjnQqwm6tJDXhSNrzicr6PUiy4r1iJLdQ6fF6AlVA7I7YMrdt5fmf0cwK3ZB7lKZBrhZADqIwDgiZAKGoudtbvxyRtKFdfOSTvJg3LdXOQmdAWOrvbaEsnZCYP5gPSumiAnL2TbFaJZCGijM",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: phone.replace(/[^0-9+]/g, ""),
          type: "template",
          template: {
            name: "goal_alignment",
            language: { code: "en" },
            components: [
              {
                type: "body",
                parameters: [
                  { type: "text", parameter_name: "name", text: name }
                ]
              },
              {
                type: "button",
                sub_type: "flow",
                index: "0",
                parameters: [
                  { type: "action", action: { flow_token: "goal_alignment_001" } }
                ]
              }
            ]
          }
        })
      });
      if (res.ok) {
        setSentTo((prev) => new Set([...prev, personId]));
      }
    } catch (e) {
      console.error("Failed to send nudge:", e);
    } finally {
      setSendingTo(null);
    }
  };

  // Use stored compliance metrics when available at org level
  const liveCompliance = rosterCompliance(roster, submissions, week);
  const c = (storedInsight && isOrgWide)
    ? {
        expected: storedInsight.expected,
        received: storedInsight.received,
        missing: storedInsight.missing,
        rate: storedInsight.complianceRate,
      }
    : liveCompliance;
  
  const missing = missingSubmitters(roster, submissions, week);
  
  // Build trend using stored insights when available (org-wide)
  const insightByWeek = new Map(allInsights.map((i) => [i.week, i]));
  const trend = weeks.map((w) => {
    const insight = insightByWeek.get(w);
    if (insight && isOrgWide) {
      return { week: w, received: insight.received, expected: insight.expected };
    }
    const cc = rosterCompliance(roster, submissions, w);
    return { week: w, received: cc.received, expected: cc.expected };
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
          <div className="grid grid-cols-2 gap-4">
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
                          {p.person?.phone && (
                            <button
                              onClick={() => sendNudge(p.id, p.name, p.person!.phone)}
                              disabled={sendingTo === p.id || sentTo.has(p.id)}
                              className={cn(
                                "inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors",
                                sentTo.has(p.id)
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
                              )}
                            >
                              {sendingTo === p.id ? (
                                <Loader2 size={11} className="animate-spin" />
                              ) : (
                                <WhatsAppIcon size={11} />
                              )}
                              {sentTo.has(p.id) ? "Sent" : "Nudge"}
                            </button>
                          )}
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
