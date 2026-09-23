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
 * which puts a `/tv/…` path into a *tracked* file — one `git commit -a` away
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
 * NEXT_PUBLIC_FEED_CSV_URL=/tv/feed.csv
 * NEXT_PUBLIC_COHORT_CSV_URL=/tv/cohort.csv
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
 * **37 — the competing cohort, `VBC101`–`VBC139` less `VBC104` and
 * `VBC138`.** It was 39 until Trigo and SAAJ left on 23 September 2026.
 * `TV_Feed` publishes more than that today, because `VBC140` and `VBC141` are
 * test workbooks still sitting in `Team Links` and the two departed teams'
 * workbooks still publish rows; the gate checks *short*, never exact, so it
 * passes either way and keeps passing the day those four are deleted. See `passesRowGate` in lib/feed.ts.
 *
 * **This number is the single most dangerous constant in the project.** Set it
 * one above the real cohort and every poll is rejected, forever, silently: no
 * spinner, no error state, nothing on screen but the empty structure and one
 * line in a console nobody is reading. Whenever the cohort size changes, this
 * changes with it.
 */
export const MIN_TEAM_ROWS = 37

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
 *
 * **`VBC138` (SAAJ) left the cohort on 23 September 2026** and is filtered the
 * same way: its workbook still publishes a row, and it takes no card, no rank
 * and no line on `/live`. Its two students' photographs stay in
 * `PEOPLE_PHOTOS` and on disk, unread, until they are placed on another team —
 * moving them is renaming the folder and editing two entries.
 *
 * **`VBC104` (Trigo) left on 23 September 2026 too**, and is handled exactly
 * the same way: filtered from every board, photographs kept but unread.
 */
export const SPARE_TEAM_IDS: readonly TeamId[] = ['VBC140', 'VBC141', 'VBC138', 'VBC104']

// ── Daily board ─────────────────────────────────────────────────────────────

/**
 * A day's revenue at or above this reads as a strong day and is emphasised.
 *
 * One threshold, one emphasis. It is a display decision, not a milestone — the
 * wall no longer fires anything on crossing it, so a team moving above and below
 * it through the day is free to.
 */
export const HOT_TODAY_MIN = 5_000

/**
 * How far down the daily board a card is a solid Deep Forest object. Below it,
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
 * Equal to `WATCH_RANKS_DAILY` today, and not derived from it: one says how far
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

// ── The daily window ────────────────────────────────────────────────────────

/**
 * The hour, IST, at which `/daily`'s window closes and the board locks for the
 * next twenty-four hours.
 *
 * **Not midnight, and the difference is the whole point.** The board shows a
 * *finished* day — 10:00 yesterday to 10:00 today — so every figure on it is
 * settled before anybody is in the corridor to read it, and the thirty-nine
 * figures that change when it rolls change while the building is empty. A
 * window closing at midnight would be as correct and would roll at the hour the
 * consolidator, the sheet's `TODAY()` and the laptop's own clock are all least
 * likely to agree.
 *
 * **Ten, not nine, because the consolidator has to have run.** The window is
 * closed by photographing `total_revenue` as the sheet publishes it, and a
 * published CSV lags the sheet by about five minutes on top of whatever the
 * consolidator's own cadence is. Ten gives the previous night's last sales time
 * to have reached the feed before the shutter closes on them; nine does not,
 * and a sale logged at 23:50 landing in the *next* day's window is the kind of
 * wrong this wall cannot report.
 *
 * Moving it is one number, and it moves the boundary for everything: the mark,
 * the period `detect` goes quiet on, and the word in the masthead. There is no
 * second copy of it anywhere.
 */
export const DAILY_CLOSE_HOUR_IST = 10

// ── Overtakes ───────────────────────────────────────────────────────────────

