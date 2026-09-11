<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# BYOB Campus TV Wall

Two pages displayed on TVs across Mesa campus during BYOB Cohort 2026, driven from a
laptop over HDMI. The wall rotates between its own two slides every thirty seconds; if it
also sits inside a wider campus slideshow, that outer rotation is someone else's.

**This is a display system, not a dashboard.** Nobody interacts with it. It runs
unattended for weeks. The bar: on a wall nobody is actively watching, a bug that renders
convincingly can run for weeks.

The design is in `docs/DESIGN.md`. Read it before any slice of work.

## Commands

```bash
npm run dev          # local dev
npm run typecheck    # tsc --noEmit
npm run test         # vitest run
npm run build        # next build
```

## Non-negotiable

- **No backend.** No API routes, no serverless functions, no database, no auth. Two
  public published-CSV URLs, fetched from the browser. If a change needs a server, stop.
- **This project never writes to `BYOB_MASTER`.** It reads two published CSVs over plain
  HTTP with no credentials. There is no token, no service account, no Apps Script here.
- **Never hardcode a hex.** `app/forge-tokens.css` is the only file that may contain
  one. It is imported **last and unlayered** from `globals.css`, and both halves of that
  matter — move it above `mesa-tv.css` and the wall silently reverts to a white page with
  purple parts on it.

  This replaced the identical rule naming `.claude/skills/mesa-design/colors_and_type.css`,
  which is Mesa's parent green brand. Forge C1 is its purple re-skin
  (`mesa_forge_design_system/design_system.md`), so the palette changed and the
  discipline did not: one file owns colour, everything else reads a token.
  `colors_and_type.css` is still imported for type, spacing, radii and shadows.

- **Two surfaces, and a component must not name a colour.** Read `--surface`,
  `--ink`, `--ink-muted`, `--accent`, `--hairline` and let the surface decide what
  they mean.

  This is not tidiness. Every light accent that carries on Deep Aubergine dies on
  Lavender Mist and the deep purples do the exact reverse — gold goes 8.59:1 → 1.61:1,
  royal purple 1.39:1 → 10.01:1. A shared accent palette is invisible on half the
  rotation. Worse, a token that is a *surface* in one place and *ink* in another cannot
  survive the flip at all: `--deep-teal` is "deepest brand surface", and three things
  used it as ink. On the dark slide they painted text in the page colour and measured
  **1.00:1**. Fixed in §5 of `forge-tokens.css`; do not reintroduce the pattern.
  `VentureLogo`'s six mark tints were the same bug in a component, fixed the same
  way in §2a.

  **Both slides are `.surface-dark` today**, and this rule used to add that
  `/weekly` is `.surface-light` and that the rotation carries the Forge deck's own
  dark/light rhythm. That half was a brand argument rather than a correctness one
  and it was overruled deliberately: on Lavender Mist every one of thirty-nine
  venture marks needed a white ground to have an edge, and the venture names
  measured 4.61:1 against the page. On Deep Aubergine the marks *are* the light
  and the names measure 12.01:1. What it costs is the flip — two dark slides
  thirty seconds apart do not announce the rotation the way a dark-to-light cut
  did, and the layouts have to carry that now.

  **The machinery above stays, and stays exercised.** `.surface-light` is fully
  defined, every token still resolves on it, and nothing in either page tree
  names a colour — which is what keeps this one line to change back, and what
  makes the paragraph above still binding rather than historical.
- **No borrowed artwork.** `LOGOS` in `config.ts` is empty, so every mark on the
  wall is `VentureLogo`'s two-letter monogram on a tinted disc. It listed all 39
  for a while and every one of those files was the *previous* cohort's logo,
  renamed — `VBC101` wearing Dosa Crisps' mark. A monogram says "this venture has
  not drawn a mark yet"; borrowed artwork says something false about who a team
  is. Adding a real logo is one commit: the file in `public/logos/` and the id in
  that list, together.
