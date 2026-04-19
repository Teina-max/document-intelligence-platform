# Document Intelligence Platform — repo guide for Claude Code

## What this repository is

Anonymized public sibling of a real freelance engagement (plasturgie SME,
suivi offres/commandes, OCR + matching + dashboard + email relances).
The real project is **out of scope for this repo**; everything here is
fictional — brand is *ThermoPack Industries*, clients / pieces / amounts
are generated.

- **GitHub**: https://github.com/Teina-max/document-intelligence-platform (public, MIT)
- **Demo Supabase ref**: see `SUPABASE_PROJECT_ID` in `app/.env.local`
- **Demo Vercel URL**: _not deployed yet_
- **Narrative**: see [`CASE_STUDY.md`](./CASE_STUDY.md)
- **User-facing pitch**: see [`README.md`](./README.md)

## Hard constraints

1. **NEVER write to the protected production Supabase project**. The
   ref is listed in `.claude/rules/supabase-prod-protection.md`
   (gitignored — kept local). The rule covers SQL, CLI, REST, Edge
   Functions, keys, tokens. Even read-only checks are forbidden.
2. **NEVER touch the private source repo**. Its path is declared in
   the local protection rule; it is read-only source of truth. No
   writes, no git operations, no pushes from there.
3. **NEVER commit secrets**. `app/.env.local`, `.env`, and
   `scripts/anonymize.ts` (which encodes the real→fake mapping) are
   gitignored. Before any commit, run:
   ```bash
   bash scripts/verify-anonymization.sh
   ```
   48 patterns, must return exit 0.
4. **NEVER revert the anonymization**. If you find a real client name,
   person, email, or prod ref in the working tree, treat it as a bug
   and scrub it via the mapping.

## Status snapshot

| Area | Status |
|---|---|
| Anonymization | Complete, verified |
| Git history | Clean, 0 secrets |
| GitHub publish | Public · 15 topics · MIT · Dependabot + secret scanning on |
| Supabase demo DB | Provisioned, 37 migrations applied, seeded (20 · 40 · 6 · 12) |
| Vercel demo deploy | **TODO** |
| Demo video | **TODO** |
| n8n workflows re-pointed to demo | **TODO** |
| Prod key rotation | **TODO (user action)** |

## Remaining tasks (priority order)

### P0 — Security (user action)

Rotate keys that were exposed in the original `.env` and transiently in
session transcripts.
- Supabase prod `service_role` key (highest blast radius)
- Supabase prod DB password
- Supabase user-level access token (`sbp_…`)
- Anthropic API key
- OpenRouter API key

