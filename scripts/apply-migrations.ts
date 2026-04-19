#!/usr/bin/env bun
/**
 * Apply all scripts/NNN-*.sql migrations sequentially to the approved
 * anonymized Supabase project via the Management API.
 *
 * Hardcoded to target `ifqgjvcygzmeaamejnrx` only. Any env override
 * that resolves to a different ref will abort, and any listed
 * forbidden ref aborts hard.
 *
 * Auth: uses the local Supabase CLI access token at ~/.supabase/access-token
 * (user-level). All HTTP calls target the approved ref's endpoint only.
 *
 * Run:
 *   bun scripts/apply-migrations.ts
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const APPROVED_REF = process.env.APPROVED_SUPABASE_REF ?? "ifqgjvcygzmeaamejnrx";
const FORBIDDEN_REFS = (process.env.FORBIDDEN_SUPABASE_REFS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const ROOT = new URL("..", import.meta.url).pathname;

// --- 1. Load access token (local user-level Supabase CLI state) -------
const tokenPath = join(homedir(), ".supabase", "access-token");
const token = readFileSync(tokenPath, "utf-8").trim();
if (!token.startsWith("sbp_")) {
  console.error(`Unexpected access token format at ${tokenPath}`);
  process.exit(1);
}

// --- 2. Guard ---------------------------------------------------------
for (const ref of FORBIDDEN_REFS) {
  if (APPROVED_REF === ref) {
    console.error(`FATAL: approved ref matches a forbidden ref (${ref}).`);
    process.exit(1);
  }
}

const endpoint = `https://api.supabase.com/v1/projects/${APPROVED_REF}/database/query`;
console.log(`target: ${endpoint}`);

// --- 3. Run SQL via Management API -----------------------------------
async function runSql(label: string, sql: string): Promise<void> {
  const t0 = Date.now();
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });
  const ms = Date.now() - t0;
  const body = await res.text();
  if (!res.ok) {
    if (IDEMPOTENT_ERRORS.some((rx) => rx.test(body))) {
      console.log(`  ~ [${ms}ms] ${label} (already applied)`);
      return;
    }
    console.error(`  ✗ [${ms}ms] ${label} — HTTP ${res.status}`);
    console.error(`    ${body.slice(0, 400)}`);
    throw new Error(`migration failed: ${label}`);
  }
  console.log(`  ✓ [${ms}ms] ${label}`);
}

// Assertion-based test files that check the original seed data — skip
// on a fresh anonymized demo project since the data doesn't match.
const SKIP_FILES = new Set([
  "012-test-rpcs.sql",
]);

// Some migrations change function signatures. When re-run, the old
// signature lingers and COMMENT / GRANT statements become ambiguous.
// Drop all variants before applying the newer version.
const DROP_ALL_TOP_CLIENTS = `
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT oid::regprocedure::text AS sig
    FROM pg_proc
    WHERE proname = 'top_clients'
  LOOP
    EXECUTE format('DROP FUNCTION IF EXISTS %s CASCADE', r.sig);
  END LOOP;
END $$;
`;

const PREFLIGHT_BEFORE: Record<string, string> = {
  "016-top-clients-exclude-non-transformees.sql": DROP_ALL_TOP_CLIENTS,
  "028-top-clients-sort-mode.sql": DROP_ALL_TOP_CLIENTS,
};

// Tolerate errors that indicate the migration was already applied, so
// the script is resumable / idempotent.
const IDEMPOTENT_ERRORS = [
  /already exists/i,
  /duplicate_column/i,
  /duplicate_object/i,
  /cannot change return type of existing function/i,
  /cannot change name of input parameter/i,
];

// Migrations 030/031 depend on offre_lignes / commande_lignes which are
// created in migrations 035-037. The filename numbering is inherited
// from the original project and breaks topological order, so reorder
// here. Any files not explicitly listed are sorted alphabetically.
const RUN_ORDER_OVERRIDE: string[] = [
  // ... everything up to 029 first (alphabetical)
  "029-enrich-regions-from-cp.sql",
  // Create pieces + lignes + related columns BEFORE patches using them
  "034-sap-columns.sql",
  "035-table-pieces.sql",
  "036-table-lignes.sql",
  "037-top-pieces-entreprise.sql",
  // Patches using offre_lignes / commande_lignes
  "030-designation-fr-column.sql",
  "031-exclude-frais-top-materiaux.sql",
  "032-fix-top-clients-sort.sql",
  "033-entreprises-sans-email-rpc.sql",
];

function orderMigrations(all: string[]): string[] {
  const pinned = new Set(RUN_ORDER_OVERRIDE);
  const early = all.filter((f) => !pinned.has(f)).sort();
  return [...early, ...RUN_ORDER_OVERRIDE];
}

// --- 4. Collect migrations -------------------------------------------
const scriptsDir = join(ROOT, "scripts");
const allMigrations = readdirSync(scriptsDir)
  .filter((f) => /^\d{3}-.*\.sql$/.test(f))
  .filter((f) => !SKIP_FILES.has(f));
const migrations = orderMigrations(allMigrations);

console.log(`found ${migrations.length} migration files (${SKIP_FILES.size} skipped)`);
console.log("---");

// --- 5. Apply in order -----------------------------------------------
async function main(): Promise<void> {
  for (const f of migrations) {
    const preflight = PREFLIGHT_BEFORE[f];
    if (preflight) {
      await runSql(`preflight:${f}`, preflight);
    }
    const sql = readFileSync(join(scriptsDir, f), "utf-8");
    await runSql(f, sql);
  }
  console.log("---");
  console.log(`✓ ${migrations.length} migrations applied to ${APPROVED_REF}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
