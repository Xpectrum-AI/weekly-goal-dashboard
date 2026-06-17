"use client";

import { useMemo, useState } from "react";
import { Users, Plus, Pencil, Trash2, Phone, Network, Send, Loader2, CheckCircle2, X } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { KpiCard } from "@/components/ui/KpiCard";
import { ExportMenu } from "@/components/ui/ExportMenu";
import { Card } from "@/components/ui/Card";
import { FilterBar } from "@/components/ui/FilterBar";
import { Modal, ConfirmDialog } from "@/components/ui/Modal";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState, TableSkeleton } from "@/components/ui/States";
import { PersonForm, emptyPerson, type PersonDraft } from "@/components/forms/PersonForm";
import { useStore } from "@/lib/store";
import { useLoaded, useWeeks, useFacets, useScope } from "@/lib/hooks";
import { consistencyByName, reportsCountByName, norm, isTopLeader, expectsSubmission, computeLevel } from "@/lib/org";
import { sendNudge } from "@/lib/nudge";
import { exportPeopleCSV, exportPeopleFullCSV, type PeopleExportRow } from "@/lib/export";
import { cn, formatDate, weekShort, normalizePhone, isValidPhone } from "@/lib/utils";
import type { Person } from "@/lib/types";

export default function PeoplePage() {
  const hydrated = useLoaded();
  const { weeks, currentWeek } = useWeeks();
  const { departments, teamLeads } = useFacets();
  const { people, submissions, roster, viewer, isOrgWide } = useScope();
  const addPerson = useStore((s) => s.addPerson);
  const updatePerson = useStore((s) => s.updatePerson);
  const deletePerson = useStore((s) => s.deletePerson);

  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState<PersonDraft | null>(null);
  const [editing, setEditing] = useState<Person | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Post-save reminder: when a saved person is still pending this week, offer to
  // send them the WhatsApp alignment nudge.
  const [nudgePerson, setNudgePerson] = useState<{ name: string; phone: string } | null>(null);
  const [nudgeState, setNudgeState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  // Merge the org roster (people) with the actual submitters so consistency is
  // real for those who report, while managers who don't submit are flagged.
  const rows = useMemo(() => {
    const reportCounts = reportsCountByName(people, submissions);
    const peopleByName = new Map(people.map((p) => [norm(p.name), p]));
    const submitterByName = new Map(roster.map((r) => [norm(r.name), r]));
    const allNames = new Set([
      ...people.map((p) => norm(p.name)),
      ...roster.map((r) => norm(r.name)),
    ]);

    let entries = [...allNames].map((key) => {
      const person = peopleByName.get(key);
      const sub = submitterByName.get(key);
      const name = person?.name ?? sub?.name ?? key;
      const reports = reportCounts.get(key) ?? 0;
      return {
        key,
        name,
        person,
        phone: person?.phone ?? "",
        title: person?.title ?? "",
        department: person?.department ?? sub?.department ?? "Unassigned",
        teamLead: person?.teamLead ?? sub?.teamLead ?? "",
        avatarColor: person?.avatarColor,
        reports,
        isLead: reports > 0 || person?.department === "Leadership" || (!!person && !person.teamLead),
        c: consistencyByName(name, submissions, weeks),
      };
    });

    // Apply filters
    entries = entries.filter((e) => {
      if (filters.dept && filters.dept !== "all" && e.department !== filters.dept) return false;
      if (filters.lead && filters.lead !== "all" && !(e.teamLead || "").includes(filters.lead)) return false;
      if (search) {
        const blob = `${e.name} ${e.phone} ${e.title} ${e.teamLead} ${e.department}`.toLowerCase();
        if (!blob.includes(search.toLowerCase())) return false;
      }
      return true;
    });

    // Calculate hierarchy level for each person
    const getLevel = (entry: typeof entries[0], depth = 0): number => {
      if (!entry.teamLead || depth > 10) return depth; // Max depth protection
      const manager = entries.find((e) => norm(e.name) === norm(entry.teamLead.split('/')[0]));
      return manager ? getLevel(manager, depth + 1) : depth;
    };

    // Add level and build hierarchical structure
    const hierarchical: any[] = [];
    const teamLeadEntries = entries.filter((e) => e.reports > 0);
    const processed = new Set<string>();
    
    // Build map of who reports to whom
    const reportedBy = new Map<string, typeof entries>();
    entries.forEach((e) => {
      if (e.teamLead) {
        const leadKey = norm(e.teamLead.split('/')[0]);
        if (!reportedBy.has(leadKey)) reportedBy.set(leadKey, []);
        reportedBy.get(leadKey)!.push(e);
      }
    });

    // Recursive function to add person and their reports
    const addPersonAndReports = (entry: typeof entries[0], level: number) => {
      if (processed.has(entry.key)) return;
      
      const isTopLevel = !entry.teamLead || entry.department === 'Leadership';
      hierarchical.push({ 
        ...entry, 
        level,
        isTeamLead: entry.reports > 0,
        isTopLevel,
        reportingTo: entry.teamLead ? entry.teamLead.split('/')[0] : null
      });
      processed.add(entry.key);

      // Add direct reports
      const reports = reportedBy.get(entry.key) || [];
      reports.sort((a, b) => {
        // Team leads first, then by name
        if ((a.reports > 0) !== (b.reports > 0)) return b.reports - a.reports;
        return a.name.localeCompare(b.name);
      });
      reports.forEach((report) => addPersonAndReports(report, level + 1));
    };

    // Start with top-level people (no manager or Leadership dept)
    const topLevel = entries.filter((e) => !e.teamLead || e.department === 'Leadership');
    topLevel.sort((a, b) => {
      if (a.department === 'Leadership' && b.department !== 'Leadership') return -1;
      if (b.department === 'Leadership' && a.department !== 'Leadership') return 1;
      return b.reports - a.reports;
    });
    topLevel.forEach((person) => addPersonAndReports(person, 0));

    // Add any remaining people who weren't categorized
    entries.forEach((e) => {
      if (!processed.has(e.key)) {
        hierarchical.push({ ...e, level: getLevel(e) });
      }
    });

    return hierarchical;
  }, [people, roster, submissions, filters, search, weeks]);

  const teamCount = teamLeads.length;

  function openNew() {
    setEditing(null);
    setDraft(emptyPerson());
  }
  function openEdit(p: Person) {
    setEditing(p);
    const { _id, ...rest } = p;
    setDraft(rest);
  }
  function save() {
    if (!draft) return;
    // Always store the phone with the +91 country code, and auto-detect the org
    // level from the chosen team lead (level 1 = top, each step down adds one).
    const level = computeLevel(draft.teamLead ?? null, people);
    const cleaned = { ...draft, phone: normalizePhone(draft.phone), level };
    if (editing) updatePerson(editing._id, cleaned);
    else addPerson(cleaned);
    setDraft(null);
    setEditing(null);

    // Is this person still pending their update for the current week?
    const expected = expectsSubmission({ ...cleaned, level } as Person);
    const submittedThisWeek = submissions.some(
      (s) => norm(s.personName) === norm(cleaned.name) && s.week === currentWeek
    );
    if (expected && !submittedThisWeek && cleaned.phone) {
      setNudgeState("idle");
      // Defer so the edit dialog finishes closing and the touch's synthesized
      // "ghost click" doesn't land on this dialog's backdrop (mobile), which
      // would dismiss it immediately.
      const next = { name: cleaned.name, phone: cleaned.phone };
      setTimeout(() => setNudgePerson(next), 350);
    }
  }

  async function handleSendNudge() {
    if (!nudgePerson) return;
    setNudgeState("sending");
    const ok = await sendNudge(nudgePerson.name, nudgePerson.phone);
    setNudgeState(ok ? "sent" : "error");
    if (ok) setTimeout(() => setNudgePerson(null), 1200);
  }

  return (
    <div className="animate-fade-in">
      {viewer && !isOrgWide && (
        <div className="mb-4 rounded-lg border border-violet-200 bg-violet-50 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="rounded-full bg-violet-200 p-1">
              <Users size={14} className="text-violet-700" />
            </div>
            <p className="text-sm font-medium text-violet-900">
              Filtered View: Showing only <span className="font-semibold">{viewer.name}</span> and their team ({people.length} {people.length === 1 ? 'person' : 'people'})
            </p>
          </div>
        </div>
      )}
      <PageHeader
        title="People & Teams"
        description={
          viewer && !isOrgWide
            ? `Showing ${viewer.name}'s team and direct reports only`
            : "Team leads with their direct reports — view and edit the full organizational hierarchy"
        }
        actions={
          <>
            <ExportMenu
              options={[
                {
                  label: "Template format",
                  hint: "Compatible with import",
                  onSelect: () => {
                    const toExport = people.filter((p) => rows.some((r: any) => r.key === norm(p.name)));
                    exportPeopleCSV(toExport, "people");
                  },
                },
                {
                  label: "Full export",
                  hint: "Includes consistency data",
                  onSelect: () => {
                    const exportRows: PeopleExportRow[] = rows.map((r: any) => ({
                      name: r.name,
                      phone: r.phone || "",
                      department: r.department,
                      teamLead: r.teamLead || "",
                      title: r.title || "",
                      active: r.person?.active,
                      consistencyRate: r.c?.rate,
                      submissionCount: r.c?.count,
                    }));
                    exportPeopleFullCSV(exportRows, "people_full");
                  },
                },
              ]}
            />
            <button className="btn-primary" onClick={openNew}>
              <Plus size={16} /> Add person
            </button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
        <KpiCard label="People tracked" value={rows.length} icon={Users} tone="brand" />
        <KpiCard label="Teams (by lead)" value={teamCount} icon={Network} tone="sky" />
        <KpiCard label="Departments" value={departments.length} icon={Users} tone="violet" />
      </div>

      <Card className="my-4 p-4">
        <FilterBar
          search={search}
          onSearch={setSearch}
          searchPlaceholder="Search name, phone, title…"
          values={filters}
          onChange={(k, v) => setFilters((f) => ({ ...f, [k]: v }))}
          onClear={() => {
            setFilters({});
            setSearch("");
          }}
          filters={[
            { key: "dept", label: "Dept", options: departments.map((d) => ({ value: d, label: d })) },
            { key: "lead", label: "Lead", options: teamLeads.map((l) => ({ value: l, label: l })) },
          ]}
        />
      </Card>

      <Card>
        {!hydrated ? (
          <TableSkeleton />
        ) : rows.length === 0 ? (
          <EmptyState icon={Users} title="No people found" description="Adjust filters or add a person." />
        ) : (
          <>
          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-left text-xs font-semibold uppercase tracking-wide text-ink-400">
                  <th className="px-5 py-3">Person</th>
                  <th className="px-3 py-3">Phone</th>
                  <th className="px-3 py-3">Team lead</th>
                  <th className="px-3 py-3">Department</th>
                  <th className="px-3 py-3">Last submission</th>
                  <th className="px-3 py-3 w-48">Consistency</th>
                  <th className="px-5 py-3 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {rows.map((e: any) => {
                  const level = e.level || 0;
                  const levelColors = [
                    { bg: "bg-violet-50", border: "border-l-violet-500", badge: "bg-violet-600" },
                    { bg: "bg-blue-50", border: "border-l-blue-500", badge: "bg-blue-600" },
                    { bg: "bg-sky-50", border: "border-l-sky-500", badge: "bg-sky-600" },
                    { bg: "bg-teal-50", border: "border-l-teal-500", badge: "bg-teal-600" },
                  ];
                  const color = levelColors[Math.min(level, levelColors.length - 1)];
                  const indent = level * 24; // Full indentation for all levels
                  
                  return (
                    <tr 
                      key={e.key} 
                      className={cn(
                        "group hover:bg-ink-50/60 border-l-4",
                        e.isTopLevel ? "border-l-violet-500 bg-violet-25" : color.border
                      )}
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5" style={{ paddingLeft: `${indent}px` }}>
                          {level > 0 && (
                            <span className="text-ink-300 text-xs">
                              {"└─"}
                            </span>
                          )}
                          <Avatar name={e.name} color={e.avatarColor} size="sm" />
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-ink-800">{e.name}</p>
                              {e.reports > 0 && (
                                <span className="text-[10px] text-ink-500 font-medium">
                                  ({e.reports} report{e.reports > 1 ? "s" : ""})
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-ink-400">{e.title || (e.isLead ? "Team lead" : "Team member")}</p>
                          </div>
                        </div>
                      </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      {e.phone ? (
                        <span className="inline-flex items-center gap-1 text-xs text-ink-500">
                          <Phone size={12} className="shrink-0" /> {e.phone}
                        </span>
                      ) : (
                        <span className="text-xs text-ink-300">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-ink-600">
                      {e.isTopLevel ? (
                        <span className="text-xs text-ink-300 italic">—</span>
                      ) : e.reportingTo ? (
                        <span className={cn("font-medium text-xs", level === 1 ? "text-violet-600" : "text-blue-600")}>
                          {e.reportingTo}
                        </span>
                      ) : e.teamLead ? (
                        <span className="text-ink-600 text-xs">{e.teamLead}</span>
                      ) : (
                        <span className="text-ink-300">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-ink-600">{e.department}</td>
                    <td className="px-3 py-3 whitespace-nowrap text-ink-500">
                      {e.c.lastSubmission ? (
                        formatDate(e.c.lastSubmission.submittedAt)
                      ) : (
                        <span className="text-ink-300">{e.isLead ? "—" : "Never"}</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {e.c.count > 0 ? (
                        <div className="flex items-center gap-2">
                          <div className="flex gap-0.5">
                            {e.c.perWeek.map((w: any) => (
                              <span
                                key={w.week}
                                title={`${weekShort(w.week)} · ${w.submitted ? "submitted" : "missing"}`}
                                className={cn("h-4 w-2.5 rounded-sm", w.submitted ? "bg-emerald-400" : "bg-ink-200")}
                              />
                            ))}
                          </div>
                          <span className={cn("text-xs font-semibold tabular-nums", e.c.rate >= 80 ? "text-emerald-600" : e.c.rate >= 50 ? "text-amber-600" : "text-rose-600")}>
                            {e.c.rate}%
                          </span>
                        </div>
                      ) : e.isLead ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-700">
                          Team lead{e.reports ? ` · ${e.reports} report${e.reports > 1 ? "s" : ""}` : ""}
                        </span>
                      ) : (
                        <span className="text-[11px] text-ink-300">No submissions</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      {e.person && (
                        <div className="flex items-center justify-end gap-0.5 opacity-0 transition group-hover:opacity-100">
                          <button onClick={() => openEdit(e.person!)} className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700">
                            <Pencil size={15} />
                          </button>
                          {!e.isTopLevel && (
                            <button onClick={() => setDeleteId(e.person!._id)} className="rounded-lg p-1.5 text-ink-400 hover:bg-rose-50 hover:text-rose-600">
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile / tablet: stacked cards instead of a wide table */}
          <ul className="divide-y divide-ink-100 lg:hidden">
            {rows.map((e: any) => {
              const level = e.level || 0;
              const levelColors = [
                "border-l-violet-500",
                "border-l-blue-500",
                "border-l-sky-500",
                "border-l-teal-500",
              ];
              const border = e.isTopLevel
                ? "border-l-violet-500"
                : levelColors[Math.min(level, levelColors.length - 1)];
              return (
                <li key={e.key} className={cn("border-l-4 px-4 py-3.5", border)}>
                  <div className="flex items-start gap-3">
                    <Avatar name={e.name} color={e.avatarColor} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                            <p className="font-medium text-ink-800">{e.name}</p>
                            {e.reports > 0 && (
                              <span className="text-[10px] font-medium text-ink-500">
                                ({e.reports} report{e.reports > 1 ? "s" : ""})
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-ink-400">
                            {e.title || (e.isLead ? "Team lead" : "Team member")}
                          </p>
                        </div>
                        {e.person && (
                          <div className="flex shrink-0 items-center gap-0.5">
                            <button onClick={() => openEdit(e.person!)} className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700">
                              <Pencil size={15} />
                            </button>
                            {!e.isTopLevel && (
                              <button onClick={() => setDeleteId(e.person!._id)} className="rounded-lg p-1.5 text-ink-400 hover:bg-rose-50 hover:text-rose-600">
                                <Trash2 size={15} />
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                        <div className="col-span-2 flex items-center gap-1 text-ink-600">
                          {e.phone ? (
                            <>
                              <Phone size={12} className="shrink-0 text-ink-400" />
                              <span className="truncate">{e.phone}</span>
                            </>
                          ) : (
                            <span className="text-ink-300">No phone</span>
                          )}
                        </div>
                        <div>
                          <dt className="text-[10px] uppercase tracking-wide text-ink-400">Team lead</dt>
                          <dd className="text-ink-600">
                            {e.isTopLevel ? "—" : e.reportingTo || e.teamLead || "—"}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[10px] uppercase tracking-wide text-ink-400">Department</dt>
                          <dd className="text-ink-600">{e.department || "—"}</dd>
                        </div>
                        <div>
                          <dt className="text-[10px] uppercase tracking-wide text-ink-400">Last submission</dt>
                          <dd className="text-ink-600">
                            {e.c.lastSubmission ? formatDate(e.c.lastSubmission.submittedAt) : (e.isLead ? "—" : "Never")}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[10px] uppercase tracking-wide text-ink-400">Consistency</dt>
                          <dd>
                            {e.c.count > 0 ? (
                              <span className={cn("font-semibold tabular-nums", e.c.rate >= 80 ? "text-emerald-600" : e.c.rate >= 50 ? "text-amber-600" : "text-rose-600")}>
                                {e.c.rate}%
                              </span>
                            ) : e.isLead ? (
                              <span className="text-violet-700">Team lead</span>
                            ) : (
                              <span className="text-ink-300">None</span>
                            )}
                          </dd>
                        </div>
                      </dl>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          </>
        )}
      </Card>

      <p className="mt-3 text-xs text-ink-400">Consistency = weeks submitted ÷ weeks expected across {weeks.length} tracked weeks.</p>

      <Modal
        open={!!draft}
        onClose={() => setDraft(null)}
        title={editing ? "Edit person" : "Add person"}
        subtitle="Writes to the people collection"
        size="md"
        footer={
          <>
            <button className="btn-outline" onClick={() => setDraft(null)}>Cancel</button>
            <button className="btn-primary" onClick={save} disabled={!draft?.name.trim() || !isValidPhone(draft?.phone ?? "") || !draft?.department?.trim() || !draft?.teamLead?.trim()}>
              {editing ? "Save changes" : "Add person"}
            </button>
          </>
        }
      >
        {draft && <PersonForm value={draft} onChange={setDraft} />}
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && deletePerson(deleteId)}
        title="Remove person?"
        message="This person will be removed from the roster. Their past submissions remain."
        confirmLabel="Remove"
      />

      <Modal
        open={!!nudgePerson}
        onClose={() => setNudgePerson(null)}
        title="Send a reminder"
        subtitle="This person hasn't submitted their update for this week yet."
        size="sm"
        hideClose
        dismissable={false}
        footer={
          nudgeState === "sent" ? (
            <button className="btn-primary" onClick={() => setNudgePerson(null)}>Done</button>
          ) : (
            <button className="btn-primary flex items-center gap-2" onClick={handleSendNudge} disabled={nudgeState === "sending"}>
              {nudgeState === "sending" ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              {nudgeState === "sending" ? "Sending…" : nudgeState === "error" ? "Retry" : "Submit"}
            </button>
          )
        }
      >
        {nudgePerson && (
          <div className="px-5 py-4">
            {nudgeState === "sent" ? (
              <div className="flex items-center gap-3 rounded-xl bg-emerald-50 px-4 py-3 text-emerald-700">
                <CheckCircle2 size={20} className="shrink-0" />
                <p className="text-sm font-medium">Reminder sent to {nudgePerson.name}.</p>
              </div>
            ) : (
              <>
                <p className="text-sm text-ink-600">
                  This will send <span className="font-semibold text-ink-800">{nudgePerson.name}</span> a
                  weekly alignment reminder on WhatsApp.
                </p>
                {nudgeState === "error" && (
                  <p className="mt-3 flex items-center gap-1.5 text-xs text-rose-500">
                    <X size={13} /> Couldn't send the message. Please try again.
                  </p>
                )}
              </>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
