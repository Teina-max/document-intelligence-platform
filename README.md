# 📄 Document Intelligence Platform

> **From PDF inbox to actionable dashboard in under 20 seconds.**
> A production-grade OCR → matching → dashboard → email-relance pipeline
> built for a French plasturgie SME — open-sourced here as an
> anonymized demo (fictional brand *ThermoPack Industries*, 100 %
> synthetic data).

<p>
  <a href="https://nextjs.org"><img alt="Next.js 16" src="https://img.shields.io/badge/Next.js-16-000?logo=next.js&logoColor=fff"></a>
  <a href="https://supabase.com"><img alt="Supabase" src="https://img.shields.io/badge/Supabase-Postgres%20%2B%20RLS-3ecf8e?logo=supabase&logoColor=fff"></a>
  <a href="https://n8n.io"><img alt="n8n" src="https://img.shields.io/badge/n8n-self--hosted-ea4b71?logo=n8n&logoColor=fff"></a>
  <a href="https://www.anthropic.com"><img alt="Claude API" src="https://img.shields.io/badge/Claude-Vision-d97757?logo=anthropic&logoColor=fff"></a>
  <a href="https://playwright.dev"><img alt="Playwright" src="https://img.shields.io/badge/E2E-Playwright-45ba4b?logo=playwright&logoColor=fff"></a>
  <a href="https://vercel.com"><img alt="Vercel" src="https://img.shields.io/badge/Deploy-Vercel-000?logo=vercel&logoColor=fff"></a>
</p>

---

## 🧭 TL;DR

| | |
|---|---|
| **Business problem** | French SME (thermoforming machines + spare parts, ~1 M€ of quotes issued per month) was tracking offres/commandes on paper. Conversion rate stuck ≈ 45 %. Every missed point ≈ **200 k€/year of recoverable revenue**. |
| **What I built** | Drag-and-drop PDF ingestion → Claude Vision OCR (20+ structured fields) → automatic matching of commandes to their source offre → real-time dashboard → scheduled email relances (J‑30 / J‑15 / J‑7 / J‑1) with opt-out. |
| **Timeline** | 6 weeks, solo dev. Phase 2 (SAP historical import + KPI direction dashboard) added 3 weeks later. |
| **Stack** | Next.js 16 · Supabase (Postgres + RLS + Edge Functions + Auth) · n8n (5 workflows) · Claude Vision · Outlook OAuth2 · Vercel. |
| **Code size** | ~34 k LOC · 37 SQL migrations · 5 n8n workflows · 40 Playwright E2E tests. |

👉 Full narrative, trade-offs and lessons learned in **[`CASE_STUDY.md`](./CASE_STUDY.md)**.

---

## 🏗 Architecture

```
                   ┌──────────────────────────────────────────┐
                   │         Next.js 16 (App Router)          │
                   │  Login · Upload · Dashboard · Admin      │
                   │  FR / ES · RLS-aware Supabase client     │
                   └──────────┬───────────────────┬───────────┘
        signed storage        │                   │   REST / RPC
        upload (.pdf)         │                   │
                              ▼                   ▼
                   ┌────────────────┐     ┌────────────────┐
                   │  n8n WF-001    │     │   Supabase     │
                   │   OCR entry    │────▶│   Postgres     │
                   └────────┬───────┘     │  RLS · 4 enums │
                            │  pages→JPEG │  37 migrations │
                            ▼             └────┬───────────┘
                   ┌────────────────┐          │
                   │  Claude Vision │          │
                   │  (prompt v2.1) │          │  cron
                   └────────┬───────┘          │
                            │   JSON           ▼
                            │           ┌────────────────┐
                            └──────────▶│  n8n WF-002    │
                                        │ Rapprochement  │
                                        │ (offre⇄cmd)    │
                                        └────┬───────────┘
                                             │
                       ┌─────────────────────┼────────────────────┐
                       ▼                     ▼                    ▼
               ┌────────────────┐   ┌────────────────┐   ┌────────────────┐
               │   WF-003       │   │   WF-003b      │   │    WF-005      │
               │  Relance emails│   │  Opt-out link  │   │  Health check  │
               │  J-30/15/7/1   │   │  (GET /stop)   │   │  + error logs  │
               │  → Outlook     │   │                │   │                │
               └────────────────┘   └────────────────┘   └────────────────┘
```

