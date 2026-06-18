import { MongoClient, Db } from "mongodb";

// ───────────────────────────────────────────────────────────────────────────
// Cached MongoClient (one connection reused across hot-reloads / requests).
// The database name is auto-detected (the collection holding weekly_submissions)
// unless MONGODB_DB is set explicitly.
// ───────────────────────────────────────────────────────────────────────────

const uri = process.env.MONGODB_URI;

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
  // eslint-disable-next-line no-var
  var _mongoDbName: string | undefined;
}

function clientPromise(): Promise<MongoClient> {
  if (!uri) throw new Error("MONGODB_URI is not set in the environment");
  if (!global._mongoClientPromise) {
    const client = new MongoClient(uri, { serverSelectionTimeoutMS: 8000 });
    // If the initial connect fails (cluster paused, IP not allowlisted, etc.)
    // clear the cached promise so the next request retries instead of being
    // stuck with a permanently-rejected promise until the server restarts.
    global._mongoClientPromise = client.connect().catch((err) => {
      global._mongoClientPromise = undefined;
      throw err;
    });
  }
  return global._mongoClientPromise;
}

const KNOWN_COLLECTIONS = ["weekly_submissions", "people", "weekly_insights"];

async function resolveDbName(client: MongoClient): Promise<string> {
  if (process.env.MONGODB_DB) return process.env.MONGODB_DB;
  if (global._mongoDbName) return global._mongoDbName;
  try {
    const { databases } = await client.db().admin().listDatabases();
    for (const d of databases) {
      if (["admin", "local", "config"].includes(d.name)) continue;
      const cols = await client.db(d.name).listCollections().toArray();
      if (cols.some((c) => KNOWN_COLLECTIONS.includes(c.name))) {
        global._mongoDbName = d.name;
        return d.name;
      }
    }
  } catch {
    // listDatabases may be unauthorized — fall through to default.
  }
  global._mongoDbName = "test";
  return "test";
}

export async function getDb(): Promise<Db> {
  const client = await clientPromise();
  const name = await resolveDbName(client);
  return client.db(name);
}

export const COLLECTIONS = {
  people: "people",
  submissions: "weekly_submissions",
  insights: "weekly_insights",
  uploads: "uploads",
  extractedSubmissions: "extracted_submissions",
  notes: "notes",
  assignedTasks: "assigned_tasks",
} as const;
