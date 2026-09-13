# BYOB Campus TV Wall — Implementation Plan

## Context

Mesa Flea is **13 September 2026** (moved from 6 September). Two web pages go onto TVs across Mesa
campus for the rest of the BYOB Cohort 2026 programme: a live leaderboard (`/podium`)
and a Mesa Flea countdown with achievement notifications (`/countdown`). They slot into
an existing campus slideshow rotation run by someone else, driven from **a laptop over
HDMI**.

This is **a display system, not a dashboard**. Nobody interacts with it. It runs
unattended for weeks, refreshes itself, survives network blips, and never asks for a
login. New separate repo at `~/byob-tv` (already `git init`-ed, no commits). It shares no
runtime state with the admin dashboard and must never depend on that dashboard being up.

The bar is specific: on a wall nobody is actively watching, **a bug that renders
convincingly can run for weeks**. That drives the verification approach in §9.

---

## 1. What exploration changed about the brief

Findings from `~/byob-master` (Apps Script behind `BYOB_MASTER`) and `~/BYOB_Dashboard`
(reference implementation for every metric). Each invalidates something the brief
specified.

| # | Brief said | Reality | Resolution |
|---|---|---|---|
| 1 | `Logo filename` in `Team Links` col F | Col F is `Product`; consolidator rewrites **C:I every 10 min** (`Consolidate.js:392-394`, `BYOB_Triggers.js:35`). Would be wiped. | Logo list in `config.ts`, no sheet column |
| 2 | `last_sale_ts` via `MAXIFS` on timestamps | `Daily Dump` has **no timestamp column** — col B is date-only. Nothing consumes the field. | Dropped |
| 3 | Tie-break by units | `TV_Feed` had no units column | Add `total_units` (`Daily Team Summary` col D) |
| 4 | `prev_week_rank` = rank of `prev_week_revenue` | Ranks a *weekly* figure against a *cumulative* one — the climb number is meaningless | Sheet computes climb from cumulative-through-week |
| 5 | Programme start 21 Jul 2026 | Every existing system anchors **20 Jul 2026** (`CHAL_START`, `WEEK_1_START`) | 20 July 2026 |
| 6 | Weekly cohort values = *current* week | They flip to the new empty week at Monday 00:00 IST, so "the week that just ended" is unreadable minutes later | Sheet publishes a **closed-week block** keyed by `closed_week_number` |

Two risks the brief didn't cover:

- **Mid-rebuild reads.** The consolidator clears `Daily Dump` rows 2+ and rewrites them
  each run. A read landing mid-rebuild could fire a false overtake or permanently burn a
  milestone. → row-count sanity gate (§5).
- **Both pages polling at once.** A laptop-driven rotation is most likely rotating
  *browser tabs*, so both pages may be open simultaneously with one visible. Both would
  poll, both would reconcile, and they would double-fire and clobber each other's
  localStorage writes. → visibility gating (§6), which also covers the
  reload-on-every-rotation case with the same mechanism.

### Decisions taken (confirmed)

- **Logos** — `config.ts` list, no sheet column.
- **Cohort values** — third tab `TV_Cohort` (`key,value`), own published CSV.
- **Stale guard** — discard any fetch that isn't exactly 42 team rows; keep last-good.
- **Programme start** — 20 July 2026 IST.
- **Theme** — **white page background.** Mesa design system via the `frontend-design`
  skill, then iterate. **Mesa logo only** — no brand marks, no other assets.
- **Flea time** — 13 Sep 2026 10:00 IST, marked unconfirmed **in a code comment only**;
  this must never appear in the UI.
- **First load** — seed silently: evaluate every trigger, record all as seen, animate
  nothing. Only post-seed changes fire.
- **Triggers** — all 15 ship.
- **Overtake motion** — build the kick as written (spring, strike, rotating exit,
  bounce), overriding the brand's "no bounces / no springs / no spinning" rule, which was
  written for marketing assets. Documented as a deliberate extension, the same way the
  dashboard documents `mesa-extensions.css`.
- **Reduced motion** — **ignored.** Laptop over HDMI; the OS setting says nothing about
  who's walking past, and honouring it would silently disable the entire product.

---

## 2. Sheet work — three formula-only tabs

Formula-only, no Apps Script. Nothing in `~/byob-master` protects the master or
enumerates its tabs, so adding tabs is safe (`BYOB_Protect_Alerts.js` only touches team
workbooks, warning-only).

