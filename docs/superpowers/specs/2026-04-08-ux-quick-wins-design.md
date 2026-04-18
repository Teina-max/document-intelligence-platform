# UX Quick Wins — Phase 1 (Before April 23, 2026)

## Context

ThermoPack Industries app is in a 2-week test phase (April 8–23, 2026) with Alice as the primary user. A reunion on April 8 surfaced multiple UX pain points: tables too dense, batch relances needed, Spanish designations untranslated, urgency not visible enough, and minor bugs.

**Approach:** Hybrid — quick wins now to stabilize and improve daily workflow during the test phase. Full UX restructuration planned post-April 23 based on real user feedback.

**Primary user:** Alice (commercial assistant), desktop only.

## Phase 1 Scope

### 1. Pagination & Table Readability

**Problem:** Tables on `/offres` and `/commandes` load all rows at once. Too many results, hard to navigate.

**Solution:**

- Server-side pagination: 30 rows per page
- Navigation controls: prev/next buttons + page number indicator
- Contextual counter above each table: "243 offres · 18 expirent cette semaine · 12 sans relance"
- Sortable column headers: click to sort by date, amount, enterprise, status (toggle asc/desc with arrow indicator)
- Sort and page number persisted in URL query params (extends existing filter persistence)

**Scope:**
- Applies to `/offres` table and `/commandes` table
- Dashboard keeps current behavior (aggregated KPIs, not paginated lists)
- Dashboard sections (top clients, recent activity, untransformed offers) reduced to 5 items with "Voir plus" button

**Contextual counter source:**
- Total count: from paginated query (COUNT over full result set)
- "expirent cette semaine": computed server-side by counting offers where `date_expiration` is within 7 days of today
- "sans relance": computed server-side by counting offers where `derniere_relance` IS NULL and status = 'en_attente'
- All three stats come from the same RPC call that returns the paginated data

**API changes:**
- `/offres` and `/commandes` pages: add `page`, `limit`, `sort_by`, `sort_order` query params to Supabase RPC calls
- Return `{ data, total_count, expiring_soon_count, no_relance_count }` alongside paginated results

### 2. Batch Relances

**Problem:** Alice relances offers one by one. With 400 pending offers, this is not scalable.

**Solution:**

- Checkbox selection on each row of the offers table
- "Select all (current page)" checkbox in table header
- Floating action bar appears when >= 1 offer selected: "X offres sélectionnées — Relancer | Exporter CSV | Supprimer"
- "Relancer" flow:
  1. Click "Relancer" button
  2. Confirmation dialog with summary: "12 offres, 8 entreprises, 3 sans email de contact"
  3. On confirm: trigger batch relance
- Anti-spam: max 10 relances per batch execution, 30s interval between each email
- Offers without contact email are flagged in the confirmation dialog and skipped

**Dependency:** Outlook credential on n8n not yet configured. Until then:
- "Relancer" button is visible but shows toast: "Connexion email en cours de configuration"
- CSV export and delete work immediately

**Components:**
- New: `<SelectionCheckbox>` (row-level + header-level)
- New: `<FloatingActionBar>` (sticky bottom bar, appears on selection)
- Modify: `<OffresTable>` to support selection state

### 3. Spanish Designation Translation

**Problem:** Parts ordered by Spanish clients have designations in Spanish. Alice doesn't understand them.

**Solution:**

- **Post-insert via Supabase Edge Function:** A database trigger on INSERT into `lignes` calls an Edge Function that detects language and translates to French via Claude API. The n8n OCR workflow is not modified.
- **Storage:** Add `designation_fr` column to `lignes` table. Keep original in `designation`.
- **Display:** Show `designation_fr` by default in all tables and detail views. Original visible on hover (tooltip).
- **Backfill:** One-shot SQL + API script to translate existing designations in `lignes` table. Process in batches of 50 to stay within Claude API rate limits. Estimated ~6900 designations to review, ~2000-3000 likely in Spanish needing translation.

**Schema change:**
```sql
ALTER TABLE lignes ADD COLUMN IF NOT EXISTS designation_fr TEXT;
```

**Edge Function logic:**
- Triggered on INSERT into `lignes` where `designation_fr` IS NULL
- Detect language using Claude API (lightweight prompt)
- Only translate if detected language != French
- Store translated version in `designation_fr`
- Fallback: if translation fails, copy original into `designation_fr`
- n8n workflows remain untouched

### 4. Enhanced Urgency Badges & Alerts

**Problem:** Expiration badges exist but aren't visible enough. Alice misses urgent offers.

**Solution:**

**Badges on offer rows:**
| Condition | Style | Label |
|-----------|-------|-------|
| Expires in < 3 days | Red, pulsing animation | "Urgent" |
| Expires in < 7 days | Red, static | "Expire bientot" |
| Expires in 7-15 days | Orange | "A surveiller" |
| Already expired | Gray | "Expiree" |

**Sortable urgency column:**
- New column "Urgence" in offers table, sortable
- Sort priority: urgent (3d) > expire bientot (7d) > a surveiller (15d) > expired > no expiration

**Sidebar badge:**
- Red notification badge on "Offres" nav item showing count of offers expiring within 7 days
- Visible from any page, updates on navigation

**Quick filter:**
- Toggle button "Urgentes" above offers table
- When active: shows only offers expiring within 15 days
- Combines with existing filters (period, status, country, enterprise)

### 5. Bug Fixes & Polish

**Montants incorrects:**
- Audit offers/orders with amount = 0 or NULL
- Cross-reference with Alice's Excel files to fill missing amounts
- 6271 orders identified without montant_ht — requires historical Excel import

**Clients without geo (267):**
- Script 029 (enrich regions from code postal) already in place
- For remaining clients without postal code: display "Non renseigne" with consistent styling instead of blank
- No further enrichment action — data not available

**Wording fix:**
- "derniere relance" → "relance" — already corrected, verify deployed on Vercel

**Dashboard density:**
- Top clients section: show 5 by default, "Voir plus" expands to full list
- Recent activity: show 5 by default, "Voir plus" expands
- Untransformed offers: show 5 by default, "Voir plus" expands

## Phase 2 — Post April 23 (Outline Only)

To be specified after test phase feedback. Planned directions:

- **Navigation restructuration** based on observed Alice workflows
- **"A traiter" page** — unified action queue (urgent relances + orders to link + anomalies)
- **Automated relances** via Outlook (when n8n credential is configured)
- **Offer → Order timeline** — visual lifecycle per client
- **Full UX audit** incorporating all test phase feedback

Phase 2 spec will be written after the April 23 meeting.

## Out of Scope

- Mobile/tablet optimization (Alice uses desktop only)
- Dark mode toggle (system preference only, no user request)
- New pages or navigation restructuration (Phase 2)
- Outlook integration (dependency not met)
- AI-powered matching improvements (already handled by SQL)

## Technical Notes

- Framework: Next.js 16 App Router + shadcn/ui + Tailwind v4
- State: URL query params for filters/sort/pagination, Zustand for selection state
- API: Supabase RPC calls with pagination params
- Translation: Claude API via existing n8n credential or direct API call
- Deployment: Vercel auto-deploy on push to master