- **Nothing moves at rest, on either slide.** Not one of the thirty-nine cards,
  not the list of seven, not the three podium marks, not a masthead or a
  numeral. No sweeps and no dance; those went with the metals. The only motion
  either page can produce is an *arrival* — the crown landing when a slide
  mounts, and an overtake — and both are things that happened.

  `/podium`'s top three idled for a while: a bob, a glance on a `rotateY`, a
  tilt, on three timelines so they could never fall into lockstep. It was
  removed, asked for back, and **removed again after the crown arrived**, for a
  reason that is mechanical rather than aesthetic and that binds anything
  proposing to idle a mark again:

  > The glance is a `rotateY` of up to 34° under the 900px `perspective` on
  > `.tv-pod-mark-band`, and a perspective transform displaces an **off-centre
  > child differently from the element's own centre**. The crown sits well off
  > centre, on the disc's upper-left rim. So every glance swung it out of
  > contact with the head it was sitting on and back again, seventeen seconds
  > apart, on a wall nobody is watching closely enough to catch it. A crown
  > cannot be welded to a rotation whose centre it does not share.

  The bob alone would have survived; the glance could not. Bring the idle back
  and the crown has to come off, or be re-solved — those are the only two
  options, and the first one costs more than the idle is worth.

  **The crown is motion and it is not an exception**, which is worth being exact
  about because the next ornament will claim it is. `components/Crown.tsx` drops
  onto rank 1 and *stops* — one run, on mount, `animation: … both` with no
  iteration count. What this rule bans is motion **at rest**, and a thing that
  is over 1.4 seconds after the slide arrives is not at rest, it is an entrance.

  **And then one ornament did loop, so this rule is narrower than it reads.**
  The line above used to end by saying the board is completely still thirty
  seconds later, and that a twinkle, a sheen or a pulse does not get in on the
  crown's precedent and has to make its own argument. The crown's two glints
  are that argument, and they did not win it on the merits — they were asked
  for directly, after being built the other way first. They sit on two of the
  crown's tips, a third of a second apart, and the pair repeats **every six
  seconds** for as long as `/podium` is up. The rule is now: *nothing moves at
  rest except the crown's glint*, and the exception is one object, one slide,
  two shapes, one period.

  What it costs is stated rather than argued away. **The board is no longer
  still thirty seconds later**, which was the property that mattered and the
  one `render.test.tsx` pinned; that test now checks the narrower claim that
  the marks, numerals and rows are still, and says so. Every ornament after
  this one will cite the glint rather than the crown, because a looping
  precedent is a far cheaper thing to argue from than a one-shot one — so the
  budget is the count, and the count is two. A spark on every stone, or one on
  a `/weekly` card, is not an extension of this decision.

  The period is the part to defend. 720ms of spark inside a six-second cycle is
  an object catching the light; the same spark on a one-second cycle is a
  blinking fault light on a wall nobody is watching. **Lengthen it before
  shortening it.**
- **Gold is back, as exactly one object.** `--forge-metal-gold` sat unread from
  the deletion of the plinths until the crown, kept on §5's stated condition
  that if it returned it would "arrive as one decision in one place". The crown
  is that decision: one glyph, one rank, one slide, no plinth and no sweep. The
  budget is spent — a second gold thing is a new argument, not an extension of
  this one. Components read `--crown-ink`, never the metal token, because gold
  measures 8.59:1 on Deep Aubergine and **1.61:1 on Lavender Mist**, so the
  light surface answers with Royal Purple instead.
- **No filler content.** Empty is a valid state. The wall being quiet is what makes it
  loud when something happens. No spinners, ever — first paint reads cached CSV.
- **There is no footer and no `as_of` stamp**, on either slide. Both were removed
  by decision. The cost is recorded rather than argued: this wall shows no error
  state, so a failed fetch keeps the last good data and renders perfectly healthy
  stale numbers for days — and the stamp was the only thing that made that
  visible. `docs/DESIGN.md` §2 added it for that reason and called it a
  deliberate exception. **A board frozen on Tuesday now looks exactly like a
  working one.** If it returns, it goes in the right of the masthead;
  `components/AsOf.tsx` is in git.
- **No trigger types beyond the 15 in the design.** The list was deliberately narrowed.
- **The rotation between the two slides is ours, and it is the only rotation logic
  here.** `components/Rotator.tsx`, thirty seconds a slide, by soft navigation. That
  reverses the original "external system" rule, which assumed the campus slideshow drove
  both URLs. It must never become a page reload: the TV runs fullscreen with nobody at
  the laptop, and a reload drops out of fullscreen for good. Nothing else about the
  rotation — ordering with the other Mesa slides, what else is in the loop — belongs
  here.

## Domain

- 42 workbooks, `SLE-C401`–`SLE-C442`. Team IDs come from `Team Links` col A, rows 6–47.
- **Logged (proof-backed) revenue is the only figure used.** `Daily Team Summary` col B,
  which is `SUMIFS('Daily Dump'!$N:$N, 'Daily Dump'!$D:$D, "Sale")`. Column N is already
  proof-gated upstream (proof = `Yes` AND units ≥ 1). Summing `Amount` (col I) instead
  would count unproven and zero-unit sales and silently disagree with every existing
  rollup. Verified revenue is not used anywhere in this project.
- Ranking: **logged revenue desc → units desc → team ID asc**, matching the admin
  dashboard's `compareTieBreak`. Rank is computed client-side, so the sort is the single
  authority on order.
