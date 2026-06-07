import * as XLSX from "xlsx";
import type { Person, ExtractedSubmission, ValidationIssue, ValidationStatus, Upload } from "./types";
import { WEEKS, CURRENT_WEEK } from "./mock-data";
import { uid } from "./utils";

// ── Field definitions for extraction ────────────────────────────────────────
export interface FieldDef {
  key: string;
  label: string;
  required?: boolean;
  aliases: string[];
}

// Updated aliases to match "Weekly Goal Alignment" Excel format
// NOTE: 'person' comes from the SHEET NAME, not a column. The field is optional here
// as a fallback in case somebody has it in a column anyway.
export const EXTRACTION_FIELDS: FieldDef[] = [
  { 
    key: "person", 
    label: "Person (from sheet name or column)", 
    required: false,  // NOT required - comes from sheet name
    aliases: [
      "person", "name", "from", "phone", "number", "whatsapp", "sender", 
      "employee", "submitted by", "team member", "intern", "full name",
      "employee name", "intern name", "member"
    ] 
  },
  { 
    key: "week", 
    label: "Week", 
    required: true, 
    aliases: [
      "week", "period", "sprint", "w", "week number", "week no", "wk",
      "week #", "reporting week"
    ] 
  },
  { 
    key: "topPriority", 
    label: "Top priority", 
    required: true, 
    aliases: [
      "priority", "top priority", "focus", "main", "key priority", "main priority",
      "priority focus", "key focus", "main focus", "primary focus", "top focus",
      "what is your top priority", "what was your top priority", "this week's priority",
      "weekly priority", "primary goal", "main goal"
    ] 
  },
  { 
    key: "actions", 
    label: "Actions / did", 
    required: true, 
    aliases: [
      "actions", "did", "done", "progress", "work", "update", "tasks", "activities",
      "what did you do", "what actions", "what steps", "actions taken", "steps taken",
      "what actions/steps did you take", "actions/steps", "work done", "completed tasks",
      "what have you done", "action items", "key actions", "activities done"
    ] 
  },
  { 
    key: "outcomes", 
    label: "Outcomes", 
    aliases: [
      "outcomes", "results", "wins", "delivered", "achievements", "output",
      "what outcomes", "key outcomes", "results achieved", "deliverables",
      "what did you achieve", "accomplishments", "key results", "impact"
    ] 
  },
  { 
    key: "blockers", 
    label: "Blockers", 
    aliases: [
      "blockers", "blocker", "blocked", "risks", "issues", "challenges", "obstacles",
      "what blockers", "roadblocks", "impediments", "problems", "concerns",
      "what's blocking you", "what is blocking", "blockers/challenges"
    ] 
  },
  { 
    key: "notes", 
    label: "Notes", 
    aliases: [
      "notes", "comments", "remarks", "additional", "other", "additional notes",
      "extra info", "additional info", "observations", "feedback"
    ] 
  },
];

// ── Validation codes ────────────────────────────────────────────────────────
export const VALIDATION_CODES = {
  WEEK_NOT_DETECTED: "WEEK_NOT_DETECTED",
  EMPLOYEE_NOT_MAPPED: "EMPLOYEE_NOT_MAPPED",
  EMPTY_PRIORITY: "EMPTY_PRIORITY",
  ACTIONS_LESS_THAN_3: "ACTIONS_LESS_THAN_3",
  DUPLICATE_SUBMISSION: "DUPLICATE_SUBMISSION",
  TEAM_LEAD_NOT_FOUND: "TEAM_LEAD_NOT_FOUND",
  MISSING_PERSON: "MISSING_PERSON",
  NO_ACTIONS_OR_PRIORITY: "NO_ACTIONS_OR_PRIORITY",
  MISSING_OUTCOMES: "MISSING_OUTCOMES",
  UNKNOWN_DEPARTMENT: "UNKNOWN_DEPARTMENT",
} as const;

// ── Parse workbook ──────────────────────────────────────────────────────────
export interface ParsedWorkbook {
  sheets: {
    name: string;
    headers: string[];
    rows: Record<string, any>[];
    // New: raw 2D array for columnar week parsing
    rawData: any[][];
  }[];
  fileName: string;
}

