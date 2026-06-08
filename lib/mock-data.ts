import type {
  Person,
  WeeklySubmission,
  WeeklyInsight,
  ImportBatch,
  Theme,
} from "./types";
import { scoreSubmission } from "./scoring";

// ── Weeks ───────────────────────────────────────────────────────────────────
export const WEEKS = ["2026-W18", "2026-W19", "2026-W20", "2026-W21", "2026-W22", "2026-W23"];
export const CURRENT_WEEK = "2026-W23";
const WEEK_MONDAY: Record<string, string> = {
  "2026-W18": "2026-04-27",
  "2026-W19": "2026-05-04",
  "2026-W20": "2026-05-11",
  "2026-W21": "2026-05-18",
  "2026-W22": "2026-05-25",
  "2026-W23": "2026-06-01",
};

/** The leadership viewer (this console is for leadership only). */
export const VIEWER = { name: "Eleanor Vance", title: "Co-Founder & COO", color: "#4f46e5" };

// ── people (the people-mapping roster of WhatsApp submitters) ───────────────
interface Seed {
  id: string;
  name: string;
  phone: string;
  department: string;
  teamLead: string;
  title: string;
  color: string;
  joinedAt: string;
  active?: boolean;
}

const SEEDS: Seed[] = [
  { id: "p_001", name: "David Okafor", phone: "+1-555-0104", department: "Engineering", teamLead: "Marcus Chen", title: "Platform Engineer", color: "#10b981", joinedAt: "2022-09-20" },
  { id: "p_002", name: "Aisha Patel", phone: "+1-555-0105", department: "Engineering", teamLead: "Marcus Chen", title: "SWE Intern", color: "#f59e0b", joinedAt: "2026-01-05" },
  { id: "p_003", name: "Ravi Nair", phone: "+1-555-0140", department: "Engineering", teamLead: "Marcus Chen", title: "Backend Engineer", color: "#8b5cf6", joinedAt: "2023-05-02" },
  { id: "p_004", name: "Tom Bergström", phone: "+1-555-0106", department: "Engineering", teamLead: "Elena Rodriguez", title: "SWE Intern", color: "#6366f1", joinedAt: "2026-02-02" },
  { id: "p_005", name: "Sara Kone", phone: "+1-555-0141", department: "Engineering", teamLead: "Elena Rodriguez", title: "Frontend Engineer", color: "#0ea5e9", joinedAt: "2023-08-14" },
  { id: "p_006", name: "Nina Volkov", phone: "+1-555-0112", department: "Product", teamLead: "James Wright", title: "Product Analyst", color: "#ec4899", joinedAt: "2023-07-03" },
  { id: "p_007", name: "Leo Martins", phone: "+1-555-0113", department: "Product", teamLead: "James Wright", title: "Product Intern", color: "#10b981", joinedAt: "2026-01-19" },
  { id: "p_008", name: "Maya Johnson", phone: "+1-555-0117", department: "Design", teamLead: "Oliver Schmidt", title: "UX Researcher", color: "#0ea5e9", joinedAt: "2023-03-22" },
  { id: "p_009", name: "Raj Mehta", phone: "+1-555-0118", department: "Design", teamLead: "Oliver Schmidt", title: "Design Intern", color: "#f59e0b", joinedAt: "2026-02-16" },
  { id: "p_010", name: "Yuki Tanaka", phone: "+1-555-0121", department: "Marketing", teamLead: "Carlos Díaz", title: "Content Strategist", color: "#8b5cf6", joinedAt: "2023-09-11" },
  { id: "p_011", name: "Omar Haddad", phone: "+1-555-0142", department: "Marketing", teamLead: "Carlos Díaz", title: "Demand Gen Marketer", color: "#f59e0b", joinedAt: "2023-04-30" },
  { id: "p_012", name: "Chris Walker", phone: "+1-555-0126", department: "Sales", teamLead: "Fatima Al-Sayed", title: "Account Executive", color: "#6366f1", joinedAt: "2022-08-01" },
  { id: "p_013", name: "Lucia Romano", phone: "+1-555-0127", department: "Sales", teamLead: "Fatima Al-Sayed", title: "Sales Intern", color: "#0ea5e9", joinedAt: "2026-01-26" },
  { id: "p_014", name: "Bao Tran", phone: "+1-555-0143", department: "Operations", teamLead: "Amara Nwosu", title: "Ops Analyst", color: "#0ea5e9", joinedAt: "2022-12-01" },
  { id: "p_015", name: "Hannah Berg", phone: "+1-555-0144", department: "Operations", teamLead: "Amara Nwosu", title: "Ops Coordinator", color: "#ec4899", joinedAt: "2024-03-18" },
];