- **Programme weeks are anchored 31 August 2026, and it must stay a Monday.** The
  31st is a Monday; 1 September, which this was briefly set to, is a Tuesday. An
  anchor on the wrong weekday reports nothing — the formula still returns a
  plausible small integer, it just rolls a week on the wrong day, and the two
  anchors agreed on 11 September. Written in three places that must move together:
  `TV_Feed!D2` (which decides the day `week_revenue` zeroes), `current_open_week`
  on `TV_Cohort` (which tells the wall that zeroing was a reset, not 39 overtakes),
  and `PROGRAMME_START_ISO` in `config.ts`.
- Mesa Flea: **25 October 2026**, 10:00 IST assumed — moved from 31 October, and it
  lives in `TV_Cohort` rather than in code, so the wall picked the change up on its
  next poll. The Cohort 2026 dates this line used to carry (20 July anchor, 13
  September Flea, 30 September capital repayment) belong to the previous arc; the
  repayment date has no Forge C1 equivalent recorded here and is not read by any
  code.
- A team with an empty `venture_name` **does** fire a trigger, like any other. This line
  previously claimed the opposite; `lib/overtake.ts` never enforced it, and the behaviour
  it describes is not the one we want — an unnamed team that overtakes has still overtaken.
  The card carries its Team ID rather than a blank, so the wall celebrates `SLE-C407` by
  name-or-ID rather than not at all. Decided in
  `docs/superpowers/specs/2026-08-12-weekly-card-grid.md` §3; the doc was corrected to
  match the code, not the other way round.
- **`/weekly` shows one of two contests, and `TV_Cohort`'s `challenge_mode` cell
  picks which.** `Yes` ranks and prints `challenge_revenue` under a `10-Day
  Challenge` heading with the day chip and the `Revenue since` caption; anything
  else ranks and prints `week_revenue` as `Weekly Leaderboard` with both of those
  gone. One cell, not two booleans — two have four states and only two mean
  anything. Not derived from the `challenge_*_iso` dates either: those say *when*
  and stay put through a switch-off, this says *whether*. Every unreadable value
  falls to week, because `week_revenue` is required and always real while
  `challenge_revenue` between challenges is whatever the consolidator last left
  there — guessing wrong towards challenge is ₹0 on 39 cards, rendered perfectly.
  `lib/board.ts` owns all of it, including folding the mode into the reset period
  so flipping the cell does not read as 39 overtakes.
- Currency: `Intl.NumberFormat('en-IN')` — `₹1,04,500`, not `₹104,500`.

## Traps that report nothing

All of these render convincingly and pass typecheck, lint and tests. Verify by reading
`getComputedStyle` / `getBoundingClientRect` back from a real browser at **1920×1080**,
not by reading source.

- **Tailwind v4 utilities lose to unlayered CSS.** The design system's `.overline`,
  `.small`, `.caption` and `h1`–`h4` each set a colour, so unlayered they beat every
  `text-*` utility. `globals.css` imports the system with `layer(components)` for this
  reason. Class rules in `mesa-tv.css` go inside its `@layer components` block.
- **`.overline` is also a real Tailwind utility** (`text-decoration-line: overline`), and
  utilities beat the components layer. `globals.css` carries an unlayered override.
  Before using any design-system class name, check it against `overline`, `underline`,
  `truncate`, `container`, `block`, `inline`, `table`, `grid`, `flex`, `hidden`,
  `visible`, `fixed`, `static`, `sticky`, `capitalize`, `uppercase`, `lowercase`,
  `italic`, `antialiased`.
- **A non-existent Tailwind step emits no rule and no warning.** `opacity-16` does
  nothing. Use a real step or an explicit arbitrary value, then confirm the computed one.
- **Motion `layout` transforms are ignored by `<tr>`.** Reordering rows must use grid
  rows with ARIA table roles. Measured in the dashboard: 30 animation frames with the
  transform present and the row at exactly one position throughout.
- **Google's published CSV carries a UTF-8 BOM and CRLF endings.** `﻿team_id` is not
  `team_id`. papaparse handles both; a hand-rolled parser does not.
- **`cache: 'no-store'` on both fetches.** Without it the browser HTTP cache serves one
  body for the life of a page that never manually reloads, and the wall freezes silently.
- **A revoked sheet returns an HTML login page with HTTP 200.** Status codes pass it;
  only the parsed-row gate catches it.

## Working style

Detective, not decorator: theory of the crime, then evidence, then fix. Surgical changes,
one at a time. Commit after every completed slice — git is the rollback path. The user is
non-technical but builds automations, and wants honest pushback over agreeableness.
