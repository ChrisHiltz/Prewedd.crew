---
name: test-step
description: Run the test checkpoint for the current (or specified) build step. Reads the expected behavior from docs/TESTING.md, verifies the app is working, and reports pass/fail.
argument-hint: "[step number, or blank for current]"
user-invocable: true
disable-model-invocation: true
allowed-tools: Read, Bash, Glob, Grep
context: fork
agent: Explore
---

# Test Current Build Step

ultrathink

## Instructions

1. Read `docs/BUILD_STATE.md` to determine the current step (or use `$ARGUMENTS` if a step number was provided)
2. Read `docs/TESTING.md` for the test criteria for that step
3. Run `npm run build` first — if this fails, report the build error immediately
4. For automated checks: verify files exist, routes are defined, components render without errors
5. For checks that need manual verification (like "click a magic link in your email"): clearly tell the user exactly what to do and what to look for
6. Report: PASS or FAIL with specific details

## Current State
!`cat docs/BUILD_STATE.md 2>/dev/null || echo "step: 0"`

## Test Criteria
!`cat docs/TESTING.md 2>/dev/null || echo "No TESTING.md found"`
