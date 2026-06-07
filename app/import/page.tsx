"use client";

import { useState, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Upload,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  RotateCcw,
  MessageSquareText,
  Users,
  Plus,
  Eye,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { Select } from "@/components/ui/Form";
import { useStore } from "@/lib/store";
import { api } from "@/lib/api";
import {
  parseWorkbook,
  autoMap,
  validateSubmissions,
  validatePeople,
  downloadTemplate,
  SUBMISSION_FIELDS,
  PEOPLE_FIELDS,
  type ParsedSheet,
  type ValidatedSubmission,
  type ValidatedPerson,
  type TargetCollection,
} from "@/lib/import";
import {
  parseWorkbooks,
  extractSubmissions,
  type ExtractionResult,
} from "@/lib/extract";
import { cn, formatDateTime } from "@/lib/utils";

type Step = 1 | 2 | 3 | 4;
const STEPS = ["Upload", "Map fields", "Preview", "Summary"];

type ImportMode = "direct" | "review";

export default function ImportPage() {
  const router = useRouter();
  const people = useStore((s) => s.people);
  const submissions = useStore((s) => s.submissions);
  const bulkAddSubmissions = useStore((s) => s.bulkAddSubmissions);
  const bulkAddPeople = useStore((s) => s.bulkAddPeople);
  const recordBatch = useStore((s) => s.recordImportBatch);
  const importBatches = useStore((s) => s.importBatches);
  const pushToast = useStore((s) => s.pushToast);

  const [target, setTarget] = useState<TargetCollection>("weekly_submissions");
  const [importMode, setImportMode] = useState<ImportMode>("review");
  const [step, setStep] = useState<Step>(1);
  const [file, setFile] = useState<File | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [sheet, setSheet] = useState<ParsedSheet | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [subRows, setSubRows] = useState<ValidatedSubmission[]>([]);
  const [peopleRows, setPeopleRows] = useState<ValidatedPerson[]>([]);
  const [extractionResult, setExtractionResult] = useState<ExtractionResult | null>(null);
  const [dragging, setDragging] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const fields = target === "people" ? PEOPLE_FIELDS : SUBMISSION_FIELDS;

  // Handle file selection for review mode (can select multiple)
  const handleFilesForReview = useCallback(
    async (fileList: File[]) => {
      setParsing(true);
      setFiles(fileList);
      try {
        const workbooks = await parseWorkbooks(fileList);
        const existing = submissions.map((s) => ({ personId: s.personId, week: s.week }));
        const result = extractSubmissions(workbooks, people, existing);
        setExtractionResult(result);
        setStep(3); // Go directly to preview for review mode
      } catch (e) {
        pushToast("Could not parse files — ensure they are valid .xlsx files", "error");
      } finally {
        setParsing(false);
      }
    },
    [people, submissions, pushToast]
  );

  // Handle file selection for direct mode (single file)
  const handleFile = useCallback(
    async (f: File) => {
      if (importMode === "review" && target === "weekly_submissions") {
        handleFilesForReview([f]);
        return;
      }
      
      setParsing(true);
      setFile(f);
      try {
        const parsed = await parseWorkbook(f);
        setSheet(parsed);
        setMapping(autoMap(parsed.headers, fields));
        setStep(2);
      } catch {
        pushToast("Could not parse that file — is it a valid .xlsx?", "error");
      } finally {
        setParsing(false);
      }
    },
    [fields, pushToast, importMode, target, handleFilesForReview]
  );

  // Handle multiple file drop for review mode
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const fileList = Array.from(e.dataTransfer.files).filter(
        (f) => f.name.endsWith(".xlsx") || f.name.endsWith(".xls") || f.name.endsWith(".csv")
      );
      if (fileList.length === 0) {
        pushToast("Please drop Excel files (.xlsx, .xls, or .csv)", "error");
        return;
      }
      if (importMode === "review" && target === "weekly_submissions") {
        handleFilesForReview(fileList);
      } else {
        handleFile(fileList[0]);
      }
    },
    [importMode, target, handleFilesForReview, handleFile, pushToast]
  );

  function runValidation() {
    if (!sheet) return;
    if (target === "people") setPeopleRows(validatePeople(sheet.rows, mapping));
    else setSubRows(validateSubmissions(sheet.rows, mapping, people));
    setStep(3);
  }

  const validRows = target === "people" ? peopleRows.filter((r) => r.data) : subRows.filter((r) => r.data);
  const allRows = target === "people" ? peopleRows : subRows;
  const errorCount = allRows.length - validRows.length;

  // Commit direct import
  function commit() {
    if (target === "people") {
      bulkAddPeople(peopleRows.filter((r) => r.data).map((r) => r.data!));
    } else {
      bulkAddSubmissions(subRows.filter((r) => r.data).map((r) => r.data!));
    }
    recordBatch({
      fileName: file?.name ?? "import.xlsx",
      importedBy: "Eleanor Vance",
      importedAt: new Date().toISOString(),
      collection: target,
      totalRows: allRows.length,
      successCount: validRows.length,
      failureCount: errorCount,
      status: validRows.length === allRows.length ? "Completed" : validRows.length === 0 ? "Failed" : "Partial",
    });
    pushToast(`Imported ${validRows.length} rows into ${target}`);
    setStep(4);
  }

  // Upload to review queue
  async function uploadForReview() {
    if (!extractionResult) return;
    
    setUploading(true);
    try {
      // Create upload record
      const upload = await api.createUpload(extractionResult.upload);
      
      // Create extracted submissions with the upload ID
      const submissionsWithUploadId = extractionResult.submissions.map((s) => ({
        ...s,
        uploadId: upload._id,
      }));
      
      await api.createExtractedSubmissions(submissionsWithUploadId);
      
      pushToast(`Created ${submissionsWithUploadId.length} draft submissions for review`);
      
      // Navigate to review page
      router.push(`/review?uploadId=${upload._id}`);
    } catch (e) {
      pushToast("Upload failed", "error");
    } finally {
      setUploading(false);
    }
  }

  function reset() {
    setStep(1);
    setFile(null);
    setFiles([]);
    setSheet(null);
    setMapping({});
    setSubRows([]);
    setPeopleRows([]);
    setExtractionResult(null);
  }

  const requiredMapped = fields.filter((f) => f.required).every((f) => mapping[f.key]);

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Data Import"
        description="Bring WhatsApp exports and roster data into MongoDB collections"
        actions={
          <>
            <Link href="/review" className="btn-outline"><Eye size={16} /> Review Queue</Link>
            <Link href="/submissions" className="btn-outline"><Plus size={16} /> Manual entry</Link>
            <button className="btn-outline" onClick={() => downloadTemplate(target)}>
              <Download size={16} /> Template
            </button>
          </>
        }
      />

      {/* Target collection toggle */}
      {step === 1 && (
        <>
          <Card className="mb-6 p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-400">Target collection</p>
            <div className="flex flex-wrap gap-2">
              <CollectionBtn active={target === "weekly_submissions"} onClick={() => setTarget("weekly_submissions")} icon={MessageSquareText} label="Weekly updates" desc="" />
              <CollectionBtn active={target === "people"} onClick={() => setTarget("people")} icon={Users} label="Roster & mapping" desc="" />
            </div>
          </Card>

          {/* Import Mode Toggle (only for submissions) */}
          {target === "weekly_submissions" && (
            <Card className="mb-6 p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-400">Import Mode</p>
              <div className="flex flex-wrap gap-2">
                <ImportModeBtn
                  active={importMode === "review"}
                  onClick={() => setImportMode("review")}
                  icon={Eye}
                  label="Review First"
                  desc="Extract & review before inserting"
                  recommended
                />
                <ImportModeBtn
                  active={importMode === "direct"}
                  onClick={() => setImportMode("direct")}
                  icon={ArrowRight}
                  label="Direct Import"
                  desc="Skip review, import valid rows directly"
                />
              </div>
            </Card>
          )}
        </>
      )}

      {/* Stepper */}
      <div className="mb-6 flex items-center">
        {(importMode === "review" && target === "weekly_submissions" ? ["Upload", "Preview", "Review"] : STEPS).map((label, i) => {
          const n = (i + 1) as Step;
          const done = step > n;
          const active = step === n;
          return (
            <div key={label} className="flex flex-1 items-center last:flex-none">
              <div className="flex items-center gap-2.5">
                <div className={cn("flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition", done ? "bg-emerald-600 text-white" : active ? "bg-emerald-600 text-white ring-4 ring-emerald-100" : "bg-ink-100 text-ink-400")}>
                  {done ? <CheckCircle2 size={16} /> : n}
                </div>
                <span className={cn("hidden text-sm font-medium sm:block", active ? "text-ink-900" : "text-ink-400")}>{label}</span>
              </div>
              {i < (importMode === "review" && target === "weekly_submissions" ? 2 : STEPS.length - 1) && <div className={cn("mx-3 h-0.5 flex-1 rounded transition", step > n ? "bg-emerald-500" : "bg-ink-200")} />}
            </div>
          );
        })}
      </div>

      {/* Step 1 upload */}
      {step === 1 && (
        <>
          <Card>
            <CardBody>
              <div
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => inputRef.current?.click()}
                className={cn("flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-16 text-center transition", dragging ? "border-emerald-400 bg-emerald-50" : "border-ink-300 hover:border-emerald-300 hover:bg-ink-50")}
              >
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                  {parsing ? <Sparkles size={28} className="animate-pulse" /> : <Upload size={28} />}
                </div>
                <p className="text-base font-semibold text-ink-800">
                  {parsing ? "Parsing your file…" : importMode === "review" && target === "weekly_submissions" ? "Drop your Excel files here" : "Drop your Excel file here"}
                </p>
                <p className="mt-1 text-sm text-ink-500">
                  {importMode === "review" && target === "weekly_submissions"
                    ? "Upload multiple files (e.g., Employees.xlsx, Interns.xlsx)"
                    : `or click to browse · importing into `}<code>{target}</code>
                </p>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  multiple={importMode === "review" && target === "weekly_submissions"}
                  className="hidden"
                  onChange={(e) => {
                    const fileList = Array.from(e.target.files || []);
                    if (fileList.length === 0) return;
                    if (importMode === "review" && target === "weekly_submissions") {
                      handleFilesForReview(fileList);
                    } else {
                      handleFile(fileList[0]);
                    }
                  }}
                />
              </div>
              <div className="mt-4 flex items-start gap-2 rounded-xl bg-sky-50 p-4 text-sm text-sky-800">
                <FileSpreadsheet size={18} className="mt-0.5 shrink-0" />
                <p>
                  {importMode === "review" && target === "weekly_submissions"
                    ? "Files are parsed and submissions extracted automatically. You can review and edit each submission before approving insertion."
                    : "Columns are auto-detected and mapped to MongoDB fields. Download the template above for the exact shape, or map your own columns in the next step."
                  }
                </p>
              </div>
            </CardBody>
          </Card>

          <Card className="mt-6">
            <CardHeader title="Recent imports" subtitle="Previous loads into the collections" />
            <CardBody className="p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink-100 text-left text-xs font-semibold uppercase tracking-wide text-ink-400">
                    <th className="px-5 py-3">File</th>
                    <th className="px-3 py-3">Collection</th>
                    <th className="px-3 py-3">By</th>
                    <th className="px-3 py-3">Result</th>
                    <th className="px-5 py-3">When</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {importBatches.map((b) => (
                    <tr key={b._id} className="hover:bg-ink-50/60">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <FileSpreadsheet size={15} className="text-emerald-500" />
                          <span className="font-medium text-ink-700">{b.fileName}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3"><code className="text-xs text-ink-500">{b.collection}</code></td>
                      <td className="px-3 py-3 text-ink-500">{b.importedBy}</td>
                      <td className="px-3 py-3">
                        <span className="text-emerald-600">{b.successCount}✓</span>
                        {b.failureCount > 0 && <span className="ml-1.5 text-rose-500">{b.failureCount}✗</span>}
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap text-ink-400">{formatDateTime(b.importedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardBody>
          </Card>
        </>
      )}

      {/* Step 2 map */}
      {step === 2 && sheet && (
        <Card>
          <CardHeader
            title="Map columns to MongoDB fields"
            subtitle={`${file?.name} · ${sheet.rows.length} rows → ${target}`}
            action={sheet.sheetNames.length > 1 ? (
              <Select
                value={sheet.sheetName}
                onChange={async (e) => {
                  if (!file) return;
                  const parsed = await parseWorkbook(file, e.target.value);
                  setSheet(parsed);
                  setMapping(autoMap(parsed.headers, fields));
                }}
                className="w-44"
              >
                {sheet.sheetNames.map((n) => <option key={n} value={n}>Sheet: {n}</option>)}
              </Select>
            ) : null}
          />
          <CardBody>
            <div className="grid gap-3 sm:grid-cols-2">
              {fields.map((f) => {
                const mapped = mapping[f.key];
                return (
                  <div key={f.key} className="flex items-center gap-3 rounded-xl border border-ink-100 p-3">
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1 text-sm font-medium text-ink-800">
                        <code className="text-xs">{f.key}</code>
                        {f.required && <span className="text-rose-500">*</span>}
                      </p>
                      <p className="text-[11px] text-ink-400">{f.label}</p>
                    </div>
                    <ArrowRight size={15} className="shrink-0 text-ink-300" />
                    <Select value={mapped ?? ""} onChange={(e) => setMapping((m) => ({ ...m, [f.key]: e.target.value }))} className={cn("w-44 shrink-0", f.required && !mapped && "border-rose-300")}>
                      <option value="">— Skip —</option>
                      {sheet.headers.map((h) => <option key={h} value={h}>{h}</option>)}
                    </Select>
                  </div>
                );
              })}
            </div>
            {!requiredMapped && (
              <div className="mt-4 flex items-center gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
                <AlertTriangle size={16} /> Map all required fields (*) to continue.
              </div>
            )}
            <div className="mt-5 flex justify-between">
              <button className="btn-outline" onClick={reset}><ArrowLeft size={16} /> Back</button>
              <button className="btn-primary" disabled={!requiredMapped} onClick={runValidation}>Preview {sheet.rows.length} rows <ArrowRight size={16} /></button>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Step 3 preview */}
      {step === 3 && (
        <Card>
          {importMode === "review" && target === "weekly_submissions" && extractionResult ? (
            <>
              <CardHeader
                title="Extraction Preview"
                subtitle={`${files.map((f) => f.name).join(", ")} · ${extractionResult.submissions.length} submissions extracted`}
                action={
                  <div className="flex items-center gap-2 text-sm">
                    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 font-medium text-emerald-700">
                      <CheckCircle2 size={13} /> {extractionResult.upload.readyCount} ready
                    </span>
                    {extractionResult.upload.warningCount > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-1 font-medium text-amber-700">
                        <AlertTriangle size={13} /> {extractionResult.upload.warningCount} warnings
                      </span>
                    )}
                    {extractionResult.upload.errorCount > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2 py-1 font-medium text-rose-700">
                        <XCircle size={13} /> {extractionResult.upload.errorCount} errors
                      </span>
                    )}
                  </div>
                }
              />
              
              {/* Column Mapping Info */}
              {extractionResult.sheetMappings && extractionResult.sheetMappings.length > 0 && (
                <div className="border-b border-ink-100 bg-sky-50 px-5 py-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-sky-700">Sheet → Person Mapping</p>
                  {extractionResult.sheetMappings.map((sm, idx) => (
                    <div key={idx} className="mb-3 last:mb-0 rounded-lg bg-white p-3 shadow-sm">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-ink-700">
                          📄 {sm.fileName} → <strong>{sm.sheetName}</strong> ({sm.rowCount} rows)
                        </p>
                        {sm.personMatched ? (
                          <span className="inline-flex items-center gap-1 rounded bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">
                            ✓ Matched: {sm.personFromSheetName}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded bg-rose-100 px-2 py-0.5 text-xs text-rose-700">
                            ✗ Person not in database
                          </span>
                        )}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {Object.entries(sm.mapping).filter(([field]) => field !== "person").map(([field, col]) => (
                          <span key={field} className="inline-flex items-center gap-1 rounded bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">
                            <code>{field}</code> ← {col}
                          </span>
                        ))}
                        {sm.unmappedFields.length > 0 && sm.unmappedFields.map((field) => (
                          <span key={field} className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
                            <code>{field}</code> ← ?
                          </span>
                        ))}
                      </div>
                      {sm.unmappedFields.length > 0 && (
                        <p className="mt-1 text-xs text-amber-600">
                          ⚠ Could not auto-detect: {sm.unmappedFields.join(", ")}. 
                          <br />Available columns: {sm.headers.join(", ")}
                        </p>
                      )}
                      {!sm.personMatched && (
                        <p className="mt-1 text-xs text-rose-600">
                          ⚠ Sheet name &quot;{sm.sheetName}&quot; does not match any person in the database. 
                          Add them via People page first.
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
              
              <CardBody className="p-0">
                <div className="max-h-[460px] overflow-auto">
                  <ExtractionPreview submissions={extractionResult.submissions} />
                </div>
              </CardBody>
              <div className="flex items-center justify-between border-t border-ink-100 px-5 py-4">
                <button className="btn-outline" onClick={reset}><ArrowLeft size={16} /> Start over</button>
                <button
                  className="btn-primary"
                  disabled={uploading || extractionResult.submissions.length === 0}
                  onClick={uploadForReview}
                >
                  {uploading ? "Creating..." : `Review ${extractionResult.submissions.length} submissions`} <Eye size={16} />
                </button>
              </div>
            </>
          ) : (
            <>
              <CardHeader
                title="Preview & validate"
                subtitle="Invalid rows are skipped on import"
                action={
                  <div className="flex items-center gap-2 text-sm">
                    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 font-medium text-emerald-700"><CheckCircle2 size={13} /> {validRows.length} valid</span>
                    {errorCount > 0 && <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2 py-1 font-medium text-rose-700"><XCircle size={13} /> {errorCount} invalid</span>}
                  </div>
                }
              />
              <CardBody className="p-0">
                <div className="max-h-[460px] overflow-auto">
                  {target === "people" ? (
                    <PeoplePreview rows={peopleRows} />
                  ) : (
                    <SubmissionPreview rows={subRows} mapping={mapping} />
                  )}
                </div>
              </CardBody>
              <div className="flex items-center justify-between border-t border-ink-100 px-5 py-4">
                <button className="btn-outline" onClick={() => setStep(2)}><ArrowLeft size={16} /> Back to mapping</button>
                <button className="btn-primary" disabled={validRows.length === 0} onClick={commit}>Import {validRows.length} rows <ArrowRight size={16} /></button>
              </div>
            </>
          )}
        </Card>
      )}

      {/* Step 4 summary */}
      {step === 4 && (
        <Card>
          <CardBody>
            <div className="flex flex-col items-center py-8 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600"><CheckCircle2 size={32} /></div>
              <h3 className="text-lg font-bold text-ink-900">Import complete</h3>
              <p className="mt-1 text-sm text-ink-500">{file?.name} was processed into <code>{target}</code>.</p>
              <div className="mt-6 grid w-full max-w-md grid-cols-3 gap-3">
                <SummaryStat label="Total rows" value={allRows.length} tone="ink" />
                <SummaryStat label="Imported" value={validRows.length} tone="emerald" />
                <SummaryStat label="Skipped" value={errorCount} tone="rose" />
              </div>
              <div className="mt-7 flex gap-2">
                <button className="btn-outline" onClick={reset}><RotateCcw size={16} /> Import another</button>
                <Link href={target === "people" ? "/people" : "/submissions"} className="btn-primary">View {target}</Link>
              </div>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}

function CollectionBtn({ active, onClick, icon: Icon, label, desc }: { active: boolean; onClick: () => void; icon: typeof Users; label: string; desc: string }) {
  return (
    <button onClick={onClick} className={cn("flex items-center gap-3 rounded-xl border p-3 text-left transition", active ? "border-emerald-300 bg-emerald-50" : "border-ink-200 bg-white hover:bg-ink-50")}>
      <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg", active ? "bg-emerald-600 text-white" : "bg-ink-100 text-ink-500")}><Icon size={18} /></div>
      <div>
        <p className={cn("text-sm font-semibold", active ? "text-emerald-700" : "text-ink-800")}><code>{label}</code></p>
        <p className="text-[11px] text-ink-400">{desc}</p>
      </div>
    </button>
  );
}

function ImportModeBtn({ active, onClick, icon: Icon, label, desc, recommended }: { active: boolean; onClick: () => void; icon: typeof Users; label: string; desc: string; recommended?: boolean }) {
  return (
    <button onClick={onClick} className={cn("relative flex items-center gap-3 rounded-xl border p-3 text-left transition", active ? "border-emerald-300 bg-emerald-50" : "border-ink-200 bg-white hover:bg-ink-50")}>
      {recommended && (
        <span className="absolute -top-2 right-2 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-semibold text-white">
          Recommended
        </span>
      )}
      <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg", active ? "bg-emerald-600 text-white" : "bg-ink-100 text-ink-500")}><Icon size={18} /></div>
      <div>
        <p className={cn("text-sm font-semibold", active ? "text-emerald-700" : "text-ink-800")}>{label}</p>
        <p className="text-[11px] text-ink-400">{desc}</p>
      </div>
    </button>
  );
}

function ExtractionPreview({ submissions }: { submissions: import("@/lib/extract").ExtractionResult["submissions"] }) {
  return (
    <table className="w-full text-sm">
      <thead className="sticky top-0 bg-white">
        <tr className="border-b border-ink-100 text-left text-xs font-semibold uppercase tracking-wide text-ink-400">
          <th className="px-5 py-3">Employee</th>
          <th className="px-3 py-3">Week</th>
          <th className="px-3 py-3">Priority</th>
          <th className="px-3 py-3 text-center">Actions</th>
          <th className="px-3 py-3 text-center">Outcomes</th>
          <th className="px-5 py-3">Status</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-ink-100">
        {submissions.map((s, i) => (
          <tr key={i} className={cn(
            s.validation.status === "ready" ? "hover:bg-ink-50/60" :
            s.validation.status === "warning" ? "bg-amber-50/40" : "bg-rose-50/40"
          )}>
            <td className="px-5 py-2.5">
              <span className={cn("font-medium", s.personId ? "text-ink-700" : "text-rose-500")}>
                {s.personName || "Unknown"}
              </span>
              {!s.personId && <span className="ml-1 text-xs text-rose-400">(not mapped)</span>}
            </td>
            <td className="px-3 py-2.5 text-ink-500">{s.week || "—"}</td>
            <td className="max-w-[200px] truncate px-3 py-2.5 text-ink-600">{s.topPriority || "—"}</td>
            <td className="px-3 py-2.5 text-center tabular-nums text-ink-600">{s.actions.length}</td>
            <td className="px-3 py-2.5 text-center tabular-nums text-ink-600">{s.outcomes.length}</td>
            <td className="px-5 py-2.5">
              {s.validation.status === "ready" ? (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                  <CheckCircle2 size={13} /> Ready
                </span>
              ) : s.validation.status === "warning" ? (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600">
                  <AlertTriangle size={13} /> {s.validation.issues.length} warning{s.validation.issues.length > 1 ? "s" : ""}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-rose-600">
                  <XCircle size={13} /> {s.validation.issues.filter((i) => i.severity === "error").length} error{s.validation.issues.filter((i) => i.severity === "error").length > 1 ? "s" : ""}
                </span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function SubmissionPreview({ rows, mapping }: { rows: ValidatedSubmission[]; mapping: Record<string, string> }) {
  return (
    <table className="w-full text-sm">
      <thead className="sticky top-0 bg-white">
        <tr className="border-b border-ink-100 text-left text-xs font-semibold uppercase tracking-wide text-ink-400">
          <th className="px-5 py-3">Row</th>
          <th className="px-3 py-3">Person</th>
          <th className="px-3 py-3">Week</th>
          <th className="px-3 py-3">Priority</th>
          <th className="px-5 py-3">Validation</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-ink-100">
        {rows.map((v) => (
          <tr key={v.index} className={cn(v.data ? "hover:bg-ink-50/60" : "bg-rose-50/40")}>
            <td className="px-5 py-2.5 text-ink-400">{v.index + 2}</td>
            <td className="px-3 py-2.5">{v.resolvedName ? <span className="font-medium text-ink-700">{v.resolvedName}</span> : <span className="text-rose-500">{String(v.raw[mapping.person] ?? "—")}</span>}</td>
            <td className="px-3 py-2.5 text-ink-500">{v.data?.week ?? "—"}</td>
            <td className="max-w-[220px] truncate px-3 py-2.5 text-ink-600">{v.data?.topPriority || "—"}</td>
            <td className="px-5 py-2.5">
              {v.data ? <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600"><CheckCircle2 size={13} /> Ready</span> : <span className="inline-flex items-center gap-1 text-xs font-medium text-rose-600"><XCircle size={13} /> {v.errors.join(", ")}</span>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function PeoplePreview({ rows }: { rows: ValidatedPerson[] }) {
  return (
    <table className="w-full text-sm">
      <thead className="sticky top-0 bg-white">
        <tr className="border-b border-ink-100 text-left text-xs font-semibold uppercase tracking-wide text-ink-400">
          <th className="px-5 py-3">Row</th>
          <th className="px-3 py-3">Name</th>
          <th className="px-3 py-3">Phone</th>
          <th className="px-3 py-3">Dept · Lead</th>
          <th className="px-5 py-3">Validation</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-ink-100">
        {rows.map((v) => (
          <tr key={v.index} className={cn(v.data ? "hover:bg-ink-50/60" : "bg-rose-50/40")}>
            <td className="px-5 py-2.5 text-ink-400">{v.index + 2}</td>
            <td className="px-3 py-2.5 font-medium text-ink-700">{v.data?.name ?? "—"}</td>
            <td className="px-3 py-2.5 text-ink-500">{v.data?.phone ?? "—"}</td>
            <td className="px-3 py-2.5 text-ink-500">{v.data ? `${v.data.department} · ${v.data.teamLead}` : "—"}</td>
            <td className="px-5 py-2.5">
              {v.data ? <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600"><CheckCircle2 size={13} /> Ready</span> : <span className="inline-flex items-center gap-1 text-xs font-medium text-rose-600"><XCircle size={13} /> {v.errors.join(", ")}</span>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function SummaryStat({ label, value, tone }: { label: string; value: number; tone: "ink" | "emerald" | "rose" }) {
  const tones = { ink: "text-ink-900", emerald: "text-emerald-600", rose: "text-rose-600" };
  return (
    <div className="rounded-xl border border-ink-100 p-4">
      <p className={cn("text-2xl font-bold", tones[tone])}>{value}</p>
      <p className="text-[11px] text-ink-400">{label}</p>
    </div>
  );
}