/**
 * How far down each board a rank change is worth animating.
 *
 * The daily board watches its whole first column; a change at rank 34 is real
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
export const WATCH_RANKS_DAILY = 20
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
/**
 * ── A venture's own links, until `TV_Feed` publishes them ──
 *
 * `Team Links` has carried Website Link and Instagram Link all along, and
 * `TV_Feed` does not select them: the published CSV is eight columns wide and
 * has never included `website`, `instagram`, `product` or `members`. So
 * `/live` has had the code to show a team's links since it was built and has
 * had nothing to show.
 *
 * This is the same shape `PEOPLE_PHOTOS` is, for the same reason and with the
 * same warning attached. **It is a floor, not a replacement.** The sheet wins
 * whenever the sheet speaks — `linksOf` prefers a published cell and only
 * falls back here — so the moment those columns land in `TV_Feed` this list
 * stops being read and a team that updates its own Instagram is right on the
 * wall the next poll. Until then it goes stale silently, and the only fix for
 * that is publishing the columns.
 *
 * Transcribed from `Team Links` cols G and I on 19 September 2026, and
 * re-checked against an updated export on 23 September 2026, which added
 * Savore, Pehchaan and Bean & Beyond: 33 teams with at least one link, 31
 * websites, 26 Instagram handles. `VBC138` and `VBC104` are gone with their
 * teams, which leaves 32, 30 and 26. Every value
 * is put through `websiteUrl` / `instagramUrl` / `facebookUrl` by
 * `lib/live.test.ts` and none is refused. **Cells are stored verbatim**, in
 * whatever shape the team typed — bare domain, full URL, with or without
 * `www.` — because deciding what is a safe URL is `lib/live.ts`'s job and
 * doing it twice is how the two answers drift apart.
 *
 * **Facebook is here from 23 September 2026**, asked for directly, from col H.
 * Three teams have one. It lives only in this list — `TV_Feed` has no
 * `facebook` column and the parser reads none — so unlike the other two it
 * is not a floor under the sheet; it is the only source. Madhosh's cell reads
 * "To be updated" and is left out rather than linked.
 */
export const TEAM_LINKS: Readonly<Record<string, { website?: string; instagram?: string; facebook?: string }>> = {
  'VBC101': { website: 'https://aksperfumes.in/', instagram: 'https://www.instagram.com/aks.perfumes_' },   // AKS Perfumes
  'VBC102': { website: 'https://getlumi.in/', instagram: 'https://www.instagram.com/shop_lumii?stkn=c3BtY2pubGVremU3' },   // LUMI
  'VBC103': { website: 'houseofpravaah.com', instagram: 'https://www.instagram.com/houseofpravaah?stkn=a280dDNucDlyY2V6' },   // House of Pravaah
  'VBC105': { website: 'https://chaklebro.myshopify.com' },   // Chakle Bro
  'VBC106': { website: 'https://dadofbags.in/', instagram: 'https://www.instagram.com/dadofbags1947/' },   // Dad Of Bags.
  'VBC107': { website: 'https://madhosh.co.in/', instagram: 'https://www.instagram.com/madhosh.co.in/' },   // Madhosh
  'VBC109': { website: 'https://www.wekrave.in/', instagram: 'https://www.instagram.com/wekravehealthy?stkn=bWFmZTVkeDI0ZGZh' },   // WeKravehealthy
  'VBC110': { website: 'https://savore.online/', instagram: 'https://www.instagram.com/savore_gifting/' },   // Savore
  'VBC111': { website: 'https://www.pehchaann.in/', instagram: 'https://www.instagram.com/pehchaann.in/', facebook: 'https://www.facebook.com/profile.php?id=61594343353780' },   // Pehchaan
  'VBC112': { website: 'fakesocietystudio.com', instagram: 'https://www.instagram.com/fakesocietystudio?stkn=cjRjZ283cWM2dHk5' },   // Fake society studio
  'VBC113': { website: 'munchco.in', instagram: 'https://www.instagram.com/shopmunchandco?stkn=MWkzd3lzNGh1aWRrOQ%3D%3D&utm_source=qr' },   // Munch&co
  'VBC114': { website: 'https://tea-riffic.in/', instagram: 'https://www.instagram.com/tea.riffic__?stkn=MXQxa3M0enh0amc4eA%3D%3D&utm_source=qr' },   // Tea-riffic
  'VBC115': { website: 'https://chipmonk.co.in/', instagram: 'https://www.instagram.com/chip.monk.snacks?stkn=ZjRzM3JoZjhlNTYw&utm_source=qr' },   // ChipMonk
  'VBC116': { website: 'https://caughtinnasha.store', instagram: 'https://www.instagram.com/caughtinnasha?stkn=MWk3M2x5ZTl5YWw5Nw%3D%3D&utm_source=qr' },   // Nasha
  'VBC117': { website: 'https://juzzle-store.myshopify.com/?utm_source=ig&utm_medium=social&utm_content=link_in_bio&fbclid=PAcGRvZgJleHRuA2FlbQIxMQBzcnRjBmFwcF9pZA85MzY2MTk3NDMzOTI0NTkAAadkSeDj0_1sTkLwmLs-pYSbp-ttUGNxZzMoBBv8IAdIjRXS89g0ci9l9mw84A_aem_uS6MOQTIglIwVhIZptHq0Q', instagram: 'https://www.instagram.com/just.juzzle/', facebook: 'https://www.facebook.com/share/1JxswCt3Wo/' },   // Juzzle
  'VBC119': { website: 'https://getnekt.in', instagram: 'https://www.instagram.com/getnekt.in?stkn=cGhvbWNxbDR4NG1z' },   // NEKT
  'VBC120': { website: 'https://nobiggie.shop/', instagram: 'https://www.instagram.com/nobiggie.crumbs?stkn=N2cxdGFnNjVjeDly' },   // No Biggie
  'VBC121': { website: 'https://kirdaaar.com/' },   // Kirdaaar
  'VBC122': { website: 'Meltyk.in', instagram: 'https://www.instagram.com/meltyk.in?stkn=NWhoMnpieHdkbm9z' },   // MELTYK
  'VBC123': { instagram: 'https://www.instagram.com/haulties_s?stkn=dWZrMHp2YTV0cXRm&utm_source=qr' },   // HAULTIES
  'VBC124': { website: 'bean-beyond-store.myshopify.com', instagram: 'https://www.instagram.com/beanandbeyond26?stkn=a3F3ZDF0OHhwMmF2' },   // Bean & Beyond
  'VBC125': { website: 'https://emberandoak.online' },   // Ember and Oak
  'VBC126': { website: 'https://chocoandcoo.myshopify.com', instagram: 'https://www.instagram.com/chocoandcoo?stkn=NDN3djQwMmZkY2k=' },   // Choco and co
  'VBC128': { website: 'theusualcoffee.in', instagram: 'https://www.instagram.com/theusualindia/' },   // The Usual
  'VBC130': { website: 'sidequestco.in' },   // Side Quest
  'VBC131': { website: 'https://nottycrunch.in/products/peri-peri-veggie-chips', instagram: 'https://www.instagram.com/nottycrunch?stkn=MW04bHAyZXFzZDdodQ%3D%3D&utm_source=qr' },   // Notty Crunch
  'VBC132': { website: 'www.mugshot.in', instagram: 'https://www.instagram.com/mugshott.co?stkn=MzRvMTRxM2YzYmhw' },   // Mugshot
  'VBC133': { website: 'https://crunchdco.myshopify.com/' },   // Crunchd
  'VBC135': { website: 'https://krackleco.myshopify.com/' },   // Krackle Co
  'VBC136': { website: 'https://thekuki.in/', instagram: 'https://www.instagram.com/getkuki?stkn=a3o1OHN6d2pzZzlm&utm_source=qr' },   // KUKI
  'VBC137': { instagram: 'https://www.instagram.com/zaaree.co?stkn=cXJvYXZrbHYyY3J1&utm_source=qr' },   // ZAAREE
  'VBC139': { website: 'www.atmiva.in', instagram: 'https://www.instagram.com/atmiva.in', facebook: 'https://www.facebook.com/atmiva.in/' },   // Atmiva
}

