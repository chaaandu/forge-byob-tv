/**
 * Every hardcoded value in the project. Nothing else carries a magic number.
 *
 * Changed by commit, not by an admin UI — there is nobody at the wall to click.
 *
 * **Almost no dates live here.** The Mesa Flea instant, the open week and the
 * challenge window all arrive in `TV_Cohort`, so correcting any of them is one
 * sheet edit rather than a commit and a redeploy. The single exception is
 * `PROGRAMME_START_ISO`, and the reason is written at its declaration.
 */

import type { TeamId } from '@/lib/types'

// ── Data source ─────────────────────────────────────────────────────────────

/**
 * Published-to-web CSV URLs for `TV_Feed` and `TV_Cohort`.
 *
 * The published URLs are the **defaults**, written here in the clear. They carry
 * no secret — the sheet is published publicly and the data is already going onto
 * public TVs — and keeping them as the fallback means a fresh clone or a new
 * Vercel project just works, rather than deploying a wall that renders perfectly
 * and fetches nothing. That was the original reason for putting them in config,
 * and it still holds.
 *
 * What it did not survive is **local development**. Pointing the wall at
 * `scripts/dev-feed.mjs`'s fixtures used to mean editing the two literals below,
 * which puts a `/mock/…` path into a *tracked* file — one `git commit -a` away
 * from deploying a wall that fetches a URL that does not exist in production.
 * That edit was made and discarded once already (`b5af89b`, "Restore the
 * published CSV URLs"); a rule that has to be remembered every time is not a
 * rule, it is a trap with good intentions.
 *
 * So the override is an environment variable and the fixture path never touches
 * a tracked file:
 *
 * ```bash
 * # .env.local — gitignored by the `.env*` rule, and cannot be committed
 * NEXT_PUBLIC_FEED_CSV_URL=/mock/feed.csv
 * NEXT_PUBLIC_COHORT_CSV_URL=/mock/cohort.csv
 * ```
 *
 * `NEXT_PUBLIC_`, necessarily: both fetches happen in the browser, so the value
 * has to be inlined into the client bundle at build time. That also means these
 * are **build-time**, not runtime — changing one on Vercel needs a redeploy, and
 * changing one in `.env.local` needs `next dev` restarting. No secret is exposed
 * by the prefix; a published CSV URL is public by construction.
 *
 * The reads below are written out longhand on purpose. Next.js inlines
 * `process.env.NEXT_PUBLIC_*` by *textual* substitution of the member
 * expression, so a dynamic lookup — `process.env[name]` — silently yields
 * `undefined` in the browser and the wall would fall back forever without
 * saying so.
 */
function feedUrl(override: string | undefined, published: string): string {
  // Trimmed, and empty treated as absent: an unset `NEXT_PUBLIC_` var inlines as
  // `undefined` in some builds and `''` in others, and a var left declared but
  // blank on Vercel is the same intent as not setting it. All three must reach
  // the published default rather than `fetch('')`, which resolves against the
  // page's own URL and hands the parser an HTML document.
  const trimmed = override?.trim() ?? ''
  return trimmed === '' ? published : trimmed
}

export const FEED_CSV_URL: string = feedUrl(
  process.env.NEXT_PUBLIC_FEED_CSV_URL,
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vQIPEG2OyaUG4epSSXmvtiHClz9jUwDKuHIUy1de4gw6AevZMBM2oODC5W8DwqbRDQspTqqM34DalBd/pub?gid=1357679077&single=true&output=csv',
)
export const COHORT_CSV_URL: string = feedUrl(
  process.env.NEXT_PUBLIC_COHORT_CSV_URL,
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vQIPEG2OyaUG4epSSXmvtiHClz9jUwDKuHIUy1de4gw6AevZMBM2oODC5W8DwqbRDQspTqqM34DalBd/pub?gid=160306272&single=true&output=csv',
)

/**
 * The fewest usable rows a fetch may carry and still be trusted.
 *
 * **39 — the competing cohort, `VBC101`–`VBC139`.** `TV_Feed` publishes more
 * than that today, because `VBC140` and `VBC141` are test workbooks still
 * sitting in `Team Links`; the gate checks *short*, never exact, so it passes
 * either way and keeps passing the day those two are deleted. See
 * `passesRowGate` in lib/feed.ts.
 *
 * **This number is the single most dangerous constant in the project.** Set it
 * one above the real cohort and every poll is rejected, forever, silently: no
 * spinner, no error state, nothing on screen but the empty structure and one
 * line in a console nobody is reading. Whenever the cohort size changes, this
 * changes with it.
 */
export const MIN_TEAM_ROWS = 39

/** The consolidator writes every 10 minutes and Google caches the CSV ~5 min; polling faster only burns cycles. */
export const POLL_INTERVAL_MS = 60_000