---

## ✨ Features highlights

### 🔍 Claude-Vision OCR that reads the printed totals
- **20+ fields extracted per document** : reference, dates, client info, correspondent, payment/delivery terms, line items (SAP reference, designation, qty, unit price), cascaded discounts, transport/packaging fees, HT/TTC totals.
- **Reads printed totals instead of summing line items** — avoids silent mismatch when fees are footer-only (see [`workflows/prompts/ocr-extraction.md`](./workflows/prompts/ocr-extraction.md) v2.1).
- Bilingual FR / ES documents handled by a single prompt.
- European decimal format normalised (`6.174,00 EUR` → `6174.00`).

### 🔗 Smart client matching (9-level cascade)
Clients often appear under 4–5 spellings across PDFs (accent / case / "SA" vs "SARL" / abbreviation). The matcher falls through :
`exact → canonical alias → normalised (unaccented / lowercased / punct-stripped) → pg_trgm fuzzy → ILIKE → …`
— with **auto-learning of OCR variants** so the next document matches first-try.
See migration [`021-smart-matching.sql`](./scripts/021-smart-matching.sql).

### 📊 Dashboard
- Taux de transformation global + par période, pays, entreprise.
- Offres urgentes (expiration ≤ 30 j), top clients (tri "Par CA" ou "Par taux").
- Direction view : CA mensuel, order intake, KPIs mois / année.
- Analyse view : top pièces par client, clients récurrents, saisonnalité.
- Fiche entreprise avec historique offres/commandes et top pièces.

### 📧 Relances (J‑30 / J‑15 / J‑7 / J‑1)
- 8 templates HTML (4 paliers × FR/ES), variables dynamiques, bouton opt-out.
- Crons n8n + trigger post-ingestion.
- Opt-out = webhook GET signé → update de `relance_stoppee` + notification interne.

### 🔒 Security-first
- **RLS enabled on 11/11 tables**, role-based (`admin` / `commercial` / `comptable`). `WITH CHECK` on INSERT policies so role enforcement lives in the database, not only in route handlers.
- Next.js security headers : CSP (+ `object-src 'none'`, `base-uri`, `form-action`, `frame-src`), HSTS, `X-Frame-Options: DENY`, Permissions-Policy.
- Rate-limiter on every sensitive API route (10 OCR/min, 5 admin invite/min, …).
- Webhook secret forwarding to n8n.
- Path-traversal guard on storage paths.
- Admin role check + explicit email regex + 512-char input caps.
- [`scripts/verify-anonymization.sh`](./scripts/verify-anonymization.sh) — **48 secret-leak patterns**, blocks any commit that contains client identifiers or API keys.
- **0 `npm audit` vulnerabilities**, Dependabot security updates enabled.

### 🧪 Testing
- 12 Playwright E2E specs : auth, navigation, API CRUD, admin hardening, OCR API, business-logic, security headers.

---

## 📦 Demo dataset

To run the full pipeline end-to-end on a fresh clone, the repo ships a
deterministic synthetic dataset :

| Path | Content |
|---|---|
| [`demo-pdfs/offres/`](./demo-pdfs/offres/) | 6 offres (réf. `504xxxxx`) — 4 FR + 2 ES |
| [`demo-pdfs/commandes/`](./demo-pdfs/commandes/) | 12 commandes (`704xxxxx`) — 8 linked to an offre (partielle / supérieure / égale / cascade remise -20 % puis -11 %), 4 directes |
| [`demo-pdfs/manifest.json`](./demo-pdfs/manifest.json) | Expected OCR values (references, totals, remises) for assertion-based testing |
| [`scripts/fixtures/fake-clients.json`](./scripts/fixtures/fake-clients.json) | 20 fictional plasturgie clients |
| [`scripts/fixtures/fake-pieces.json`](./scripts/fixtures/fake-pieces.json) | 40 fictional SAP articles (résistances, vérins, capteurs…) |

The PDFs are regenerated by [`scripts/generate-demo-pdfs.ts`](./scripts/generate-demo-pdfs.ts)
(pdfkit, layout mirrors the real ThermoPack template).

---

## 🚀 Quickstart