export const PEOPLE_PHOTOS: readonly string[] = [
  'VBC101/nirmalya-sah',
  'VBC101/sachidananda-dehury',
  'VBC101/tanishque-jain',
  'VBC102/arpita-mahata',
  'VBC102/diya-agarwal',
  'VBC102/simran-kalra',
  'VBC103/annashri-mahato',
  'VBC103/kavya-zala',
  'VBC103/pragati-singh',
  'VBC104/preethi-s',
  'VBC104/udhav-kothari',
  'VBC105/harsh-malani',
  'VBC105/meith-jain',
  'VBC105/ritesh-oswal',
  'VBC106/aarav',
  'VBC106/tushar',
  'VBC107/anubhav',
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
  'VBC113/diya-ispahani',
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
  'VBC118/radha-hutkey',
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
  'VBC131/abhishek-hosmani',
  'VBC131/brijesh-attal',
  'VBC131/rushabh-shah',
  'VBC132/aditi',
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
  'VBC136/shivansh-sarraf',
  'VBC137/abhishek-gaur',
  'VBC137/kaavya-goenka',
  'VBC137/riya-khurana',
  'VBC138/sahil-agrawal',
  'VBC139/aditya-singhal',
  'VBC139/bhavit-gupta',
  'VBC139/harsh-nain',
]

