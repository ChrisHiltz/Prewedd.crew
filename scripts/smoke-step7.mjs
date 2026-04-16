#!/usr/bin/env node
// scripts/smoke-step7.mjs
//
// Step 7 HTTP smoke test for:
//   • POST /api/assignment-notify (new, server-built email)
//   • POST /api/notify             (legacy, now admin-gated + rate-limited)
//   • check_notify_rate_limit RPC (shared bucket)
//
// Usage:
//   1. .test-auth must contain a valid admin session cookie (set during Step 6)
//   2. Run: node scripts/smoke-step7.mjs
//
// The script:
//   • Fires real requests to assignment-notify for the Yvette & Sebastian
//     wedding. This DOES send real email to real shooters — intentional, so
//     the test proves the end-to-end flow works.
//   • Tests the rate limit using a NON-EXISTENT assignment id so the handler
//     rate-checks first, then 404s on fetchRecipient — no Resend spend for
//     the 31 rate-limit probe calls.
//
// Rate limit test timing: the test waits until the start of a fresh UTC
// minute bucket before firing the 31-request burst, so bucket rollover mid-
// test is impossible.

import { readFileSync, existsSync, writeFileSync, unlinkSync } from "node:fs";
import { execSync } from "node:child_process";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";

const BASE = "https://prewedd-crew.vercel.app";
const PROJECT_REF = "oljrnmgiaypdysmoaovo";
const COOKIE_NAME = `sb-${PROJECT_REF}-auth-token`;

// ── Fixture: Yvette & Sebastian, 2026-04-18 ──────────────────────────────
const WEDDING_ID = "8505b7a4-2b8b-49a0-bf16-8df2ee034939";
const KATIE_ASSIGNMENT = "9cadd554-30c6-4dd4-b100-1cc57dc28b3f"; // lead_photo
const CALEB_ASSIGNMENT = "1295e451-11e3-44fa-8fce-ab6ff7d27cd4"; // lead_video

// Fake uuid that will never exist — used to probe the rate limit without
// sending real email (handler will 404 after rate check passes).
const GHOST_ASSIGNMENT = "00000000-0000-0000-0000-000000000000";

// ── Cookie loading ────────────────────────────────────────────────────────
const cookiePath = resolve(".test-auth");
if (!existsSync(cookiePath)) {
  console.error("✗ .test-auth file not found in project root");
  process.exit(2);
}
const cookieValue = readFileSync(cookiePath, "utf8").trim();
if (!cookieValue.startsWith("base64-")) {
  console.error("✗ .test-auth does not look like a Supabase session cookie");
  process.exit(2);
}
const cookieHeader = `${COOKIE_NAME}=${encodeURIComponent(cookieValue)}`;