/**
 * Workbooks that exist but do not compete.
 *
 * `TV_Feed` publishes whatever is in `Team Links`, and these two are the test
 * workbooks the cohort was built against — every row in `Daily Dump` today
 * belongs to `VBC141` and says "Test Tote". They are filtered out for display.
 *
 * They still count toward `MIN_TEAM_ROWS`, which asks whether a whole fetch
 * arrived rather than who is racing. Listing them here is also what makes the
 * wall correct *before* they are deleted from the sheet and *after*: a spare
 * that no longer exists simply never matches.
 */
export const SPARE_TEAM_IDS: readonly TeamId[] = ['VBC140', 'VBC141']

// ── Weekly board ────────────────────────────────────────────────────────────

/**
 * A day's revenue at or above this reads as a strong day and is emphasised.
 *
 * One threshold, one emphasis. It is a display decision, not a milestone — the
 * wall no longer fires anything on crossing it, so a team moving above and below
 * it through the day is free to.
 */
export const HOT_TODAY_MIN = 5_000

/**
 * How far down the weekly board a card is a solid Deep Forest object. Below it,
 * the card is the pale outlined kind.
 *
 * **A property of the slot, not of the team.** The rule this replaced was
 * `weekRevenue <= 0` — the card went quiet when a team had not traded. That was
 * right about *absence* and wrong about *weight*: in week 4 it made thirty solid
 * cards, three full rows of dark, and a board that is three-quarters loud is not
 * saying anything by being loud. Twenty is the top half of the frame — rows 1
 * and 2 at ten cards a row — so the split lands on a row boundary rather than
 * mid-row where it would read as an accident.
 *
 * **The figure does not follow this.** A pale card that earned still prints its
 * figure; only a genuinely zero week prints nothing. Quiet is about how much of
 * the board a card claims, and a team that made ₹6,440 has a number the wall is
 * not entitled to swallow.
 *
 * Equal to `WATCH_RANKS_WEEKLY` today, and not derived from it: one says how far
 * down an overtake is worth animating, the other how far down the board reads as
 * the contest. They would move for different reasons.
 */
export const SOLID_RANKS = 20

// ── Data quality ────────────────────────────────────────────────────────────

/**
 * The team-workbook template's placeholder venture name, lowercased.
 *
 * Treated as no name at all. Compared in lowercase because it is typed by hand
 * in 39 separate workbooks and the capitalisation drifts.
 */
export const UNNAMED_VENTURE = 'type your venture name'

// ── Mesa Flea calendar countdown ────────────────────────────────────────────

/**
 * When the calendar changes mode. The instant it counts to lives in `TV_Cohort`;
 * only the *shape* of the escalation is a build decision. The transitions
 * themselves are computed in one place: `computeCountdownState` in
 * lib/countdown.ts.
 */
export const DAYS_ONLY_FROM_MS = 15 * 24 * 60 * 60 * 1000
export const TIMER_UNDER_MS = 24 * 60 * 60 * 1000

/**
 * Where `/podium`'s masthead countdown changes what it counts.
 *
 * **A second set of thresholds on one brain, not a second brain.** The dial in
 * the shared header escalates at 15 days and 24 hours; the masthead escalates at
 * 7 days, 3 days and 24 hours, and shows whole weeks above the first of those —
 * a mode the dial has never had. Both read the same
 * `computeCountdownState`, which is where every comparison against the clock
 * still happens; only the banding differs, and it differs because the two are
 * different sizes on the frame. The dial is a 48px ring in a header and can
 * afford one figure; the masthead figure is the third-largest thing on the
 * slide and can afford to change shape.
 *
 * The final band deliberately reuses `TIMER_UNDER_MS` rather than declaring its
 * own 24 hours. The two boards must not disagree about when the last day starts.
 */
export const PODIUM_WEEKS_FROM_MS = 7 * 24 * 60 * 60 * 1000
export const PODIUM_CLOCK_UNDER_MS = 3 * 24 * 60 * 60 * 1000

/**
 * How long the Flea itself runs — 10:00 to 18:00 IST assumed, like the opening
 * time. While it runs the calendar says LIVE NOW; after it ends the calendar
 * leaves the wall entirely.
 */
export const FLEA_EVENT_DURATION_MS = 8 * 60 * 60 * 1000

/**
 * When the programme started — **1 September 2026, 00:00 IST** (Forge C1).
 *
 * The one date in this system that is not in the sheet, so moving it costs a
 * commit and a redeploy. That is a deliberate, eyes-open trade: it does not
 * move, and publishing it as a cohort key would change the sheet contract for
 * one arc.
 *
 * It is not decorative, though — it is one end of `/podium`'s progress ring,
 * with `flea_datetime_iso` as the other. Left at Cohort 2026's 20 July anchor
 * the ring read **52% complete** on 11 September against a true **17%**: a
 * three-fold error, correctly rendered, in a large element. `current_open_week`
 * in `TV_Cohort` is anchored to this same date and must move with it.
 */
export const PROGRAMME_START_ISO = '2026-09-01T00:00:00+05:30'
export const PROGRAMME_START_MS = Date.parse(PROGRAMME_START_ISO)

