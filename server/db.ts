import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";
import "dotenv/config";
import dns from "node:dns";
import { promisify } from "node:util";

// Force IPv4 resolution to prevent ENETUNREACH errors on networks without IPv6 support
dns.setDefaultResultOrder("ipv4first");

const { Pool } = pg;

const connectionString =
  process.env.DATABASE_POOLER_URL?.trim() || process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const SUPABASE_DIRECT_HOST = /^db\.[a-z0-9]+\.supabase\.co$/i;

// #region agent log
function debugDbLog(
  hypothesisId: string,
  location: string,
  message: string,
  data: Record<string, unknown>,
) {
  fetch("http://127.0.0.1:7632/ingest/2e18d3d7-f245-49bc-8113-d6d425d4a36d", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "174623",
    },
    body: JSON.stringify({
      sessionId: "174623",
      runId: "pre-fix",
      hypothesisId,
      location,
      message,
      data,
      timestamp: Date.now(),
    }),
  }).catch(() => {});
}
// #endregion

function assertDatabaseReachable(hostname: string): void {
  if (
    SUPABASE_DIRECT_HOST.test(hostname) &&
    process.env.DATABASE_ALLOW_IPV6_DIRECT !== "true"
  ) {
    // #region agent log
    debugDbLog("F", "server/db.ts:guard", "blocked Supabase direct IPv6 host", {
      hostname,
      hasPoolerUrl: Boolean(process.env.DATABASE_POOLER_URL?.trim()),
    });
    // #endregion
    throw new Error(
      "DATABASE_URL uses Supabase direct host (db.*.supabase.co), which is IPv6-only. " +
        "This machine cannot reach that address (EHOSTUNREACH). " +
        "Replace DATABASE_URL with the Session pooler URI from Supabase Dashboard → Connect, " +
        "or set DATABASE_POOLER_URL. To override, set DATABASE_ALLOW_IPV6_DIRECT=true. " +
        "See https://supabase.com/docs/guides/database/connecting-to-postgres",
    );
  }
}

const dbUrl = new URL(connectionString);
const dbHostname = dbUrl.hostname;
const lookup = promisify(dns.lookup);
void (async () => {
  debugDbLog("D", "server/db.ts:startup", "dns default result order", {
    defaultResultOrder: dns.getDefaultResultOrder?.() ?? "unknown",
    hostname: dbHostname,
    port: dbUrl.port || "5432",
    isIPv6Literal: dbHostname.includes(":"),
  });
  try {
    const all = await promisify(dns.lookup)(dbHostname, { all: true });
    debugDbLog("A", "server/db.ts:dns-all", "lookup all addresses", {
      hostname: dbHostname,
      addresses: all,
    });
  } catch (e) {
    debugDbLog("A", "server/db.ts:dns-all", "lookup all failed", {
      hostname: dbHostname,
      error: e instanceof Error ? e.message : String(e),
    });
  }
  try {
    const v4 = await lookup(dbHostname, { family: 4 });
    debugDbLog("B", "server/db.ts:dns-v4", "lookup IPv4 only", {
      hostname: dbHostname,
      address: v4.address,
      family: v4.family,
    });
  } catch (e) {
    debugDbLog("B", "server/db.ts:dns-v4", "lookup IPv4 failed", {
      hostname: dbHostname,
      error: e instanceof Error ? e.message : String(e),
    });
  }
  try {
    const v6 = await lookup(dbHostname, { family: 6 });
    debugDbLog("C", "server/db.ts:dns-v6", "lookup IPv6 only", {
      hostname: dbHostname,
      address: v6.address,
      family: v6.family,
    });
  } catch (e) {
    debugDbLog("C", "server/db.ts:dns-v6", "lookup IPv6 failed", {
      hostname: dbHostname,
      error: e instanceof Error ? e.message : String(e),
    });
  }
})();
// #endregion

assertDatabaseReachable(dbHostname);

export const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false,
  },
});

// #region agent log
pool.on("error", (err) => {
  debugDbLog("E", "server/db.ts:pool-error", "pool error event", {
    code: (err as NodeJS.ErrnoException).code,
    message: err.message,
    address: (err as NodeJS.ErrnoException).address,
    syscall: (err as NodeJS.ErrnoException).syscall,
  });
});
// #endregion

export const db = drizzle(pool, { schema });
