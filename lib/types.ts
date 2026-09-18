/**
 * Shared types for the wall.
 *
 * Everything lives here so `feed`, `ranking`, `storage` and the animation
 * modules never import each other merely to borrow a type, and therefore cannot
 * form an import cycle. This file holds no logic.
 */

export type TeamId = string

/**
 * One row of `TV_Feed`. Six columns; nothing else is published per team.
 *
 * All three revenue figures are **logged (proof-backed)** revenue — `Daily Dump`
 * column N filtered to `Type = "Sale"` — differing only in their date window.
 * One definition across the whole system, so two figures on the same row can
 * never quietly disagree.
 */
export type Team = {
  teamId: TeamId
  /** Empty string for a workbook with no venture name filled in yet. */
  ventureName: string
  /** All-time. Ranks `/podium`, and breaks ties everywhere else. */
  totalRevenue: number
  /**
   * Since Monday 00:00 IST. **Ranks no slide.** It ranked `/daily` until the
   * challenge took that board, and again between challenges until the daily
   * window replaced it; `/live`'s week tab is its only reader now. Still
   * required, still correct, and the fallback nothing falls back to.
   */
  weekRevenue: number
  /**
   * Today, IST — live, from midnight, not from the daily window's ten o'clock.
   *
   * **Never a sort key on the wall, and never a figure on it either.** It is
   * what `/daily`'s chevrons are driven by: a card wearing them has sold since
   * the board's window closed, which is the only live thing on a locked board.
   * The figure beside them went with the fold. `/live` prints it and ranks its
   * today tab on it.
   */
  todayRevenue: number
  /** First tie-break for absolute ranking only. */
  totalUnits: number
  /**
   * Revenue banked since the current challenge's baseline was photographed —
   * `total_revenue` minus a frozen snapshot of itself, computed in the sheet.
   *
   * **Ranks `/daily` while `challenge_mode` is `Yes`.** The rest of the time
   * that board ranks a daily window this project computes itself — see
   * `lib/daily.ts`, which uses precisely the trick described below, for
   * precisely the reason described below. `/podium` is unaffected.
   *
   * ── Why the sheet subtracts rather than sums a date range ──
   *
   * `Daily Team Summary` col B is cumulative, and `Daily Dump`'s date column is
   * empty on 99.4% of sale rows, so there is no windowed figure to read
   * anywhere in `BYOB_MASTER`. Photographing the running total when the window
   * opens and subtracting it is the only thing that can work.
   *
   * **Legitimately negative.** A baseline is a photograph of a *proof-gated*
   * figure, and proof can be revoked after the shutter closes: a sale logged
   * before the baseline that later has its proof set to `No` shrinks the
   * all-time total while the photograph still shows the larger number. Three
   * teams were in this state on 19 August. Nothing clamps it — the comparator
   * sorts the true value and the card prints it, so a team that went backwards
   * says so from the bottom of the board.
   *
   * `0` when the sheet has not published the column — read optionally, like
   * `prevWeekRank`, so the wall works before the column exists.
   */
  challengeRevenue: number
  /**
   * This team's rank at the close of last week, **among teams that had banked
   * something by then**, or `undefined`.
   *
   * Published by the sheet as `prev_week_rank`; read optionally, so the wall
   * works before the column exists and picks it up when it lands.
   *
   * ── The two rules that make this figure mean anything ──
   *
   * **It ranks cumulative revenue, not last week's.** Ranking a weekly figure
   * against the cumulative one the board uses compares two different things and
   * the difference between them is not a climb. Recorded as finding #4 in
   * docs/DESIGN.md.
   *
   * **It is `undefined` for a team that had ₹0 at last week's close.** Teams on
   * zero are separated only by the tie-break, so a team logging its first sale
   * would otherwise appear to climb fifteen places on ₹500 — noise wearing a
   * climb's clothes. A team with no standing to improve on did not improve on
   * it. (It fed `biggestMover` in lib/climber.ts, which left the wall with the
   * footer line; the field is still published and still read by the cards.)
   */
  prevWeekRank?: number
  /**
   * What the venture sells, in its own words — `Team Links` col F, published
   * as a `product` column in `TV_Feed`.
   *
   * **Read optionally, like `challengeRevenue` and `prevWeekRank`**, and
   * deliberately not in `FEED_HEADERS`: the sheet does not publish it today,
   * and a required column that does not exist throws away every fetch. The
   * moment the column lands, `/live` starts showing it with no deploy.
   *
   * Read by `/live` only. Neither slide prints it — a venture's product is a
   * sentence, and the wall is figures at six metres.
   */
  product?: string
  /**
   * The venture's own Instagram handle and website, published as `instagram`
   * and `website` columns in `TV_Feed`.
   *
   * **Optional, like `product`**, and stored as the sheet typed them: a
   * handle, an `@handle`, a full profile URL, a bare domain. Turning one into
   * something a browser may open is `instagramUrl` / `websiteUrl` in
   * `lib/live.ts`, which is also where anything that is not plainly `http(s)`
   * is refused — a cell in a spreadsheet forty people can edit is untrusted
   * input, and `javascript:` in an `href` is the one way this page could do
   * something worse than look wrong.
   *
   * Read by `/live` only.
   */
  instagram?: string
  website?: string
  /**
   * The team's students, as one cell — `Team Links` col D, published as a
   * `members` column in `TV_Feed`.
   *
   * Kept verbatim, because the sheet writes it five ways: `A, B, C`, `A, B and
   * C`, ALL CAPS, lowercase, with trailing full stops and double spaces.
   * Splitting and casing it is `membersOf` in `lib/live.ts`.
   */
  members?: string
}

