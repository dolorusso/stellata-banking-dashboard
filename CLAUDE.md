# CLAUDE.md — Stellata (small-business banking dashboard)

Brand primary: `#193e2c` (deep oak green). The name comes from *Quercus stellata*, the post oak, a nod to Post Oak Group.

A demo case study: a banking dashboard for small businesses. It has no real backend, no auth and no paid services, and it deploys on Vercel with zero config.

## Stack
- Next.js (App Router) + TypeScript `strict` (also `noUncheckedIndexedAccess`)
- Next 16 with **Cache Components** enabled: read `node_modules/next/dist/docs/` before using unfamiliar APIs (see AGENTS.md). Data-dependent client UI that reads time must sit behind `<Suspense>`.
- Tailwind CSS v4 + shadcn/ui (Radix primitives, `cn` package), lucide-react icons. Light/dark mode uses a hand-rolled no-flash script (`components/layout/theme.ts`), not `next-themes`.
- Recharts (charts), TanStack Table (transactions), Zod (validation), TanStack Query (fetching, loading/error states, polling)
- @faker-js/faker with a **fixed seed** for mock data
- Vitest for unit tests

## Commands
- `npm run dev`: start the dev server
- `npm run build`: production build (must pass with zero errors)
- `npm run typecheck`: `next typegen && tsc --noEmit` (typegen provides `LayoutProps`/`RouteContext`)
- `npm run lint`: ESLint
- `npm test`: Vitest (run once)

## Folder structure
```
src/
  app/                  # routes only: thin pages, layouts, route handlers (app/api/**)
  features/
    overview/           # KPIs, account cards, charts
    transactions/       # table, filters, detail drawer, CSV export
    transfers/          # transfer form + flow
    cards/              # virtual debit card + freeze
  components/
    ui/                 # shadcn/ui primitives (generated, edit sparingly)
    layout/             # app shell, sidebar, mobile nav, theme toggle
    shared/             # cross-feature pieces (Money, EmptyState, ErrorState…)
  lib/
    money.ts            # cents math + formatting
    schemas.ts          # Zod schemas = single source of truth for types
    seed.ts             # deterministic faker seed (anchored to the current UTC day)
    ledger.ts           # seed + replayed events → accounts, transactions, cards, transfers
    transfers.ts        # transfer business rules + resulting ledger entries
    transactions-query.ts # filter / sort / paginate / CSV
    http.ts             # server-only: body parsing + error responses
    demo-state.ts       # client-only: event log in localStorage
    api-client.ts       # typed fetch helpers used by the client
```
Feature folders hold their own components, hooks and helpers. Move something to `components/` or `lib/` only when two or more features use it.

## Engineering rules
- **Money is integer cents + currency** (`{ amountCents: number; currency: "USD" }`). Never use floats for money. Do arithmetic only through `lib/money.ts`. Format only at the UI edge (the `<Money>` component / `formatMoney`). Parse user input with `parseMoneyToCents` (string to cents, no `parseFloat`).
- **Sign convention:** transaction `amountCents` is signed (+ for inflow, − for outflow). Balances are derived from or kept in sync with transactions.
- **Types come from Zod.** Define the schema in `lib/schemas.ts` and use `z.infer` for the type. The client and the server import the same schemas.
- **Validate every API input with Zod** (body and query params). Invalid input returns `400` with `{ error: { message, issues } }`.
- **Mock backend (stateless):** serverless instances don't share memory, so the server state = deterministic seed + a replayed **user event log**. The client keeps the log in `localStorage` and sends it **in the request body** (never in headers, because of size limits). Every API call is therefore a `POST` with `{ state, ...params }`. Convention: reads are `POST /api/<resource>/query`, writes are `POST /api/transfers` and `PATCH /api/cards/[id]`. Business-rule failures return `422` with `{ error: { code, message, field } }`. Replay re-validates every event, so tampered events are dropped. Compaction: card state is stored as the latest status per card (not as toggle events), and transfers are capped (`MAX_USER_TRANSFERS`). Past the cap, the UI asks the user to reset the demo. Replay and domain logic are pure functions in `lib/`. Route handlers stay thin.
- **Transfer settlement** is derived from time (`createdAt` + settle delay per method). There are no server timers. The client polls (TanStack Query `refetchInterval`) while anything is pending.
- **Dates** are ISO 8601 strings in data and are formatted at the UI edge. The seed uses a fixed faker seed but is anchored to the **current UTC day** (history ends yesterday), so the data has a stable shape and always looks recent. Tests pass a fixed `now`.
- **UI states:** every data view has loading (skeleton), empty and error states.
- **Accessibility:** use semantic HTML, label every input, keep everything keyboard reachable, keep focus rings visible, meet AA contrast in both themes, and use `aria-live` for async status (transfer progress).
- **Numbers:** amounts in tables/lists use the `amount` utility (`tabular-nums`) via `<Money>` and are right-aligned. Large standalone figures (hero, KPI tiles) keep proportional digits.
- **Charts:** the categorical palette (`--chart-1…6`, fixed order) is validated with the dataviz validator in both themes. Never reorder or cycle it. Single-series charts use `--chart-accent`. Every chart card has a table view (`ChartCard`), a legend for 2 or more series, and a custom `MoneyTooltip` (values are cents). Animations are off because charts refetch while transfers settle. No dual axes.
- **Money in/out** excludes internal transfers (`category: "transfer"`) and failed transactions. Pending counts.
- **Simplicity:** add no abstractions without a second use. Keep files small and avoid barrel files. Prefer server-side pure functions over client state machinery.
- **Styling:** use design tokens (CSS variables) only, with no hard-coded colors in components. Use `cn()` to merge classes.

## Testing
Vitest unit tests sit next to the code they cover (`*.test.ts`). Required coverage: money utilities, transfer validation (Zod schema + business rules such as insufficient funds) and balance updates after transfers.

## Workflow
- Build in vertical slices, **one branch per slice** (`feat/a-scaffold`, `feat/b-data-api`, `feat/c-overview`, `feat/d-transactions`, `feat/e-transfers-cards`, `feat/f-polish`). Branches are merged locally into `main`.
- After each slice, run `typecheck`, `lint` and `test` and fix the failures. Then propose a conventional commit message (`feat: …`, `chore: …`, `test: …`).
- **The maintainer runs all git write operations (branch, commit, merge, push) manually.** The assistant never runs them. It only suggests the commands.
