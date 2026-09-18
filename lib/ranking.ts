import { SPARE_TEAM_IDS } from '@/config'
import type { Team, TeamId } from '@/lib/types'

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

/**
 * `/weekly`'s standing: the daily window desc → **all-time** revenue desc →
 * team ID asc.
 *
 * ── The only comparator here that is handed its first key ──
 *
 * Every other one reads a field off the `Team`, because every other figure on
 * this wall is a column in `TV_Feed`. The daily window is not: it is the
 * difference between two photographs of `total_revenue` taken by the laptop at
 * ten o'clock, so it lives in a map keyed by team id rather than on the row —
 * see `lib/daily.ts` for why the sheet cannot supply it.
 *
 * **A factory rather than a `Team` carrying an extra field.** Writing the
 * window's figure onto each row would make a `Team` mean "a row of `TV_Feed`,
 * plus something this machine worked out", and the day one of those is cached,
 * persisted or compared against a fresh fetch, the two would be
 * indistinguishable. The map is passed in and stays outside the row.
 *
 * All-time revenue is the second key for the reason `compareWeek` gives, and the
 * reason is at its strongest here: this board's first key is **₹0 for every team
 * a wall has just been plugged in at**, because a window needs two marks, and it
 * is ₹0 for most teams on any quiet day. Falling back to the standing the wall
 * showed yesterday is the reading a passer-by already has in their head.
 * Ordering thirty-five zeroes by team ID would look arbitrary and would make
 * `/weekly` disagree with `/podium` for no reason anyone could see.
 *
 * **A total order, like every comparator in this file** — and the `?? 0` is part
 * of what makes it one. A team the window cannot measure compares equal to a
 * team that earned nothing, and is then separated by all-time revenue, so it
 * holds one stable position rather than floating.
 */
export function compareDaily(earned: Readonly<Record<TeamId, number>>) {
  return (a: Team, b: Team): number => {
    const ea = earned[a.teamId] ?? 0
    const eb = earned[b.teamId] ?? 0
    if (eb !== ea) return eb - ea
    if (b.totalRevenue !== a.totalRevenue) return b.totalRevenue - a.totalRevenue
    return a.teamId.localeCompare(b.teamId)
  }
}

export function rankByDaily(
  teams: readonly Team[],
  earned: Readonly<Record<TeamId, number>>,
): Team[] {
  return [...teams].sort(compareDaily(earned))
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