**Claude must not perform any of these** — they are account-level
actions that require the user's Supabase / Anthropic / OpenRouter
consoles. Do not use those keys either (see rule #1).

### P1 — Make the live demo work end-to-end

1. **Deploy on Vercel** as a **new project** (do NOT link to any
   existing project belonging to the protected engagement):
   - `vercel` in the repo root, choose "Create new project"
   - Set env vars from `app/.env.local` in Vercel dashboard
   - After deploy, paste the URL into `README.md` under *Status*.

2. **Re-import n8n workflows** on the dev instance, re-pointing them
   to the demo Supabase project:
   - Replace the Supabase credential in WF-001..WF-005 with a
     credential targeting the demo ref
   - Replace the `{{ $env.SUPABASE_SERVICE_ROLE_KEY }}` placeholder in
     `ThermoPack - WF-001` node `Sign Storage URL` with an n8n
     credential (never embed the key in the JSON)
   - Activate WF-001, WF-002, WF-005. Leave WF-003 / WF-003b inactive
     until relance emails are explicitly desired for the demo.
   - Update `N8N_WEBHOOK_URL`, `N8N_RAPPROCHEMENT_URL`,
     `N8N_WEBHOOK_SECRET` in the Vercel env.

### P2 — Polish

3. **Record the demo video** on the 18 synthetic PDFs in
   `demo-pdfs/`. Scenes: upload flow → OCR log → rapprochement →
   dashboard KPIs → offre detail → fiche entreprise → relance template
   preview. Paste the YouTube/Loom link into `README.md`.
4. **Fix 2 pre-existing TS errors** in
   `app/src/components/expandable-row.tsx` (Supabase relation types
   widened too aggressively). Pre-existing, not blocking build, but
   should be clean before showing to reviewers.
5. **Refresh `app/.env.example`** to document every env var actually
   used: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_PROJECT_ID`,
   `ANTHROPIC_API_KEY`, `N8N_WEBHOOK_URL`, `N8N_RAPPROCHEMENT_URL`,
   `N8N_WEBHOOK_SECRET`.

### P3 — Nice to have

6. Add a `.github/workflows/ci.yml` running lint + typecheck +
   `verify-anonymization.sh` on every PR.
7. Migrate the rate limiter from in-memory Map to Upstash or Vercel KV
   (`app/src/lib/rate-limit.ts`) so the limit holds across Vercel
   serverless instances.
8. Add a `CONTRIBUTING.md` when opening to external PRs.

## How to work here

### Before every session
- Read this file + [`README.md`](./README.md) + [`CASE_STUDY.md`](./CASE_STUDY.md).
- Check `.claude/rules/supabase-prod-protection.md` (gitignored) for
  the current forbidden vs approved Supabase refs.
- Run `bash scripts/verify-anonymization.sh` to confirm the baseline.

### Before every commit
```bash
bash scripts/verify-anonymization.sh   # 48 checks, must pass
(cd app && npm audit)                   # must be 0 vulns
```
**If this script exits non-zero, stop.** Even this file, `CLAUDE.md`,
is scanned — don't bake sensitive refs into documentation.

### Supabase operations
- Only target the approved demo ref (`SUPABASE_PROJECT_ID` in
  `app/.env.local`).
- Use `scripts/apply-migrations.ts` for DDL (uses
  `~/.supabase/access-token`, calls the Management API, refuses refs
  listed in `FORBIDDEN_SUPABASE_REFS`).
- Use `scripts/seed-demo-data.ts` for DML (uses service_role + same
  forbidden-ref guard).

### Adding a new migration
- Write `scripts/NNN-<description>.sql`. Keep each statement
  idempotent where possible (`CREATE IF NOT EXISTS`,
  `CREATE OR REPLACE`).
- Re-run `apply-migrations.ts`. It tolerates `already exists`,
  `cannot change return type`, etc.
- If your migration creates a new table that previous migrations
  reference, add it to `RUN_ORDER_OVERRIDE` in `apply-migrations.ts`.

### n8n workflows
- JSON exports live in `workflows/`. Treat them as source of truth.
- After any edit on the dev instance, re-export and overwrite the
  JSON in this repo, then commit.
- **Never embed credentials** in the JSON — use the n8n credential
  store and reference it by name / id. `anonymize.ts` strips known
  legacy credential ids; do the equivalent for any new one.

### Conventions
- TypeScript strict, ESM, `camelCase` / `PascalCase`.
- Commits: short, descriptive, **English**.
- UI/CLI output: French (rule `.claude/rules/language.md`).
- No over-engineering; no silent fallbacks; fail fast with clear
  error messages.
- Comments explain *why*, not *what*. Default is no comment.

## Glossary

| Term | Value |
|---|---|
| Approved Supabase ref | `$SUPABASE_PROJECT_ID` (see `app/.env.local`) |
| Forbidden Supabase ref | see `.claude/rules/supabase-prod-protection.md` (gitignored) |
| GitHub repo | `Teina-max/document-intelligence-platform` |
| Fictional brand | ThermoPack Industries |
| Fictional personae | Alice Durand · Éric Martin · Gabrielle Petit |
| Private source repo | declared in the local protection rule (read-only) |