// Question patterns to identify which field each Q/A pair maps to
const QUESTION_PATTERNS = {
  outcomes: [
    /top\s*3\s*measurable\s*outcomes/i,
    /measurable\s*outcomes/i,
    /outcomes\s*for\s*next\s*week/i,
    /deliverables/i,
  ],
  topPriority: [
    /#1\s*priority/i,
    /number\s*1\s*priority/i,
    /top\s*priority/i,
    /move\s*your\s*accounts/i,
    /move\s*your\s*business/i,
    /most\s*important/i,
  ],
  actions: [
    /specific\s*actions/i,
    /actions\s*will\s*you\s*take/i,
    /action\s*items/i,
    /bullet\s*points/i,
    /what\s*will\s*you\s*do/i,
  ],
  blockers: [
    /blockers/i,
    /dependencies/i,
    /obstacles/i,
    /anticipate/i,
    /risks/i,
  ],
  notes: [
    /success\s*be\s*measured/i,
    /how\s*will\s*success/i,
    /measure\s*success/i,
    /end\s*of\s*the\s*week/i,
    /kpis/i,
  ],
};

// Detect which field a question maps to
function detectQuestionField(questionText: string): keyof typeof QUESTION_PATTERNS | null {
  const text = questionText.toLowerCase();
  for (const [field, patterns] of Object.entries(QUESTION_PATTERNS)) {
    if (patterns.some(p => p.test(text))) {
      return field as keyof typeof QUESTION_PATTERNS;
    }
  }
  return null;
}

// Parse week from date range string like "13th APRIL - 17th APRIL" or "April 13 - April 17"
function parseWeekFromDateRange(dateRange: string): { week: string; detected: boolean } {
  const s = String(dateRange || "").trim();
  if (!s) return { week: "", detected: false };
  
  // Try to extract month and day
  // Patterns: "13th APRIL", "APRIL 13", "13 April", "Apr 13", etc.
  const monthNames: Record<string, number> = {
    jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3,
    apr: 4, april: 4, may: 5, jun: 6, june: 6,
    jul: 7, july: 7, aug: 8, august: 8, sep: 9, september: 9,
    oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
  };
  
  // Find first date in the range
  const dateMatch = s.match(/(\d{1,2})(?:st|nd|rd|th)?\s*[-–]?\s*(?:of\s*)?([a-z]+)|([a-z]+)\s*(\d{1,2})/i);
  
  if (dateMatch) {
    let day: number, monthStr: string;
    if (dateMatch[1] && dateMatch[2]) {
      // "13th APRIL" format
      day = parseInt(dateMatch[1], 10);
      monthStr = dateMatch[2].toLowerCase();
    } else if (dateMatch[3] && dateMatch[4]) {
      // "APRIL 13" format
      monthStr = dateMatch[3].toLowerCase();
      day = parseInt(dateMatch[4], 10);
    } else {
      return { week: "", detected: false };
    }
    
    const month = monthNames[monthStr.substring(0, 3)];
    if (month && day >= 1 && day <= 31) {
      // Calculate ISO week number for 2026
      const date = new Date(2026, month - 1, day);
      const weekNum = getISOWeek(date);
      return { week: `2026-W${String(weekNum).padStart(2, "0")}`, detected: true };
    }
  }
  
  // Try Week format directly
  const weekMatch = s.match(/(?:week|w)\s*[-#]?\s*(\d{1,2})/i);
  if (weekMatch) {
    const weekNum = parseInt(weekMatch[1], 10);
    if (weekNum >= 1 && weekNum <= 53) {
      return { week: `2026-W${String(weekNum).padStart(2, "0")}`, detected: true };
    }
  }
  
  return { week: "", detected: false };
}

// Get ISO week number
function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

export async function parseWorkbooks(files: File[]): Promise<ParsedWorkbook[]> {
  const results: ParsedWorkbook[] = [];
  
  for (const file of files) {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    
    const sheets = wb.SheetNames.map((name) => {
      const ws = wb.Sheets[name];
      
      // Get raw 2D array data for columnar parsing
      const rawData = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: "", raw: false });
      
      // Also parse as standard JSON for backwards compatibility
      const json = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: "", raw: false });
      const headers = json.length > 0 ? Object.keys(json[0]) : [];
      
      return { name, headers, rows: json, rawData: rawData as any[][] };
    });
    
    results.push({ sheets, fileName: file.name });
  }
  
  return results;
}