/**
 * `TV_Cohort` as a flat key/value map.
 *
 * Deliberately not a typed struct: every value arrives as a string and may
 * legitimately be empty, and a struct would invite treating a missing key and
 * an empty value as the same thing. They are not — an empty value means the
 * sheet does not know yet, which is normal and renders as nothing, while a
 * missing key means the sheet's shape has drifted, which throws.
 *
 * Read it through `openWeek` and `fleaInstant` in `lib/feed.ts` rather than
 * indexing it directly; those are where a string becomes a checked value.
 */
export type Cohort = Readonly<Record<string, string>>

/**
 * Which contest `/daily` is showing. Set by `challenge_mode` in `TV_Cohort`;
 * everything that follows from it lives in `lib/board.ts`.
 *
 * **`week` is gone and `daily` is what replaced it.** The board's ordinary state
 * is now a finished day — 10:00 to 10:00, computed on the laptop by
 * `lib/daily.ts` — rather than the open programme week. `weekRevenue` is still
 * published and still correct, and `/live` still ranks a board on it; no slide
 * does.
 */
export type BoardMode = 'challenge' | 'daily'

/**
 * Both CSVs, parsed together, and always constructed as a unit.
 *
 * `current_open_week` is what tells the wall a week rolled over and the weekly
 * board reset to zero — the moment it must *not* animate. Pairing it with a
 * stale feed, or the reverse, would either animate that reset or suppress a real
 * week of overtakes.
 */
export type Snapshot = {
  teams: readonly Team[]
  cohort: Cohort
}

/** Raw CSV text, cached verbatim so `parseSnapshot` is the only thing that ever builds a Snapshot. */
export type CsvCache = {
  feedCsv: string
  cohortCsv: string
}

/**
 * A rank changing hands: the one thing on this wall that animates.
 *
 * Carries both ventures' names rather than just their ids, so the animation
 * never has to look a team up in a snapshot that may have moved on since the
 * event was queued.
 */
export type OvertakeEvent = {
  /** `week:attacker:toRank`. Stable, so the same overtake seen twice replaces itself. */
  id: string
  attacker: TeamId
  attackerName: string
  defender: TeamId
  defenderName: string
  fromRank: number
  toRank: number
}

/**
 * What the wall last saw a board look like.
 *
 * `week` is stored beside the ranks because a new challenge week zeroes every
 * team's week revenue at once. Without it the board would reshuffle completely
 * on Monday at 00:00 IST and every one of those shifts would read as an
 * overtake — forty boot kicks celebrating a reset.
 */
export type BoardState = {
  week: number | null
  ranks: Readonly<Record<TeamId, number>>
  /**
   * The figure the board ranks on, per team, as it stood.
   *
   * Stored alongside the ranks because a rank can improve without the team doing
   * anything — when the team above it falls, everyone below rises a place. Ranks
   * alone cannot tell that apart from a climb.
   */
  earned: Readonly<Record<TeamId, number>>
}
