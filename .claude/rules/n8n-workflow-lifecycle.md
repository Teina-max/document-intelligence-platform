# n8n Workflow Lifecycle — Dev → Test → Deploy

## Principle

NO workflow touches prod without passing through dev AND a validation checklist. Zero exceptions.

## Instances

- **Dev**: n8n-teina.shop — skill `n8n-cli` / `n8n`
- **Prod**: n8n.example.com — skill `n8n-prod-cli` / `n8n-prod`

## Phase 1: Define (BEFORE building)

Before writing a single node, define acceptance criteria in a `WF-XXX.md` file:

```markdown
# WF-XXX — [Name]

## Purpose
What this workflow does in one sentence.

## Trigger
What starts the workflow (webhook, cron, manual).

## Inputs
What data it receives (fields, format, source).

## Expected outputs
What it produces (API calls, records created, emails sent, etc.).

## Acceptance criteria
- [ ] Criteria 1: [specific, measurable condition]
- [ ] Criteria 2: ...
- [ ] Criteria N: ...

## Credentials required
List exact credential names from `.claude/rules/n8n-credentials.md`.

## Error scenarios
What should happen when: bad input, API down, empty result, rate limit hit.
```

Every acceptance criterion must be **testable** — no vague "works correctly" statements.

## Phase 2: Build on Dev

1. Create the workflow on n8n dev (`n8n-cli`)
2. Tag it with the project name
3. Use **dev credentials** (test API keys, sandbox accounts) — never prod credentials on dev
4. After each significant change, export the JSON to the local repo:
   ```bash
   n8n-cli workflows get <ID> --json > workflows/WF-XXX.json
   ```
5. Commit the JSON with a descriptive message

## Phase 3: Test on Dev

Run through EVERY acceptance criterion defined in Phase 1:

- **Happy path**: Normal input → expected output
- **Edge cases**: Empty data, special characters, large payloads
- **Error paths**: Invalid input, API failure simulation, missing fields
- **Idempotency**: Running the same trigger twice must not create duplicates

For each test:
1. Document the input used
2. Document the actual output
3. Mark the acceptance criterion as passed or failed

All criteria must pass. If one fails → fix → retest ALL criteria (not just the failing one).

## Phase 4: Pre-Deploy Checklist

Before touching prod, ALL items must be checked:

```markdown
## Pre-Deploy Checklist — WF-XXX

### Workflow
- [ ] All acceptance criteria pass on dev
- [ ] Workflow JSON exported and committed to repo
- [ ] No hardcoded dev URLs, test emails, or sandbox API endpoints remain
- [ ] Error handling covers all identified error scenarios
- [ ] No `console.log` or debug nodes left active

### Credentials
- [ ] All required credentials exist on prod (check `.claude/rules/n8n-credentials.md`)
- [ ] Credential names and IDs in the JSON match prod credentials exactly
- [ ] No dev/test credentials referenced

### Data
- [ ] Airtable base IDs / Notion DB IDs point to prod (not dev copies)
- [ ] Webhook URLs are correct for prod environment
- [ ] Email recipients are real (not test addresses)
- [ ] Cron schedules are set to prod timing (not "every minute" test schedules)
```

## Phase 5: Deploy to Prod

1. Create/update the workflow on prod (`n8n-prod-cli`)
2. Tag it with the project name
3. **Do NOT activate yet**
4. Verify the workflow appears correctly in the n8n UI
5. Run one manual test execution on prod with real data
6. If manual test passes → activate
7. Export the prod version and verify it matches the local JSON

## Phase 6: Post-Deploy Sync

After successful deployment:
1. Export the prod workflow JSON
2. Compare with local JSON — they must match
3. Update `credentials.md` in the project repo (status → ✅)
4. Update `About.md` with deployment date and status
5. Delete the test workflow from dev (keep prod and local repo only)

## Rules

- **NEVER build directly on prod** — not even "quick fixes"
- **NEVER activate a workflow on prod without testing on dev first**
- **NEVER deploy without the pre-deploy checklist passing**
- **NEVER skip the JSON export** — the local repo is the source of truth
- **ALWAYS define acceptance criteria BEFORE building** — if you can't define what "done" means, you're not ready to build
- If a prod workflow needs a fix: reproduce on dev → fix on dev → test → redeploy
