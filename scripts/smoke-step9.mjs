#!/usr/bin/env node
// scripts/smoke-step9.mjs
//
// End-to-end HTTP smoke for the combined PATCH → notify flow the popover
// walks. Step 6 covered PATCH/DELETE in isolation; Step 7 covered notify in
// isolation; this covers the two-call sequence, including the noop branch
// and invalid_role / not_found branches the popover's error table expects.
//
// Usage:
//   1. .test-auth must contain a valid admin session cookie (see Step 6).
//   2. Run: node scripts/smoke-step9.mjs
//
// The fixture picks a shooter with user_id IS NOT NULL and ≥2 roles, so
// the happy-path notify POST sends one real email. All role changes are
// reverted at the end so the test is idempotent.

import { readFileSync, existsSync, writeFileSync, unlinkSync } from "node:fs";
import { execSync } from "node:child_process";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";

const BASE = "https://prewedd-crew.vercel.app";
const PROJECT_REF = "oljrnmgiaypdysmoaovo";
const COOKIE_NAME = `sb-${PROJECT_REF}-auth-token`;

const cookiePath = resolve(".test-auth");
if (!existsSync(cookiePath)) {
  console.error("✗ .test-auth file not found in project root");
  process.exit(2);
}
const cookieValue = readFileSync(cookiePath, "utf8").trim();
const cookieHeader = `${COOKIE_NAME}=${encodeURIComponent(cookieValue)}`;

function runSql(sql) {
  const tmpFile = resolve(tmpdir(), `smoke9-sql-${randomUUID()}.sql`);
  writeFileSync(tmpFile, sql, "utf8");
  try {
    const out = execSync(`npx supabase db query --linked < "${tmpFile}"`, {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
      shell: true,
    });
    const jsonStart = out.indexOf("{");
    if (jsonStart < 0) throw new Error("no JSON in supabase output: " + out);
    return JSON.parse(out.slice(jsonStart));
  } catch (e) {
    console.error("SQL failed:", sql);
    if (e.stdout) console.error("stdout:", e.stdout.toString());
    if (e.stderr) console.error("stderr:", e.stderr.toString());
    throw e;
  } finally {
    try { unlinkSync(tmpFile); } catch {}
  }
}

async function call(path, method, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Cookie: cookieHeader,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json;
  try { json = await res.json(); } catch { json = null; }
  return { status: res.status, body: json };
}

const results = [];
let passed = 0, failed = 0;

function assert(name, actual, predicate) {
  const ok =
    typeof predicate === "function"
      ? predicate(actual)
      : JSON.stringify(actual) === JSON.stringify(predicate);
  results.push({ name, ok, actual });
  if (ok) { passed++; console.log(`  ✓ ${name}`); }
  else    { failed++; console.log(`  ✗ ${name} — got ${JSON.stringify(actual)}`); }
}

async function main() {
  console.log("\n🧪 Step 9 smoke — combined PATCH → notify flow\n");

  // ── Find a safe fixture: assignment where shooter has user_id + ≥2 roles
  console.log("Phase 0: locate fixture (shooter with user_id + ≥2 roles)");
  const fixtures = runSql(`
    SELECT
      a.id AS assignment_id,
      a.role AS current_role,
      sp.roles,
      sp.name
    FROM assignments a
    JOIN shooter_profiles sp ON sp.id = a.shooter_id
    WHERE sp.user_id IS NOT NULL
      AND cardinality(sp.roles) >= 2
      AND a.role = ANY(sp.roles)
    LIMIT 1;
  `);
  if (!fixtures.rows?.length) {
    console.error("✗ no suitable fixture — need assignment where shooter has user_id AND ≥2 roles");
    process.exit(2);
  }
  const fix = fixtures.rows[0];
  const otherRole = fix.roles.find((r) => r !== fix.current_role);
  console.log(`  fixture: ${fix.name} (${fix.current_role} → ${otherRole})`);

  // Clear rate limit bucket before starting
  runSql("DELETE FROM notify_rate_limits;");

  // ── Phase 1: happy path (PATCH role change → POST notify role_change) ─
  console.log("\nPhase 1: happy path (PATCH updated → notify role_change)");
  const patch1 = await call("/api/assign", "PATCH", {
    assignment_id: fix.assignment_id,
    new_role: otherRole,
  });
  assert("PATCH updated → 200 action=updated",
    patch1,
    (r) => r.status === 200 && r.body?.action === "updated");

  const notify1 = await call("/api/assignment-notify", "POST", {
    assignment_id: fix.assignment_id,
    action: "role_change",
  });
  assert("POST notify role_change → 200 sent>=1 failed=0",
    notify1,
    (r) => r.status === 200 && r.body?.ok === true && r.body?.sent >= 1 && r.body?.failed === 0);

  // Revert
  await call("/api/assign", "PATCH", {
    assignment_id: fix.assignment_id,
    new_role: fix.current_role,
  });

  // ── Phase 2: noop — switch to role the shooter already has ──────────
  console.log("\nPhase 2: noop (PATCH to current role)");
  const patch2 = await call("/api/assign", "PATCH", {
    assignment_id: fix.assignment_id,
    new_role: fix.current_role,
  });
  assert("PATCH to current role → 200 noop=true",
    patch2,
    (r) => r.status === 200 && r.body?.noop === true);

  // ── Phase 3: invalid_role (from RPC — shooter doesn't hold it) ──────
  // Use a valid crew role that the shooter does NOT have in their roles
  // array. The route's pre-RPC check only rejects non-crew strings; the
  // "shooter doesn't hold this role" check lives in the RPC and returns
  // { error: "invalid_role" } — which is what the popover branches on.
  console.log("\nPhase 3: invalid_role (valid crew role, not held)");
  // Find a crew role the shooter doesn't have
  const allCrewRoles = ["lead_photo", "second_photo", "lead_video", "second_video", "assistant", "bts"];
  const unhelpRole = allCrewRoles.find((r) => !fix.roles.includes(r));
  if (!unhelpRole) {
    console.log("  ⚠ fixture shooter holds every crew role — skipping Phase 3");
  } else {
    const patch3 = await call("/api/assign", "PATCH", {
      assignment_id: fix.assignment_id,
      new_role: unhelpRole,
    });
    assert(`PATCH with ${unhelpRole} (not held) → 400 invalid_role`,
      patch3,
      (r) => r.status === 400 && r.body?.error === "invalid_role");
  }

  // ── Phase 4: not_found ───────────────────────────────────────────────
  console.log("\nPhase 4: not_found");
  const patch4 = await call("/api/assign", "PATCH", {
    assignment_id: "00000000-0000-0000-0000-000000000000",
    new_role: otherRole,
  });
  assert("PATCH on nonexistent assignment → 404 not_found",
    patch4,
    (r) => r.status === 404 && r.body?.error === "not_found");

  // Cleanup
  runSql("DELETE FROM notify_rate_limits;");

  // ── Summary ──────────────────────────────────────────────────────────
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`  Passed: ${passed} / Failed: ${failed}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  if (failed > 0) {
    for (const r of results.filter(r => !r.ok)) console.log(`  • ${r.name}`);
    process.exit(1);
  }
}

main().catch((e) => { console.error("fatal:", e); process.exit(1); });
