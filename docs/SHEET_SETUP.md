# Sheet setup — the two new tabs in `BYOB_MASTER`

**v2 — supersedes the three-tab setup.** If you already built the v1 tabs, do not
read this top to bottom and re-key everything. Go to **[What changed from
v1](#what-changed-from-v1)** first; it is a short list and the published URLs do
not change.

**These formulas have not been run.** They were written against the Apps Script
source (`Consolidate.js`, `Iteration_1.js`), which guarantees *column positions* but
not header text, and I have no access to the live sheet. Paste them, then work
through the verification checklist at the bottom before pointing the wall at them.

## Ground rules

- **Formula-only. No Apps Script.** The master already runs enough of it, and
  formulas re-run themselves whenever the consolidator writes.
- **Do not touch any existing tab.** These two tabs are additive. Nothing in
  `BYOB_Protect_Alerts.js` protects the master, and no script enumerates its tabs,
  so adding them is safe.
- **Reference source tabs by column position, not header name.** `Daily Dump` row 1
  and `Daily Team Summary` A1:L1 are typed by hand — no script writes them, so a
  `MATCH()` on that text is a silent failure waiting to happen.
- Revenue is always `Daily Dump` column **N** (`Money in (₹)`) filtered to
  `Type = "Sale"`. Column N is already proof-gated upstream — a Sale only becomes
  money-in when proof is `Yes` **and** units ≥ 1. Summing column I instead would
  count unproven and zero-unit sales and disagree with every existing rollup.
- **All three revenue figures use that one rule.** `total_revenue` reads it through
  `Daily Team Summary`; `week_revenue` and `today_revenue` apply it directly with a
  date filter. There is one definition of revenue in this build, not three.

Source layout this relies on:

| Tab | Header row | Data rows | Columns used |
|---|---|---|---|
| `Team Links` | 4 | **6–47** | A team ID, E venture name |
| `Daily Dump` | 1 | 2+ | A team, B date, D type, N money in |
| `Daily Team Summary` | 1 | 2–43 | A team, B revenue (proof), D units sold |
| `Sync Status` | 1 | 2–43 | B last sync |

`Weekly — by Team` and `Daily Dump` column H are no longer read. See
[Why `week_revenue` does not come from `Weekly — by Team`](#why-week_revenue-does-not-come-from-weekly--by-team).

---

## What changed from v1

Three things happen in the live master, in this order. Total time: about ten minutes.

### 1. Delete `TV_Helper` entirely

Right-click the tab ▸ Delete. It computed streaks and closed-week rank maths. Nothing
in v2 reads either. If you named it `Streaks_Helper`, that is the same tab.

Nothing else references it once step 2 is done, so delete it **after** step 2 to
avoid `#REF!` noise in between.

### 2. `TV_Feed` — replace the header row and all five formulas

Clear `A1:F43` and paste the new block from [Tab 1](#tab-1--tv_feed-published-as-csv).
Do not patch it column by column; the columns moved.

| Column | v1 | v2 |
|---|---|---|
| A | `team_id` | `team_id` — unchanged |
| B | `venture_name` | `venture_name` — unchanged |
| C | `total_revenue` | `total_revenue` — unchanged |
| D | `total_units` | **`week_revenue`** — new |
| E | `streak_days` | **`today_revenue`** — new |
| F | — | **`total_units`** — moved here from D |

Two new figures, one deletion (`streak_days`), one column that moved. The wall's
weekly slide is sorted on `week_revenue` and its 6pm celebration is ranked on
`today_revenue`, so neither is optional.

### 3. `TV_Cohort` — drop twelve keys, add two

Keep `as_of` exactly as it is. Delete the other twelve rows. Add two.

| Key | v1 | v2 |
|---|---|---|
| `as_of` | ✔ | **keep, unchanged** |
| `current_open_week` | — | **add** |
| `flea_datetime_iso` | — | **add** |
| `challenge_mode` | — | **add** — `Yes` or `No`, see below |
| `biggest_sale_today_team` / `_amount` | ✔ | delete |
| `most_units_today_team` / `_count` | ✔ | delete |
| `biggest_revenue_day_team` / `_amount` / `_date` | ✔ | delete |
| `closed_week_number` | ✔ | delete |
| `closed_week_revenue_team` / `_amount` | ✔ | delete |
| `closed_week_climb_team` / `_ranks` | ✔ | delete |
| `closed_week_improved_team` / `_delta` | ✔ | delete |

The twelve deleted keys fed the fifteen trigger types, which no longer exist. The
wall's only interrupt is now the 6pm celebration, and that is computed client-side
from `today_revenue`.

### What does *not* change

- **The published URLs.** Editing a tab's contents does not change its `gid`. Leave
  both publishes alone; `config.ts` stays as it is. Only *unpublishing* and
  republishing would issue new URLs.
- **`Team Links`.** No logo column was ever added and none is needed — logos live in
  `config.ts`.
- **Row count.** `TV_Feed` still publishes **42** rows, `SLE-C401`–`SLE-C442`. The
  client filters the two spares out; the sanity gate still counts 42.
- **The timezone precondition**, which is still unconfirmed. See
  [Publishing](#publishing).

---

## Tab 1 — `TV_Feed` (published as CSV)

Row 1, verbatim — the client parses these by name, so spelling matters and order
does not:

```
team_id    venture_name    total_revenue    week_revenue    today_revenue    total_units    prev_week_rank
```

**`prev_week_rank` is optional and not yet built.** Every other column is required
and a missing one throws the whole fetch away; this one the client reads only if
present, so the board's biggest-mover panel runs today on a fallback and switches
to showing real climbs the moment the column appears. Nothing needs redeploying.

See "The `prev_week_rank` column" below before writing it — it has two rules, and
getting either wrong produces a number that looks right and is not.

Row 2 only. Each formula spills down 42 rows, so there is nothing to fill down.

```
A2  =ARRAYFORMULA(IF('Team Links'!A6:A47="","",'Team Links'!A6:A47))

B2  =ARRAYFORMULA(IF(A2:A43="","",IFERROR(TRIM('Team Links'!E6:E47),"")))

C2  =ARRAYFORMULA(IF(A2:A43="","",IFERROR(VLOOKUP(A2:A43,'Daily Team Summary'!$A$2:$D$43,2,FALSE),0)))

D2  =BYROW(A2:A43,LAMBDA(t,IF(t="","",SUMIFS('Daily Dump'!$N:$N,'Daily Dump'!$A:$A,t,'Daily Dump'!$D:$D,"Sale",'Daily Dump'!$B:$B,">="&(TODAY()-MOD(TODAY()-DATE(2026,8,31),7)),'Daily Dump'!$B:$B,"<="&TODAY()))))

E2  =BYROW(A2:A43,LAMBDA(t,IF(t="","",SUMIFS('Daily Dump'!$N:$N,'Daily Dump'!$A:$A,t,'Daily Dump'!$D:$D,"Sale",'Daily Dump'!$B:$B,TODAY()))))

F2  =ARRAYFORMULA(IF(A2:A43="","",IFERROR(VLOOKUP(A2:A43,'Daily Team Summary'!$A$2:$D$43,4,FALSE),0)))
```

**`BYROW` for D and E, `ARRAYFORMULA` for the rest.** `SUMIFS` does not spill inside
an `ARRAYFORMULA` — it collapses to one value for the whole column, which looks like
a working formula and puts the same number on all 42 rows. `BYROW` evaluates it once
per team, which is what is wanted. Checklist item 4 catches it if this goes wrong.

**Looked up by team ID, not read positionally.** `Daily Team Summary` is generated
in `Team Links` order, so row alignment currently holds — but if it ever slips, a
positional read would attribute one team's revenue to another and the wall would
show it confidently for a week. A `VLOOKUP` cannot do that.

### The `prev_week_rank` column

Each team's rank **at the close of the last completed week**. It feeds one thing:
the "biggest climber this week" panel on `/podium`, which shows a team's previous
rank, its current rank, and the places between them.

Two rules, and both change the answer:

**1. Rank cumulative revenue, not the week's.** The wall ranks teams by
*cumulative* logged revenue. If `prev_week_rank` ranked last week's *weekly*
figure instead, the panel would subtract a position in one ranking from a position
in a different one and print the difference as a climb. It would be a number, it
would change every week, and it would mean nothing. This is finding #4 in
`docs/DESIGN.md`, rediscovered.

So: cumulative logged revenue **as it stood when the week closed**, ordered by the
wall's own comparator — revenue desc, then units desc, then `team_id` asc.

**2. Rank only teams that had banked something, and leave the rest blank.**

A team on ₹0 is separated from every other team on ₹0 by the tie-break alone. If
those teams are given ranks, a team logging its first ₹500 sale appears to climb
fifteen places, wins the panel, and holds it for a week — over ventures that
actually moved. It is noise wearing a climb's clothes.

So the ranking is taken **among teams with cumulative revenue above zero**, and a
team that had banked nothing at last week's close gets an **empty cell**, not a
rank and not a `0`. The client treats blank and `0` alike and reads either as "no
previous standing", which it renders as no climb rather than a large one. The
matching half of the rule lives in `biggestMover` in `lib/climber.ts`, with a test
pinning it.

Teams that had revenue then and have since been overtaken keep a rank and simply
show no climb, which is correct — they did not go up.

### The week window

`TODAY() - MOD(TODAY() - DATE(2026,8,31), 7)` is the Monday that opened the current
challenge week. The programme starts on a Monday, so this lands on a Monday for the
rest of it. On 11 Sep 2026 it resolves to **7 Sep**, and `week_revenue` is that
team's Monday-to-today total.

The upper bound is `TODAY()`, not `week_start + 6`. A sale mis-dated into the future
would otherwise inflate the current week and put a team on the weekly podium for
days.

> **The 31 August 2026 anchor is written in exactly three places:** `TV_Feed!D2`
> here, `current_open_week` on `TV_Cohort`, and `PROGRAMME_START_ISO` in `config.ts`.
> If the programme start ever moves, change all three. Checklist item 6 is the
> cross-check that the two sheet copies still agree.
>
> **It must be a Monday.** Programme weeks run Monday→Sunday, and an anchor on any
> other weekday is wrong in the one way nothing reports: the formula still returns a
> plausible small integer, it just rolls to the next week on the wrong day.
> 31 August 2026 is a Monday; 1 September, which this was briefly set to, is a
> Tuesday — and the two agreed on 11 September, which is exactly how a date like
> this survives a spot-check and is wrong the following Monday.
>
> **The two sheet copies matter more than the constant.** `TV_Feed!D2` decides the
> day `week_revenue` drops to zero for all 39 teams, and `current_open_week` is what
> tells the wall that drop was a reset rather than 39 overtakes. Anchor them to
> different weekdays and the wall answers one quiet Monday with a queue of overtake
> celebrations for teams that did nothing.

### Why `week_revenue` does not come from `Weekly — by Team`

The pivot brief specifies `Weekly — by Team` filtered to the open week. This uses
`Daily Dump` instead, for three reasons:

1. **One revenue definition.** All three revenue columns then apply the same
   `column N, Type = "Sale"` rule. A weekly figure sourced elsewhere can disagree
   with the daily and total figures beside it on the same row, and on a wall nobody
   would notice for weeks.
2. **The open week may not have a row.** `Weekly — by Team` is written by the
   consolidator and I cannot verify without sheet access whether it carries the
   *current, incomplete* week or only closed ones. If it only carries closed weeks,
   the brief's formula returns 0 for every team, all week, and slide 2 is blank.
3. **That tab is week-major and hardcodes 42 into its row arithmetic.** Reading it by
   `SUMIFS` on team + week is safe, but it is a second thing that has to stay true.

Checklist item 6 has you compare the two for one team once. If they disagree, that
tells you which of the two is tracking the open week — and I would rather you find
that out from a cross-check than from a blank wall.

---

## Tab 2 — `TV_Cohort` (published as CSV)

Two columns. `A1` = `key`, `B1` = `value`. Then three rows — column A is typed text,
column B is the value.

An empty value is fine and means "not known right now". A **missing key** throws in
the client and discards the tick, so all three rows must exist.

| A (type verbatim) | B |
|---|---|
| `as_of` | `=TEXT(MAX('Sync Status'!$B$2:$B$43),"dd mmm HH:mm")` |
| `current_open_week` | `=MAX(1,INT((TODAY()-DATE(2026,8,31))/7)+1)` |
| `flea_datetime_iso` | `2026-10-25T10:00:00+05:30` — **typed, not a formula** |
| `challenge_mode` | `Yes` or `No` — **typed by hand, the one switch on the wall** |

**Column A is matched exactly; column B is not.** Header names are trimmed and
lowercased before parsing, but the *keys* in column A are only trimmed — so
`Challenge_Mode` in A is a different key from `challenge_mode` and the client
will never find it. Type the key lowercase. The value in B is read case-
insensitively: `Yes`, `yes`, `Y` and a ticked checkbox all read the same.

### `challenge_mode` — which contest `/daily` shows

`Yes` → the board is the **10-Day Challenge**: it ranks and prints
`challenge_revenue`, the band reads `10-Day Challenge`, the `Day 7 of 10` chip
appears, and the legend adds `Revenue since 4 Sept`.

`No` → the board is the **Daily Leaderboard**: it ranks and prints a *finished
day*, 10:00 yesterday to 10:00 today, the band reads `Daily Leaderboard` with
that window's two dates beside it, and the day chip leaves. Nothing else on the
wall changes; `/podium` is all-time revenue either way and never looks at this
cell.

**Leave the two `challenge_*_iso` dates in place when you switch to `No`.** They
are the window, not the switch, and you will want them back. The wall simply
stops measuring against them.

**Anything that is not a yes is a no** — blank, missing, `Nope`, a typo. That
asymmetry is the safety margin and it only runs one way. Guessing wrong towards
daily puts a true, ranked, finished day on the board under a heading that says
so, and it corrects itself the moment you fix the cell. Guessing wrong towards
challenge puts **₹0 on thirty-nine cards** under the name of a contest that is
not running — which renders perfectly, reports nothing, and would run for weeks.

Deliberately **not** in `COHORT_KEYS`, so adding the row is not urgent and
editing it mid-poll cannot discard a tick: a missing key there throws the whole
fetch away. Until the row exists the wall is in daily mode.

### The daily board needs nothing from you, and that is worth knowing about

**There is no `yesterday_revenue` column and the wall does not want one today.**
A finished day cannot be read out of `BYOB_MASTER` as it stands — `today_revenue`
is live from midnight and reads ₹0 for most teams until the afternoon, `Daily
Team Summary` is cumulative in spite of its name, `Weekly — by Team` is weekly.
So the wall makes the window itself: the laptop driving the TV photographs every
team's `total_revenue` at the first poll at or after 10:00 IST, keeps the newest
two photographs, and prints the difference. Exactly the trick the
`challenge_baseline` column already uses, done on the client.

Two consequences for whoever looks after the wall, because neither is visible on
screen:

- **A laptop that has never run the wall shows ₹0 on every card** until its
  second 10:00 — up to twenty-four hours. So does one whose browser data has
  been cleared. The board looks completely healthy throughout. If you set up a
  new laptop, open `/daily` on it the day before you need it.
- **A laptop that is asleep or off at 10:00 takes its photograph late**, and the
  window silently becomes 25 or 48 hours long. The figures stay true — they are
  the difference between two real photographs — and the **two dates in the
  masthead** are the only thing that says the window widened. `17 Sep → 18 Sep`
  is a day; `16 Sep → 18 Sep` is not.

**The wall asks the sheet for this once a day.** `/daily` only goes to the
network when its 10:00 window has not been photographed yet, so it makes one
request a day rather than 1,440. `/podium` still polls every sixty seconds,
because it is a live all-time board — so the workbook is still being read
regularly; it is the *daily* board that has stopped asking.

If a fetch fails at 10:00 — the laptop is offline, the sheet is slow — nothing
is lost. The window stays unphotographed, so the wall simply asks again a minute
later, and keeps asking until it succeeds.

**If you would rather the sheet owned this**, it is one formula and it retires
all of the above — no photographs, no localStorage, no blank first day:

```
=BYROW(A2:A43,LAMBDA(t,IF(t="","",SUMIFS('Daily Dump'!$N:$N,'Daily Dump'!$A:$A,t,'Daily Dump'!$D:$D,"Sale",'Daily Dump'!$B:$B,TODAY()-1))))
```

published as a `yesterday_revenue` column. Say so and the wall will read it the
way it reads `challenge_revenue` — optional, so adding the column cannot break
anything and the wall picks it up on its next poll. Note that it would be a
**midnight-to-midnight** day rather than 10-to-10, and that it inherits
`today_revenue`'s own dependency on `Daily Dump` column B: see checklist item 5.

**`as_of` reads `Sync Status`, not `NOW()`.** `NOW()` would restamp on every
recalculation and the wall would look freshly updated even while the data underneath
was days stale — which is the exact failure this stamp exists to expose.

**`current_open_week` is not clamped at 8.** The eight challenge weeks end on 13 Sep
but the programme runs to 30 Sep, and a clamp would freeze anything reading it on
week 8's numbers for the last fortnight. On 11 Sep 2026 it reads **2**.

**Nothing on the wall ranks `week_revenue` any more**, as of 18 Sep 2026 —
`/daily` is the daily board and `/podium` is all-time. Keep both the column and
this key: `/live`'s middle tab still ranks the week, and `current_open_week` is
still what tells the wall a week rolled over. Neither is dead, but neither
decides a figure on a TV.

**`flea_datetime_iso` needs the cell formatted as plain text first** — Format ▸ Number
▸ Plain text — before you type it. Otherwise Sheets parses it as a date and publishes
something the client cannot read. After typing, the cell should still read
`2026-10-25T10:00:00+05:30` character for character, left-aligned.

Keep the `+05:30` offset. It is what makes the countdown correct on a laptop set to
any timezone: the client subtracts two absolute instants and never asks what timezone
it is in.

**The 10:00 opening time is still assumed, not confirmed.** This is now the one place
it is written down, which is the point of moving it here — correcting it is one cell,
not a commit and a redeploy.

---

## Publishing

**File ▸ Share ▸ Publish to web**, and publish **`TV_Feed` and `TV_Cohort` only**,
each as **Comma-separated values (.csv)**. Leave "Automatically republish when
changes are made" on. Do not publish the entire document.

If you published these in v1, **they are already published and the URLs are
unchanged** — skip this section apart from the timezone check.

Paste both URLs into `config.ts` as the **defaults** of `FEED_CSV_URL` and
`COHORT_CSV_URL`. They are public and carry no secret — the data is going onto
public TVs — which is why they stay in committed config rather than living only in
an env var a fresh deploy would be missing.

Each can still be overridden per-environment by `NEXT_PUBLIC_FEED_CSV_URL` /
`NEXT_PUBLIC_COHORT_CSV_URL`; see the README. That override exists for local
fixtures, so nobody has to edit the lines above and risk committing the edit.

Google caches a published CSV for about five minutes. The wall polls every 60
seconds, so it sees a change within roughly six minutes of the consolidator writing.

Also confirm, once: **File ▸ Settings ▸ Time zone is `(GMT+05:30) India Standard
Time`.** That setting is separate from `appsscript.json`, and `TODAY()` follows the
spreadsheet. If it is wrong, `today_revenue` is a day out near midnight, and every
figure on the wall is made from a `TODAY()` somewhere — so it is worth thirty
seconds to check.

**The client asks `Intl` for Asia/Kolkata explicitly and never the machine's own
setting**, which is what lets the two agree. The laptop driving the TV can come
back from a trip still set to another zone and the daily board's 10:00 boundary
does not move. Nothing protects you from the *spreadsheet's* timezone being
wrong, which is why this line is here.

---

## Verification checklist

Work through this before pointing the wall at the URLs. Each line is a number you can
read off two places and compare.

1. `TV_Feed` has exactly **42** data rows, `A2` = `SLE-C401`, `A43` = `SLE-C442`.
2. Pick any team. Its `total_revenue` equals that team's `Revenue (proof) ₹` on
   `Daily Team Summary` — the same figure the admin dashboard leads on.
3. `week_revenue` ≤ `total_revenue` for **every** team, and `today_revenue` ≤
   `week_revenue` for every team. Any row that breaks this has its date filter wrong.
4. `week_revenue` is **not** identical down all 42 rows. If it is, `BYROW` collapsed
   and every team is showing the cohort total.
5. Pick a team you know sold today: `today_revenue` > 0. If every team reads 0 on a
   day with sales, `Daily Dump` column B is carrying a time component and `=TODAY()`
   no longer matches it.
6. `TV_Cohort!current_open_week` reads **2** on 11 Sep 2026 and increments each
   Monday. For one team, compare `TV_Feed` `week_revenue` against
   `=SUMIFS('Weekly — by Team'!$C:$C,'Weekly — by Team'!$A:$A,"SLE-C4xx",'Weekly — by Team'!$B:$B,4)`
   in a scratch cell. They should match, or the weekly tab should read 0 — anything
   else means one of them is on the wrong week boundary. Delete the scratch cell after.
7. `TV_Cohort` has exactly **three** keys in column A, spelled as listed, and
   `TV_Helper` no longer exists in the tab bar.
8. `flea_datetime_iso` is left-aligned and reads `2026-10-25T10:00:00+05:30`. If it
   is right-aligned or shows `06/09/2026`, the cell was not plain text.
9. Open both published URLs in a private window. Each returns CSV, not an HTML
   sign-in page. A revoked publish answers with HTTP 200 and a login page, so the only
   reliable check is looking at what comes back.
10. `as_of` shows a time close to the last consolidator run, and does **not** advance
    when you merely reopen the sheet.

---

## Rebuilds, and why the wall does not flinch at them

**The master is never readable in a torn state.** The consolidator builds its output
in memory and writes it under `LockService`, so nothing reading the spreadsheet ever
sees a half-updated `Daily Dump`. Formulas on these two tabs inherit that: they
recalculate against a consistent sheet, and the numbers they publish are consistent
with each other.

The narrow window that does exist is outside Apps Script. A full rebuild does
`clearContent` and then `setValues`, roughly 200ms apart, and **Google's CSV export
can re-read the sheet inside that gap**. The export that comes back is short, or
carries `#REF!` where a formula's source has momentarily gone.

That is the one input that can put nonsense on the wall with no error anywhere:
teams vanish, the remaining ranks close up around the hole, and the boot kick treats
every one of those shifts as news.

**The client rejects it on row count alone.** A fetch yielding fewer than **40** rows
with a non-empty `team_id` and a numeric `total_revenue` is discarded whole — nothing
parsed, nothing stored, nothing animated, last-good data left on screen and a line in
the console. Forty because `SLE-C441` and `SLE-C442` are spares; a short export cannot
*add* rows, so the check is a floor and never a ceiling.

Built, in `passesRowGate` and `parseTeams` (`lib/feed.ts`). There is no cohort-total
floor and no stored threshold — one number, one decision, nothing that needs tuning.

Nothing is required of the sheet for this. It is here because this document is where
the cause lives.