/**
 * ── Who is on each team, and where to find them on LinkedIn ──
 *
 * `/live`'s team sheet lists the students behind a venture, by name, each one
 * linking to their LinkedIn — so somebody reading a team's numbers can reach
 * the people who made them. Added 23 September 2026, asked for directly.
 *
 * **Three sources, joined on the one key they share, which is the Forge
 * email.** The `Groups List` tab of `Forge C1 Team Details` gives student →
 * team; the `Daily LinkedIn Post Tracker` gives student → profile; both carry
 * `<name>@forge27.mesaschool.co`. Joining on the name instead is how
 * `fetch-headshots.py` once paired Diya Agarwal with Aditya Agarwal's face,
 * so names were not used as the key. Two tracker rows needed the name after
 * all — Aditya Peter's email reads `aditya_peyet@forge28`, Madhuresh
 * Binzani's is a Gmail — and each is the only possible match on its team.
 *
 * **The roster is the programme's, corrected where this repo already knows
 * better**: Aditi Bhateja is on Mugshot (`30662d9`) and Radha Hutkey on Mello
 * (`1fe854b`), both confirmed directly. Trigo and SAAJ have left, so Rohit
 * Singh, Preethi S, Udhav Kothari and Sahil Agrawal are unplaced and not
 * here. Riya Khurana is on ZAAREE, confirmed directly on 23 September 2026
 * after `Groups List` and `Team Links` disagreed about her. Her link is the
 * tracker's, matched on her Forge email like everyone else's.
 *
 * **Names are written by hand**, as first and last name in the case a person
 * would write them — the sources carry `AADISHWAR R`, `Sai Santosh Praval Goud
 * . M` and `Anuj sunil Bajaj`. Order is `Team Links`' order, which is the
 * order a team listed itself in.
 *
 * **`linkedin` is stored verbatim**, tracking query and all, for the reason
 * `TEAM_LINKS` gives: deciding what is safe to put in an `href` is
 * `linkedinUrl`'s job in `lib/live.ts`, and doing it twice is how two answers
 * drift. Divy Hardenia's tracker cell is a `share.google` short link rather
 * than a profile; his link here was given directly on 23 September 2026
 * instead, and the tracker still carries the short link.
 *
 * **`photo` is the slug in `PEOPLE_PHOTOS`**, stated rather than derived,
 * because a third of those slugs are first names only (`VBC106/aarav`) and
 * deriving it would mean guessing whose face is whose. `lib/live.test.ts`
 * holds this list and `PEOPLE_PHOTOS` to each other in both directions.
 *
 * **Consent is the same question it is for the photographs.** Each student
 * put this URL into a cohort tracker; a public page is a wider audience than
 * that. Removing one person's link is deleting one field.
 */
export type Person = {
  name: string
  linkedin?: string
  photo?: string
}

