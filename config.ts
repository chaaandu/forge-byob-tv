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
 * When the programme started — **31 August 2026, 00:00 IST** (Forge C1).
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
 *
 * ── Why the 31st and not the 1st ──
 *
 * **31 August 2026 is a Monday; 1 September is a Tuesday.** Programme weeks run
 * Monday→Sunday, so the anchor has to land on a Monday or every week boundary
 * this system computes is a day out — and a Tuesday anchor is wrong in the one
 * way nothing reports: `INT((TODAY()-anchor)/7)+1` still returns a plausible
 * small integer, it just rolls to the next week on the wrong day. It agreed with
 * the Monday anchor on 11 September, which is exactly how a date like this
 * survives a spot-check and is wrong the following Monday.
 */
export const PROGRAMME_START_ISO = '2026-08-31T00:00:00+05:30'
export const PROGRAMME_START_MS = Date.parse(PROGRAMME_START_ISO)

// ── Ganesh Chaturthi ────────────────────────────────────────────────────────

/**
 * The window the Ganesha ornament is on the wall — **14 to 17 September 2026,
 * IST**, and then it is gone without anyone touching the laptop.
 *
 * Ganesh Chaturthi 2026 falls on Monday 14 September; the full festival runs to
 * Anant Chaturdashi on Friday 25 September. This wall takes the first four days
 * by decision, not by accident — see `isFestival`. It was three, and on 15
 * September 2026 it was asked to run through Thursday night.
 *
 * **The whole festival and a Visarjan on the 25th were built and turned down
 * the same day** — the idol sinking into water and a sprout growing where it
 * went, replayed every three minutes. It is commit `37a421b`, reverted rather
 * than lost, if it is wanted another year.
 *
 * ── Why an end date at all ──
 *
 * Because nobody is at the laptop. Every other thing on this wall is driven by
 * a sheet someone edits or by a figure that moves on its own; a festival
 * ornament is the one element whose correct state is *absent*, and absence is
 * the state no polling loop will ever arrive at. Left ungated it would still be
 * there in October — during the Mesa Flea run-up — and it would look exactly as
 * deliberate then as it does on the 14th. That is the same failure mode as the
 * missing `as_of` stamp, so it gets the treatment the stamp did not.
 *
 * **The end is exclusive and it is the 18th, not the 17th.** `UNTIL` is the
 * instant the window shuts, so naming the last day here would take the ornament
 * down at midnight *entering* Thursday and give three days rather than four —
 * off-by-one in the direction that reports nothing, because a wall that stopped
 * a day early looks precisely like a wall that was configured that way.
 *
 * Both are absolute instants with an explicit `+05:30`, for the reason in
 * `docs/DESIGN.md` §"Timezone: the client needs none": the comparison is then
 * correct on any machine whose clock is right, including a laptop that came
 * back from a trip still set to another timezone.
 */
export const GANESH_FROM_ISO = '2026-09-14T00:00:00+05:30'
export const GANESH_UNTIL_ISO = '2026-09-18T00:00:00+05:30'
export const GANESH_FROM_MS = Date.parse(GANESH_FROM_ISO)
export const GANESH_UNTIL_MS = Date.parse(GANESH_UNTIL_ISO)

/** Where the animation is served from. A plain file in `public/`, fetched at
    runtime rather than imported — see `components/Ganesha.tsx` for why 877KB
    does not belong in the JS bundle of a page that must paint immediately. */
export const GANESH_LOTTIE_URL = '/lottie/ganesha.json'

/** Once a minute is plenty to notice a three-day window opening or shutting. */
export const GANESH_CHECK_MS = 60_000

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
 * ── IT IS EMPTY, AND THAT IS THE CORRECT STATE TODAY ──
 *
 * It used to list all 39. Every one of those files is the *previous* cohort's
 * artwork, renamed `SLE-C4NN.png` → `VBC1NN.png` so the wall had something in
 * every tile while Forge C1's layout was being built — so `VBC101` was wearing
 * Dosa Crisps' mark, `VBC102` was wearing ROOH's, and so on down the board.
 * Thirty-nine real ventures' identities, each on a different venture's card.
 *
 * The warning that stood here said "**empty this list before the wall goes on a
 * screen**". It went on a screen first. This is that.
 *
 * A team not in this list gets `VentureLogo`'s two-letter monogram, which is a
 * first-class treatment and not a degraded one — see that component. An empty
 * list is therefore a perfectly good wall, and the honest one: a monogram says
 * "this venture has not drawn a mark yet", where borrowed artwork says
 * something false about who a team is.
 *
 * The files are left in `public/logos/` rather than deleted. Nothing requests
 * them while this list is empty — presence is read from the list, never the
 * filesystem — and they are what `scripts/prepare-logos.py` was calibrated
 * against.
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
 *
 * **Adding one team is safe.** The monogram and the logo draw at the same
 * diameter in the same disc, so a board of thirty-eight monograms and one real
 * mark is a board with one venture further along, not a broken grid.
 */
export const LOGOS: readonly TeamId[] = []

// ── Student photographs ─────────────────────────────────────────────────────