**Reference source tabs positionally, not by header name.** `Daily Dump` row 1,
`Daily Team Summary` A1:L1 and `Weekly — by Team` row 1 are all typed by hand — no script
writes them, so their text can't be verified from source and a `MATCH()` on them is a
silent-failure waiting to happen. The existing summary formulas already reference
positionally; follow them. `TV_Feed`'s *own* headers we control, so the client parses
those by name.

Two facts that must not be got wrong:

- **Revenue is `SUMIFS('Daily Dump'!$N:$N, 'Daily Dump'!$D:$D, "Sale")`.** Column N
  (`Money in (₹)`) is already proof-gated upstream (proof = `Yes` **and** units ≥ 1).
  Summing column I instead would count unproven and zero-unit sales and silently disagree
  with every existing rollup.
- `Weekly — by Team` is week-major and hard-codes 42 into `ROW()` arithmetic. Derive weeks
  in `Streaks_Helper` from `Daily Dump!$C:$C` directly, never from that tab's row geometry.

### `TV_Feed` — 42 rows, five columns

| Header | Source |
|---|---|
| `team_id` | `Team Links` col A (rows 6–47) |
| `venture_name` | `Team Links` col E; empty string if placeholder |
| `total_revenue` | `Daily Team Summary` col B (`Revenue (proof) ₹`) |
| `total_units` | `Daily Team Summary` col D (`Units sold`) |
| `streak_days` | `Streaks_Helper` |

> **Scope note — please confirm at approval.** The brief's §4.2 also specified
> `logo_filename`, `current_rank`, `week_revenue`, `day_revenue`, `prev_week_revenue`,
> `prev_week_ts` and `last_sale_ts`. **Nothing in the 15 triggers or either slide layout
> reads any of them** — `logo_filename` moved to `config.ts`, `current_rank` is computed
> client-side (§4), and the weekly figures are all cohort-level. They're dropped under
> YAGNI. Each is one formula to add back if you want the headroom; say so and I'll keep
> them.

### `TV_Cohort` — `key,value`

Daily and all-time titles:

- `biggest_sale_today_team` / `_amount`
- `most_units_today_team` / `_count`
- `biggest_revenue_day_team` / `_amount` / `_date` (highest single-day revenue ever)

Then a **closed-week block**, written at rollover and held stable for the following seven
days:

- `closed_week_number` — integer, `0` before the first Monday rollover
- `closed_week_revenue_team` / `_amount`
- `closed_week_climb_team` / `_ranks` — climb in *cumulative* rank between the end of the
  closed week and the end of the week before
- `closed_week_improved_team` / `_delta`

Seven days of dwell time is the whole point: a TV loading at any moment during the
following week fires each weekly exactly once via `claim(fired, 'week:3:revenue')`. No
client-side week maths, no clock, correct through arbitrary downtime — and a mid-week
correction to the winner does not replay, which is right, because a correction is not news.

**The rank-25 floor must be applied sheet-side**, inside `closed_week_climb_team`. The
client only knows *current* rank, which drifts after the week closes, so a client-side
floor would give a different answer on Wednesday than on Monday.

Plus `as_of` — **still published, no longer displayed.** It was a text stamp the client
rendered verbatim, small, on both slides, decided here as a deliberate exception to §10's
"nothing else on the countdown slide": without it, an unpublished or permanently short
feed freezes every wall on stale numbers that look perfectly healthy, for days. That
reasoning was never refuted — the stamp was removed on 13 September 2026 because a display
should be figures rather than apparatus, and the freeze it exposed is now diagnosed from
`Sync Status` in the master instead of from the wall. `AGENTS.md` carries the full cost
and `WallHeader.tsx` carries the route back.

**Keep the key in `TV_Cohort` regardless.** `COHORT_KEYS` requires it, so deleting the row
throws the whole snapshot away on every poll — and it is what any future stamp, or any
staleness check that never renders, would read.

Any value may be an empty string, and the client handles empty by not firing. Keys may
not be *missing* — that throws.

### `Streaks_Helper` — one row per team, hidden

`streak_days` = consecutive days ending today with at least one `Sale` row where
`Money in (₹) > 0`. `SUMPRODUCT` over `Daily Dump` is sufficient.

### Publishing