export const TEAM_PEOPLE: Readonly<Record<string, readonly Person[]>> = {
  VBC101: [
    { name: 'Tanishque Jain', linkedin: 'https://www.linkedin.com/in/tanishquejain9/', photo: 'tanishque-jain' },
    { name: 'Nirmalya Sah', linkedin: 'https://www.linkedin.com/in/nirmalyasah', photo: 'nirmalya-sah' },
    { name: 'Sachidananda Dehury', linkedin: 'https://www.linkedin.com/in/sachidananda-dehury-1ba51229a', photo: 'sachidananda-dehury' },
  ],
  VBC102: [
    { name: 'Simran Kalra', linkedin: 'https://www.linkedin.com/in/simran-kalra-20088a347?utm_source=share_via&utm_content=profile&utm_medium=member_ios', photo: 'simran-kalra' },
    { name: 'Diya Agrawal', linkedin: 'https://www.linkedin.com/in/diyagrawall', photo: 'diya-agarwal' },
    { name: 'Arpita Mahata', linkedin: 'https://www.linkedin.com/in/arpita-mahata', photo: 'arpita-mahata' },
  ],
  VBC103: [
    { name: 'Annashri Mahato', linkedin: 'https://www.linkedin.com/in/annashrimahato', photo: 'annashri-mahato' },
    { name: 'Pragati Singh', linkedin: 'https://www.linkedin.com/in/pragatisingh99', photo: 'pragati-singh' },
    { name: 'Kavya Zala', linkedin: 'https://www.linkedin.com/in/kavya-zala-a451292b2', photo: 'kavya-zala' },
  ],
  VBC105: [
    { name: 'Harsh Malani', linkedin: 'https://www.linkedin.com/in/harsh-malani-a656992b1?utm_source=share_via&utm_content=profile&utm_medium=member_android', photo: 'harsh-malani' },
    { name: 'Meith Jain', linkedin: 'https://www.linkedin.com/in/meith-jain-89b056291/', photo: 'meith-jain' },
    { name: 'Ritesh Oswal', linkedin: 'https://www.linkedin.com/in/ritesh-oswal-738682394', photo: 'ritesh-oswal' },
  ],
  VBC106: [
    { name: 'Aarav Shrivastava', linkedin: 'https://www.linkedin.com/in/aarav-shrivastava-b63779218?utm_source=share_via&utm_content=profile&utm_medium=member_ios', photo: 'aarav' },
    { name: 'Divy Hardenia', linkedin: 'https://www.linkedin.com/in/divy-hardenia-b08666377' },
    { name: 'Tushar Ram Reddy', linkedin: 'https://www.linkedin.com/in/tushar-ram-759706399', photo: 'tushar' },
  ],
  VBC107: [
    { name: 'Satvik Bansal', linkedin: 'https://www.linkedin.com/in/satvik-bansal-b26542286?utm_source=share_via&utm_content=profile&utm_medium=member_ios', photo: 'satvik' },
    { name: 'Somanshu Singhal', linkedin: 'https://www.linkedin.com/in/somanshu-singhal-b42055216/', photo: 'soumanshu' },
    { name: 'Anubhav Rastogi', linkedin: 'https://www.linkedin.com/in/anubhav-rastogi-91aa95249', photo: 'anubhav' },
  ],
  VBC108: [
    { name: 'Vatsal Shah', linkedin: 'https://www.linkedin.com/in/vatsalshah-/', photo: 'vatsal' },
    { name: 'Akassh Puranik', linkedin: 'https://www.linkedin.com/in/akassh-puranik-581755224', photo: 'akassh' },
    { name: 'Divyam Arora', linkedin: 'https://www.linkedin.com/in/divyam-arora-78207b250', photo: 'divyam' },
  ],
  VBC109: [
    { name: 'Shweta Singh', linkedin: 'https://www.linkedin.com/in/shweta-singh', photo: 'shweta-singh' },
    { name: 'Ajitesh Senthilkumar', linkedin: 'https://www.linkedin.com/in/ajitesh-senthilkumar-0b8a85216?utm_source=share_via&utm_content=profile&utm_medium=member_android', photo: 'ajitwsh-s' },
    { name: 'Ridhima Gupta', linkedin: 'https://www.linkedin.com/in/ridhima-gupta-a2b3a026a/', photo: 'ridhima-gupta' },
  ],
  VBC110: [
    { name: 'Happy Panjwani', linkedin: 'https://www.linkedin.com/in/happy-panjwani-652909241/', photo: 'happy-panjwani' },
    { name: 'Diya Harish', linkedin: 'https://www.linkedin.com/in/diya-h-bb7694255', photo: 'diya-harish' },
    { name: 'Rishika Choudhary', linkedin: 'https://www.linkedin.com/in/rishikachoudhary?utm_source=share_via&utm_content=profile&utm_medium=member_ios', photo: 'rishika-choudhary' },
    { name: 'Zuha Fathima', linkedin: 'https://www.linkedin.com/in/zuha-fathima-gs-bb8572290?trk=contact-info' },
  ],
  VBC111: [
    { name: 'Jenessa Bhathena', linkedin: 'https://www.linkedin.com/in/jenessa-bhathena-527079247/', photo: 'jenessa-bhathena' },
    { name: 'Tanishq Lomte', linkedin: 'http://linkedin.com/in/lomtetanishq26', photo: 'tanishq-lomte' },
    { name: 'Zalak Gogri', linkedin: 'https://www.linkedin.com/in/zalak-gogri-3837342b2?trk=contact-info', photo: 'zalak-gogri' },
  ],
  VBC112: [
    { name: 'Praval Goud Madduri', linkedin: 'https://www.linkedin.com/in/praval-goud-47a795273?utm_source=share_via&utm_content=profile&utm_medium=member_ios', photo: 'praval-goud-madduri' },
    { name: 'Parin Kumat', linkedin: 'https://www.linkedin.com/in/parin-kumat-a58911278?trk=contact-info', photo: 'parin-kumat' },
    { name: 'Naveen Kumar', linkedin: 'https://in.linkedin.com/in/naveen-kumar-p-6b03522a5', photo: 'naveen-kumar' },
  ],
  VBC113: [
    { name: 'Archit Pathak', linkedin: 'https://www.linkedin.com/in/archit-pathak-1b4859211/', photo: 'archit-pathak' },
    { name: 'Riya Kothavade', linkedin: 'https://www.linkedin.com/in/riya-kothavade-a3a549236?utm_source=share_via&utm_content=profile&utm_medium=member_ios', photo: 'riya-kothavade' },
    { name: 'Diya Ispahani', linkedin: 'https://www.linkedin.com/in/diya-ispahani?utm_source=share_via&utm_content=profile&utm_medium=member_ios', photo: 'diya-ispahani' },
  ],
  VBC114: [
    { name: 'Abhishek Kambalath', linkedin: 'https://www.linkedin.com/in/abhishek-kambalath-20337a25a', photo: 'abhishek-kamblath' },
    { name: 'Kalika Srivastava', linkedin: 'https://www.linkedin.com/in/kalika-srivastava-73aa20267', photo: 'kalika-srivastava' },
    { name: 'Aditi Roy', linkedin: 'https://www.linkedin.com/in/aditi-roy-a9ab212bb/', photo: 'aditi-roy' },
  ],
  VBC115: [
    { name: 'Risheet Gangar', linkedin: 'https://www.linkedin.com/in/risheet-gangar?utm_source=share_via&utm_content=profile&utm_medium=member_ios', photo: 'risheet-gangar' },
    { name: 'Dev Mehra', linkedin: 'https://www.linkedin.com/in/dev-mehra-2596bb135?utm_source=share_via&utm_content=profile&utm_medium=member_ios', photo: 'dev-mehra' },
    { name: 'Maitree Shah', linkedin: 'https://www.linkedin.com/in/maitree-shah-9352331b1?utm_source=share_via&utm_content=profile&utm_medium=member_android', photo: 'maitree-shah' },
  ],
  VBC116: [
    { name: 'Ananta Tantia', linkedin: 'https://www.linkedin.com/in/tantiaananta', photo: 'ananta-tantia' },
    { name: 'Rydham Jain', linkedin: 'https://www.linkedin.com/in/rydham-jain-8281ab28a/', photo: 'rydham-jain' },
    { name: 'Vidhi Agarwal', linkedin: 'https://www.linkedin.com/in/vidhi-agarwal-38b467203?utm_source=share_via&utm_content=profile&utm_medium=member_ios', photo: 'vidhi-agarwal' },
  ],
  VBC117: [
    { name: 'Pratiksha Bengani', linkedin: 'https://www.linkedin.com/in/pratiksha-bengani-5413a8215', photo: 'pratiksha-bengani' },
    { name: 'Rishika Uppalapati', linkedin: 'https://www.linkedin.com/in/rishika-uppalapati-940545333/', photo: 'rishika-uppalapati' },
    { name: 'Harsh Dubey', linkedin: 'https://www.linkedin.com/in/harshdubey5?utm_source=share_via&utm_content=profile&utm_medium=member_ios', photo: 'harsh-dubey' },
  ],
  VBC118: [
    { name: 'Rahul M', linkedin: 'https://www.linkedin.com/in/rahulm1228/', photo: 'rahul-m' },
    { name: 'Adithya Rajagopalan', linkedin: 'https://www.linkedin.com/in/adithya-rajagopalan-593014256?utm_source=share&utm_campaign=share_via&utm_content=profile&utm_medium=android_app', photo: 'adithya-rajagopalan' },
    { name: 'Sairaj G', linkedin: 'https://www.linkedin.com/in/sai-raj-g-63b848373', photo: 'sairaj-g' },
    { name: 'Radha Hutkey', linkedin: 'https://www.linkedin.com/in/radha-hutkey-a0pr', photo: 'radha-hutkey' },
  ],
  VBC119: [
    { name: 'Abeer Bhati', linkedin: 'https://www.linkedin.com/in/abeer-bhati-493341285?utm_source=share_via&utm_content=profile&utm_medium=member_ios', photo: 'abeer-bhati' },
    { name: 'Utkarsh Kapoor', linkedin: 'https://www.linkedin.com/in/utkarsh-kapoor-b20998262', photo: 'utkarsh-kapoor' },
    { name: 'Bhadar Singh', linkedin: 'https://www.linkedin.com/in/bhadar-singh-2898161b8?utm_source=share_via&utm_content=profile&utm_medium=member_ios', photo: 'bhadar-singh' },
  ],
  VBC120: [
    { name: 'Dhruvi Lohiya', linkedin: 'https://www.linkedin.com/in/dhruvi-lohiya-747087216?utm_source=share_via&utm_content=profile&utm_medium=member_ios', photo: 'dhruvi-lohiya' },
    { name: 'Mayank Agrawal', linkedin: 'https://www.linkedin.com/in/mayank-agrawal-b520513b1?utm_source=share_via&utm_content=profile&utm_medium=member_ios', photo: 'mayank-agrawal' },
    { name: 'Anushka Ghogre', linkedin: 'https://www.linkedin.com/in/anushka-ghogre-48a968268?utm_source=share_via&utm_content=profile&utm_medium=member_ios', photo: 'anushka-ghogre' },
  ],
  VBC121: [
    { name: 'Ashutosh Saxena', linkedin: 'https://www.linkedin.com/in/ashutoshsaxena2003', photo: 'ashutosh-saxena' },
    { name: 'Tejas Joshi', linkedin: 'https://www.linkedin.com/in/tejas-joshi-b1296a31b/', photo: 'tejas-joshi' },
    { name: 'Sohum Shikhare', linkedin: 'https://www.linkedin.com/in/sohum-shikhare-772a36257?utm_source=share_via&utm_content=profile&utm_medium=member_ios', photo: 'sohum-shikhare' },
  ],
  VBC122: [
    { name: 'Shashank Pandey', linkedin: 'https://www.linkedin.com/in/shashank-pandey-95857a17b', photo: 'shashank-pandey' },
    { name: 'Akristi Mohta', linkedin: 'https://www.linkedin.com/in/akristimohta/', photo: 'akristi-mohta' },
    { name: 'Itish Pande', linkedin: 'https://www.linkedin.com/in/itishpande/', photo: 'itish-pande' },
  ],
  VBC123: [
    { name: 'Yashwi Agrawal', linkedin: 'https://www.linkedin.com/in/yashwi-agrawal-565627293', photo: 'yashwi' },
    { name: 'Hritik Gani', linkedin: 'https://www.linkedin.com/in/hritik-gani-78b1673ba?utm_source=share_via&utm_content=profile&utm_medium=member_ios', photo: 'hritik' },
    { name: 'Akhilesh Bijjargi', linkedin: 'https://www.linkedin.com/in/akhilesh-bijjargi-8596383b7', photo: 'akhilesh' },
  ],
  VBC124: [
    { name: 'Naveen Kolla', linkedin: 'http://www.linkedin.com/in/kollanaveen', photo: 'naveen-kolla' },
    { name: 'Tanishka Desai', linkedin: 'https://www.linkedin.com/in/tanishka-desai-tnd2005', photo: 'tanishkha' },
    { name: 'Aditya Peter', linkedin: 'https://www.linkedin.com/in/aditya-peter-822876426?utm_source=share_via&utm_content=profile&utm_medium=member_android', photo: 'aditya-peter' },
  ],
  VBC125: [
    { name: 'Darshan Chopda', linkedin: 'https://in.linkedin.com/in/darshan-chopda-8b11231b9', photo: 'darshan-chopda' },
    { name: 'Anuj Bajaj', linkedin: 'https://www.linkedin.com/in/anujbajaj17', photo: 'anuj-bajaj' },
  ],
  VBC126: [
    { name: 'Vikram Aditya Agarwal', linkedin: 'https://www.linkedin.com/in/vikramadityaagarwal1?utm_source=share_via&utm_content=profile&utm_medium=member_android', photo: 'vikram' },
    { name: 'Sarth Raghuwanshi', linkedin: 'https://www.linkedin.com/in/sarth-raghuwanshi-583bb5240?utm_source=share_via&utm_content=profile&utm_medium=member_ios', photo: 'sarth' },
    { name: 'Ujjwal Sitlani', linkedin: 'https://www.linkedin.com/in/ujjwal-sitlani-6198b5229?utm_source=share_via&utm_content=profile&utm_medium=member_ios' },
  ],
  VBC127: [
    { name: 'Akshat Thakur', linkedin: 'https://www.linkedin.com/in/akshat-thakur-0a7bb3262?utm_source=share_via&utm_content=profile&utm_medium=member_android', photo: 'akshat' },
    { name: 'Lipika Arya', linkedin: 'https://www.linkedin.com/in/lipika-arya-14398b21b?utm_source=share&utm_campaign=share_via&utm_content=profile&utm_medium=ios_app', photo: 'lipika' },
    { name: 'Param Deora', linkedin: 'https://www.linkedin.com/in/paramdeora?utm_source=share_via&utm_content=profile&utm_medium=member_android', photo: 'param' },
  ],
  VBC128: [
    { name: "Vion D'Souza", linkedin: 'https://www.linkedin.com/in/vion-george-dsouza-91a25132a?utm_source=share_via&utm_content=profile&utm_medium=member_ios', photo: 'vion-d-souza' },
    { name: 'Adnaan R', linkedin: 'https://www.linkedin.com/in/adnaan-r-0a94352b3?utm_source=share_via&utm_content=profile&utm_medium=member_android', photo: 'adnaan-r' },
    { name: 'Akash Ghorpade', linkedin: 'https://www.linkedin.com/in/akash-ghorpade-051291271/', photo: 'akash-ghorpade' },
  ],
  VBC129: [
    { name: 'Yogita Bhuwania', linkedin: 'https://www.linkedin.com/in/yogita-bhuwania-02087324a?utm_source=share&utm_campaign=share_via&utm_content=profile&utm_medium=ios_app', photo: 'yogita' },
    { name: 'Haider Millwala', linkedin: 'https://www.linkedin.com/in/haidermillwala/', photo: 'haider' },
    { name: 'Bhavya Tandon', linkedin: 'linkedin.com/in/bhavya-tandon-175027223', photo: 'bhavya' },
  ],
  VBC130: [
    { name: 'Anshul Dhapte', linkedin: 'https://www.linkedin.com/in/anshul-dhapte-383498370', photo: 'anshul-dhapte' },
    { name: 'Devansh Mehta', linkedin: 'https://www.linkedin.com/in/devansh-mehta-06a251259/', photo: 'devansh-mehta' },
    { name: 'Nikhil Kanjolia', linkedin: 'https://www.linkedin.com/in/nikhil-kanjolia-45a452326/', photo: 'nikhil-kanjolia' },
  ],
  VBC131: [
    { name: 'Abhishek Hosmani', linkedin: 'https://www.linkedin.com/in/abhishek-hosmani-b3a9b135b?utm_source=share_via&utm_content=profile&utm_medium=member_ios', photo: 'abhishek-hosmani' },
    { name: 'Rushabh Shah', linkedin: 'https://www.linkedin.com/in/rushabh-shah-34438923b/', photo: 'rushabh-shah' },
    { name: 'Brijesh Attal', linkedin: 'https://www.linkedin.com/in/brijesh-attal-37b38940b', photo: 'brijesh-attal' },
  ],
  VBC132: [
    { name: 'Rohan Vivek', linkedin: 'https://www.linkedin.com/in/rohan-vivek-', photo: 'rohan-vivek' },
    { name: 'Darsh Shah', linkedin: 'https://www.linkedin.com/in/darshshah19', photo: 'darsh-shah' },
    { name: 'Sinchan Rai', linkedin: 'https://www.linkedin.com/in/sinchan-rai', photo: 'sinchan-rai' },
    { name: 'Aditi Bhateja', linkedin: 'https://www.linkedin.com/in/aditi-bhateja-a36134375?utm_source=share_via&utm_content=profile&utm_medium=member_android', photo: 'aditi' },
  ],
  VBC133: [
    { name: 'Ansh Loya', linkedin: 'https://www.linkedin.com/in/anshloya/', photo: 'ansh-loya' },
    { name: 'Aditya Agarwal', linkedin: 'https://www.linkedin.com/in/aditya-agarwal-5a7317373', photo: 'aditya-agarwal' },
    { name: 'Yaswanth Krishna', linkedin: 'https://www.linkedin.com/in/yashfiner', photo: 'yaswanth-krishna' },
  ],
  VBC134: [
    { name: 'Yashansh Savla', linkedin: 'https://www.linkedin.com/in/yashanshsavla/', photo: 'yashansh' },
    { name: 'Preet Jain', linkedin: 'https://www.linkedin.com/in/preet-jain-14b375248/', photo: 'preet' },
    { name: 'Dhyay Popat', linkedin: 'https://www.linkedin.com/in/dhyay', photo: 'dhyay' },
  ],
  VBC135: [
    { name: 'Sakshi Awasthi', linkedin: 'https://www.linkedin.com/in/sakshi-awasthi-353505211?utm_source=share_via&utm_content=profile&utm_medium=member_ios', photo: 'sakshi-awasthi' },
    { name: 'Devansh Vora', linkedin: 'https://www.linkedin.com/in/devanshvora--/', photo: 'devansh-vora' },
    { name: 'Madhuresh Binzani', linkedin: 'https://in.linkedin.com/in/madhuresh-binzani-014903242', photo: 'madhuresh-binzani' },
  ],
  VBC136: [
    { name: 'Pratiksha Bihani', linkedin: 'https://www.linkedin.com/in/pratiksha-bihani-4135731b1?utm_source=share_via&utm_content=profile&utm_medium=member_ios', photo: 'pratiksha-bihani' },
    { name: 'Shivansh Sarraf', linkedin: 'linkedin.com/in/shivansh-sarraf-a6b090216', photo: 'shivansh-sarraf' },
    { name: 'Aadishwar R', linkedin: 'https://www.linkedin.com/in/aadishwar-r-0b843a34a/', photo: 'aadishwar-r' },
  ],
  VBC137: [
    { name: 'Abhishek Gaur', linkedin: 'https://www.linkedin.com/in/abhishek-gaur-b64225282?utm_source=share_via&utm_content=profile&utm_medium=member_ios', photo: 'abhishek-gaur' },
    { name: 'Kaavya Goenka', linkedin: 'https://www.linkedin.com/in/kaavya-goenka-a91059288', photo: 'kaavya-goenka' },
    { name: 'Atharva Agrawal', linkedin: 'https://www.linkedin.com/in/atharva-agrawal-835193202?utm_source=share_via&utm_content=profile&utm_medium=member_ios' },
    { name: 'Riya Khurana', linkedin: 'https://www.linkedin.com/in/riya-khurana-048626271/', photo: 'riya-khurana' },
  ],
  VBC139: [
    { name: 'Aditya Singhal', linkedin: 'https://www.linkedin.com/in/adityasinghal15703/', photo: 'aditya-singhal' },
    { name: 'Bhavit Gupta', linkedin: 'https://www.linkedin.com/in/bhavit-gupta-32b777225', photo: 'bhavit-gupta' },
    { name: 'Harsh Nain', linkedin: 'https://www.linkedin.com/in/harshnainn/', photo: 'harsh-nain' },
  ],
}