export const people: Person[] = SEEDS.map((s) => ({
  _id: s.id,
  name: s.name,
  phone: s.phone,
  department: s.department,
  teamLead: s.teamLead,
  title: s.title,
  active: s.active ?? true,
  joinedAt: s.joinedAt,
  avatarColor: s.color,
}));

/** Distinct team leads + departments — derived from the people mapping. */
export const TEAM_LEADS = Array.from(new Set(people.map((p) => p.teamLead)));
export const DEPARTMENTS = Array.from(new Set(people.map((p) => p.department)));

// ── Content pools per department (to build realistic WhatsApp messages) ─────
interface Pool {
  priorities: string[];
  actions: string[];
  outcomes: string[];
  blockers: string[];
}
const POOLS: Record<string, Pool> = {
  Engineering: {
    priorities: ["Ship the billing event schema", "Cut API p95 latency", "Stabilize the CI pipeline", "Migrate billing to event-driven"],
    actions: ["Refactored the billing producer", "Added a Redis caching layer", "Profiled the hot endpoints", "Wrote integration tests", "Reviewed 6 PRs", "Paired on the event schema"],
    outcomes: ["p95 latency down 15%", "Error rate down to 0.2%", "Shipped behind a feature flag", "Closed 4 tickets"],
    blockers: ["Waiting on infra capacity approval", "Flaky integration tests blocking CI", "Blocked by an upstream API change"],
  },
  Product: {
    priorities: ["Validate onboarding v2", "Run discovery on the AI assistant", "Synthesize interview findings"],
    actions: ["Ran 4 customer interviews", "Drafted the PRD", "Built the activation funnel report", "Aligned with design on the flows"],
    outcomes: ["Found 3 activation drop-offs", "Validated demand with 8 users", "Shared findings with leadership"],
    blockers: ["Legal review of data usage pending", "Waiting on an eng estimate", "Unclear scope from stakeholders"],
  },
  Design: {
    priorities: ["Unified design system v1", "Onboarding usability study", "Component library audit"],
    actions: ["Migrated 12 screens to tokens", "Ran 3 moderated sessions", "Documented the contribution guide", "Refreshed the icon set"],
    outcomes: ["Findings reshaped onboarding", "Cut component variants by 30%", "Published the v1 tokens"],
    blockers: ["Waiting on eng handoff", "Research recruiting delays", "Undecided direction on navigation"],
  },
  Marketing: {
    priorities: ["Launch the Q3 campaign", "Grow MQL volume", "Refresh the content calendar"],
    actions: ["Drafted the campaign brief", "Shipped 3 blog posts", "Set up the paid test", "Aligned with creative"],
    outcomes: ["MQLs up 12% week over week", "Brief approved by leadership", "Landing page is live"],
    blockers: ["Creative agency is a week behind", "Waiting on budget sign-off", "Attribution data has gaps"],
  },
  Sales: {
    priorities: ["Close the Northwind expansion", "Advance the enterprise pipeline", "QBR preparation"],
    actions: ["Ran 3 discovery calls", "Sent the proposal", "Looped in solutions engineering", "Updated the forecast"],
    outcomes: ["Two deals at verbal commit", "Northwind moved to procurement", "Added $180k to pipeline"],
    blockers: ["Deal stuck in customer procurement", "Waiting on the security questionnaire", "Champion went quiet"],
  },
  Operations: {
    priorities: ["Automate billing reconciliation", "Clean up the data pipeline", "Monthly close"],
    actions: ["Built the reconciliation script", "Validated last month's numbers", "Documented the runbook", "Fixed 5 mapping errors"],
    outcomes: ["Cut manual steps by half", "Reconciled within 1%", "Runbook published"],
    blockers: ["Waiting on finance sign-off", "Source data is inconsistent", "Tooling access pending"],
  },
};
function pick<T>(arr: T[], n: number, seed: number): T[] {
  const out: T[] = [];
  for (let i = 0; i < n; i++) out.push(arr[(seed + i) % arr.length]);
  return Array.from(new Set(out));
}

