import type { WeeklySubmission, SubmissionStatus } from "./types";

// ───────────────────────────────────────────────────────────────────────────
// Pure functions: derive completeness, status, and themes from stored fields
// only. No external metrics. Shared by the seed data and the live analytics so
// what's displayed always matches what's stored.
// ───────────────────────────────────────────────────────────────────────────

export interface SubmissionScore {
  completeness: number; // 0–100
  status: SubmissionStatus;
}

/**
 * Response completeness from the structured fields a submission actually has:
 * a stated priority, action items, and outcomes. Blockers are optional context
 * and don't penalize the score.
 *
 *   topPriority present        → 30
 *   actions: 2+ → 40, exactly 1 → 22
 *   outcomes: 1+               → 30
 *
 * Status: Weak < 45, Partial 45–74, Complete 75+.
 */
export function scoreSubmission(sub: WeeklySubmission): SubmissionScore {
  let c = 0;
  if ((sub.topPriority ?? "").trim().length > 3) c += 30;

  const acts = (sub.actions ?? []).filter((a) => (a ?? "").trim()).length;
  if (acts >= 2) c += 40;
  else if (acts === 1) c += 22;

  if ((sub.outcomes ?? []).filter((o) => (o ?? "").trim()).length >= 1) c += 30;

  c = Math.max(0, Math.min(100, c));

  let status: SubmissionStatus;
  if (c < 45) status = "Weak";
  else if (c < 75) status = "Partial";
  else status = "Complete";

  return { completeness: c, status };
}

// ── Theme classification (keyword-based, transparent) ───────────────────────
interface ThemeRule {
  theme: string;
  keywords: string[];
}

// Vocabulary aligned to this org's domain (PR / influencer marketing) and to
// the AI theme names stored in weekly_insights, so the keyword fallback yields
// meaningful themes instead of a giant "Other" bucket. Order matters — first
// matching rule wins.
const BLOCKER_RULES: ThemeRule[] = [
  { theme: "No Blocker", keywords: ["no blocker", "nothing as of now", "nothing", "none", "n/a", "all good", "no issues", "no challenge"] },
  { theme: "Skill Gap", keywords: ["confidence", "drafting", "writing", "learn", "improve my", "skill", "training", "still building", "need to work on"] },
  { theme: "Recruitment Challenge", keywords: ["hire", "hiring", "recruit", "candidate", "vacancy", "backfill"] },
  { theme: "Client Approval", keywords: ["approval", "approvals", "sign-off", "sign off", "feedback from", "client end", "revision", "review cycle", "delay in approval"] },
  { theme: "External Dependency", keywords: ["micro-management", "micromanagement", "co-ordinate", "coordinate", "depend", "dependency", "celeb manager", "agency", "vendor", "third party", "third-party", "waiting on", "cello", "ethnix", "bioderma", "client team", "relationship", "cold outreach"] },
  { theme: "Timeline Risk", keywords: ["delay", "timeline", "deadline", "few days", "very few days", "lock and shoot", "shoot", "turnaround", "behind", "late", "time crunch", "short notice"] },
  { theme: "Resource Constraint", keywords: ["bandwidth", "resourc", "capacity", "availability", "manpower", "workload", "stretched", "overloaded", "too much"] },
  { theme: "Process Issue", keywords: ["process", "communication", "follow up", "follow-up", "coordination", "alignment", "clarity", "unclear"] },
];

const PRIORITY_RULES: ThemeRule[] = [
  { theme: "Media Outreach", keywords: ["coverage", "media", "outreach", "press", "pr ", "article", "interview", "story", "publication", "rbm", "release", "event", "feature", "visibility", "journalist"] },
  { theme: "Influencer Marketing", keywords: ["influencer", "creator", "profile", "shoot", "video", "reel", "barter", "collab", "celeb", "ugc"] },
  { theme: "Content Production", keywords: ["draft", "script", "content", "copy", "caption", "writing", "newsletter", "blog"] },
  { theme: "Social Media", keywords: ["social media", "instagram", "linkedin", "engagement", "follower", "handle", "calendar"] },
  { theme: "Brand Strategy", keywords: ["brand", "strategy", "positioning", "narrative", "messaging"] },
  { theme: "Business Development", keywords: ["pitch", "proposal", "new business", "new client", "revenue", "lead generation", "sales", "onboarding client"] },
  { theme: "Recruitment", keywords: ["hire", "hiring", "recruit", "candidate", "onboarding new"] },
  { theme: "Design", keywords: ["design", "creative", "graphic", "visual", "banner", "logo"] },
  { theme: "HR", keywords: ["payroll", "appraisal", "policy", "attendance", "leave", "human resource"] },
  // Client-account priority lists (often just brand names) → account servicing.
  { theme: "Account Servicing", keywords: ["dominos", "cello", "bioderma", "ethnix", "pilgrim", "juliet", "roshvasttu", "uni seoul", "raymond", "tira", "phd", "client"] },
];

function classify(text: string, rules: ThemeRule[], fallback = "Other"): string {
  const t = ` ${text.toLowerCase()} `;
  for (const rule of rules) {
    if (rule.keywords.some((k) => t.includes(k))) return rule.theme;
  }
  return fallback;
}

export function classifyBlocker(text: string): string {
  return classify(text ?? "", BLOCKER_RULES);
}

export function classifyPriority(text: string): string {
  return classify(text ?? "", PRIORITY_RULES);
}
