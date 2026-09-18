import Papa from 'papaparse'

import { COHORT_CSV_URL, FEED_CSV_URL, MIN_TEAM_ROWS, UNNAMED_VENTURE } from '@/config'
import type { Cohort, CsvCache, Snapshot, Team } from '@/lib/types'

/**
 * Turning published CSV into a `Snapshot`, and deciding whether to trust it.
 *
 * The contract with the sheet is checked here and nowhere else: a missing
 * header or a missing cohort key throws, loudly, and the caller discards the
 * whole tick. There is no guessing at a column — that is how a wall ends up
 * confidently wrong for a week.
 */

export const FEED_HEADERS = [
  'team_id',
  'venture_name',
  'total_revenue',
  'week_revenue',
  'today_revenue',
  'total_units',
] as const

export const COHORT_KEYS = ['as_of', 'current_open_week', 'flea_datetime_iso'] as const

export class TvSchemaError extends Error {
  constructor(
    readonly source: 'feed' | 'cohort',
    readonly missing: string,
    readonly found: readonly string[],
  ) {
    super(`TV ${source} CSV is missing "${missing}". Found: ${found.join(', ') || '(nothing)'}`)
    this.name = 'TvSchemaError'
  }
}

/**
 * Sheet cells reach us as *formatted* values, so a revenue can arrive as
 * `₹1,04,500` rather than `104500`. Strip currency and separators, then require
 * a finite number.
 *
 * Blank is 0 — a team with no sales yet is normal. `null` means the cell did not
 * parse at all, which makes the whole row unusable; see `toTeam`.
 */
function toNumber(raw: string): number | null {
  const cleaned = raw.replace(/[₹,\s]/g, '')
  if (cleaned === '') return 0
  const value = Number(cleaned)
  return Number.isFinite(value) ? value : null
}

/**
 * A venture name, or `''` for a workbook that has not been named.
 *
 * The template ships each workbook with `Type your venture name` in the cell,
 * and five of the forty competing teams still had it at the time of writing. It
 * is semantically empty, and putting it on a campus TV is worse than putting the
 * team code there: the code reads as "not yet", the placeholder reads as "nobody
 * is looking after this wall". Falling back to `SLE-C4xx` is also the pressure
 * to go and fill the cell in.
 */
function ventureNameOf(raw: string): string {
  const name = raw.trim()
  return name.toLowerCase() === UNNAMED_VENTURE ? '' : name
}

/**
 * One CSV row to one team, or `null` for a row the wall cannot use: no team id,
 * or a number that did not parse. `#REF!` and `#N/A` are what a formula tab
 * exports while it is mid-recalculation.
 *
 * **Unusable rows are dropped, not thrown on, because the count of usable rows
 * *is* the sanity gate.** A garbled cell and a missing row are the same event
 * seen from two angles, and routing both into `passesRowGate` keeps one decision
 * point for "is this fetch trustworthy". Throwing here would instead let a single
 * bad cell discard a fetch that is 41 rows good — the gate's whole job is to
 * judge that, and it cannot judge what never reaches it.
 */
function toTeam(row: Record<string, string>): Team | null {
  const teamId = (row.team_id ?? '').trim()
  if (teamId === '') return null

  const totalRevenue = toNumber(row.total_revenue ?? '')
  const weekRevenue = toNumber(row.week_revenue ?? '')
  const todayRevenue = toNumber(row.today_revenue ?? '')
  const totalUnits = toNumber(row.total_units ?? '')
  if (
    totalRevenue === null ||
    weekRevenue === null ||
    todayRevenue === null ||
    totalUnits === null
  ) {
    return null
  }

  return {
    teamId,
    ventureName: ventureNameOf(row.venture_name ?? ''),
    totalRevenue,
    weekRevenue,
    todayRevenue,
    totalUnits,
    // `?? 0` rather than a null-check that drops the row: an unreadable
    // optional column must not discard a row the required six columns fully
    // describe. The row gate judges whether a whole *fetch* is trustworthy, and
    // it cannot judge what never reaches it.
    //
    // Deliberately **not** in `FEED_HEADERS`, for the reason `prev_week_rank`
    // is not: every name in that list is required and a missing one throws away
    // the fetch, so keeping this one optional is what lets the wall run against
    // a sheet that has not grown the column yet, and pick it up the moment it
    // does — no second deploy, no version check.
    challengeRevenue: toNumber(row.challenge_revenue ?? '') ?? 0,
    ...prevWeekRankOf(row.prev_week_rank),
    ...productOf(row.product),
    ...textOf('instagram', row.instagram),
    ...textOf('website', row.website),
  }
}

/**
 * `prev_week_rank`, if the sheet publishes it.
 *
 * **Deliberately not in `FEED_HEADERS`.** Every column in that list is required
 * and a missing one throws away the whole fetch; this one is optional so the
 * biggest-mover panel ships before the sheet grows the column and starts using
 * it the moment it does, with no second deploy and no version check.
 *
 * A blank cell and a `0` both mean *no previous standing*: blank is how the
 * sheet says a team had banked nothing at last week's close, and `0` is what a
 * formula emits when it means the same thing but was written by someone else.
 * Neither is a rank, and rank 1 is the smallest real value.
 */