File → Share → Publish to web, **`TV_Feed` and `TV_Cohort` only**, CSV. Two public URLs
into `config.ts`. `Streaks_Helper` stays unpublished. Note this makes cohort revenue
publicly readable by URL — acceptable, since it's already going onto public TVs.

**Precondition:** confirm the *spreadsheet's* timezone is Asia/Kolkata in File ▸ Settings.
That is a separate setting from `appsscript.json`, and `TODAY()`/`NOW()` follow the
spreadsheet. If it's wrong, "today's sales" is off by a day near midnight.

---

## 3. Client architecture

```
byob-tv/
├── app/
│   ├── layout.tsx              # fonts, globals, no chrome
│   ├── globals.css             # tailwind + design-system imports
│   ├── mesa-tv.css             # viewing-distance extension (documented as not core brand)
│   ├── podium/page.tsx
│   └── countdown/page.tsx
├── components/
│   ├── Podium.tsx  OvertakeSequence.tsx
│   ├── Countdown.tsx  MicrosecondTicker.tsx
│   ├── HeroNotification.tsx  SubCardNotification.tsx
│   └── VentureLogo.tsx        # logo-or-initial, no broken images
├── lib/
│   ├── types.ts                # shared types; keeps the others acyclic
│   ├── feed.ts                 # fetch + parse + sanity gate
│   ├── triggers.ts             # PURE reconcile — the only trigger logic
│   ├── storage.ts              # the only module touching localStorage
│   ├── player.ts               # PURE playback reducer
│   ├── usePlayer.ts            # reducer + the single timer effect
│   ├── useWallData.ts          # visibility-gated 60s poll; the only fetch
│   └── format.ts               # en-IN currency
├── public/logos/
├── .claude/skills/mesa-design/ # copied in, so a fresh clone has it
└── config.ts                   # every constant
```

Stack matches the dashboard: **Next.js 16 App Router, React 19, Tailwind v4, TypeScript
strict, vitest**. Two dependency choices differ:

- **`motion` (motion.dev), not `framer-motion`.** Same library under its current name —
  `motion/react` exports the identical `motion`, `AnimatePresence`, `layout` prop, spring
  physics and keyframes, so every animation in this plan is unchanged. The brief chose
  framer-motion because it's "already in the org's dependency chain", but a separate repo
  shares no dependencies, so that reason doesn't bind and the legacy package name buys
  nothing. Pin the latest v12 at install. The one consequence: imports differ from the
  dashboard's, which matters only if someone hand-copies a component between repos.
- **`papaparse`** — venture names will contain commas and Google quotes those fields, and
  it handles the BOM and CRLF cases in §5. A hand-rolled `split(',')` is a
  silent-corruption bug on exactly the kind of data this wall celebrates.

### Timezone: the client needs none

`FLEA_DATE` and `PROGRAMME_START` are stored as **absolute instants** (ISO with `+05:30`).
`flea.getTime() - Date.now()` is then timezone-independent and correct on any machine
whose clock is right. All "today" / "this week" logic lives in the sheet, which is IST.
No `Intl` timezone gymnastics client-side.

---

## 4. Ranking

Reuse the dashboard's rule exactly (`lib/metrics/ranking.ts`): **logged revenue desc →
units desc → team ID asc.** Rank is computed client-side from the sorted feed, so there
is one authority on ordering rather than a sheet column that can disagree with the sort.

---

## 5. `lib/feed.ts` — fetch, parse, gate

```ts
export const MIN_TEAM_ROWS = 40
export type Team = { teamId: string; ventureName: string; totalRevenue: number; totalUnits: number; streakDays: number }
export type Cohort = Record<string, string>
export type Snapshot = { teams: Team[]; cohort: Cohort }

export class TvSchemaError extends Error {}         // missing header/key — loud, discards the tick
export function parseTeams(csv: string): Team[]     // pure; throws TvSchemaError
export function parseCohort(csv: string): Cohort    // pure; every key required, empty values allowed
export async function fetchSnapshot(): Promise<Snapshot>
```

Four things here are non-obvious and each would have shipped a broken wall:

- **The gate is `teams.length < MIN_TEAM_ROWS`, not `!== 42`.** A short export can only
  ever produce *fewer* rows, so short-checking is strictly correct — and an exact check
  means the day a 43rd team is added, every wall freezes on stale data permanently,
  silently, with no spinner or error to notice. The dashboard's `lib/sheets/gate.ts`
  already encodes exactly this ("short, not exact").
  *Revised 11 Aug 2026:* the threshold is **40**, the competing cohort, since `SLE-C441`
  and `SLE-C442` are spares. What it guards is Google's CSV export re-reading the sheet
  inside a rebuild's `clearContent` → `setValues` window — **not** a torn read of the
  master, which `LockService` and the consolidator's build-then-write make impossible.
  The gate counts *usable* rows, which is why `parseTeams` drops a row with an
  unparseable number rather than throwing on it: one judge of trustworthiness, not two.
- **Google's published CSV carries a UTF-8 BOM and CRLF line endings.** `﻿team_id`
  does not equal `team_id`, so a header check throws on every fetch from first deploy.
  Both are handled by **papaparse**, which is the main reason to take the dependency
  rather than hand-roll — venture names containing commas are the other.
- **Both fetches use `cache: 'no-store'`.** On a page that never reloads under manual
  control, the browser HTTP cache would serve one body for the life of the page and the
  wall would freeze with no error anywhere.
- **A revoked or re-published sheet returns an HTML login page with HTTP 200**, so
  status-code checking passes it. The parsed-row gate is what catches that.

**The two CSVs are one atomic snapshot** — fetched with `Promise.all`, gated together,
committed together, discarded together. Required, not tidiness: triggers 13–15 join a
cohort team ID against the feed for its venture name, so a fresh cohort reconciled
against a stale feed would put the wrong name on screen.

---

## 6. `lib/useWallData.ts` — visibility-gated polling

The single mechanism that makes both slideshow assumptions safe:

- **Only a visible page fetches or reconciles.** `document.visibilityState !== 'visible'`
  → do nothing. A hidden tab in a tab-rotator cannot double-fire or clobber the store.
- On becoming visible (or on load): fetch → gate → persist → reconcile → enqueue → enter
  the 60s interval. On hidden: clear the interval.
- First paint reads the cached CSV in `useLayoutEffect`, so data is on screen before the
  browser paints. Never a spinner.
- **One `catch` in the whole subsystem**, on the interval callback, so a bad tick can't
  kill the loop. Every other error path throws. Worth a comment saying so, or someone
  will add a second `try`.

---

## 7. `lib/triggers.ts` — one pure function

```ts
export function reconcile(prev: Ledger | null, snapshot: Snapshot): { ledger: Ledger; events: WallEvent[] }
```

`prev === null` means absent, unparseable **or** wrong-shaped storage — all three route
into the seed branch, which is the branch a brand-new TV already needs. Not a fallback:
one branch with three entry conditions and no repair code. The failure direction is the
point — a corrupt ledger read as "empty but replay" would fire 250 heroes at once, in
public.

Pure: no `localStorage`, no `Date.now()`, no `fetch`. **All 15 triggers reduce to two
mechanisms**, which is what keeps this file small:

```ts
claim(fired, id): boolean       // records unconditionally; true if this call recorded it
handover(holders, key, team)    // records unconditionally; true if that's news worth showing
```

| Triggers | Mechanism | Id |
|---|---|---|
| 1–4, 10–11 (revenue) | `claim` | `rev:SLE-C407:100000` |
| 5, 12 (streaks) | `claim` | `streak:SLE-C407:14` |
| 6–8 (weekly) | `claim` | `week:3:revenue` |
| 9 (rank 1), 13–15 (daily titles) | `handover` | `rank1`, `biggestSaleToday`, … |

Set membership rather than delta detection (`prev < 100000 && now >= 100000`) because a
delta check breaks the moment a tick is discarded by the gate or a poll is missed, and
re-fires if revenue is corrected downward then back up. `>= threshold && !fired.has(id)`
cannot miss and cannot double-fire whatever the poll history. It's also grow-only, so
concurrent writes from two tabs commute. Bounded by construction at ~276 ids ≈ 7KB — no
pruning code, ever.

### Three subtleties that are easy to get backwards

- **`claim` runs BEFORE the venture-name check.** A nameless team crossing ₹1L records
  the id and emits nothing. The alternative — skipping nameless teams entirely — means
  the day someone fills in a venture name, that team detonates six triggers at once
  (₹25k, ₹50k, ₹1L, ₹2L, 7-day, 14-day) as one burst of stale news, and a *transiently*
  blank cell mid-edit re-fires a milestone already shown. The ledger records facts about
  the data; the name check governs what is fit to display. Gets its own named test.
