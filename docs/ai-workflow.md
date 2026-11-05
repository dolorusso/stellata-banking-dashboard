# How AI was used to build Stellata

Stellata was built with **Claude Code** as a pair programmer, in six vertical slices (one branch each). I set the direction, constraints and every git operation, and reviewed each slice. The assistant wrote code, ran checks, drove the browser and reported back. This file records the parts of that process worth looking at: the conventions it worked under, how work was delegated to subagents, and what verification caught.

## 1. Conventions first: `CLAUDE.md`

Before any code, the assistant wrote `CLAUDE.md` (stack, folder structure, engineering rules, workflow) and proposed a plan, then **waited for approval**. Rules that would be expensive to get wrong later were fixed up front:

- money as integer cents, formatted only at the UI edge
- Zod schemas as the single source of truth for types and validation
- a stateless mock API, so it survives Vercel's serverless instances (decision below)
- loading, empty and error states, accessibility and design tokens as requirements, not polish

`CLAUDE.md` was updated whenever reality diverged from the plan (Next 16 Cache Components, the seed anchored to "today", the chart palette rules), so it stays an accurate brief for any agent picking up the repo.


## 2. Subagents (`.claude/agents/`)

Two subagent roles are defined as versioned files, so the workflow is reproducible by anyone who opens the repo in Claude Code:

| Agent | Tools | Role |
|---|---|---|
| [`feature-slice-builder`](../.claude/agents/feature-slice-builder.md) | Read, Write, Edit, Glob, Grep, Bash | Builds one feature in parallel with others under a **strict file-ownership contract** |
| [`convention-reviewer`](../.claude/agents/convention-reviewer.md) | Read, Grep, Glob, Bash (**no write tools**) | Audits the branch diff against `CLAUDE.md` before the commit |

### The ownership contract (why parallel agents didn't collide)
- Each builder owns a disjoint set of paths (`src/features/<name>/**` + its route page).
- Shared code (`src/lib/**`, `src/components/**`) is off-limits. Builders **report** the shared changes they need, and the integrating agent applies them.
- No git, no `npm run build` and no dev server (concurrent builds collide in `.next/`). Builders run typecheck, lint and tests only.
- The integrating agent builds once, then verifies in a real browser.

### Slice (e): transfers + cards, built in parallel
The slice split cleanly into two independent features, so it ran as two builders, while the main agent worked on code neither of them owned:

| Who | Built | Reported back |
|---|---|---|
| Builder: transfers | 3-step flow (details, review, result), shared Zod + business-rule validation on the client, 422 errors mapped to fields, live pending→completed timeline, recent transfers, **8 new unit tests** | No shared changes needed |
| Builder: cards | Card visual, optimistic freeze/unfreeze with rollback, spend meter (`role="meter"`), card activity | **Missing server-side `cardIds` filter**: it had to fetch 50 rows and filter on the client, so older card activity was invisible |
| Main agent | "Reset demo" dialog, overview polling while transfers settle, the `cardIds` filter + test (from the cards report), integration, browser E2E | — |
| Reviewer (read-only) | Audited the integrated slice against `CLAUDE.md` | 5 verified findings + 1 borderline (below). All were fixed by the main agent, not the reviewer |

**Review pass findings (all fixed before the commit):**
| Severity | Finding | Fix |
|---|---|---|
| Medium | The transfer result's `aria-live` text included the countdown, so screen readers re-announced it **every second** | Announce status changes only; the countdown stays visual |
| Medium | The recent-transfers list was `aria-live` and contained the ticking countdown (and duplicated the result announcement) | Removed `aria-live` from the list |
| Low | `ring-black/5` on the card: a hard-coded color, not a token | `ring-foreground/5` |
| Low | Amount input `aria-describedby` pointed to a help element that isn't rendered when no account is selected | Only reference it when it exists |
| Low | 422 handling relied on a hand-copied list of error codes, so a new server code would silently skip field mapping | Decide by `status === 422`; unknown codes fall back to a form alert |
| Borderline | Two cents subtractions done inline instead of through `lib/money.ts` | `sumCents([a, -b])` |

