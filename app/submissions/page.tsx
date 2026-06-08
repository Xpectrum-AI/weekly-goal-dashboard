"use client";

import { useMemo, useState } from "react";
import {
  MessageCircle,
  Pencil,
  Trash2,
  Eye,
  Plus,
  Download,
  Phone,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { FilterBar } from "@/components/ui/FilterBar";
import { StatusBadge, CountPill, ThemeChip } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { ProgressBar } from "@/components/ui/Progress";
import { Modal, ConfirmDialog } from "@/components/ui/Modal";
import { EmptyState, TableSkeleton } from "@/components/ui/States";
import { SubmissionForm, emptySubmission, type SubmissionDraft } from "@/components/forms/SubmissionForm";
import { useStore } from "@/lib/store";
import { useLoaded, useWeeks, useFacets, useScope, useThemeIndex } from "@/lib/hooks";
import { scoreAll } from "@/lib/analytics";
import { exportSubmissionsCSV, exportSubmissionsFullCSV } from "@/lib/export";
import { weekLabel, formatDateTime, cn } from "@/lib/utils";
import type { WeeklySubmission, ScoredSubmission } from "@/lib/types";

export default function SubmissionsPage() {
  const hydrated = useLoaded();
  const { weeks, currentWeek } = useWeeks();
  const { departments, teamLeads } = useFacets();
  const { submissions, roster } = useScope();
  const themeIdx = useThemeIndex();
  const people = useStore((s) => s.people);
  const addSubmission = useStore((s) => s.addSubmission);
  const updateSubmission = useStore((s) => s.updateSubmission);
  const deleteSubmission = useStore((s) => s.deleteSubmission);

  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState<SubmissionDraft | null>(null);
  const [editing, setEditing] = useState<WeeklySubmission | null>(null);
  const [viewing, setViewing] = useState<ScoredSubmission | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);

  const rows = useMemo(() => {
    const scored = scoreAll(submissions);
    return scored
      .filter((s) => {
        if (filters.week && filters.week !== "all" && s.week !== filters.week) return false;
        if (filters.dept && filters.dept !== "all" && s.department !== filters.dept) return false;
        if (filters.lead && filters.lead !== "all" && s.teamLead !== filters.lead) return false;
        if (filters.person && filters.person !== "all" && s.personName !== filters.person) return false;
        if (filters.status && filters.status !== "all" && s.status !== filters.status) return false;
        if (search) {
          const blob = `${s.personName} ${s.topPriority} ${s.actions.join(" ")} ${s.blockers.join(" ")}`.toLowerCase();
          if (!blob.includes(search.toLowerCase())) return false;
        }
        return true;
      })
      .sort((a, b) => (b.submittedAt || "").localeCompare(a.submittedAt || ""));
  }, [submissions, filters, search]);

  function openNew() {
    setEditing(null);
    setDraft(emptySubmission(people[0], currentWeek));
  }
  function openEdit(s: WeeklySubmission) {
    setEditing(s);
    const { _id, ...rest } = s;
    setDraft(rest);
  }
  function save() {
    if (!draft) return;
    if (editing) updateSubmission(editing._id, draft);
    else addSubmission(draft);
    setDraft(null);
    setEditing(null);
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Weekly Submissions"
        description="Every weekly WhatsApp update, scored for completeness"
        actions={
          <>
            <div className="relative">
              <button className="btn-outline" onClick={() => setShowExportMenu(!showExportMenu)}>
                <Download size={16} /> Export
              </button>
              {showExportMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowExportMenu(false)} />
                  <div className="absolute right-0 top-full z-20 mt-1 w-56 rounded-lg border border-ink-200 bg-white py-1 shadow-lg">
                    <button
                      className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-ink-700 hover:bg-ink-50"
                      onClick={() => {
                        exportSubmissionsCSV(rows, "weekly_submissions");
                        setShowExportMenu(false);
                      }}
                    >
                      <Download size={14} />
                      <div>
                        <p className="font-medium">Template format</p>
                        <p className="text-[11px] text-ink-400">Compatible with import</p>
                      </div>
                    </button>
                    <button
                      className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-ink-700 hover:bg-ink-50"
                      onClick={() => {
                        exportSubmissionsFullCSV(rows, "weekly_submissions_full");
                        setShowExportMenu(false);
                      }}
                    >
                      <Download size={14} />
                      <div>
                        <p className="font-medium">Full export</p>
                        <p className="text-[11px] text-ink-400">Includes all metadata</p>
                      </div>
                    </button>
                  </div>
                </>
              )}
            </div>
            <button className="btn-primary" onClick={openNew}>
              <Plus size={16} /> Log update
            </button>
          </>
        }
      />

      <Card className="mb-4 p-4">
        <FilterBar
          search={search}
          onSearch={setSearch}
          searchPlaceholder="Search person, priority, blocker text…"
          values={filters}
          onChange={(k, v) => setFilters((f) => ({ ...f, [k]: v }))}
          onClear={() => {
            setFilters({});
            setSearch("");
          }}
          filters={[
            { key: "week", label: "Week", options: weeks.map((w) => ({ value: w, label: weekLabel(w) })) },
            { key: "dept", label: "Dept", options: departments.map((d) => ({ value: d, label: d })) },
            { key: "lead", label: "Lead", options: teamLeads.map((l) => ({ value: l, label: l })) },
            { key: "person", label: "Person", options: roster.map((r) => ({ value: r.name, label: r.name })) },
            { key: "status", label: "Status", options: ["Complete", "Partial", "Weak"].map((s) => ({ value: s, label: s })) },
          ]}
        />
      </Card>

      <Card>
        {!hydrated ? (
          <TableSkeleton />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={MessageCircle}
            title="No submissions found"
            description="Adjust your filters, or log an update manually."
            action={<button className="btn-primary" onClick={openNew}><Plus size={16} /> Log update</button>}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-left text-xs font-semibold uppercase tracking-wide text-ink-400">
                  <th className="px-5 py-3">Person</th>
                  <th className="px-3 py-3">Team lead</th>
                  <th className="px-3 py-3">Week</th>
                  <th className="px-3 py-3">Top priority</th>
                  <th className="px-3 py-3 text-center">Actions</th>
                  <th className="px-3 py-3 text-center">Outcomes</th>
                  <th className="px-3 py-3 text-center">Blockers</th>
                  <th className="px-3 py-3 w-36">Completeness</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-5 py-3 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {rows.map((s) => (
                  <tr
                    key={s._id}
                    className="group cursor-pointer transition hover:bg-ink-50/60"
                    onClick={() => setViewing(s)}
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={s.personName} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-ink-800">{s.personName}</p>
                          <p className="text-[11px] text-ink-400">{s.department}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-ink-600">{s.teamLead}</td>
                    <td className="px-3 py-3 whitespace-nowrap text-ink-600">{weekLabel(s.week)}</td>
                    <td className="max-w-[220px] px-3 py-3">
                      {themeIdx.priority[s._id] ? (
                        <ThemeChip theme={themeIdx.priority[s._id]} />
                      ) : s.topPriority ? (
                        <span className="text-xs text-ink-500 truncate block">{s.topPriority}</span>
                      ) : (
                        <span className="text-xs italic text-ink-300">none stated</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-center tabular-nums text-ink-600">{s.actionCount}</td>
                    <td className="px-3 py-3 text-center tabular-nums text-ink-600">{s.outcomeCount}</td>
                    <td className="px-3 py-3 text-center">
                      {s.blockerCount > 0 ? (
                        <span className="font-semibold text-rose-600 tabular-nums">{s.blockerCount}</span>
                      ) : (
                        <span className="text-ink-300">0</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <ProgressBar value={s.completeness} showLabel />
                    </td>
                    <td className="px-3 py-3">
                      <StatusBadge status={s.status} />
                    </td>
                    <td className="px-5 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-0.5 opacity-0 transition group-hover:opacity-100">
                        <IconBtn title="View raw" onClick={() => setViewing(s)}><Eye size={15} /></IconBtn>
                        <IconBtn title="Edit" onClick={() => openEdit(s)}><Pencil size={15} /></IconBtn>
                        <IconBtn title="Delete" danger onClick={() => setDeleteId(s._id)}><Trash2 size={15} /></IconBtn>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {hydrated && rows.length > 0 && (
        <p className="mt-3 text-xs text-ink-400">Showing {rows.length} of {submissions.length} submissions</p>
      )}

      {/* Create / edit */}
      <Modal
        open={!!draft}
        onClose={() => setDraft(null)}
        title={editing ? "Edit submission" : "Log weekly update"}
        subtitle="Writes to the weekly_submissions collection"
        size="lg"
        footer={
          <>
            <button className="btn-outline" onClick={() => setDraft(null)}>Cancel</button>
            <button className="btn-primary" onClick={save} disabled={!draft?.personId || (!draft?.topPriority.trim() && draft?.actions.length === 0)}>
              {editing ? "Save changes" : "Add submission"}
            </button>
          </>
        }
      >
        {draft && <SubmissionForm value={draft} onChange={setDraft} />}
      </Modal>

      {/* Raw drill-down */}
      <Modal
        open={!!viewing}
        onClose={() => setViewing(null)}
        title="Raw submission"
        size="lg"
        footer={<button className="btn-outline" onClick={() => setViewing(null)}>Close</button>}
      >
        {viewing && <SubmissionDetail s={viewing} />}
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && deleteSubmission(deleteId)}
        title="Delete submission?"
        message="This weekly update will be permanently removed."
      />
    </div>
  );
}

function IconBtn({ children, onClick, title, danger }: { children: React.ReactNode; onClick: () => void; title: string; danger?: boolean }) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={cn("rounded-lg p-1.5 transition", danger ? "text-ink-400 hover:bg-rose-50 hover:text-rose-600" : "text-ink-400 hover:bg-ink-100 hover:text-ink-700")}
    >
      {children}
    </button>
  );
}

function SubmissionDetail({ s }: { s: ScoredSubmission }) {
  const people = useStore((st) => st.people);
  const person = people.find((p) => p._id === s.personId);
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Avatar name={s.personName} color={person?.avatarColor} size="lg" />
        <div>
          <p className="font-semibold text-ink-900">{s.personName}</p>
          <p className="text-xs text-ink-400">
            {s.department} · {s.teamLead} · {weekLabel(s.week)}
          </p>
        </div>
        <div className="ml-auto"><StatusBadge status={s.status} /></div>
      </div>

      {person?.phone && (
        <div className="flex items-center gap-1.5 text-xs text-ink-500">
          <Phone size={13} /> {person.phone}
        </div>
      )}

      <div className="rounded-xl bg-ink-50 p-3">
        <div className="mb-1 flex items-center justify-between text-xs">
          <span className="font-medium text-ink-600">Response completeness</span>
          <span className="font-semibold text-ink-800">{s.completeness}%</span>
        </div>
        <ProgressBar value={s.completeness} />
        <div className="mt-2 flex gap-2">
          <CountPill value={s.actionCount} label="actions" />
          <CountPill value={s.outcomeCount} label="outcomes" tone="emerald" />
          <CountPill value={s.blockerCount} label="blockers" tone={s.blockerCount ? "rose" : "ink"} />
        </div>
      </div>

      {s.topPriority && <Block label="Top priority">{s.topPriority}</Block>}

      {s.actions.length > 0 && (
        <Block label="Actions">
          <ul className="list-inside list-disc space-y-0.5">{s.actions.map((a, i) => <li key={i}>{a}</li>)}</ul>
        </Block>
      )}
      {s.outcomes.length > 0 && (
        <Block label="Outcomes">
          <ul className="list-inside list-disc space-y-0.5">{s.outcomes.map((o, i) => <li key={i}>{o}</li>)}</ul>
        </Block>
      )}
      {s.blockers.length > 0 && (
        <div>
          <p className="label">Blockers</p>
          <div className="flex flex-wrap gap-1.5">
            {s.blockers.map((b, i) => (
              <span key={i} className="rounded-md bg-rose-50 px-2 py-1 text-xs text-rose-700">{b}</span>
            ))}
          </div>
        </div>
      )}

      {s.notes && <Block label="Notes">{s.notes}</Block>}

      <p className="text-[11px] text-ink-400">Received {formatDateTime(s.submittedAt)}</p>
    </div>
  );
}

function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="label">{label}</p>
      <div className="text-sm leading-relaxed text-ink-700">{children}</div>
    </div>
  );
}