/** Once a second while the live timer shows seconds; once a minute before that. */
export const TICK_MS = 1_000
export const TICK_SLOW_MS = 60_000

// ── End of day ──────────────────────────────────────────────────────────────

/**
 * The sheet's timezone, hardcoded.
 *
 * Every "today" and "this week" figure on the wall was computed by a spreadsheet
 * running in Asia/Kolkata, so the wall's own day has to start and end there too.
 * Never the browser's locale — see `lib/schedule.ts`.
 */
export const IST_TIMEZONE = 'Asia/Kolkata'

/** The podium marks the end of the trading day from this hour, IST, until midnight. */
export const EOD_FROM_HOUR_IST = 18

// ── Overtakes ───────────────────────────────────────────────────────────────

/**
 * How far down each board a rank change is worth animating.
 *
 * The weekly board watches its whole first column; a change at rank 34 is real
 * but nobody is watching that far down, and animating it would spend the wall's
 * one interrupt on it.
 *
 * **The podium watches its whole top ten**, up from rank 1 alone. That was right
 * while the board animated nothing — the only change worth an interrupt was a
 * new leader. It now has two things to say: a venture crossing into the top
 * three, which gets the close-travel-open, and two list rows trading places,
 * which get a slide. Rank 11 is off the board, so ten is the whole of what it
 * can show.
 */
export const WATCH_RANKS_WEEKLY = 20
export const WATCH_RANKS_PODIUM = 10

/**
 * How many overtakes may be waiting at once. FIFO, oldest dropped.
 *
 * Four, not ten. Each kick runs about three seconds, so ten would mean half a
 * minute of continuous animation after one busy fetch — and by the end of it the
 * board underneath would be two fetches stale. Currency beats completeness.
 */
export const KICK_QUEUE_CAP = 4

/**
 * One kick, start to finish, in milliseconds.
 *
 * The seven beats inside `BootKick` are declarative delays that sum to this; the
 * playback hook only needs the total. Three seconds is the ceiling: the wall's
 * job is to be a leaderboard, and it should be one again quickly.
 */
export const KICK_MS = 3_000

// ── Logos ───────────────────────────────────────────────────────────────────

/**
 * Team IDs that have a logo committed at `public/logos/<TEAM_ID>.png`.
 *
 * ── ⚠️ THESE ARE PLACEHOLDERS. THEY ARE COHORT 2026's ARTWORK. ──
 *
 * All 39 files are the previous cohort's logos, renamed `SLE-C4NN.png` →
 * `VBC1NN.png` so the wall has something in every tile while Forge C1's layout
 * and design are being built. **`VBC101` is currently wearing Dosa Crisps'
 * mark.** Every one of these is a real venture's identity on a different
 * venture's card.
 *
 * That is fine for measuring a frame and wrong for a campus TV, and it is
 * exactly the class of error this project is built around: it renders
 * convincingly, passes every check, and would run for weeks. **Empty this list
 * before the wall goes on a screen**, or replace the files. A team not in the
 * list gets the coloured initial disc, which is a first-class treatment, so an
 * empty list is a perfectly good state — not a degraded one.
 *
 * ── The list, not the filesystem, is what the wall reads ──
 *
 * Presence is known ahead of the render, so no broken image is ever requested
 * and there is no error-handler flash. A file on disk that is missing from this
 * list is invisible; an id here with no file is a broken image on a TV. They
 * arrive together, in one commit.
 *
 * ── The spec for real artwork ──
 *
 * **512×512 PNG, RGBA, content inside the inscribed circle.**
 * `components/VentureLogo.tsx` clips every mark with `border-radius: 50%`, so a
 * square design that fills its frame loses its four corners — silently.
 * `scripts/prepare-logos.py` masks circular sources to exactly this and prints
 * a list to paste here; its `team_id` line needs the `VBC1NN` pattern.
 *
 * The list stays here rather than in a sheet column for two reasons that both
 * still hold: the consolidator rewrites `Team Links` C:I every 10 minutes, so a
 * filename there would be wiped; and the file itself arrives by commit anyway,
 * so listing it in the same commit is one action rather than two in two systems
 * that would drift.
 */
export const LOGOS: readonly TeamId[] = [
  'VBC101',
  'VBC102',
  'VBC103',
  'VBC104',
  'VBC105',
  'VBC106',
  'VBC107',
  'VBC108',
  'VBC109',
  'VBC110',
  'VBC111',
  'VBC112',
  'VBC113',
  'VBC114',
  'VBC115',
  'VBC116',
  'VBC117',
  'VBC118',
  'VBC119',
  'VBC120',
  'VBC121',
  'VBC122',
  'VBC123',
  'VBC124',
  'VBC125',
  'VBC126',
  'VBC127',
  'VBC128',
  'VBC129',
  'VBC130',
  'VBC131',
  'VBC132',
  'VBC133',
  'VBC134',
  'VBC135',
  'VBC136',
  'VBC137',
  'VBC138',
  'VBC139',
]