function prevWeekRankOf(raw: string | undefined): { prevWeekRank?: number } {
  const value = toNumber((raw ?? '').trim())
  if (value === null || value < 1) return {}
  return { prevWeekRank: Math.round(value) }
}

/**
 * What a venture sells, if the sheet says.
 *
 * Absent rather than empty when there is nothing to show, so `/live` can ask
 * `team.product === undefined` and render nothing at all — `AGENTS.md`'s rule
 * that empty is a valid state, applied to a field that is empty for every team
 * until somebody adds the column.
 *
 * The workbook template's placeholder is treated as no answer, the way
 * `ventureNameOf` treats its own.
 */
function productOf(raw: string | undefined): { product?: string } {
  const product = (raw ?? '').trim()
  if (product === '' || product.toLowerCase().startsWith('type your')) return {}
  return { product }
}

/**
 * An optional free-text column, absent rather than empty.
 *
 * The same shape as `productOf` for the same reason: `/live` asks
 * `team.instagram === undefined` and renders nothing, rather than rendering an
 * empty link. Validation is deliberately **not** here — `lib/feed.ts` decides
 * whether the sheet's shape is trustworthy, and whether a string is a safe URL
 * is a different question, answered in `lib/live.ts` where it is used.
 */
function textOf<K extends string>(key: K, raw: string | undefined): Partial<Record<K, string>> {
  const value = (raw ?? '').trim()
  if (value === '' || value.toLowerCase().startsWith('type your')) return {}
  return { [key]: value } as Record<K, string>
}

function rows(csv: string): Record<string, string>[] {
  // papaparse strips the UTF-8 BOM Google prepends and the CR of its CRLF
  // endings, both of which would otherwise make `team_id` unmatchable and leave
  // a stray "\r" on the last field of every row. Verified, and pinned by tests.
  const parsed = Papa.parse<Record<string, string>>(csv, {
    header: true,
    skipEmptyLines: 'greedy',
    // Header rows on these two tabs are typed by hand, and the live `TV_Cohort`
    // came back as `Key,Value` rather than `key,value` — which threw on every
    // fetch while looking, in the sheet, exactly right. Case and surrounding
    // space are not part of the contract; the *names* are. One rule applied to
    // both CSVs, so there is no per-tab special case to remember.
    transformHeader: (header) => header.trim().toLowerCase(),
  })
  return parsed.data
}

export function parseTeams(csv: string): Team[] {
  const data = rows(csv)
  const found = Object.keys(data[0] ?? {})
  for (const header of FEED_HEADERS) {
    if (!found.includes(header)) throw new TvSchemaError('feed', header, found)
  }

  return data.map(toTeam).filter((team): team is Team => team !== null)
}

export function parseCohort(csv: string): Cohort {
  const data = rows(csv)
  const found = Object.keys(data[0] ?? {})
  for (const header of ['key', 'value'] as const) {
    if (!found.includes(header)) throw new TvSchemaError('cohort', header, found)
  }

  const cohort: Record<string, string> = {}
  for (const row of data) {
    const key = (row.key ?? '').trim()
    if (key !== '') cohort[key] = (row.value ?? '').trim()
  }

  // Every key must be present. A value may legitimately be empty — nobody has
  // made a sale today yet — but a *missing* key means the sheet's shape drifted.
  for (const key of COHORT_KEYS) {
    if (!(key in cohort)) throw new TvSchemaError('cohort', key, Object.keys(cohort))
  }
  return cohort
}

/**
 * The current challenge week, or `null` if the sheet has not produced one.
 *
 * This is the wall's only way to know a week rolled over — the moment every
 * team's `week_revenue` drops to zero at once and the weekly board reshuffles
 * completely. That is a reset, not forty overtakes, and the number is what tells
 * the two apart.
 */
export function openWeek(cohort: Cohort): number | null {
  const raw = (cohort.current_open_week ?? '').trim()
  if (raw === '') return null
  const value = Number(raw)
  return Number.isInteger(value) && value >= 1 ? value : null
}

/**
 * Which challenge is open, or `null` if the sheet has not said.
 *
 * This is `/weekly`'s answer to the question `openWeek` answers for a weekly
 * board: *did the figure this board ranks on just reset to zero for everyone at
 * once?* The two are different clocks and always will be — challenges run
 * Tuesday→Monday and programme weeks run Monday→Sunday, so week 7 spans both the
 * end of challenge 1 and the start of challenge 2. Reading the week here would
 * be wrong in both directions: silent on 24 August when nothing reset, and
 * talkative on 1 September when everything did.
 *
 * Read optionally, and deliberately **not** in `COHORT_KEYS`: a missing key
 * there throws away the whole fetch, and this one is allowed to be absent while
 * the sheet is mid-edit. `null` then behaves exactly as a wall with no stored
 * state does — it records what it sees and animates nothing.
 */
