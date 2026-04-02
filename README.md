# PreWedd Crew

Internal team platform for TLIC. Built with Next.js 16, Supabase, and Vercel.

## Setup

### 1. Supabase (10 min)

1. **supabase.com** → New Project → name it `prewedd`
2. **SQL Editor** → paste `supabase/migrations/001_initial_schema.sql` → Run
3. **Storage** → New Bucket → `headshots` → Public
4. **Authentication** → Providers → Email → enable Magic Link
5. **Settings** → API → copy **Project URL**, **anon key**, and **Project ID** (under Project ID)
6. **resend.com** → sign up → copy API key

### 2. Project Folder

```bash
mkdir prewedd-crew && cd prewedd-crew
```

Copy this entire scaffold into the folder.

Open `.mcp.json` and replace `YOUR_PROJECT_REF` with your Supabase Project ID.

### 3. Install Skills + MCP Servers

```bash
# Install Vercel's official agent skills (React best practices + deployment)
npx skills add https://github.com/vercel-labs/agent-skills --skill vercel-react-best-practices

# Install Anthropic's frontend-design skill (if not already bundled)
# This may already be available as a bundled skill — check with /skills in Claude Code
```

The MCP servers (Supabase + Next.js DevTools) are configured in `.mcp.json` and will connect automatically when Claude Code starts. Supabase MCP will prompt you to log in via browser on first use.

### 4. Build

```bash
claude
```

Then:

```
/build-next
```

Fill in `.env.local` after step 1. Then keep going:

```
/build-next
```

17 steps. Claude builds, tests, advances. You provide oversight.

**If something breaks:** Describe the error. Claude fixes and retests.

**If context gets long:** `/compact` or `/clear` then `/build-next` — state is tracked in `docs/BUILD_STATE.md`.

**To rerun a test:** `/test-step`

**To jump to a step:** `/build-next 12`

## The 17 Steps

| # | What Gets Built | You Do |
|---|-----------------|--------|
| 1 | Project init, Next.js 16, Tailwind, Supabase deps | Fill in .env.local + .mcp.json |
| 2 | Login page, magic link auth | Test with your email |
| 3 | Role-based routing, layouts | Glance at nav |
| 4 | Onboarding step 1 (basic info) | Try the form |
| 5 | Onboarding steps 2-4 (roles, personality, skills) | Complete onboarding |
| 6 | Shooter profile page | Quick look |
| 7 | Admin team roster | Check roster |
| 8 | Shooter calendar + date blocking | Block some dates |
| 9 | Admin master calendar | Quick look |
| 10 | Wedding creation + list | Create a test wedding |
| 11 | Assignments + email notifications | Assign shooter, check email |
| 12 | Shooter dashboard + weddings list | Verify as shooter |
| 13 | Brief builder (couple + logistics) | Fill in test data |
| 14 | Brief builder (timeline + quiz + publish) | Publish a brief |
| 15 | Shooter brief view | Read the brief |
| 16 | Pre-wedding quiz | Take the quiz |
| 17 | Admin quiz visibility + reminders | Check admin dashboard |

## Deploy

```bash
git init && git add -A && git commit -m "PreWedd Crew MVP"
# Push to GitHub → Connect to Vercel → Set env vars → Done
```
