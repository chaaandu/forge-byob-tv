import { SPARE_TEAM_IDS } from '@/config'
import type { Team } from '@/lib/types'

/**
 * Ordering, and who is in the running. Nothing else.
 *
 * **This module reads no clock, no storage, no network and no DOM.** Not by
 * convention — a source-scan test fails the build if `Date`, `Math.random`,
 * `localStorage`, `fetch`, `window` or `document` appear here. Ranking is a pure
 * function of a snapshot, and a rank that could vary with the machine it ran on
 * would fire boot kicks that no data change justifies.
 *
 * ── Every comparator here is a *total* order ──
 *
 * That is load-bearing, not tidiness. A rank change is what fires the kick, so
 * an order that can shuffle between two identical fetches is indistinguishable
 * from forty teams overtaking each other. Early in a week roughly thirty teams
 * sit on ₹0, and without a final tie-break their order is whatever the CSV row
 * order happened to be that minute.
 */

/**
 * Absolute standing: logged revenue desc → units desc → team ID asc.
 *
 * Identical to the admin dashboard's `compareTieBreak`, so the wall and the
 * dashboard can never disagree about who is ahead.
 */
export function compareTeams(a: Team, b: Team): number {
  if (b.totalRevenue !== a.totalRevenue) return b.totalRevenue - a.totalRevenue
  if (b.totalUnits !== a.totalUnits) return b.totalUnits - a.totalUnits
  return a.teamId.localeCompare(b.teamId)
}

/**
 * This week's standing: week revenue desc → **all-time** revenue desc → team ID asc.
 *
 * All-time revenue rather than units is the second key on purpose. Monday
 * morning has every team on ₹0 for the week, and falling back to the standing
 * the wall showed all of last week is the reading a passer-by already has in
 * their head. Ordering thirty zeroes by team ID would look arbitrary, and would
 * make the weekly board disagree with the podium for no reason anyone could see.
 */
export function compareWeek(a: Team, b: Team): number {
  if (b.weekRevenue !== a.weekRevenue) return b.weekRevenue - a.weekRevenue
  if (b.totalRevenue !== a.totalRevenue) return b.totalRevenue - a.totalRevenue
  return a.teamId.localeCompare(b.teamId)
}

/**
 * This challenge's standing: challenge revenue desc → **all-time** revenue desc
 * → team ID asc.
 *
 * All-time revenue is the second key for the reason `compareWeek` gives, and the
 * reason survives the change of first key intact: day one of a challenge has
 * every team on ₹0, and falling back to the standing the wall showed all of last
 * fortnight is the reading a passer-by already has in their head. Ordering forty
 * zeroes by team ID would look arbitrary, and would make `/weekly` disagree with
 * `/podium` for no reason anyone could see.
 *
 * **A total order, like every comparator in this file.** On the morning a
 * challenge opens, forty teams sit on ₹0 — and an order that can shuffle between
 * two identical fetches is indistinguishable from forty teams overtaking each
 * other.
 *
 * **Sorts the true value, including a negative one.** A team below its baseline
 * belongs beneath a team that has simply not traded, and its card prints the
 * negative rather than hiding it. Nothing is clamped, here or at the card —
 * clamping either would collapse the two into a tie.
 */
export function compareChallenge(a: Team, b: Team): number {
  if (b.challengeRevenue !== a.challengeRevenue) return b.challengeRevenue - a.challengeRevenue
  if (b.totalRevenue !== a.totalRevenue) return b.totalRevenue - a.totalRevenue
  return a.teamId.localeCompare(b.teamId)
}

/**
 * Today's standing: today's revenue desc → all-time desc → team ID asc.
 *
 * Read only by `/live`. All-time second for the reason `compareWeek` gives: at
 * nine in the morning every team is on zero, and the order a reader already
 * has in their head is the all-time one.
 */
export function compareToday(a: Team, b: Team): number {
  if (b.todayRevenue !== a.todayRevenue) return b.todayRevenue - a.todayRevenue
  if (b.totalRevenue !== a.totalRevenue) return b.totalRevenue - a.totalRevenue
  return a.teamId.localeCompare(b.teamId)
}

export function rankTeams(teams: readonly Team[]): Team[] {
  return [...teams].sort(compareTeams)
}

export function rankByWeek(teams: readonly Team[]): Team[] {
  return [...teams].sort(compareWeek)
}

export function rankByToday(teams: readonly Team[]): Team[] {
  return [...teams].sort(compareToday)
}

export function rankByChallenge(teams: readonly Team[]): Team[] {
  return [...teams].sort(compareChallenge)
}

/**
 * The forty teams actually competing.
 *
 * `TV_Feed` publishes all 42 workbooks because it reads `Team Links`, and the
 * two spares would otherwise take up two of the eighty slots on the weekly board
 * while never trading. Filtered here rather than in `feed.ts` so the row gate
 * still counts what the sheet published: the gate's job is "did we get a whole
 * fetch", which is a question about the sheet, not about the cohort.
 */
export function competingTeams(teams: readonly Team[]): Team[] {
  return teams.filter((team) => !SPARE_TEAM_IDS.includes(team.teamId))
}