// ── SQL helper (for clearing the rate limit bucket between test phases) ──
function runSql(sql) {
  const tmpFile = resolve(tmpdir(), `smoke7-sql-${randomUUID()}.sql`);
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

function clearRateLimitBucket() {
  // Delete all rows — next test starts with a clean bucket.
  runSql("DELETE FROM notify_rate_limits;");
}

// ── HTTP helper ───────────────────────────────────────────────────────────
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

// ── Test runner ───────────────────────────────────────────────────────────
const results = [];
let passed = 0;
let failed = 0;

function assert(name, actual, predicate) {
  const ok = typeof predicate === "function"
    ? predicate(actual)
    : JSON.stringify(actual) === JSON.stringify(predicate);
  results.push({ name, ok, actual });
  if (ok) { passed++; console.log(`  ✓ ${name}`); }
  else    { failed++; console.log(`  ✗ ${name}  — got ${JSON.stringify(actual)}`); }
}

const expectStatus = (code) => (r) => r.status === code;
const expectStatusAndError = (status, err) => (r) =>
  r.status === status && r.body?.error === err;

// ── Main ──────────────────────────────────────────────────────────────────
async function main() {
  console.log("\n🧪 Step 7 smoke test — /api/assignment-notify + /api/notify + rate limit\n");

  // Clean the bucket before starting so we don't inherit state from a
  // previous run or the Step 6 test.
  console.log("Phase 0: clearing rate limit bucket");
  clearRateLimitBucket();
  console.log("  ✓ notify_rate_limits cleared\n");

  // ── Phase 1: input validation ────────────────────────────────────────
  console.log("Phase 1: input validation");

  assert("POST /api/assignment-notify with no body → 400",
    await call("/api/assignment-notify", "POST", {}),
    expectStatus(400));

  assert("POST /api/assignment-notify with invalid action → 400 invalid_action",
    await call("/api/assignment-notify", "POST", {
      assignment_id: KATIE_ASSIGNMENT,
      action: "removed",
    }),
    expectStatusAndError(400, "invalid_action"));

  assert("POST /api/assignment-notify swapped without affected_ids → 400",
    await call("/api/assignment-notify", "POST", {
      assignment_id: KATIE_ASSIGNMENT,
      action: "swapped",
    }),
    expectStatusAndError(400, "missing_affected_ids"));

  // Find an assignment on a different wedding for the cross-wedding test
  const otherWedding = runSql(`
    SELECT id FROM assignments WHERE wedding_id != '${WEDDING_ID}' LIMIT 1;
  `);
  if (otherWedding.rows.length > 0) {
    assert("POST /api/assignment-notify swap with cross-wedding target → 400 invalid_swap_target",
      await call("/api/assignment-notify", "POST", {
        assignment_id: KATIE_ASSIGNMENT,
        action: "swapped",
        affected_ids: [otherWedding.rows[0].id],
      }),
      expectStatusAndError(400, "invalid_swap_target"));
  }

  assert("POST /api/assignment-notify with nonexistent assignment → 404",
    await call("/api/assignment-notify", "POST", {
      assignment_id: GHOST_ASSIGNMENT,
      action: "role_change",
    }),
    expectStatus(404));

  // ── Phase 2: legacy /api/notify input validation + auth ──────────────
  console.log("\nPhase 2: legacy /api/notify input validation");

  assert("POST /api/notify missing fields → 400",
    await call("/api/notify", "POST", {}),
    expectStatus(400));

  assert("POST /api/notify with only partial fields → 400",
    await call("/api/notify", "POST", { to: "test@example.com" }),
    expectStatus(400));

  // ── Phase 3: real email flow (assignment-notify role_change) ─────────
  // This sends one real email to Katie. Allowed because the test is run
  // intentionally and the inbox belongs to a real shooter.
  console.log("\nPhase 3: real email send (assignment-notify role_change)");
  clearRateLimitBucket();
  {
    const r = await call("/api/assignment-notify", "POST", {
      assignment_id: KATIE_ASSIGNMENT,
      action: "role_change",
    });
    assert("POST /api/assignment-notify role_change → 200 sent:1",
      r, (x) => x.status === 200 && x.body?.ok === true && x.body?.sent === 1 && x.body?.failed === 0);
  }

  // ── Phase 4: rate limit — fire 31 ghost requests inside one bucket ───
  console.log("\nPhase 4: rate limit probe (fixed UTC minute bucket)");
  clearRateLimitBucket();

  // Wait until we're at least 5 seconds into a fresh minute to avoid
  // bucket rollover during the 31-request burst.
  const nowMs = Date.now();
  const msIntoMinute = nowMs % 60_000;
  const msUntilNextMinute = 60_000 - msIntoMinute;
  // If we have less than ~45 seconds left in the current minute, wait for
  // the next one. 31 round-trips take ~5-15 seconds, so we need slack.
  if (msUntilNextMinute < 45_000) {
    const waitMs = msUntilNextMinute + 2_000; // cross into next minute + 2s buffer
    console.log(`  waiting ${Math.round(waitMs / 1000)}s for fresh bucket...`);
    await new Promise((resolve) => setTimeout(resolve, waitMs));
    clearRateLimitBucket(); // new bucket, but force empty anyway
  }

  const startMs = Date.now();
  const minuteAtStart = Math.floor(startMs / 60_000);
  console.log(`  firing 31 requests in minute bucket ${minuteAtStart}`);

  const statuses = [];
  for (let i = 0; i < 31; i++) {
    const r = await call("/api/assignment-notify", "POST", {
      assignment_id: GHOST_ASSIGNMENT,
      action: "role_change",
    });
    statuses.push(r);
    // Safety: if the minute has rolled over mid-burst, abort — the test
    // would be unreliable. We'll restart in the next phase.
    if (Math.floor(Date.now() / 60_000) !== minuteAtStart) {
      console.log(`  ⚠ bucket rolled over at request ${i + 1}/31 — test invalid`);
      failed++;
      results.push({ name: "rate limit burst stayed in same bucket", ok: false });
      break;
    }
  }

  // First 30 should be 404 (ghost assignment, rate check passed)
  const first30 = statuses.slice(0, 30);
  const nonForty04 = first30.filter((r) => r.status !== 404);
  assert("first 30 ghost requests all return 404 (rate limit not yet hit)",
    nonForty04.length, 0);

  // 31st must be 429 with rate_limited body
  if (statuses.length >= 31) {
    const r31 = statuses[30];
    assert("31st request → 429 rate_limited",
      r31, (x) => x.status === 429 && x.body?.error === "rate_limited");
    assert("31st request body includes retry_after_seconds > 0",
      r31, (x) => typeof x.body?.retry_after_seconds === "number" && x.body.retry_after_seconds > 0 && x.body.retry_after_seconds <= 60);
  }

  // ── Phase 5: shared bucket — /api/notify also rate-limited ───────────
  console.log("\nPhase 5: shared bucket proof (/api/notify hits the same limit)");
  // We just burned 31 calls on /api/assignment-notify. Without clearing the
  // bucket, the next /api/notify call from the same admin should ALSO 429
  // until the minute rolls over.
  {
    const r = await call("/api/notify", "POST", {
      to: "test@example.com",
      subject: "smoke test",
      html: "<p>should be rate limited</p>",
    });
    assert("POST /api/notify after 31 assignment-notify calls → 429 (shared bucket)",
      r, (x) => x.status === 429 && x.body?.error === "rate_limited");
  }

  // ── Phase 6: bucket rollover → clear bucket, legacy route works ──────
  console.log("\nPhase 6: bucket cleared → legacy /api/notify admin path works");
  clearRateLimitBucket();
  {
    const r = await call("/api/notify", "POST", {
      to: "chris@mytlic.com",
      subject: "Step 7 smoke test — ignore",
      html: "<p>This is an automated smoke test. Ignore this email.</p>",
    });
    assert("POST /api/notify as admin with valid body → 200",
      r, (x) => x.status === 200 && x.body?.success === true);
  }

  // ── Final cleanup ─────────────────────────────────────────────────────
  console.log("\nPhase 7: cleanup");
  clearRateLimitBucket();
  console.log("  ✓ notify_rate_limits cleared");

  // ── Summary ───────────────────────────────────────────────────────────
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`  Passed: ${passed}`);
  console.log(`  Failed: ${failed}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  if (failed > 0) {
    console.log("FAILED CASES:");
    for (const r of results.filter(r => !r.ok)) {
      console.log(`  • ${r.name}`);
      if (r.actual !== undefined) console.log(`      got: ${JSON.stringify(r.actual)}`);
    }
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("fatal:", e);
  process.exit(1);
});