export function currentChallenge(cohort: Cohort): number | null {
  const raw = (cohort.current_challenge ?? '').trim()
  if (raw === '') return null
  const value = Number(raw)
  return Number.isInteger(value) && value >= 1 ? value : null
}

/** An ISO instant must carry `Z` or an explicit ±HH:MM offset. See `cohortInstant`. */
const ABSOLUTE_INSTANT = /(?:Z|[+-]\d{2}:\d{2})$/

/**
 * An absolute instant from a `TV_Cohort` cell, or `null`.
 *
 * **The offset is mandatory.** `new Date('2026-08-18T00:00:00')` — no offset —
 * is parsed in the *browser's* timezone, so a laptop set to anything but IST
 * computes a different instant and looks completely healthy doing it. Requiring
 * `+05:30` is what makes every figure derived from these cells a difference
 * between two absolute instants, correct on any machine whose clock is right —
 * and it is why `lib/challenge.ts` needs no timezone arithmetic at all.
 *
 * One rule in one place, for both the Flea and the challenge window. Two copies
 * is how one of them quietly stops enforcing it.
 */
export function cohortInstant(cohort: Cohort, key: string): Date | null {
  const raw = (cohort[key] ?? '').trim()
  if (!ABSOLUTE_INSTANT.test(raw)) return null
  const at = new Date(raw)
  return Number.isFinite(at.getTime()) ? at : null
}

/**
 * When the Mesa Flea opens, or `null` if the sheet has not said.
 *
 * The offset requirement lives in `cohortInstant`, which this delegates to
 * rather than repeating — see there for why it is mandatory.
 *
 * `null` renders as no countdown at all. The opening time is still unconfirmed
 * and lives in one cell now; a wall showing nothing there is a legible state,
 * and a guessed date is not.
 */
export function fleaInstant(cohort: Cohort): Date | null {
  return cohortInstant(cohort, 'flea_datetime_iso')
}

/** The only thing that ever produces a `Snapshot`, from cache and network alike. */
export function parseSnapshot(raw: CsvCache): Snapshot {
  return { teams: parseTeams(raw.feedCsv), cohort: parseCohort(raw.cohortCsv) }
}

/**
 * **Short, not exact.**
 *
 * The master itself is never readable in a torn state — the consolidator builds
 * in memory and writes under `LockService`. What this guards is narrower: a full
 * rebuild does `clearContent` then `setValues`, and Google's CSV export can
 * re-read the sheet inside that window. The export that comes back is short.
 *
 * A short feed is the one input that can put nonsense on the wall without any
 * error anywhere — teams vanish, ranks reshuffle around the hole, and the
 * animations treat all of it as news. So a fetch carrying fewer than the
 * competing cohort is rejected whole, and the last good data stays on screen.
 *
 * An exact `=== 42` check would instead freeze every wall the day a 43rd
 * workbook is added: permanently, silently, with no spinner and no error state
 * to notice. A short export cannot *add* rows, so short-checking is both
 * strictly correct and strictly safer. The admin dashboard's gate reasons the
 * same way.
 */
export function passesRowGate(teams: readonly Team[]): boolean {
  return teams.length >= MIN_TEAM_ROWS
}

/**
 * Fetches both CSVs as one unit and returns the raw text.
 *
 * Raw, not parsed, because the caller caches exactly these bytes: keeping
 * `parseSnapshot` the single path from text to data means a field rename cannot
 * leave a shape-stale cached object yielding `undefined` with no error.
 *
 * `cache: 'no-store'` is load-bearing. This page can run for days without a
 * manual reload, and without it the browser HTTP cache would serve one body for
 * the life of the page — the wall would freeze with nothing logged anywhere.
 *
 * Note a revoked or re-published sheet answers with an HTML login page and
 * HTTP 200, so a status check passes it. The row gate is what catches that.
 */
export async function fetchCsv(signal?: AbortSignal): Promise<CsvCache> {
  if (FEED_CSV_URL === '' || COHORT_CSV_URL === '') {
    // Fail with the actual problem rather than letting `fetch('')` resolve
    // against the page's own URL and hand the parser an HTML document.
    throw new Error(
      'FEED_CSV_URL and COHORT_CSV_URL resolved empty. They default to the published URLs in config.ts, so this means those defaults were emptied — or NEXT_PUBLIC_FEED_CSV_URL / NEXT_PUBLIC_COHORT_CSV_URL are set to something that trims to nothing.',
    )
  }

  const [feedCsv, cohortCsv] = await Promise.all(
    [FEED_CSV_URL, COHORT_CSV_URL].map(async (url) => {
      const response = await fetch(url, { cache: 'no-store', signal })
      if (!response.ok) throw new Error(`TV feed fetch failed: ${response.status} ${url}`)
      return response.text()
    }),
  )
  return { feedCsv, cohortCsv }
}