```bash
# 1. Clone
git clone https://github.com/Teina-max/document-intelligence-platform
cd document-intelligence-platform

# 2. Install
(cd app && bun install)

# 3. Provision a dedicated Supabase project
#    ❗ Never reuse a production project — this repo ships migrations
#    that will wipe the demo data with `scripts/seed-demo-data.ts`.
cp app/.env.example app/.env.local
# Fill:
#   NEXT_PUBLIC_SUPABASE_URL
#   NEXT_PUBLIC_SUPABASE_ANON_KEY
#   SUPABASE_SERVICE_ROLE_KEY
#   SUPABASE_PROJECT_ID
#   ANTHROPIC_API_KEY
#   N8N_WEBHOOK_URL, N8N_RAPPROCHEMENT_URL, N8N_WEBHOOK_SECRET

# 4. Apply the 37 SQL migrations
#    Option A — via Supabase SQL editor: paste scripts/_combined-migrations.sql
#    Option B — via Management API (needs ~/.supabase/access-token):
bun scripts/apply-migrations.ts

# 5. Seed the demo data (20 clients · 40 pieces · 6 offres · 12 commandes)
bun scripts/seed-demo-data.ts

# 6. Verify anonymization before any git push (48 checks)
bash scripts/verify-anonymization.sh

# 7. Start the dev server
(cd app && bun run dev)
# → http://localhost:3000
```

---

## 🗂 Repo structure

```
app/                         Next.js 16 application
  src/app/                   App Router (pages + API routes)
  src/components/            shadcn/ui + custom components
  src/lib/supabase/          server / client / admin SSR helpers
  src/lib/rate-limit.ts      In-memory sliding window limiter
  src/lib/sap-parser.ts      Excel import helpers (for Phase 2)
  e2e/                       12 Playwright specs
scripts/
  001-037-*.sql              37 idempotent migrations
  apply-migrations.ts        Migration runner (Management API)
  seed-demo-data.ts          Deterministic seed from fixtures + manifest
  generate-demo-pdfs.ts      pdfkit-based fake-PDF generator
  verify-anonymization.sh    48-pattern secret / leak scanner
  fixtures/                  fake-clients.json · fake-pieces.json
workflows/
  ThermoPack - WF-00*.json   5 n8n workflows (OCR, matching, relances, opt-out, health)
  prompts/ocr-extraction.md  Claude Vision prompt v2.1
  templates/relance-j*.html  8 HTML relance templates (FR + ES × 4 steps)
supabase/functions/
  translate-designation/     Edge Function (OpenRouter fallback translation)
demo-pdfs/                   Committed demo dataset + manifest.json
docs/                        Schema, OCR strategy, templates notes, design specs
.github/dependabot.yml       Weekly npm + monthly Actions updates
.claude/                     Project rules (language, n8n lifecycle, credentials)
```

---

## 🔑 Design decisions

Short version :

- **Supabase > self-hosted Postgres** — Auth + RLS + Storage + Edge in one managed platform, $0 → $25/month glide path, migrations are just SQL files.
- **n8n > pure Node code** — the client's MSP partner maintains it after my handoff; visual workflows = transferable knowledge. JSON exports in git = single source of truth.
- **Claude Vision > Tesseract / Azure DI** — no per-client template needed, one prompt handles FR + ES + cascaded discounts + footer-only fees. OCR accuracy ≈ 98 % on first pass across a 39-PDF calibration batch.
- **Next.js 16 + shadcn/ui > Retool / Lovable** — no per-seat lock-in, exportable to any host, gives us SSR + i18n + a clean admin surface. shadcn/ui kills the UI bike-shedding.

Full reasoning in [`CASE_STUDY.md`](./CASE_STUDY.md).

---

## 🧱 Status

- **Production reference**: a real version of this platform is running for a French plasturgie SME since March 2026.
- **This repository**: anonymized sibling — all brand names, persons, business figures and client data replaced. Safe to fork, deploy, and demo.
- **Live demo**: _(to be deployed on Vercel, URL added here once the demo Supabase is connected.)_
- **Demo video**: _(walkthrough on the 18 synthetic PDFs, coming soon.)_

---

## 📫 Hiring / contact

Open to freelance missions on B2B automation, Supabase / n8n / Claude pipelines,
and document-intelligence problems for SMEs in France and EU.

**teinateinauri@gmail.com** · [GitHub profile](https://github.com/Teina-max)

License: [MIT](./LICENSE).