/**
 * Students who have a photograph committed at
 * `public/people/<TEAM_ID>/<name-slug>.webp`.
 *
 * ── 105 of the 117 competing students, and the other twelve are a data gap ──
 *
 * Seven missed the shoot (`Headshot Slots` says "not coming"), four attended
 * with no slot number written down, and one — `VBC113`'s roster entry `Diya` —
 * is a first name the shoot has three of. Each of those shows a silhouette in
 * the team's livery with their initials, which is a first-class treatment
 * rather than a degraded one, for the reason the monogram is on the wall:
 * **a stock face standing in for a student is the `LOGOS` mistake with a
 * person's face in it.** Borrowed artwork says something false about who a
 * team is; a borrowed face says it about who a person is.
 *
 * ── The list, not the filesystem, is what `/live` reads ──
 *
 * Presence is known before the render, so no broken image is ever requested
 * and there is no error-handler flash. A file on disk missing from this list
 * is invisible; an entry here with no file is a broken image on somebody's
 * phone. They arrive together, in one commit.
 *
 * ── The spec ──
 *
 * **330x440 WebP with an alpha channel: a cutout, not a photograph.** The
 * background is removed and the crop is measured in face widths so every
 * student comes out the same size — see `scripts/fetch-headshots.py`, which
 * built this set from the cohort's own shoot, and `scripts/prepare-people.py`
 * for a folder of files named after their student. Each is about 16KB and a
 * team sheet loads three or four.
 *
 * Entries are `<TEAM_ID>/<slug>`, where the slug comes from `photoSlug` in
 * lib/live.ts: the student's name, lowercased, non-letters to hyphens —
 * `VBC101/tanishque-jain`. Deriving it from the name is what removes the need
 * for a mapping file that could drift from the photographs.
 *
 * **Consent is upstream of this list.** These are photographs of named people
 * on a page anybody with the link can open, which no other asset in this
 * project is. Removing one person is deleting one entry and one file.
 */
export const PEOPLE_PHOTOS: readonly string[] = [
  'VBC101/nirmalya-sah',
  'VBC101/sachidananda-dehury',
  'VBC101/tanishque-jain',
  'VBC102/arpita-mahata',
  'VBC102/diya-agarwal',
  'VBC102/simran-kalra',
  'VBC103/kavya-zala',
  'VBC103/pragati-singh',
  'VBC104/preethi-s',
  'VBC104/udhav-kothari',
  'VBC105/harsh-malani',
  'VBC105/meith-jain',
  'VBC105/ritesh-oswal',
  'VBC106/aarav',
  'VBC106/tushar',
  'VBC107/aditi',
  'VBC107/satvik',
  'VBC107/soumanshu',
  'VBC108/akassh',
  'VBC108/divyam',
  'VBC108/vatsal',
  'VBC109/ajitwsh-s',
  'VBC109/ridhima-gupta',
  'VBC109/shweta-singh',
  'VBC110/diya-harish',
  'VBC110/happy-panjwani',
  'VBC110/rishika-choudhary',
  'VBC111/jenessa-bhathena',
  'VBC111/tanishq-lomte',
  'VBC111/zalak-gogri',
  'VBC112/naveen-kumar',
  'VBC112/parin-kumat',
  'VBC112/praval-goud-madduri',
  'VBC113/archit-pathak',
  'VBC113/riya-kothavade',
  'VBC114/abhishek-kamblath',
  'VBC114/aditi-roy',
  'VBC114/kalika-srivastava',
  'VBC115/dev-mehra',
  'VBC115/maitree-shah',
  'VBC115/risheet-gangar',
  'VBC116/ananta-tantia',
  'VBC116/rydham-jain',
  'VBC116/vidhi-agarwal',
  'VBC117/harsh-dubey',
  'VBC117/pratiksha-bengani',
  'VBC117/rishika-uppalapati',
  'VBC118/adithya-rajagopalan',
  'VBC118/rahul-m',
  'VBC118/sairaj-g',
  'VBC119/abeer-bhati',
  'VBC119/bhadar-singh',
  'VBC119/utkarsh-kapoor',
  'VBC120/anushka-ghogre',
  'VBC120/dhruvi-lohiya',
  'VBC120/mayank-agrawal',
  'VBC121/ashutosh-saxena',
  'VBC121/sohum-shikhare',
  'VBC121/tejas-joshi',
  'VBC122/akristi-mohta',
  'VBC122/itish-pande',
  'VBC122/shashank-pandey',
  'VBC123/akhilesh',
  'VBC123/hritik',
  'VBC123/yashwi',
  'VBC124/aditya-peter',
  'VBC124/naveen-kolla',
  'VBC124/tanishkha',
  'VBC125/anuj-bajaj',
  'VBC125/darshan-chopda',
  'VBC126/sarth',
  'VBC126/vikram',
  'VBC127/akshat',
  'VBC127/lipika',
  'VBC127/param',
  'VBC128/adnaan-r',
  'VBC128/akash-ghorpade',
  'VBC128/vion-d-souza',
  'VBC129/bhavya',
  'VBC129/haider',
  'VBC129/yogita',
  'VBC130/anshul-dhapte',
  'VBC130/devansh-mehta',
  'VBC130/nikhil-kanjolia',
  'VBC131/brijesh-attal',
  'VBC131/rushabh-shah',
  'VBC132/darsh-shah',
  'VBC132/rohan-vivek',
  'VBC132/sinchan-rai',
  'VBC133/aditya-agarwal',
  'VBC133/ansh-loya',
  'VBC133/yaswanth-krishna',
  'VBC134/dhyay',
  'VBC134/preet',
  'VBC134/yashansh',
  'VBC135/devansh-vora',
  'VBC135/madhuresh-binzani',
  'VBC135/sakshi-awasthi',
  'VBC136/aadishwar-r',
  'VBC136/pratiksha-bihani',
  'VBC138/radha-hutkey',
  'VBC138/sahil-agrawal',
  'VBC139/aditya-singhal',
  'VBC139/bhavit-gupta',
  'VBC139/harsh-nain',
]
