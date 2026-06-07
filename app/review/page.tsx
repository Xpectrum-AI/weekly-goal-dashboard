"use client";

import { useState, useEffect, useMemo, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ChevronRight,
  ArrowLeft,
  Plus,
  X,
  Save,
  Trash2,
  CheckCheck,
  FileSpreadsheet,
  Eye,
  Code,
  Users,
  Calendar,
  Download,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { Field, TextInput, TextArea, Select } from "@/components/ui/Form";
import { Avatar } from "@/components/ui/Avatar";
import { StatusBadge } from "@/components/ui/Badge";
import { Modal, ConfirmDialog } from "@/components/ui/Modal";
import { EmptyState, TableSkeleton } from "@/components/ui/States";
import { useStore } from "@/lib/store";
import { useLoaded, useWeeks } from "@/lib/hooks";
import { api } from "@/lib/api";
import { weekLabel, cn } from "@/lib/utils";
import { exportExtractedSubmissionsCSV } from "@/lib/export";
import type { ExtractedSubmission, Upload, ValidationIssue, Person } from "@/lib/types";
import { WEEKS } from "@/lib/mock-data";

type ViewMode = "table" | "sideBySide";

export default function ReviewPage() {
  return (
    <Suspense fallback={<div className="animate-fade-in"><PageHeader title="Review Submissions" description="Loading..." /><TableSkeleton /></div>}>
      <ReviewPageContent />
    </Suspense>
  );
}

function ReviewPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const uploadId = searchParams.get("uploadId");
  
  const hydrated = useLoaded();
  const people = useStore((s) => s.people);
  const pushToast = useStore((s) => s.pushToast);
  const reload = useStore((s) => s.reload);
  const { weeks } = useWeeks();
  
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [submissions, setSubmissions] = useState<ExtractedSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [filters, setFilters] = useState({
    week: "all",
    department: "all",
    person: "all",
    status: "all",
  });
  const [showEditor, setShowEditor] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);

  // Load data
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [uploadsData, subsData] = await Promise.all([
          api.listUploads(),
          uploadId ? api.listExtractedSubmissions(uploadId) : api.listExtractedSubmissions(),
        ]);
        setUploads(uploadsData);
        setSubmissions(subsData);
      } catch (e) {
        pushToast("Failed to load data", "error");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [uploadId, pushToast]);

  // Filter submissions
  const filteredSubmissions = useMemo(() => {
    return submissions.filter((s) => {
      if (filters.week !== "all" && s.week !== filters.week) return false;
      if (filters.department !== "all" && s.department !== filters.department) return false;
      if (filters.person !== "all" && s.personName !== filters.person) return false;
      if (filters.status !== "all" && s.validation.status !== filters.status) return false;
      return true;
    });
  }, [submissions, filters]);

  // Group by week
  const groupedByWeek = useMemo(() => {
    const groups: Record<string, { ready: number; warnings: number; errors: number; all: ExtractedSubmission[] }> = {};
    filteredSubmissions.forEach((s) => {
      const week = s.week || "Unknown";
      if (!groups[week]) groups[week] = { ready: 0, warnings: 0, errors: 0, all: [] };
      groups[week].all.push(s);
      if (s.validation.status === "ready") groups[week].ready++;
      else if (s.validation.status === "warning") groups[week].warnings++;
      else groups[week].errors++;
    });
    return groups;
  }, [filteredSubmissions]);

  // Get unique values for filters
  const uniqueWeeks = useMemo(() => [...new Set(submissions.map((s) => s.week).filter(Boolean))], [submissions]);
  const uniqueDepts = useMemo(() => [...new Set(submissions.map((s) => s.department).filter(Boolean))], [submissions]);
  const uniquePersons = useMemo(() => [...new Set(submissions.map((s) => s.personName).filter(Boolean))], [submissions]);

  // Selected submission
  const selected = useMemo(
    () => submissions.find((s) => s._id === selectedId) ?? null,
    [submissions, selectedId]
  );

  // Stats
  const stats = useMemo(() => {
    const ready = submissions.filter((s) => s.validation.status === "ready").length;
    const warnings = submissions.filter((s) => s.validation.status === "warning").length;
    const errors = submissions.filter((s) => s.validation.status === "error").length;
    const reviewed = submissions.filter((s) => s.reviewed).length;
    return { ready, warnings, errors, reviewed, total: submissions.length };
  }, [submissions]);

  // Update submission
  const updateSubmission = useCallback(async (id: string, patch: Partial<ExtractedSubmission>) => {
    try {
      const updated = await api.updateExtractedSubmission(id, patch);
      setSubmissions((prev) => prev.map((s) => (s._id === id ? updated : s)));
      return updated;
    } catch (e) {
      pushToast("Failed to update", "error");
      throw e;
    }
  }, [pushToast]);

  // Mark as reviewed
  const markReviewed = useCallback(async (id: string) => {
    await updateSubmission(id, { reviewed: true, reviewedAt: new Date().toISOString() });
    pushToast("Marked as reviewed");
  }, [updateSubmission, pushToast]);

  // Delete submission
  const deleteSubmission = useCallback(async (id: string) => {
    try {
      await api.deleteExtractedSubmission(id);
      setSubmissions((prev) => prev.filter((s) => s._id !== id));
      if (selectedId === id) setSelectedId(null);
      pushToast("Submission deleted", "info");
    } catch (e) {
      pushToast("Failed to delete", "error");
    }
  }, [selectedId, pushToast]);

  // Approve all reviewed submissions
  const approveAll = useCallback(async () => {
    if (!uploadId) return;
    setApproving(true);
    try {
      const result = await api.approveExtractedSubmissions({ uploadId });
      pushToast(`Approved ${result.approved} submissions`);
      await reload();
      // Refresh data
      const [uploadsData, subsData] = await Promise.all([
        api.listUploads(),
        api.listExtractedSubmissions(uploadId),
      ]);
      setUploads(uploadsData);
      setSubmissions(subsData);
    } catch (e) {
      pushToast("Approval failed", "error");
    } finally {
      setApproving(false);
    }
  }, [uploadId, pushToast, reload]);

  // Current upload
  const currentUpload = useMemo(() => uploads.find((u) => u._id === uploadId), [uploads, uploadId]);

  if (!hydrated || loading) {
    return (
      <div className="animate-fade-in">
        <PageHeader title="Review Submissions" description="Loading..." />
        <TableSkeleton />
      </div>
    );
  }

  // If no uploadId, show upload selection
  if (!uploadId) {
    return (
      <div className="animate-fade-in">
        <PageHeader
          title="Review Submissions"
          description="Select an upload to review extracted submissions"
        />
        <Card>
          {uploads.length === 0 ? (
            <EmptyState
              icon={FileSpreadsheet}
              title="No uploads to review"
              description="Upload Excel files to extract and review submissions"
              action={
                <button className="btn-primary" onClick={() => router.push("/import")}>
                  <Plus size={16} /> Upload Files
                </button>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink-100 text-left text-xs font-semibold uppercase tracking-wide text-ink-400">
                    <th className="px-5 py-3">File</th>
                    <th className="px-3 py-3">Uploaded</th>
                    <th className="px-3 py-3 text-center">Total</th>
                    <th className="px-3 py-3 text-center">Ready</th>
                    <th className="px-3 py-3 text-center">Warnings</th>
                    <th className="px-3 py-3 text-center">Errors</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-5 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {uploads.map((u) => (
                    <tr
                      key={u._id}
                      className="cursor-pointer transition hover:bg-ink-50"
                      onClick={() => router.push(`/review?uploadId=${u._id}`)}
                    >
                      <td className="px-5 py-3 font-medium text-ink-800">{u.fileName}</td>
                      <td className="px-3 py-3 text-ink-500">{new Date(u.uploadedAt).toLocaleString()}</td>
                      <td className="px-3 py-3 text-center">{u.totalRows}</td>
                      <td className="px-3 py-3 text-center text-emerald-600">{u.readyCount}</td>
                      <td className="px-3 py-3 text-center text-amber-600">{u.warningCount}</td>
                      <td className="px-3 py-3 text-center text-rose-600">{u.errorCount}</td>
                      <td className="px-3 py-3">
                        <UploadStatusBadge status={u.status} />
                      </td>
                      <td className="px-5 py-3">
                        <ChevronRight size={16} className="text-ink-300" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Review Submissions"
        description={currentUpload ? `Reviewing: ${currentUpload.fileName}` : "Review extracted submissions"}
        actions={
          <>
            <button className="btn-outline" onClick={() => router.push("/review")}>
              <ArrowLeft size={16} /> Back to uploads
            </button>
            <button
              className="btn-outline"
              onClick={() => exportExtractedSubmissionsCSV(filteredSubmissions, `extracted_submissions${uploadId ? `_${uploadId}` : ""}`)}
              disabled={filteredSubmissions.length === 0}
            >
              <Download size={16} /> Export
            </button>
            <button
              className="btn-primary"
              onClick={approveAll}
              disabled={approving || stats.reviewed === 0}
            >
              <CheckCheck size={16} />
              {approving ? "Approving..." : `Approve ${stats.reviewed} reviewed`}
            </button>
          </>
        }
      />

      {/* Stats Cards */}
      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <StatsCard
          label="Ready"
          value={stats.ready}
          color="emerald"
          icon={CheckCircle2}
          onClick={() => setFilters((f) => ({ ...f, status: f.status === "ready" ? "all" : "ready" }))}
          active={filters.status === "ready"}
        />
        <StatsCard
          label="Warnings"
          value={stats.warnings}
          color="amber"
          icon={AlertTriangle}
          onClick={() => setFilters((f) => ({ ...f, status: f.status === "warning" ? "all" : "warning" }))}
          active={filters.status === "warning"}
        />
        <StatsCard
          label="Errors"
          value={stats.errors}
          color="rose"
          icon={XCircle}
          onClick={() => setFilters((f) => ({ ...f, status: f.status === "error" ? "all" : "error" }))}
          active={filters.status === "error"}
        />
        <StatsCard
          label="Reviewed"
          value={stats.reviewed}
          total={stats.total}
          color="sky"
          icon={Eye}
        />
      </div>

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Panel - List */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader
              title="Submissions"
              subtitle={`${filteredSubmissions.length} of ${stats.total}`}
              className="border-b border-ink-100"
            />
            <div className="border-b border-ink-100 p-3">
              <div className="grid gap-2 sm:grid-cols-2">
                <Select
                  value={filters.week}
                  onChange={(e) => setFilters((f) => ({ ...f, week: e.target.value }))}
                >
                  <option value="all">All Weeks</option>
                  {uniqueWeeks.map((w) => (
                    <option key={w} value={w}>{weekLabel(w)}</option>
                  ))}
                </Select>
                <Select
                  value={filters.status}
                  onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
                >
                  <option value="all">All Status</option>
                  <option value="ready">Ready</option>
                  <option value="warning">Warnings</option>
                  <option value="error">Errors</option>
                </Select>
              </div>
            </div>
            <div className="max-h-[calc(100vh-400px)] overflow-y-auto">
              {filteredSubmissions.length === 0 ? (
                <div className="p-8 text-center text-sm text-ink-400">No submissions match filters</div>
              ) : (
                filteredSubmissions.map((s) => (
                  <SubmissionRow
                    key={s._id}
                    submission={s}
                    selected={selectedId === s._id}
                    onClick={() => setSelectedId(s._id)}
                  />
                ))
              )}
            </div>
          </Card>
        </div>

        {/* Right Panel - Detail/Editor */}
        <div className="lg:col-span-2">
          {selected ? (
            <SubmissionDetail
              submission={selected}
              people={people}
              weeks={weeks}
              onUpdate={(patch) => updateSubmission(selected._id, patch)}
              onMarkReviewed={() => markReviewed(selected._id)}
              onDelete={() => setDeleteId(selected._id)}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
            />
          ) : (
            <Card className="flex h-96 items-center justify-center">
              <div className="text-center text-ink-400">
                <FileSpreadsheet size={48} className="mx-auto mb-4 opacity-30" />
                <p>Select a submission to review</p>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteId}
        title="Delete submission?"
        message="This will permanently remove this extracted submission."
        confirmLabel="Delete"
        onConfirm={() => {
          if (deleteId) deleteSubmission(deleteId);
          setDeleteId(null);
        }}
        onClose={() => setDeleteId(null)}
      />
    </div>
  );
}

// ── Helper Components ─────────────────────────────────────────────────────────

function UploadStatusBadge({ status }: { status: Upload["status"] }) {
  const styles = {
    processing: "bg-sky-100 text-sky-700",
    review_pending: "bg-amber-100 text-amber-700",
    approved: "bg-emerald-100 text-emerald-700",
    partial: "bg-violet-100 text-violet-700",
    rejected: "bg-rose-100 text-rose-700",
  };
  const labels = {
    processing: "Processing",
    review_pending: "Review Pending",
    approved: "Approved",
    partial: "Partial",
    rejected: "Rejected",
  };
  return (
    <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold", styles[status])}>
      {labels[status]}
    </span>
  );
}

function StatsCard({
  label,
  value,
  total,
  color,
  icon: Icon,
  onClick,
  active,
}: {
  label: string;
  value: number;
  total?: number;
  color: "emerald" | "amber" | "rose" | "sky";
  icon: React.ElementType;
  onClick?: () => void;
  active?: boolean;
}) {
  const colors = {
    emerald: "text-emerald-600 bg-emerald-50",
    amber: "text-amber-600 bg-amber-50",
    rose: "text-rose-600 bg-rose-50",
    sky: "text-sky-600 bg-sky-50",
  };
  return (
    <div
      className={cn(
        "card cursor-pointer p-4 transition hover:shadow-md",
        active && "ring-2 ring-emerald-500"
      )}
      onClick={onClick}
    >
      <div className="flex items-center gap-3">
        <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", colors[color])}>
          <Icon size={20} />
        </div>
        <div>
          <p className="text-2xl font-bold text-ink-800">
            {value}
            {total !== undefined && <span className="text-sm font-normal text-ink-400">/{total}</span>}
          </p>
          <p className="text-xs text-ink-500">{label}</p>
        </div>
      </div>
    </div>
  );
}

function SubmissionRow({
  submission,
  selected,
  onClick,
}: {
  submission: ExtractedSubmission;
  selected: boolean;
  onClick: () => void;
}) {
  const statusIcon = {
    ready: <CheckCircle2 size={14} className="text-emerald-500" />,
    warning: <AlertTriangle size={14} className="text-amber-500" />,
    error: <XCircle size={14} className="text-rose-500" />,
  };
  return (
    <div
      className={cn(
        "flex cursor-pointer items-center gap-3 border-b border-ink-100 px-4 py-3 transition hover:bg-ink-50",
        selected && "bg-emerald-50"
      )}
      onClick={onClick}
    >
      <Avatar name={submission.personName || "?"} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium text-ink-800">
            {submission.personName || "Unknown"}
          </span>
          {submission.reviewed && (
            <CheckCircle2 size={12} className="shrink-0 text-emerald-500" />
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-ink-400">
          <span>{submission.week ? weekLabel(submission.week) : "No week"}</span>
          <span>·</span>
          <span>{submission.actions.length} actions</span>
        </div>
      </div>
      {statusIcon[submission.validation.status]}
    </div>
  );
}

function SubmissionDetail({
  submission,
  people,
  weeks,
  onUpdate,
  onMarkReviewed,
  onDelete,
  viewMode,
  onViewModeChange,
}: {
  submission: ExtractedSubmission;
  people: Person[];
  weeks: string[];
  onUpdate: (patch: Partial<ExtractedSubmission>) => Promise<ExtractedSubmission>;
  onMarkReviewed: () => void;
  onDelete: () => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(submission);
  const [saving, setSaving] = useState(false);

  // Reset draft when submission changes
  useEffect(() => {
    setDraft(submission);
    setEditing(false);
  }, [submission._id]);

  const save = async () => {
    setSaving(true);
    try {
      await onUpdate({
        personId: draft.personId,
        personName: draft.personName,
        department: draft.department,
        teamLead: draft.teamLead,
        week: draft.week,
        topPriority: draft.topPriority,
        actions: draft.actions,
        outcomes: draft.outcomes,
        blockers: draft.blockers,
        notes: draft.notes,
      });
      setEditing(false);
    } catch {
      // error handled in parent
    } finally {
      setSaving(false);
    }
  };

  const selectPerson = (personId: string) => {
    const person = people.find((p) => p._id === personId);
    if (person) {
      setDraft((d) => ({
        ...d,
        personId: person._id,
        personName: person.name,
        department: person.department,
        teamLead: person.teamLead ?? "",
      }));
    }
  };

  return (
    <Card>
      <CardHeader
        title="Submission Details"
        subtitle={submission.reviewed ? "Reviewed" : "Pending review"}
        className="border-b border-ink-100"
        action={
          <div className="flex gap-2">
            <button
              className={cn("rounded-lg p-2 transition", viewMode === "table" ? "bg-ink-100" : "hover:bg-ink-50")}
              onClick={() => onViewModeChange("table")}
              title="Editor view"
            >
              <FileSpreadsheet size={16} />
            </button>
            <button
              className={cn("rounded-lg p-2 transition", viewMode === "sideBySide" ? "bg-ink-100" : "hover:bg-ink-50")}
              onClick={() => onViewModeChange("sideBySide")}
              title="Side-by-side view"
            >
              <Code size={16} />
            </button>
          </div>
        }
      />

      {/* Validation Issues Banner */}
      {submission.validation.issues.length > 0 && (
        <div className="border-b border-ink-100 bg-amber-50 p-4">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-800">
            <AlertTriangle size={16} />
            Extraction Warnings
          </h3>
          <div className="space-y-1">
            {submission.validation.issues.map((issue, i) => (
              <ValidationIssueRow key={i} issue={issue} />
            ))}
          </div>
        </div>
      )}

      <CardBody className="p-0">
        {viewMode === "sideBySide" ? (
          <SideBySideView submission={submission} />
        ) : (
          <div className="p-5">
            <div className="space-y-4">
              {/* Person & Week */}
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Employee" required>
                  {editing ? (
                    <Select
                      value={draft.personId ?? ""}
                      onChange={(e) => selectPerson(e.target.value)}
                    >
                      <option value="">— Select person —</option>
                      {people.map((p) => (
                        <option key={p._id} value={p._id}>
                          {p.name} — {p.department}
                        </option>
                      ))}
                    </Select>
                  ) : (
                    <div className="flex items-center gap-2 rounded-lg bg-ink-50 px-3 py-2">
                      <Avatar name={submission.personName || "?"} size="sm" />
                      <span className="font-medium">{submission.personName || "Not mapped"}</span>
                    </div>
                  )}
                </Field>
                <Field label="Week" required>
                  {editing ? (
                    <Select
                      value={draft.week}
                      onChange={(e) => setDraft((d) => ({ ...d, week: e.target.value }))}
                    >
                      <option value="">— Select week —</option>
                      {WEEKS.map((w) => (
                        <option key={w} value={w}>{weekLabel(w)}</option>
                      ))}
                    </Select>
                  ) : (
                    <div className="flex items-center gap-2 rounded-lg bg-ink-50 px-3 py-2">
                      <Calendar size={16} className="text-ink-400" />
                      <span className="font-medium">{submission.week ? weekLabel(submission.week) : "Not detected"}</span>
                    </div>
                  )}
                </Field>
              </div>

              {/* Top Priority */}
              <Field label="Top Priority">
                {editing ? (
                  <TextArea
                    value={draft.topPriority}
                    onChange={(e) => setDraft((d) => ({ ...d, topPriority: e.target.value }))}
                    rows={2}
                    placeholder="Main focus for the week..."
                  />
                ) : (
                  <div className="rounded-lg bg-ink-50 p-3 text-sm">
                    {submission.topPriority || <span className="italic text-ink-400">Not specified</span>}
                  </div>
                )}
              </Field>

              {/* Actions */}
              <Field label="Actions" hint={`${draft.actions.length} item(s)`}>
                {editing ? (
                  <ListEditor
                    value={draft.actions}
                    onChange={(v) => setDraft((d) => ({ ...d, actions: v }))}
                    placeholder="Add action..."
                  />
                ) : (
                  <ListDisplay items={submission.actions} emptyText="No actions listed" />
                )}
              </Field>

              {/* Outcomes */}
              <Field label="Outcomes" hint={`${draft.outcomes.length} item(s)`}>
                {editing ? (
                  <ListEditor
                    value={draft.outcomes}
                    onChange={(v) => setDraft((d) => ({ ...d, outcomes: v }))}
                    placeholder="Add outcome..."
                    tone="emerald"
                  />
                ) : (
                  <ListDisplay items={submission.outcomes} emptyText="No outcomes listed" tone="emerald" />
                )}
              </Field>

              {/* Blockers */}
              <Field label="Blockers">
                {editing ? (
                  <ListEditor
                    value={draft.blockers}
                    onChange={(v) => setDraft((d) => ({ ...d, blockers: v }))}
                    placeholder="Add blocker..."
                    tone="rose"
                  />
                ) : (
                  <ListDisplay items={submission.blockers} emptyText="No blockers" tone="rose" />
                )}
              </Field>

              {/* Notes */}
              <Field label="Notes">
                {editing ? (
                  <TextArea
                    value={draft.notes}
                    onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
                    rows={3}
                    placeholder="Additional notes..."
                  />
                ) : (
                  <div className="rounded-lg bg-ink-50 p-3 text-sm">
                    {submission.notes || <span className="italic text-ink-400">No notes</span>}
                  </div>
                )}
              </Field>
            </div>

            {/* Actions */}
            <div className="mt-6 flex flex-wrap gap-2 border-t border-ink-100 pt-4">
              {editing ? (
                <>
                  <button className="btn-primary" onClick={save} disabled={saving}>
                    <Save size={16} /> {saving ? "Saving..." : "Save"}
                  </button>
                  <button className="btn-outline" onClick={() => { setDraft(submission); setEditing(false); }}>
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <button className="btn-outline" onClick={() => setEditing(true)}>
                    Edit
                  </button>
                  {!submission.reviewed && (
                    <button
                      className="btn-primary"
                      onClick={onMarkReviewed}
                      disabled={submission.validation.status === "error"}
                    >
                      <CheckCircle2 size={16} /> Mark Reviewed
                    </button>
                  )}
                  <button className="btn-outline text-rose-600 hover:bg-rose-50" onClick={onDelete}>
                    <Trash2 size={16} /> Delete
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function ValidationIssueRow({ issue }: { issue: ValidationIssue }) {
  const icons = {
    warning: <AlertTriangle size={14} className="shrink-0 text-amber-500" />,
    error: <XCircle size={14} className="shrink-0 text-rose-500" />,
  };
  const colors = {
    warning: "text-amber-800",
    error: "text-rose-800",
  };
  return (
    <div className={cn("flex items-center gap-2 text-sm", colors[issue.severity])}>
      {icons[issue.severity]}
      <span>{issue.message}</span>
      {issue.field && <span className="text-xs opacity-60">({issue.field})</span>}
    </div>
  );
}

function SideBySideView({ submission }: { submission: ExtractedSubmission }) {
  return (
    <div className="grid h-[500px] grid-cols-2 divide-x divide-ink-200">
      {/* Left: Raw Excel Data */}
      <div className="flex flex-col">
        <div className="border-b border-ink-100 bg-ink-50 px-4 py-2">
          <h3 className="font-semibold text-ink-700">Excel Cell Data</h3>
          <p className="text-xs text-ink-400">Raw values from the spreadsheet</p>
        </div>
        <div className="flex-1 overflow-auto p-4">
          <pre className="text-xs leading-relaxed">
            {Object.entries(submission.rawData).map(([key, value]) => (
              <div key={key} className="mb-2">
                <span className="font-semibold text-sky-600">{key}:</span>{" "}
                <span className="text-ink-600">{String(value) || "(empty)"}</span>
              </div>
            ))}
          </pre>
        </div>
      </div>

      {/* Right: Parsed JSON */}
      <div className="flex flex-col">
        <div className="border-b border-ink-100 bg-emerald-50 px-4 py-2">
          <h3 className="font-semibold text-emerald-700">Parsed JSON</h3>
          <p className="text-xs text-emerald-500">Normalized data structure</p>
        </div>
        <div className="flex-1 overflow-auto p-4">
          <pre className="text-xs leading-relaxed">
            <JsonField label="personId" value={submission.personId} />
            <JsonField label="personName" value={submission.personName} />
            <JsonField label="department" value={submission.department} />
            <JsonField label="teamLead" value={submission.teamLead} />
            <JsonField label="week" value={submission.week} />
            <JsonField label="topPriority" value={submission.topPriority} />
            <JsonField label="actions" value={submission.actions} isArray />
            <JsonField label="outcomes" value={submission.outcomes} isArray />
            <JsonField label="blockers" value={submission.blockers} isArray />
            <JsonField label="notes" value={submission.notes} />
          </pre>
        </div>
      </div>
    </div>
  );
}

function JsonField({ label, value, isArray }: { label: string; value: any; isArray?: boolean }) {
  if (isArray) {
    return (
      <div className="mb-2">
        <span className="font-semibold text-emerald-600">{label}:</span>
        {value.length === 0 ? (
          <span className="text-ink-400"> []</span>
        ) : (
          <div className="ml-4">
            {value.map((v: string, i: number) => (
              <div key={i} className="text-ink-600">
                {i + 1}. {v}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }
  return (
    <div className="mb-2">
      <span className="font-semibold text-emerald-600">{label}:</span>{" "}
      <span className="text-ink-600">{value || "(empty)"}</span>
    </div>
  );
}

function ListDisplay({
  items,
  emptyText,
  tone = "ink",
}: {
  items: string[];
  emptyText: string;
  tone?: "ink" | "emerald" | "rose";
}) {
  const tones = {
    ink: "bg-ink-50 text-ink-700",
    emerald: "bg-emerald-50 text-emerald-700",
    rose: "bg-rose-50 text-rose-700",
  };
  if (items.length === 0) {
    return <p className="text-sm italic text-ink-400">{emptyText}</p>;
  }
  return (
    <div className="space-y-1.5">
      {items.map((item, i) => (
        <div key={i} className={cn("rounded-lg px-3 py-1.5 text-sm", tones[tone])}>
          {i + 1}. {item}
        </div>
      ))}
    </div>
  );
}

function ListEditor({
  value,
  onChange,
  placeholder,
  tone = "ink",
}: {
  value: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
  tone?: "ink" | "emerald" | "rose";
}) {
  const [input, setInput] = useState("");
  const tones = {
    ink: "bg-ink-100 text-ink-700",
    emerald: "bg-emerald-50 text-emerald-700",
    rose: "bg-rose-50 text-rose-700",
  };

  const add = () => {
    if (input.trim()) {
      onChange([...value, input.trim()]);
      setInput("");
    }
  };

  return (
    <div>
      <div className="flex gap-2">
        <TextInput
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder={placeholder}
        />
        <button type="button" className="btn-outline shrink-0" onClick={add}>
          <Plus size={16} />
        </button>
      </div>
      {value.length > 0 && (
        <div className="mt-2 space-y-1">
          {value.map((v, i) => (
            <div
              key={i}
              className={cn("flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm", tones[tone])}
            >
              <span className="flex-1">{i + 1}. {v}</span>
              <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))}>
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
