#!/usr/bin/env node
// scripts/smoke-step6.mjs
//
// Step 6 HTTP smoke test for /api/assign PATCH + DELETE.
//
// Usage:
//   1. Log into https://prewedd-crew.vercel.app as an admin in a browser
//   2. Open devtools → Application → Cookies → copy the value of the
//      "sb-<project-ref>-auth-token" cookie (the one starting with "base64-")
//   3. Save that value to .test-auth in the project root (no trailing newline)
//   4. Run: node scripts/smoke-step6.mjs
//
// The script never prints the cookie value. It exits 0 if every test passes,
// non-zero (with a summary of failures) otherwise.
//
// Setup/teardown: the script assumes the "Yvette & Sebastian" wedding on
// 2026-04-18 with 3 assignments is present in production. It inserts a
// temporary 4th assignment via direct SQL (so the HTTP layer is exercised
// only for the test cases themselves), then restores the original state at
// the end regardless of pass/fail.

import { readFileSync, existsSync, writeFileSync, unlinkSync } from "node:fs";
import { execSync } from "node:child_process";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";

const BASE = "https://prewedd-crew.vercel.app";
const PROJECT_REF = "oljrnmgiaypdysmoaovo";
const COOKIE_NAME = `sb-${PROJECT_REF}-auth-token`;

// ── Test fixture IDs (Yvette & Sebastian, 2026-04-18) ────────────────────
const WEDDING_ID = "8505b7a4-2b8b-49a0-bf16-8df2ee034939";

// Katie Koutsouradis — holds [lead_photo, second_photo]
const KATIE_ASSIGNMENT = "9cadd554-30c6-4dd4-b100-1cc57dc28b3f";
const KATIE_SHOOTER = "edbfafea-9b0e-40cd-9b47-b3033a7c2f5b";
const KATIE_ORIGINAL_ROLE = "lead_photo";

// Caleb Snyder — holds [lead_video, second_video]
const CALEB_ASSIGNMENT = "1295e451-11e3-44fa-8fce-ab6ff7d27cd4";
const CALEB_ORIGINAL_ROLE = "lead_video";

// Amanda MacPhee — holds [second_photo] ONLY (cannot swap with Katie's lead_photo)
const AMANDA_ASSIGNMENT = "ac41240b-4a4e-4c40-ae2b-66a4753097b2";
const AMANDA_ORIGINAL_ROLE = "second_photo";

// Esra Pozan Warren — NOT on this wedding originally; holds [lead_photo, second_photo]
// Used to create a legal-swap conflict: we insert her at second_photo so Katie's
// lead_photo → second_photo attempt conflicts with a shooter who DOES hold lead_photo.
const ESRA_SHOOTER = "e0908d05-6b10-4235-940a-d4a0400c93e6";

// ── Cookie loading ────────────────────────────────────────────────────────
const cookiePath = resolve(".test-auth");
if (!existsSync(cookiePath)) {
  console.error("✗ .test-auth file not found in project root");
  console.error("  Paste your sb-<ref>-auth-token cookie value into .test-auth");
  process.exit(2);
}
const cookieValue = readFileSync(cookiePath, "utf8").trim();
if (!cookieValue.startsWith("base64-")) {
  console.error("✗ .test-auth does not look like a Supabase session cookie");
  console.error("  Expected value starting with 'base64-'");
  process.exit(2);
}
const cookieHeader = `${COOKIE_NAME}=${encodeURIComponent(cookieValue)}`;