> Note: the two slice-(e) builders were launched with these contracts written inline. The
> `.claude/agents/` files were then extracted from them so the roles are versioned and reusable.
> Claude Code loads agent definitions at session start, so in the session that created them the
> reviewer ran as a general-purpose agent with the file's exact instructions (the read-only rule
> was stated in the prompt, not enforced by tool restrictions). New sessions get both by name.

### Slice (f): the reviewer by name, with enforced tools
In the next session Claude Code loaded both agents from `.claude/agents/`, and `convention-reviewer` ran **by name with its frontmatter tool list** (no Write/Edit available to it). Besides its checklist, it was asked to verify every factual claim in the README against the code: test counts, endpoints and methods, settle times, the transfer cap, scripts and paths. All of them held.

| Severity | Finding | Outcome |
|---|---|---|
| Low | `npm run e2e` uses Node's built-in `WebSocket` (Node 22+), but nothing declared it | `engines.node >= 22`, noted in README and `CLAUDE.md` |
| Low | The e2e driver's `dark` option was never exercised | Added a dark-theme suite |
| Low | The error boundary showed raw `error.message` to users | Generic message; the error is logged to the console |
| Low | "The 404 title probably drops the `· Stellata` suffix" | **False positive.** The browser shows `Page not found · Stellata`. The reviewer had flagged it as unconfirmed without a server, and the browser check settled it |

The false positive is the point of splitting the roles: static review proposes, and running the app decides.

## 3. Verification: what actually caught bugs

Typecheck, lint and Vitest ran after every slice. The bugs worth mentioning were caught by **running the app**, not by unit tests. The assistant drove headless Edge through the Chrome DevTools Protocol (clicks, typing, keyboard), took screenshots and read them back.

| Slice | Found by | Bug | Fix |
|---|---|---|---|
| b | Unit test | Seed generated "today" transactions with times later than *now* | History ends yesterday |
| b | API smoke test | CSV formula-injection guard turned `-12.50` into `'-12.50` (text in Excel) | Plain numbers exempt |
| c | Palette validator | Money in/out greens and reds indistinguishable under protanopia (ΔE 2.0) | Separated by lightness, re-validated in both themes |
| c | Screenshot | Charts rendered empty; axes had odd ticks ($398.8K) | Animations off (charts refetch while polling); auto domain |
| d | Browser E2E | Closing the detail sheet sent focus to `<body>` instead of the row | Return focus to the trigger |
| e | Subagent report | Card activity limited to the newest 50 rows | Server-side `cardIds` filter |
| e | Screenshot | Two countdowns for the same transfer disagreed (~8s vs ~13s) | Clock syncs immediately on activation |
| e | Screenshot | "Frozen" badge covered the card number | Moved between holder and expiry |
| e | Reviewer agent | Countdown re-announced every second to screen readers | Status-only `aria-live` |
| f | Screenshot (dark) | Selected toggle (range, destination, chart/table) indistinguishable in dark mode | Primary-tinted "on" state in the toggle primitive |
| f | Screenshot | Overview tab title lacked the `· Stellata` suffix (root-segment template doesn't apply) | `title.absolute` |
| f | Reviewing the test itself | An e2e check passed while showing 221 rows, not 12: `a ?? "".includes(x)` binds as `a ?? ("".includes(x))` | Parenthesized; the check now fails when it should |

That last row is a reminder that tests can be wrong too. A check that passed with the wrong number on screen was caught because the logged value was read, not just the ✓.

These checks live in the repo as `npm run e2e` (`scripts/e2e/`, 39 checks, no dependencies beyond an installed Chrome/Edge). The browser checks also confirmed the end-to-end flow:
- validation runs before review
- a $1,500 wire goes pending and completes in ~8s, with an `aria-live` announcement
- the total balance drops by exactly $1,500.00
- the transaction tops the table
- an internal transfer completes instantly
- a frozen card survives a reload
- a reset restores the seed
- there are zero console errors and no horizontal overflow at 390px