// ── Auto-map headers to fields ──────────────────────────────────────────────
export function autoMapHeaders(headers: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  const used = new Set<string>();
  
  // Normalize header for comparison
  const normalize = (s: string) => s.toLowerCase().trim().replace(/[?:]/g, "").replace(/\s+/g, " ");
  
  EXTRACTION_FIELDS.forEach((field) => {
    // Try exact match first, then partial match
    let match = headers.find((h) => {
      if (used.has(h)) return false;
      const hl = normalize(h);
      
      // Exact matches
      if (hl === field.key.toLowerCase()) return true;
      if (hl === normalize(field.label)) return true;
      if (field.aliases.some((a) => hl === normalize(a))) return true;
      
      return false;
    });
    
    // If no exact match, try partial/contains match
    if (!match) {
      match = headers.find((h) => {
        if (used.has(h)) return false;
        const hl = normalize(h);
        
        // Check if header contains any alias
        if (field.aliases.some((a) => hl.includes(normalize(a)) || normalize(a).includes(hl))) return true;
        
        // Check if any word in the header matches
        const words = hl.split(/\s+/);
        if (field.aliases.some((a) => words.some((w) => w === normalize(a) || normalize(a).startsWith(w)))) return true;
        
        return false;
      });
    }
    
    if (match) {
      map[field.key] = match;
      used.add(match);
    }
  });
  
  return map;
}

// ── Helper to split list values ─────────────────────────────────────────────
const splitList = (v: string): string[] => {
  if (!v || typeof v !== "string") return [];
  
  // Handle various list formats:
  // 1. Numbered lists (1. item, 2. item OR 1) item, 2) item)
  // 2. Bullet points (- item, • item, * item)
  // 3. Newline separated
  // 4. Semicolon or pipe separated
  // 5. Comma with space separated
  
  let items: string[] = [];
  
  // Check if it's a numbered list (1. or 1) format)
  if (/^\s*\d+[.)]\s*/m.test(v)) {
    items = v.split(/\n?\s*\d+[.)]\s+/).map((x) => x.trim()).filter(Boolean);
  }
  // Check if it's bullet points
  else if (/^\s*[-•*]\s*/m.test(v)) {
    items = v.split(/\n?\s*[-•*]\s+/).map((x) => x.trim()).filter(Boolean);
  }
  // Check if newline separated
  else if (v.includes("\n")) {
    items = v.split(/\n+/).map((x) => x.trim()).filter(Boolean);
  }
  // Semicolon or pipe separated
  else if (v.includes(";") || v.includes("|")) {
    items = v.split(/[;|]/).map((x) => x.trim()).filter(Boolean);
  }
  // Comma with space (to avoid splitting "1,000")
  else if (/,\s+/.test(v)) {
    items = v.split(/,\s+/).map((x) => x.trim()).filter(Boolean);
  }
  // Single item
  else {
    items = [v.trim()];
  }
  
  // Clean up any remaining numbering from items
  return items.map((item) => item.replace(/^\d+[.)]\s*/, "").replace(/^[-•*]\s*/, "").trim()).filter(Boolean);
};