- **`handover` records the empty string.** A title going team → empty at midnight is
  recorded and emits nothing; empty → team emits. That's why daily titles fire about once
  a day — the intent, not a bug. It also handles a rank-1 tie: two rows at rank 1 → holder
  becomes `''`, no overtake.
- **`reconcile` never throws.** Schema drift throws in `feed.ts` and discards the tick.
  Value oddities — a cohort team ID with no matching row, a blank name — are suppressed
  silently. Throwing on one bad cell would blank a wall in front of 42 teams.

### Storage — three keys, version in the key name

`byob-tv.v1.ledger` · `byob-tv.v1.pending` · `byob-tv.v1.csv`

Three, not one, because they have three different write patterns: the ledger is grow-only
and merged, `pending` is destructively drained, and `csv` is blindly overwritten every
60s. Folding the cache into the ledger would rewrite it 1,440 times a day and multiply
the cross-tab clobber window by sixty for no benefit.

Version lives **in the key name**. A version bump makes the old key simply absent, which
routes into the seed branch — no migration code, which would be a second read path.

The cache stores **raw CSV text, not parsed rows**, so `parseSnapshot` is the only thing
that ever produces a `Snapshot`, from cache and network alike. Parsed objects would go
shape-stale on a field rename and yield `undefined` with no error.

### Queue

One array. Enqueue is **replace-by-id, else append**, and the id choice makes staleness
policy fall out of that one rule: milestone ids are unique forever so they accumulate,
while `title:biggestSaleToday` and `overtake:rank1` are *constant*, so a newer holder
overwrites the older one. A card announcing a title its team no longer holds is a lie on
screen; latest-wins is the only truthful policy and here it costs no extra code. Caps of
6 per kind, drop-oldest.

**Consumed on play-start, not completion.** If the page rotates away 1s into an 8s hero,
that event is gone — at-most-once display, stated plainly. The alternative livelocks: if
the slideshow ever gives `/countdown` less time than one hero, the same hero replays every
rotation forever and everything behind it starves.

### Playback

`lib/player.ts` is a pure reducer (`idle` / `playing` / `gap`); `usePlayer(kinds,
queueVersion)` holds exactly one timer, by construction. The invariant:

> **`mode` is the only thing that says what is on screen. The queue is a mailbox and is
> never rendered. Nothing outside `usePlayer` calls `takePending`.**

Heroes and sub-cards share **one** machine on `/countdown` so they serialise, with "hero
beats card" expressed as a sort in `playOrder` rather than a priority system. Two machines
would be exactly the two-sources-of-truth problem. The 2.4s overtake is a single hold; its
five beats live inside the Motion component and never touch the machine.

*Rejected: publishing `countdown_seconds` from the sheet and adding monotonic
`performance.now()`. It immunises against a wrong clock, but it makes the countdown stop
working when the sheet is unreachable — and storing `FLEA_DATE` as an absolute instant
already covers the realistic failure (a wrong timezone). A laptop's clock is NTP-synced.*

---

## 8. Slides

**`/podium`** — 1st centred and larger, 2nd left, 3rd right, ranks 4–10 in a strip below.
That arrangement still holds; **the treatment described in the rest of this paragraph does
not.** It was superseded once by the pillars and again by the cards that replaced them — see
`docs/superpowers/specs/2026-08-12-podium-masthead.md`, which is the live design. First place is
a dark card on a gold plinth, not `panel-forest` with a lockup; there is no frosted glass;
rank is a numeral in a metal badge, not a word; and the slide's chrome is a full-height
masthead at the left rather than a strip across the top. What survives verbatim is the reason the word was chosen — that a
greyscale crop still has to rank — which the card now answers with size and a green ramp
instead. Ranks 4–10 reorder **as grid rows, not a `<table>`**: the dashboard measured 30
frames of a `<tr>` ignoring the layout transform and sitting still
(`components/Standings.tsx:263`).

Empty states per brief §6.3: fetch failure keeps last data and logs; fewer than 10
revenue-earning teams shows only those; no revenue at all still shows the structure at
zero. Never an error message, never a spinner.

**`/countdown`** — five automatic states (Calm / Aware / Urgent / Final hour / Past)
driven off the instant delta. Microsecond ticker top corner at 30fps. Sub-cards rotate
below; **when the queue is empty the space stays empty**. Hero takeover collapses the
timer for 8s. Nothing else on this slide — no cohort stats.