// ── SQL helpers (direct DB access for setup/teardown only) ────────────────
// Windows shell can't handle multiline piped heredocs reliably, so we write
// each SQL snippet to a temp file and redirect stdin from it.
function runSql(sql) {
  const tmpFile = resolve(tmpdir(), `smoke-sql-${randomUUID()}.sql`);
  writeFileSync(tmpFile, sql, "utf8");
  try {
    const out = execSync(`npx supabase db query --linked < "${tmpFile}"`, {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
      shell: true,
    });
    // Output contains "Initialising login role..." before JSON. Extract the JSON.
    const jsonStart = out.indexOf("{");
    if (jsonStart < 0) {
      throw new Error("no JSON in supabase output: " + out);
    }
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

// ── HTTP helper ───────────────────────────────────────────────────────────
async function apiCall(method, body) {
  const res = await fetch(`${BASE}/api/assign`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Cookie: cookieHeader,
    },
    body: JSON.stringify(body),
  });
  let json;
  try {
    json = await res.json();
  } catch {
    json = { _parseError: "non-JSON response" };
  }
  return { status: res.status, body: json };
}

// ── Test runner ───────────────────────────────────────────────────────────
const results = [];
let passed = 0;
let failed = 0;

function assert(name, actual, expected, extra = "") {
  const ok = JSON.stringify(actual) === JSON.stringify(expected) || expected(actual);
  results.push({ name, ok, actual, expected: typeof expected === "function" ? "<fn>" : expected, extra });
  if (ok) { passed++; console.log(`  ✓ ${name}`); }
  else    { failed++; console.log(`  ✗ ${name}  — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`); }
}

function expectStatus(code) { return (r) => r.status === code; }
function expectBodyError(code) { return (r) => r.body?.error === code; }
function expectStatusAndError(status, errorCode) {
  return (r) => r.status === status && r.body?.error === errorCode;
}