// ── Normalize week string ───────────────────────────────────────────────────
function normalizeWeek(v: string): { week: string; detected: boolean } {
  const s = (v || "").toString().trim();
  
  if (!s) return { week: "", detected: false };
  
  // Try ISO week format first (2026-W23)
  const iso = s.match(/(\d{4})-W(\d{1,2})/i);
  if (iso) {
    const candidate = `${iso[1]}-W${iso[2].padStart(2, "0")}`;
    if (WEEKS.includes(candidate)) return { week: candidate, detected: true };
    // If year is current, still accept
    return { week: candidate, detected: true };
  }
  
  // Try "Week 23" or "Week-23" format
  const weekWord = s.match(/week\s*[-#]?\s*(\d{1,2})/i);
  if (weekWord) {
    const weekNum = parseInt(weekWord[1], 10);
    if (weekNum >= 1 && weekNum <= 53) {
      const candidate = `2026-W${String(weekNum).padStart(2, "0")}`;
      return { week: candidate, detected: true };
    }
  }
  
  // Try W prefix (W23, W-23, W 23)
  const ww = s.match(/W\s*[-]?\s*(\d{1,2})/i);
  if (ww) {
    const weekNum = parseInt(ww[1], 10);
    if (weekNum >= 1 && weekNum <= 53) {
      const candidate = `2026-W${String(weekNum).padStart(2, "0")}`;
      return { week: candidate, detected: true };
    }
  }
  
  // Try raw number (23) - must be a reasonable week number
  const num = s.match(/^(\d{1,2})$/);
  if (num) {
    const weekNum = parseInt(num[1], 10);
    if (weekNum >= 1 && weekNum <= 53) {
      const candidate = `2026-W${String(weekNum).padStart(2, "0")}`;
      return { week: candidate, detected: true };
    }
  }
  
  // Try to find any week number in the string
  const anyNum = s.match(/(\d{1,2})/);
  if (anyNum) {
    const weekNum = parseInt(anyNum[1], 10);
    if (weekNum >= 1 && weekNum <= 53) {
      const candidate = `2026-W${String(weekNum).padStart(2, "0")}`;
      return { week: candidate, detected: true };
    }
  }
  
  return { week: "", detected: false };
}

// ── Extract and validate submissions ────────────────────────────────────────
export interface SheetMapping {
  sheetName: string;
  fileName: string;
  headers: string[];
  mapping: Record<string, string>;
  unmappedFields: string[];
  rowCount: number;
  personFromSheetName: string | null;  // The matched person name from the sheet name
  personMatched: boolean;  // Whether the sheet name matched a person in the database
}

export interface ExtractionResult {
  upload: Omit<Upload, "_id">;
  submissions: Omit<ExtractedSubmission, "_id">[];
  sheetMappings: SheetMapping[];
}

export function extractSubmissions(
  workbooks: ParsedWorkbook[],
  people: Person[],
  existingSubmissions: { personId: string | null; week: string }[] = []
): ExtractionResult {
  const allSubmissions: Omit<ExtractedSubmission, "_id">[] = [];
  const sheetMappings: SheetMapping[] = [];
  let totalRows = 0;
  let readyCount = 0;
  let warningCount = 0;
  let errorCount = 0;
  
  const uploadId = uid("upload");
  const existingSet = new Set(
    existingSubmissions.map((s) => `${s.personId}:${s.week}`)
  );
  
  for (const wb of workbooks) {
    for (const sheet of wb.sheets) {
      // Skip empty sheets
      const rawData = sheet.rawData;
      if (!rawData || rawData.length === 0) continue;
      
      // The sheet name IS the person's name
      const sheetPersonRef = sheet.name.toLowerCase().trim();
      const sheetRefWords = sheetPersonRef.split(/\s+/).filter(w => w.length > 1);
      
      // Try to find the person based on sheet name
      let sheetPerson: Person | undefined;
      
      // Strategy 1: Exact name match
      sheetPerson = people.find((p) => p.name.toLowerCase().trim() === sheetPersonRef);
      
      // Strategy 2: Name contains or is contained
      if (!sheetPerson) {
        sheetPerson = people.find((p) => {
          const pName = p.name.toLowerCase().trim();
          return pName.includes(sheetPersonRef) || sheetPersonRef.includes(pName);
        });
      }
      
      // Strategy 3: Match by first or last name
      if (!sheetPerson && sheetRefWords.length > 0) {
        sheetPerson = people.find((p) => {
          const pNameWords = p.name.toLowerCase().trim().split(/\s+/);
          return sheetRefWords.some(rw => pNameWords.some(pw => 
            pw === rw || pw.startsWith(rw) || rw.startsWith(pw)
          ));
        });
      }
      
      // Strategy 4: Fuzzy match (at least 3 char overlap)
      if (!sheetPerson && sheetRefWords.length > 0) {
        sheetPerson = people.find((p) => {
          const pNameWords = p.name.toLowerCase().trim().split(/\s+/);
          return sheetRefWords.some(rw => 
            rw.length >= 3 && pNameWords.some(pw => 
              pw.length >= 3 && (pw.includes(rw) || rw.includes(pw))
            )
          );
        });
      }

      // ═══════════════════════════════════════════════════════════════════
      // WEEK BLOCK PARSING
      // Each "week block" = Week header + 5 Q/A pairs vertically below
      // Week blocks can appear anywhere: horizontally, vertically, or both
      // We scan entire sheet for week headers and extract the block below each
      // ═══════════════════════════════════════════════════════════════════
      
      interface WeekBlock {
        rowIndex: number;
        colIndex: number;
        weekHeader: string;
        week: string;
        // The 5 Q/A pairs below the week header
        qa: { question: string; answer: string; field: string | null }[];
      }
      
      const weekBlocks: WeekBlock[] = [];
      
      // Scan entire sheet for week headers
      for (let rowIdx = 0; rowIdx < rawData.length; rowIdx++) {
        const row = rawData[rowIdx];
        if (!Array.isArray(row)) continue;
        
        for (let colIdx = 0; colIdx < row.length; colIdx++) {
          const cellVal = String(row[colIdx] || "").trim();
          if (!cellVal) continue;
          
          // Try to parse as week/date range
          const parsed = parseWeekFromDateRange(cellVal);
          if (parsed.detected) {
            // Found a week header! Now extract the Q/A block below it
            const block: WeekBlock = {
              rowIndex: rowIdx,
              colIndex: colIdx,
              weekHeader: cellVal,
              week: parsed.week,
              qa: [],
            };
            
            // Read up to 15 rows below to find 5 Q/A pairs (with possible gaps)
            // Q/A can be: Q in one row, A in next row OR Q and A in same row (different cols)
            let qaCount = 0;
            let currentQuestion = "";
            let currentField: string | null = null;
            
            for (let offset = 1; offset <= 20 && qaCount < 5; offset++) {
              const qaRowIdx = rowIdx + offset;
              if (qaRowIdx >= rawData.length) break;
              
              const qaRow = rawData[qaRowIdx];
              if (!Array.isArray(qaRow)) continue;
              
              // Get the cell in the same column as week header
              const cellInCol = String(qaRow[colIdx] || "").trim();
              
              // Also check adjacent columns for Q/A pairs
              const cellLeft = colIdx > 0 ? String(qaRow[colIdx - 1] || "").trim() : "";
              const cellRight = colIdx < qaRow.length - 1 ? String(qaRow[colIdx + 1] || "").trim() : "";
              
              // Check if this row starts a new week block (stop if we hit another week)
              if (cellInCol && parseWeekFromDateRange(cellInCol).detected) break;
              if (cellLeft && parseWeekFromDateRange(cellLeft).detected) break;
              if (cellRight && parseWeekFromDateRange(cellRight).detected) break;
              
              // Try to detect if any cell is a question
              const checkForQuestion = (text: string): string | null => {
                if (!text || text.length < 10) return null;
                const field = detectQuestionField(text);
                return field;
              };
              
              // Strategy 1: Question and Answer in same row but different columns
              // Look for question pattern in left columns, answer in right/same column
              let foundQA = false;
              
              // Check left cell for question, main cell for answer
              if (cellLeft && cellInCol) {
                const leftField = checkForQuestion(cellLeft);
                if (leftField) {
                  block.qa.push({ question: cellLeft, answer: cellInCol, field: leftField });
                  qaCount++;
                  foundQA = true;
                }
              }
              
              // Check main cell for question, right cell for answer
              if (!foundQA && cellInCol && cellRight) {
                const mainField = checkForQuestion(cellInCol);
                if (mainField) {
                  block.qa.push({ question: cellInCol, answer: cellRight, field: mainField });
                  qaCount++;
                  foundQA = true;
                }
              }
              
              // Strategy 2: Q in one row, A in next row (both in same column)
              if (!foundQA && cellInCol) {
                const fieldDetected = checkForQuestion(cellInCol);
                if (fieldDetected) {
                  // This is a question - look for answer in next non-empty row
                  currentQuestion = cellInCol;
                  currentField = fieldDetected;
                } else if (currentQuestion && currentField) {
                  // This might be the answer to previous question
                  // Only treat as answer if it's substantial text (not another question)
                  if (cellInCol.length > 5 && !checkForQuestion(cellInCol)) {
                    block.qa.push({ question: currentQuestion, answer: cellInCol, field: currentField });
                    qaCount++;
                    currentQuestion = "";
                    currentField = null;
                  }
                } else if (!currentQuestion && cellInCol.length > 10) {
                  // No pending question, but this is substantial text
                  // Treat as standalone answer and try to infer field from position
                  const inferredField = qaCount === 0 ? "outcomes" :
                                       qaCount === 1 ? "topPriority" :
                                       qaCount === 2 ? "actions" :
                                       qaCount === 3 ? "blockers" : "notes";
                  block.qa.push({ question: `Field ${qaCount + 1}`, answer: cellInCol, field: inferredField });
                  qaCount++;
                }
              }
            }
            
            // Only add block if we found some Q/A content
            if (block.qa.length > 0) {
              weekBlocks.push(block);
            }
          }
        }
      }
      
      // Record mapping info
      const detectedWeeks = weekBlocks.map(b => b.weekHeader).join(", ");
      sheetMappings.push({
        sheetName: sheet.name,
        fileName: wb.fileName,
        headers: weekBlocks.map(b => b.weekHeader),
        mapping: { format: "week_blocks", weeks: detectedWeeks, blockCount: weekBlocks.length.toString() },
        unmappedFields: weekBlocks.length === 0 ? ["week"] : [],
        rowCount: weekBlocks.length,
        personFromSheetName: sheetPerson?.name ?? null,
        personMatched: !!sheetPerson,
      });
      
      // If no week blocks found, fallback to row-based parsing
      if (weekBlocks.length === 0) {
        const fallbackResult = extractRowBasedSubmissions(
          sheet, sheetPerson, people, uploadId, existingSet
        );
        allSubmissions.push(...fallbackResult.submissions);
        totalRows += fallbackResult.totalRows;
        readyCount += fallbackResult.readyCount;
        warningCount += fallbackResult.warningCount;
        errorCount += fallbackResult.errorCount;
        continue;
      }
      
      // Create submissions from week blocks
      for (const block of weekBlocks) {
        totalRows++;
        
        // Build field data from Q/A pairs
        const fieldData: Record<string, string> = {};
        const rawQA: Record<string, string> = {};
        
        for (const qa of block.qa) {
          rawQA[qa.question.substring(0, 50)] = qa.answer;
          if (qa.field) {
            // Accumulate if same field appears multiple times
            if (fieldData[qa.field]) {
              fieldData[qa.field] += "\n" + qa.answer;
            } else {
              fieldData[qa.field] = qa.answer;
            }
          }
        }
        
        const topPriority = fieldData.topPriority || "";
        const actions = splitList(fieldData.actions || "");
        const outcomes = splitList(fieldData.outcomes || "");
        const blockers = splitList(fieldData.blockers || "");
        const notes = fieldData.notes || "";
        
        const issues: ValidationIssue[] = [];
        
        // Person validation
        let personId: string | null = sheetPerson?._id ?? null;
        let personName = sheetPerson?.name ?? sheet.name;
        let department = sheetPerson?.department ?? "";
        let teamLead = sheetPerson?.teamLead ?? "";
        
        if (!sheetPerson) {
          issues.push({
            code: VALIDATION_CODES.EMPLOYEE_NOT_MAPPED,
            message: `Employee not mapped: "${sheet.name}" - add to People or map manually`,
            severity: "error",
            field: "person"
          });
        } else if (!sheetPerson.teamLead) {
          issues.push({
            code: VALIDATION_CODES.TEAM_LEAD_NOT_FOUND,
            message: "Team lead not found for this employee",
            severity: "warning",
            field: "teamLead"
          });
        }
        
        // Week validation
        if (!block.week) {
          issues.push({
            code: VALIDATION_CODES.WEEK_NOT_DETECTED,
            message: `Could not parse week from: "${block.weekHeader}"`,
            severity: "error",
            field: "week"
          });
        }
        
        // Priority validation
        if (!topPriority) {
          issues.push({
            code: VALIDATION_CODES.EMPTY_PRIORITY,
            message: "No priority specified",
            severity: "warning",
            field: "topPriority"
          });
        }
        
        // Actions validation
        if (actions.length === 0 && !topPriority) {
          issues.push({
            code: VALIDATION_CODES.NO_ACTIONS_OR_PRIORITY,
            message: "No priority or actions found - submission may be empty",
            severity: "warning",
          });
        }
        
        // Outcomes validation
        if (outcomes.length === 0) {
          issues.push({
            code: VALIDATION_CODES.MISSING_OUTCOMES,
            message: "No outcomes specified",
            severity: "warning",
            field: "outcomes"
          });
        }
        
        // Duplicate check
        if (personId && block.week) {
          const key = `${personId}:${block.week}`;
          if (existingSet.has(key)) {
            issues.push({
              code: VALIDATION_CODES.DUPLICATE_SUBMISSION,
              message: `Submission already exists for ${personName} in ${block.week}`,
              severity: "warning",
            });
          }
          existingSet.add(key);
        }
        
        const hasError = issues.some((i) => i.severity === "error");
        const hasWarning = issues.some((i) => i.severity === "warning");
        const status: ValidationStatus = hasError ? "error" : hasWarning ? "warning" : "ready";
        
        if (status === "ready") readyCount++;
        else if (status === "warning") warningCount++;
        else errorCount++;
        
        allSubmissions.push({
          uploadId,
          rowIndex: block.rowIndex,
          personId,
          personName,
          department,
          teamLead,
          week: block.week,
          topPriority,
          actions,
          outcomes,
          blockers,
          notes,
          rawData: { 
            weekHeader: block.weekHeader,
            position: `Row ${block.rowIndex + 1}, Col ${block.colIndex + 1}`,
            qaCount: block.qa.length,
            ...rawQA,
            _format: "week_blocks"
          },
          mapping: { row: block.rowIndex.toString(), col: block.colIndex.toString() },
          validation: { status, issues },
          reviewed: false,
        });
      }
    }
  }
  
  const upload: Omit<Upload, "_id"> = {
    fileName: workbooks.map((w) => w.fileName).join(", "),
    uploadedAt: new Date().toISOString(),
    uploadedBy: "admin",
    status: readyCount > 0 ? "review_pending" : "rejected",
    totalRows,
    readyCount,
    warningCount,
    errorCount,
  };
  
  return { upload, submissions: allSubmissions, sheetMappings };
}

// Fallback row-based extraction for standard Excel formats
function extractRowBasedSubmissions(
  sheet: ParsedWorkbook["sheets"][0],
  sheetPerson: Person | undefined,
  people: Person[],
  uploadId: string,
  existingSet: Set<string>
): { submissions: Omit<ExtractedSubmission, "_id">[]; totalRows: number; readyCount: number; warningCount: number; errorCount: number } {
  const submissions: Omit<ExtractedSubmission, "_id">[] = [];
  let totalRows = 0;
  let readyCount = 0;
  let warningCount = 0;
  let errorCount = 0;
  
  const mapping = autoMapHeaders(sheet.headers);
  
  for (let i = 0; i < sheet.rows.length; i++) {
    const raw = sheet.rows[i];
    totalRows++;
    
    const issues: ValidationIssue[] = [];
    
    const get = (key: string) => {
      const col = mapping[key];
      return col ? String(raw[col] ?? "").trim() : "";
    };
    
    // Person from sheet name
    let personId: string | null = sheetPerson?._id ?? null;
    let personName = sheetPerson?.name ?? sheet.name;
    let department = sheetPerson?.department ?? "";
    let teamLead = sheetPerson?.teamLead ?? "";
    
    if (!sheetPerson) {
      issues.push({
        code: VALIDATION_CODES.EMPLOYEE_NOT_MAPPED,
        message: `Employee not mapped: "${sheet.name}"`,
        severity: "error",
        field: "person"
      });
    }
    
    // Week
    const weekRaw = get("week");
    const { week, detected } = normalizeWeek(weekRaw);
    if (!detected) {
      issues.push({
        code: VALIDATION_CODES.WEEK_NOT_DETECTED,
        message: weekRaw ? `Could not parse week: "${weekRaw}"` : "Week not specified",
        severity: "error",
        field: "week"
      });
    }
    
    const topPriority = get("topPriority");
    const actions = splitList(get("actions"));
    const outcomes = splitList(get("outcomes"));
    const blockers = splitList(get("blockers"));
    const notes = get("notes");
    
    if (!topPriority && actions.length === 0) {
      issues.push({
        code: VALIDATION_CODES.NO_ACTIONS_OR_PRIORITY,
        message: "No priority or actions found",
        severity: "error",
      });
    }
    
    const hasError = issues.some((i) => i.severity === "error");
    const hasWarning = issues.some((i) => i.severity === "warning");
    const status: ValidationStatus = hasError ? "error" : hasWarning ? "warning" : "ready";
    
    if (status === "ready") readyCount++;
    else if (status === "warning") warningCount++;
    else errorCount++;
    
    submissions.push({
      uploadId,
      rowIndex: i,
      personId,
      personName,
      department,
      teamLead,
      week,
      topPriority,
      actions,
      outcomes,
      blockers,
      notes,
      rawData: raw,
      mapping,
      validation: { status, issues },
      reviewed: false,
    });
  }
  
  return { submissions, totalRows, readyCount, warningCount, errorCount };
}

// ── Re-validate a single submission ─────────────────────────────────────────
export function revalidateSubmission(
  submission: ExtractedSubmission,
  people: Person[],
  existingSubmissions: { personId: string | null; week: string }[]
): ExtractedSubmission {
  const issues: ValidationIssue[] = [];
  
  // Check person
  if (!submission.personId) {
    const person = people.find(
      (p) =>
        p.name.toLowerCase() === submission.personName.toLowerCase() ||
        p.name.toLowerCase().includes(submission.personName.toLowerCase())
    );
    
    if (person) {
      submission.personId = person._id;
      submission.personName = person.name;
      submission.department = person.department;
      submission.teamLead = person.teamLead ?? "";
    } else {
      issues.push({
        code: VALIDATION_CODES.EMPLOYEE_NOT_MAPPED,
        message: `Employee not mapped: "${submission.personName}"`,
        severity: "error",
        field: "person"
      });
    }
  }
  
  // Check team lead
  if (submission.personId && !submission.teamLead) {
    issues.push({
      code: VALIDATION_CODES.TEAM_LEAD_NOT_FOUND,
      message: "Team lead not found",
      severity: "warning",
      field: "teamLead"
    });
  }
  
  // Check week
  if (!submission.week) {
    issues.push({
      code: VALIDATION_CODES.WEEK_NOT_DETECTED,
      message: "Week not specified",
      severity: "error",
      field: "week"
    });
  }
  
  // Check priority
  if (!submission.topPriority) {
    issues.push({
      code: VALIDATION_CODES.EMPTY_PRIORITY,
      message: "No priority specified",
      severity: "warning",
      field: "topPriority"
    });
  }
  
  // Check actions
  if (submission.actions.length === 0 && !submission.topPriority) {
    issues.push({
      code: VALIDATION_CODES.NO_ACTIONS_OR_PRIORITY,
      message: "No priority or actions found",
      severity: "error",
    });
  } else if (submission.actions.length > 0 && submission.actions.length < 3) {
    issues.push({
      code: VALIDATION_CODES.ACTIONS_LESS_THAN_3,
      message: `Only ${submission.actions.length} action(s)`,
      severity: "warning",
      field: "actions"
    });
  }
  
  // Check outcomes
  if (submission.outcomes.length === 0) {
    issues.push({
      code: VALIDATION_CODES.MISSING_OUTCOMES,
      message: "No outcomes specified",
      severity: "warning",
      field: "outcomes"
    });
  }
  
  // Check duplicates
  if (submission.personId && submission.week) {
    const exists = existingSubmissions.some(
      (s) => s.personId === submission.personId && s.week === submission.week
    );
    if (exists) {
      issues.push({
        code: VALIDATION_CODES.DUPLICATE_SUBMISSION,
        message: "Duplicate submission exists",
        severity: "warning",
      });
    }
  }
  
  const hasError = issues.some((i) => i.severity === "error");
  const hasWarning = issues.some((i) => i.severity === "warning");
  
  return {
    ...submission,
    validation: {
      status: hasError ? "error" : hasWarning ? "warning" : "ready",
      issues,
    },
  };
}

// ── Convert draft to final submission ───────────────────────────────────────
export function draftToSubmission(draft: ExtractedSubmission): Omit<import("./types").WeeklySubmission, "_id"> {
  return {
    personId: draft.personId,
    personName: draft.personName,
    department: draft.department,
    teamLead: draft.teamLead,
    week: draft.week,
    submittedAt: new Date().toISOString(),
    topPriority: draft.topPriority,
    actions: draft.actions,
    outcomes: draft.outcomes,
    blockers: draft.blockers,
    notes: draft.notes,
  };
}