**`VentureLogo`** — zero team logos exist today, so the coloured-initial square carries
the entire wall on day one and is a first-class element, not a fallback afterthought.
Logo presence comes from the `config.ts` list, so no broken image is ever requested.

Neither slide carries the `as_of` stamp any more — it was the only element on either page
that was not in the brief's list, and it was removed on 13 September 2026. §2 has what
that costs.

---

## 9. Verification

The brief's rule, and the dashboard's hard-won lesson: **measure the running app, don't
read the source.** Three recorded CSS failure modes in `BYOB_Dashboard/CLAUDE.md` all
"looked deliberate and passed typecheck, lint and tests".

- **Tailwind v4 layering.** Import the design system with `layer(components)` — unlayered
  CSS beats layered utilities at any specificity. This bit the dashboard three separate
  times.
- **Class-name collisions.** Check every design-system class against Tailwind utilities
  (`.overline` drew a hairline over 67 labels and survived a full styling pass).
- **Fonts.** Self-host as variable fonts with deliberately renamed files, per
  `app/fonts/README.md` — `next/font` derives family names from filenames and collides.
- Verify colour, size and layout with `getComputedStyle` / `getBoundingClientRect` at
  **1920×1080**, the actual target.
- Unit tests (vitest, node) on pure `reconcile`:
  - **Seed emits nothing** — even for a fixture where all 42 teams are past ₹4L on 20-day
    streaks.
  - **Idempotence, asserted across every fixture**: `reconcile(reconcile(null, s).ledger,
    s).events` is `[]`. This one property is what *proves* seeding and steady-state are
    the same code path — they cannot drift, because there is one computation and a
    `prev === null` gate on the output.
  - One test per trigger; nameless team records but never emits, and still doesn't emit
    once named; midnight `A → '' → A` emits exactly one card; rank-1 tie emits no
    overtake and resolving it emits one; revenue regression ₹1.1L → ₹0.9L → ₹1.1L emits
    one hero total; a 41-row feed is discarded and writes nothing.
  - **A source-scan test** over `lib/triggers.ts` failing on
    `/\bDate\b|Date\.now|Math\.random|localStorage|fetch|window|document/`. This is the
    executable form of "the trigger system reads no clock", which is what makes the
    clock-skew reasoning true rather than aspirational. The dashboard uses the same
    pattern in `lib/metrics/metrics.test.ts`.
  - CSV-level tests for the BOM and CRLF cases specifically.
- Smoke test that both pages render with mock data.
- **When testing a bug fix, reintroduce the bug and confirm the test fails first.**

---

## 10. Build order

1. Scaffold repo, copy `mesa-design` skill in, wire Tailwind v4 + fonts + white surface.
2. `config.ts`, `lib/storage.ts`, `lib/feed.ts` with mock CSVs and tests.
3. `lib/triggers.ts` + `lib/player.ts` and their full test suites — both pure, both
   finished before any animation exists.
4. Build the three sheet tabs (incl. the closed-week block and `as_of`); publish both
   CSVs; point `config.ts` at the real URLs; confirm the real CSV parses, that the BOM
   and CRLF are handled, and that the gate behaves.
5. `/podium` static, then reorder, then `OvertakeSequence`.
6. `/countdown` states, ticker, sub-cards, hero takeover.
7. Visual pass with the `frontend-design` skill; measure in-browser at 1920×1080.
8. README: setup, config, adding a logo, publishing the tabs, changing the Flea date.

Commit after each slice — git is the rollback path.

**Deploy:** I'll build and commit locally in `~/byob-tv`. Creating a GitHub remote and a
Vercel project are outward-facing actions on your accounts, so I'll leave those to you
unless you tell me to run `gh` / `vercel` yourself.

---

## 11. Open preconditions (not build blockers)

1. **Venture names** in `Team Links` col E for at least the top 20 teams. A wall of
   `SLE-C4xx` codes is worse than no wall — and empty names are gated out of every
   trigger, so those teams also can't be celebrated.
2. **Logos** — currently **zero of 42** exist.
3. **Slideshow rotation** — confirm what drives it and whether it reloads URLs or rotates
   tabs. The visibility gating means the build is correct either way.
4. **Flea opening time** — 10:00 IST assumed, in a code comment only.
5. **Spreadsheet timezone** — confirm Asia/Kolkata in File ▸ Settings.
