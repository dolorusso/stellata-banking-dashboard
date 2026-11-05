# Stellata

**Business banking for small teams.** A dashboard showing balances across accounts, searchable transactions, ACH/wire transfers that settle in real time, and a virtual debit card you can freeze. Built in 24 hours as a case study.

> Stellata comes from *Quercus stellata*, the post oak. The brand color is `#193e2c`.

**Live demo:** _add the Vercel URL here_

**Stack:** Next.js 16 (App Router) · TypeScript (strict) · Tailwind v4 · shadcn/ui · TanStack Query + Table · Recharts · Zod · Vitest

## What you can do

| Area | Highlights |
|---|---|
| **Overview** | Total balance + Operating / Payroll / Tax Reserve. KPIs: money in, money out, net, runway, each vs the prior period. Cash-flow, spending-by-category and balance-trend charts with tooltips, legends and a **table view** each, plus a 30D / 90D / 6M range selector |
| **Transactions** | ~220 seeded transactions. Server-side search, sort and pagination. Filters for date (presets + custom), category, status, account and amount range. Active-filter chips, a detail drawer, **CSV export of the current view**, and a list layout on mobile |
| **Transfers** | ACH or wire to saved payees, or instant transfers between your own accounts. Validation → review → confirmation. Money is held immediately and the transfer goes **pending → completed** live (wire ~8s, ACH ~20s in the demo), with balances and transactions updating everywhere |
| **Cards** | Virtual debit card with **freeze / unfreeze** (optimistic, with rollback), a monthly spend meter and recent card activity |
| **Everywhere** | Light/dark/system theme without a flash, sidebar on desktop and bottom nav on mobile, skeletons plus empty and error states, keyboard and screen-reader support, and a "Reset demo data" button |

> **Try this:** send a $1,500 wire from Operating to Brightline Design Co. and watch it settle. Then check that the total balance dropped by exactly $1,500.00 on the overview and that the wire tops the transactions table. State is kept in your browser (`localStorage`), so it survives reloads. Use ↺ in the header to reset.

## Run it

Requires **Node 22+**, which the e2e script needs for the built-in `WebSocket`.

```bash
npm install
npm run dev            # http://localhost:3000
```

| Script | What it does |
|---|---|
| `npm run build` / `npm start` | Production build / serve |
| `npm run typecheck` | `next typegen` + `tsc --noEmit` (strict, `noUncheckedIndexedAccess`) |
| `npm run lint` | ESLint (Next core-web-vitals + TypeScript) |
| `npm test` | Vitest: 79 unit tests (money, transfer rules, ledger/balances, analytics, queries) |
| `npm run e2e` | 39 browser checks against a running server (`BASE_URL`, default `:3000`) using your installed Chrome or Edge, with no extra dependencies. Screenshots go to `e2e-artifacts/` (git-ignored) |

**Deploy:** import the repo in Vercel. There are no environment variables, database or paid services.

## Architecture

```
src/
  app/                 routes only: thin pages (Suspense boundaries) + api/** route handlers
  features/            overview · transactions · transfers · cards (UI + feature hooks)
  components/          ui/ (shadcn primitives) · layout/ (shell, theme) · shared/ (Money, states, chart card)
  lib/                 domain logic, framework-free and unit-tested
    money.ts           integer-cents math, parsing, formatting
    schemas.ts         Zod schemas → every type, shared by client and server
    seed.ts            deterministic faker seed
    ledger.ts          seed + replayed events → accounts, transactions, cards, transfers
    transfers.ts       business rules (funds, ACH daily limit, payee methods, demo cap)
    analytics.ts       overview aggregations
    transactions-query.ts  filter / sort / paginate / CSV
scripts/e2e/           dependency-free browser checks (Chrome DevTools Protocol)
.claude/agents/        versioned Claude Code subagents (see "How I used AI")
```

### A stateless mock backend that survives serverless
The brief asked for route handlers backed by an in-memory store, persisted in `localStorage`. On Vercel each request can hit a different serverless instance, so **server memory can't be the source of truth**. Instead:

```
Browser                                         Route handler (any instance)
┌───────────────────────────────┐   POST {state, ...params}   ┌─────────────────────────────────────┐
│ localStorage: event log       │ ──────────────────────────▶ │ Zod-validate body                   │
│  · transfers (capped at 100)  │                             │ ledger = seed(today) + replay(log)  │
│  · card status (latest/card)  │ ◀────────────────────────── │   ↳ every event re-validated        │
└───────────────────────────────┘   JSON / CSV / 201 / 422    │ filter · aggregate · paginate       │
                                                              └─────────────────────────────────────┘
```