// ── Main ──────────────────────────────────────────────────────────────────
async function main() {
  console.log("\n🧪 Step 6 smoke test — /api/assign PATCH + DELETE\n");

  // Phase 1: verify cookie works by checking auth on the happy path endpoint
  console.log("Phase 0: auth sanity check");
  const authCheck = await apiCall("PATCH", {});
  if (authCheck.status === 403) {
    console.error("  ✗ cookie rejected (403) — session expired or not admin");
    process.exit(2);
  }
  if (authCheck.status !== 400) {
    console.error(`  ✗ unexpected status ${authCheck.status} on empty PATCH — expected 400 (missing fields)`);
    console.error("    body:", authCheck.body);
    process.exit(2);
  }
  console.log("  ✓ cookie is valid admin session\n");

  // Phase 2: snapshot original state
  console.log("Phase 1: snapshot original state");
  const snapshot = runSql(`
    SELECT id, shooter_id, role FROM assignments WHERE wedding_id = '${WEDDING_ID}' ORDER BY role;
  `);
  console.log(`  ✓ captured ${snapshot.rows.length} original assignments`);

  // Phase 3: insert temporary Esra assignment to set up legal-swap conflict
  console.log("\nPhase 2: setup legal-swap fixture (insert Esra at second_photo)");
  // Esra holds both lead_photo AND second_photo, so Katie's lead_photo → second_photo
  // with swap action should succeed (Esra can take lead_photo).
  // But Amanda ALREADY holds second_photo, so this creates a 2-conflict state we
  // need to avoid. Solution: temporarily remove Amanda first, insert Esra, run tests,
  // then reinsert Amanda at the end.
  runSql(`DELETE FROM assignments WHERE id = '${AMANDA_ASSIGNMENT}';`);
  const esraInsert = runSql(`
    INSERT INTO assignments (wedding_id, shooter_id, role, status)
    VALUES ('${WEDDING_ID}', '${ESRA_SHOOTER}', 'second_photo', 'assigned')
    RETURNING id;
  `);
  const esraAssignmentId = esraInsert.rows[0].id;
  console.log(`  ✓ Amanda removed, Esra inserted as second_photo (id: ${esraAssignmentId.slice(0, 8)}...)`);

  let testFailed = false;
  try {
    // ── Phase 4: run tests ─────────────────────────────────────────────
    console.log("\nPhase 3: HTTP tests");

    // Test 1: PATCH missing fields → 400
    assert("PATCH missing fields → 400",
      (await apiCall("PATCH", {})), expectStatus(400));

    // Test 2: PATCH with invalid role → 400 invalid role (isCrewRole check)
    assert("PATCH invalid role literal → 400",
      (await apiCall("PATCH", { assignment_id: KATIE_ASSIGNMENT, new_role: "not_a_role" })),
      expectStatus(400));

    // Test 3: PATCH with role shooter doesn't hold (Katie → drone) → 400 invalid_role
    assert("PATCH shooter doesn't hold role → 400 invalid_role",
      (await apiCall("PATCH", { assignment_id: KATIE_ASSIGNMENT, new_role: "drone" })),
      expectStatusAndError(400, "invalid_role"));

    // Test 4: PATCH with invalid conflict_action → 400
    assert("PATCH invalid conflict_action → 400",
      (await apiCall("PATCH", {
        assignment_id: KATIE_ASSIGNMENT, new_role: "second_photo", conflict_action: "nuke"
      })),
      expectStatus(400));

    // Test 5: PATCH swap without conflict_assignment_id → 400
    assert("PATCH swap missing conflict_assignment_id → 400",
      (await apiCall("PATCH", {
        assignment_id: KATIE_ASSIGNMENT, new_role: "second_photo", conflict_action: "swap"
      })),
      expectStatus(400));

    // Test 6: PATCH no-conflict path — Caleb lead_video → second_video
    {
      const r = await apiCall("PATCH", { assignment_id: CALEB_ASSIGNMENT, new_role: "second_video" });
      assert("PATCH Caleb lead_video → second_video (no conflict) → 200",
        r, (x) => x.status === 200 && x.body?.ok === true && x.body?.action === "updated");
      // Revert
      runSql(`UPDATE assignments SET role = '${CALEB_ORIGINAL_ROLE}' WHERE id = '${CALEB_ASSIGNMENT}';`);
    }

    // Test 7: PATCH conflict detection (no action) — Katie → second_photo, Esra already there
    let conflictId = null;
    {
      const r = await apiCall("PATCH", { assignment_id: KATIE_ASSIGNMENT, new_role: "second_photo" });
      assert("PATCH Katie → second_photo (conflict, no action) → 409 conflict with list",
        r, (x) => x.status === 409
          && x.body?.error === "conflict"
          && Array.isArray(x.body?.conflicts)
          && x.body.conflicts.length === 1
          && x.body.conflicts[0].shooter_id === ESRA_SHOOTER
          && x.body.conflicts[0].can_swap === true);
      conflictId = r.body?.conflicts?.[0]?.id;
    }

    // Test 8: PATCH swap (legal) — Katie → second_photo, swap with Esra who holds lead_photo
    {
      const r = await apiCall("PATCH", {
        assignment_id: KATIE_ASSIGNMENT,
        new_role: "second_photo",
        conflict_action: "swap",
        conflict_assignment_id: conflictId,
      });
      assert("PATCH Katie swap with Esra (legal) → 200 swapped",
        r, (x) => x.status === 200 && x.body?.action === "swapped"
          && x.body?.swapped_with_assignment_id === conflictId);
      // Verify DB: Katie now second_photo, Esra now lead_photo
      const verify = runSql(`
        SELECT id, role FROM assignments
        WHERE id IN ('${KATIE_ASSIGNMENT}', '${conflictId}') ORDER BY id;
      `);
      const katieRow = verify.rows.find(r => r.id === KATIE_ASSIGNMENT);
      const esraRow = verify.rows.find(r => r.id === conflictId);
      assert("Swap DB state: Katie=second_photo, Esra=lead_photo",
        { katie: katieRow?.role, esra: esraRow?.role },
        { katie: "second_photo", esra: "lead_photo" });
      // Revert
      runSql(`UPDATE assignments SET role = '${KATIE_ORIGINAL_ROLE}' WHERE id = '${KATIE_ASSIGNMENT}';`);
      runSql(`UPDATE assignments SET role = 'second_photo' WHERE id = '${conflictId}';`);
    }

    // Test 9: PATCH swap (illegal) — put Amanda back temporarily (only holds second_photo)
    // and have Katie try to swap. Wait — we already have Esra at second_photo. Let me
    // swap Esra's holdings mental-model: the test needs a row whose shooter does NOT
    // hold Katie's current role (lead_photo). Esra DOES hold lead_photo, so she's legal.
    // To test ILLEGAL swap, I need to replace Esra temporarily with someone who only
    // holds second_photo. Amanda fits exactly — remove Esra, reinsert Amanda.
    runSql(`DELETE FROM assignments WHERE id = '${conflictId}';`);
    const amandaReinsert = runSql(`
      INSERT INTO assignments (wedding_id, shooter_id, role, status)
      VALUES ('${WEDDING_ID}', 'a6249fec-86d2-4959-a0e2-52f8f23c9a09', 'second_photo', 'assigned')
      RETURNING id;
    `);
    const tempAmandaId = amandaReinsert.rows[0].id;
    {
      const r = await apiCall("PATCH", {
        assignment_id: KATIE_ASSIGNMENT,
        new_role: "second_photo",
        conflict_action: "swap",
        conflict_assignment_id: tempAmandaId,
      });
      assert("PATCH Katie swap with Amanda (illegal, Amanda lacks lead_photo) → 409 cannot_swap",
        r, expectStatusAndError(409, "cannot_swap"));
    }

    // Test 10: PATCH add_to — Katie → second_photo + add_to
    {
      const r = await apiCall("PATCH", {
        assignment_id: KATIE_ASSIGNMENT,
        new_role: "second_photo",
        conflict_action: "add_to",
      });
      assert("PATCH Katie → second_photo add_to → 200 added_to",
        r, (x) => x.status === 200 && x.body?.action === "added_to");
      // Verify: Katie is now second_photo, Amanda is still second_photo (both)
      const verify = runSql(`
        SELECT id, role FROM assignments
        WHERE wedding_id = '${WEDDING_ID}' AND role = 'second_photo' ORDER BY id;
      `);
      assert("add_to DB state: two second_photo rows exist",
        verify.rows.length, 2);
      // Revert Katie
      runSql(`UPDATE assignments SET role = '${KATIE_ORIGINAL_ROLE}' WHERE id = '${KATIE_ASSIGNMENT}';`);
    }

    // Test 11: PATCH remove_other — Katie → second_photo, remove Amanda
    {
      const r = await apiCall("PATCH", {
        assignment_id: KATIE_ASSIGNMENT,
        new_role: "second_photo",
        conflict_action: "remove_other",
        conflict_assignment_id: tempAmandaId,
      });
      assert("PATCH Katie remove_other (Amanda) → 200 removed_other",
        r, (x) => x.status === 200 && x.body?.action === "removed_other"
          && x.body?.removed_assignment_id === tempAmandaId);
      // Verify: Amanda's row gone, Katie is second_photo
      const verify = runSql(`
        SELECT id FROM assignments WHERE id = '${tempAmandaId}';
      `);
      assert("remove_other DB state: Amanda's row deleted",
        verify.rows.length, 0);
      // Revert Katie
      runSql(`UPDATE assignments SET role = '${KATIE_ORIGINAL_ROLE}' WHERE id = '${KATIE_ASSIGNMENT}';`);
    }

    // Test 12: PATCH with conflict_assignment_id on a different wedding → 400 conflict_mismatch
    // Find any assignment on a different wedding
    const otherAssignment = runSql(`
      SELECT id FROM assignments WHERE wedding_id != '${WEDDING_ID}' LIMIT 1;
    `);
    if (otherAssignment.rows.length > 0) {
      const r = await apiCall("PATCH", {
        assignment_id: KATIE_ASSIGNMENT,
        new_role: "second_photo",
        conflict_action: "swap",
        conflict_assignment_id: otherAssignment.rows[0].id,
      });
      assert("PATCH with cross-wedding conflict_assignment_id → 400 conflict_mismatch",
        r, expectStatusAndError(400, "conflict_mismatch"));
    } else {
      console.log("  ⊘ skipping cross-wedding test (no other weddings with assignments)");
    }

    // Test 13: PATCH with conflict_assignment_id pointing at a deleted row → 409 conflict_row_gone
    {
      const r = await apiCall("PATCH", {
        assignment_id: KATIE_ASSIGNMENT,
        new_role: "second_photo",
        conflict_action: "swap",
        conflict_assignment_id: "00000000-0000-0000-0000-000000000000",
      });
      assert("PATCH with nonexistent conflict_assignment_id → 409 conflict_row_gone",
        r, expectStatusAndError(409, "conflict_row_gone"));
    }

    // Test 14: DELETE — create a throwaway assignment, delete it via API
    const throwaway = runSql(`
      INSERT INTO assignments (wedding_id, shooter_id, role, status)
      VALUES ('${WEDDING_ID}', '${ESRA_SHOOTER}', 'second_photo', 'assigned')
      RETURNING id;
    `);
    const throwawayId = throwaway.rows[0].id;
    {
      const r = await apiCall("DELETE", { assignment_id: throwawayId });
      assert("DELETE valid assignment → 200",
        r, (x) => x.status === 200 && x.body?.ok === true);
      const verify = runSql(`SELECT id FROM assignments WHERE id = '${throwawayId}';`);
      assert("DELETE DB state: row gone", verify.rows.length, 0);
    }

    // Test 15: DELETE with missing body → 400
    assert("DELETE missing assignment_id → 400",
      (await apiCall("DELETE", {})), expectStatus(400));

  } catch (err) {
    console.error("\n✗ unexpected error during tests:", err);
    testFailed = true;
  } finally {
    // ── Phase 5: teardown ──────────────────────────────────────────────
    console.log("\nPhase 4: teardown (restore original state)");
    try {
      // Delete any residual test rows that aren't in the original snapshot
      const originalIds = snapshot.rows.map(r => `'${r.id}'`).join(",");
      runSql(`
        DELETE FROM assignments
        WHERE wedding_id = '${WEDDING_ID}' AND id NOT IN (${originalIds});
      `);
      // Restore original roles for the 3 original assignments
      for (const row of snapshot.rows) {
        runSql(`UPDATE assignments SET role = '${row.role}' WHERE id = '${row.id}';`);
      }
      // If Amanda's original row was deleted during setup, reinsert it
      const amandaCheck = runSql(`SELECT id FROM assignments WHERE id = '${AMANDA_ASSIGNMENT}';`);
      if (amandaCheck.rows.length === 0) {
        runSql(`
          INSERT INTO assignments (id, wedding_id, shooter_id, role, status)
          VALUES ('${AMANDA_ASSIGNMENT}', '${WEDDING_ID}',
                  'a6249fec-86d2-4959-a0e2-52f8f23c9a09',
                  '${AMANDA_ORIGINAL_ROLE}', 'assigned');
        `);
      }
      console.log("  ✓ state restored");
    } catch (e) {
      console.error("  ✗ teardown failed — MANUAL CLEANUP REQUIRED");
      console.error("    Original state was:", snapshot.rows);
      console.error(e);
      testFailed = true;
    }
  }

  // ── Summary ────────────────────────────────────────────────────────────
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`  Passed: ${passed}`);
  console.log(`  Failed: ${failed}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  if (failed > 0 || testFailed) {
    console.log("FAILED CASES:");
    for (const r of results.filter(r => !r.ok)) {
      console.log(`  • ${r.name}`);
      console.log(`      got:      ${JSON.stringify(r.actual)}`);
    }
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("fatal:", e);
  process.exit(1);
});