function buildSubmissions(): WeeklySubmission[] {
  const out: WeeklySubmission[] = [];
  let counter = 1;
  people.forEach((person, pi) => {
    const pool = POOLS[person.department];
    WEEKS.forEach((week, wi) => {
      const last = WEEKS.length - 1;
      // A handful of missing updates, concentrated in the most recent weeks.
      const missing =
        (pi % 6 === 0 && wi === last) ||
        (pi % 7 === 3 && wi === last - 1) ||
        (pi % 9 === 5 && wi === last);
      if (missing) return;

      const tier = (pi + wi) % 5 === 0 ? "weak" : (pi + wi) % 3 === 0 ? "partial" : "complete";
      const basePriority = pool.priorities[(pi + wi) % pool.priorities.length];
      const monday = WEEK_MONDAY[week];
      const submittedAt = `${monday}T${9 + ((pi + wi) % 8)}:${(pi * 7) % 6}0:00Z`;

      let topPriority = basePriority;
      let actions: string[] = [];
      let outcomes: string[] = [];
      let blockers: string[] = [];

      if (tier === "weak") {
        // Sparse update: at most a bare priority or a single action, no outcomes.
        if ((pi + wi) % 2 === 0) actions = pick(pool.actions, 1, pi + wi);
        else topPriority = "";
      } else if (tier === "partial") {
        actions = pick(pool.actions, 1 + ((pi + wi) % 2), pi + wi);
        if ((pi + wi) % 2 === 0) outcomes = pick(pool.outcomes, 1, pi + wi);
        if ((pi + wi) % 4 === 0) blockers = pick(pool.blockers, 1, pi + wi);
      } else {
        actions = pick(pool.actions, 2 + ((pi + wi) % 2), pi + wi);
        outcomes = pick(pool.outcomes, 1 + ((pi + wi) % 2), pi + wi + 1);
        if ((pi + wi) % 3 === 0) blockers = pick(pool.blockers, 1, pi + wi);
      }

      out.push({
        _id: `ws_${String(counter++).padStart(3, "0")}`,
        personId: person._id,
        personName: person.name,
        department: person.department,
        teamLead: person.teamLead ?? "",
        week,
        submittedAt,
        topPriority,
        actions,
        outcomes,
        blockers,
        notes: "",
      });
    });
  });
  return out;
}

export const weeklySubmissions: WeeklySubmission[] = buildSubmissions();

// ── weekly_insights (precomputed per-week aggregates) ───────────────────────
function topThemes(counts: Record<string, number>): Theme[] {
  return Object.entries(counts)
    .map(([theme, count]) => ({ theme, count }))
    .sort((a, b) => b.count - a.count);
}

function buildInsights(): WeeklyInsight[] {
  const expected = people.filter((p) => p.active).length;
  return WEEKS.map((week) => {
    const subs = weeklySubmissions.filter((s) => s.week === week);
    const received = subs.length;
    const scores = subs.map((s) => scoreSubmission(s));
    const weakCount = scores.filter((sc) => sc.status === "Weak").length;
    const avgCompleteness = received
      ? Math.round(scores.reduce((a, sc) => a + sc.completeness, 0) / received)
      : 0;
    const blockerCount = subs.reduce((a, s) => a + s.blockers.length, 0);

    const pThemes: Record<string, number> = {};
    const bThemes: Record<string, number> = {};
    // Themes now come from MongoDB AI analysis only - mock data returns empty themes
    const priorityThemes = topThemes(pThemes);
    const blockerThemes = topThemes(bThemes);

    return {
      _id: `wi_${week}`,
      week,
      expected,
      received,
      missing: expected - received,
      complianceRate: expected ? Math.round((received / expected) * 100) : 0,
      blockerCount,
      avgCompleteness,
      weakCount,
      topPriorityTheme: priorityThemes[0]?.theme ?? "—",
      priorityThemes,
      blockerThemes,
    };
  });
}

export const weeklyInsights: WeeklyInsight[] = buildInsights();

// ── Import history ──────────────────────────────────────────────────────────
export const importBatches: ImportBatch[] = [
  { _id: "imp_01", fileName: "whatsapp_export_W22.xlsx", importedBy: "Eleanor Vance", importedAt: "2026-05-25T09:14:00Z", collection: "weekly_submissions", totalRows: 14, successCount: 13, failureCount: 1, status: "Partial" },
  { _id: "imp_02", fileName: "people_roster.xlsx", importedBy: "Amara Nwosu", importedAt: "2026-05-02T15:40:00Z", collection: "people", totalRows: 15, successCount: 15, failureCount: 0, status: "Completed" },
  { _id: "imp_03", fileName: "whatsapp_export_W21.xlsx", importedBy: "Eleanor Vance", importedAt: "2026-05-18T08:55:00Z", collection: "weekly_submissions", totalRows: 14, successCount: 14, failureCount: 0, status: "Completed" },
];