- **The client holds only intent** (the transfers it made, plus each card's latest status). The server rebuilds the ledger on every request, which is cheap at about 200 rows, and **re-validates each event on replay**. A tampered, duplicated or stale event is dropped, so the client can't forge a balance.
- **Settlement is derived from time** (`createdAt` + delay per method), not timers. TanStack Query polls only while something is due to settle.
- The log travels in the **request body** (headers have size limits), so reads are `POST /api/<resource>/query`. Writes are `POST /api/transfers` and `PATCH /api/cards/[id]`. Invalid input returns `400` with issues; a business-rule rejection returns `422` with `{ code, message, field }`, which the form maps back to the right field.

| Endpoint | Purpose |
|---|---|
| `POST /api/overview/query` | KPIs and chart series for a range |
| `POST /api/accounts/query` | Accounts with balances and pending outflows |
| `POST /api/transactions/query` · `/export` | Filtered, sorted, paginated page · CSV |
| `POST /api/transfers` · `/query` | Create a transfer (201 + event to store) · list user transfers |
| `POST /api/cards/query` · `PATCH /api/cards/[id]` | Cards · freeze/unfreeze |
| `GET /api/payees` | Saved recipients (static, prerendered) |

## Key decisions and trade-offs

- **Money is integer cents everywhere.** User input is parsed by `parseMoneyToCents` (string → cents, never `parseFloat`), cents are converted to a decimal only in `formatMoney`, and CSV amounts use exact integer math. `formatMoney` throws on non-integer cents, so a float can't slip through silently.
- **Zod is the single source of truth.** Types are `z.infer`'d. The client runs the same schema **and the same business rules** as the server before the review step (fast feedback), and the server stays authoritative.
- **Internal transfers are excluded from money in/out**, since moving cash between your own accounts is neither revenue nor spend, and failed transactions are excluded too. Pending transactions count, because the money is committed.
- **The seed is anchored to "today" with a fixed faker seed.** The data has a stable shape but always looks current. A fixed calendar date would leave "last 30 days" empty within weeks. Tests pin `now`.
- **Charts:** the categorical palette was **validated for color-vision deficiency** in both themes with a script, not eyeballed. Money in and money out differ in lightness, not just hue, and every chart has a table twin. Animations are off because charts refetch while transfers settle. There are no dual axes.
- **Next 16 Cache Components:** pages are static shells, and client data views sit behind `<Suspense>`. The theme uses a tiny no-flash inline script instead of `next-themes`, which renders a `<script>` from React and warns in React 19.
- **Trade-offs I accepted for a demo:** the event-log size is capped (with a reset button) instead of snapshotting, the client could clear its own log (fine without auth), and ACH settles in seconds instead of days.

## Quality

- **Unit tests (Vitest):** money parsing and formatting edge cases (`0.29`, grouping, >2 decimals), transfer schema and business rules (one cent over the balance, ACH daily limit, unsupported payee methods), ledger invariants (seed never overdraws, internal transfers conserve the total, pending → completed, tampered and duplicate events dropped), analytics consistency (buckets sum to totals), CSV escaping and formula-injection guard.
- **Browser E2E (`npm run e2e`):** drives a real headless Chrome/Edge through the DevTools Protocol. It covers search, sort, pagination, filters, keyboard access to the detail drawer and focus return, a full wire (validation → pending → completed, total balance down by exactly $1,500.00), card freeze surviving a reload, reset, zero console errors, and no horizontal overflow at 390px.
- **Accessibility:** semantic tables with `aria-sort`, labelled inputs, `fieldset`/`legend`, `aria-invalid` + `aria-describedby`, focus moved to step headings and invalid fields, `aria-live` for status changes only (the countdown is visual), status always icon + label, a skip link, and AA contrast verified for every token pair.

## How I used AI

I built this with **Claude Code**, with a documented, repeatable workflow rather than one-off prompts. The full record is in **[docs/ai-workflow.md](docs/ai-workflow.md)**.

- **Conventions first.** [`CLAUDE.md`](CLAUDE.md) (money rules, folder structure, API contract, accessibility, chart rules) was written and approved before any code, and kept up to date as decisions changed.
- **Vertical slices, one branch each.** The assistant ran typecheck, lint, tests and the build, and checked each slice in a browser. I reviewed every slice, made the architecture calls (for example, putting the event log in the request body instead of a header) and ran every git operation myself.
- **Versioned subagents** in [`.claude/agents/`](.claude/agents): a `feature-slice-builder` (two ran in parallel to build Transfers and Cards under a strict file-ownership contract) and a **read-only** `convention-reviewer` (no write tools) that audits each slice against `CLAUDE.md`. The reviewer caught, among other things, that screen readers would have re-announced the transfer countdown every second.
- **Verification over trust.** The bugs that mattered were found by running the app: a CSV guard turning negative amounts into text, a red/green pair indistinguishable under protanopia, focus lost after closing a drawer, and two countdowns disagreeing. Each one is listed, with its fix, in the workflow doc.

## What I'd do next

1. **Real auth and multi-tenancy.** Sessions (e.g. Auth.js or Clerk), roles (owner / admin / bookkeeper), approval rules for large transfers, and 2FA step-up before moving money.
2. **A BaaS provider instead of the mock ledger.** For example Unit, Treasury Prime, Column or Increase: their accounts, ACH/wire and card APIs, with **webhooks** driving status changes instead of time-derived settlement, plus reconciliation against their ledger.
3. **A real ledger store.** Postgres with an append-only, double-entry journal. The event-replay design here maps onto it directly.
4. **Audit logs.** Immutable records of who did what and when (transfers, card changes, logins), exportable for compliance.
5. **Idempotency and rate limiting.** Idempotency keys on `POST /api/transfers` (no double-send on retries), per-user and per-IP rate limits, and velocity checks on outgoing money.
6. **Observability.** Structured logs, tracing on route handlers, and error tracking (Sentry). Playwright in CI on every PR with the existing E2E scenarios.
7. **Product.** Scheduled and recurring payments, payee onboarding with account verification, multi-currency, statements (PDF), and receipts attached to card transactions.
