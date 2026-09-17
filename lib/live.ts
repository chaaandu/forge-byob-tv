import { boardEarned, rankForMode } from '@/lib/board'
import { competingTeams, rankByToday, rankTeams } from '@/lib/ranking'
import { hashTeamId } from '@/lib/seed'
import type { BoardMode, Team, TeamId } from '@/lib/types'

/**
 * Everything `/live` knows that is not a pixel. Pure: no clock, no storage, no
 * DOM — `live.test.ts` scans for them, the way `ranking.test.ts` does.
 *
 * ── `/live` is a reader of the wall's rules, not a second copy of them ──
 *
 * The phone shows three boards and **two of them are the wall's own**: the
 * all-time board ranks with `rankTeams`, which is `/podium`'s comparator, and
 * the period board ranks with `rankForMode`, which is `/weekly`'s — including
 * `challenge_mode` deciding whether that is the week or the challenge. A phone
 * that disagreed with the TV in the corridor about who is fourth would be worse
 * than no phone.
 *
 * The third, today, is new, and its comparator (`compareToday`) lives in
 * `lib/ranking.ts` beside the others for the same reason they do.
 */

export type BoardKey = 'all' | 'period' | 'today'

export const BOARD_KEYS: readonly BoardKey[] = ['all', 'period', 'today']

export type Standing = {
  team: Team
  /** 1-based. Every comparator is a total order, so a rank is just a position. */
  rank: number
  /** The figure this board ranks on. */
  figure: number
}

export function figureOf(key: BoardKey, mode: BoardMode, team: Team): number {
  if (key === 'all') return team.totalRevenue
  if (key === 'today') return team.todayRevenue
  return boardEarned(mode, team)
}

/** One board, ranked, spares removed. */
export function standingsFor(key: BoardKey, mode: BoardMode, teams: readonly Team[]): Standing[] {
  const competing = competingTeams(teams)
  const ranked =
    key === 'all'
      ? rankTeams(competing)
      : key === 'today'
        ? rankByToday(competing)
        : rankForMode(mode, competing)
  return ranked.map((team, index) => ({ team, rank: index + 1, figure: figureOf(key, mode, team) }))
}

/** The tab's label. Short, because three of them share a phone's width. */
export function boardLabel(key: BoardKey, mode: BoardMode): string {
  if (key === 'all') return 'All-time'
  if (key === 'today') return 'Today'
  return mode === 'challenge' ? '10-Day' : 'This week'
}

/** What the figure on this board is, in words, for the team sheet. */
export function figureLabel(key: BoardKey, mode: BoardMode): string {
  if (key === 'all') return 'All-time revenue'
  if (key === 'today') return 'Revenue today'
  return mode === 'challenge' ? '10-Day Challenge revenue' : 'Revenue this week'
}

/**
 * An avalanche step before the modulus.
 *
 * Every id is `VBC1` plus two digits, and `hashTeamId` is a polynomial hash, so
 * its low bits are decided almost entirely by the last two characters — `% 12`
 * straight off it bunches. `lib/seed.ts` records the same trap for `% 3`.
 */
function mix(value: number): number {
  let h = value
  h ^= h >>> 16
  h = Math.imul(h, 0x85ebca6b)
  h ^= h >>> 13
  h = Math.imul(h, 0xc2b2ae35)
  h ^= h >>> 16
  return h >>> 0
}

export const LIVERY_COUNT = 12
export const EMBLEM_COUNT = 12

/** 1–12, matching `--lv-N-*` in `forge-tokens.css` §8. Keyed by id, so a climb never recolours a team. */
export function liveryFor(teamId: TeamId): number {
  return (mix(hashTeamId(teamId)) % LIVERY_COUNT) + 1
}

/**
 * 0–11. Drawn from different bits than the livery, so two teams sharing a
 * colour — as F1 teammates do — are still told apart by their mark.
 */
export function emblemFor(teamId: TeamId): number {
  return (mix(hashTeamId(teamId)) >>> 8) % EMBLEM_COUNT
}

export type Race = {
  self: Standing
  leader: Standing
  /** The team one place up, or `undefined` for the leader. */
  ahead?: Standing
  /** The team one place down, or `undefined` for last. */
  behind?: Standing
  total: number
}

/** Where a team is on one board, and who is either side of it. `null` if it is not on the board. */
export function raceFor(standings: readonly Standing[], teamId: TeamId): Race | null {
  const at = standings.findIndex((s) => s.team.teamId === teamId)
  if (at === -1) return null
  return {
    self: standings[at]!,
    leader: standings[0]!,
    ahead: standings[at - 1],
    behind: standings[at + 1],
    total: standings.length,
  }
}

/**
 * Places gained since last week's close, on the all-time board only.
 *
 * `prev_week_rank` ranks the cumulative figure, so it can only be compared
 * with the all-time rank — against the week or today it would be comparing
 * two different contests. `null` when the sheet does not publish it, or the
 * team had no standing then (see `Team.prevWeekRank`).
 */
export function climbOf(key: BoardKey, standing: Standing): number | null {
  if (key !== 'all' || standing.team.prevWeekRank === undefined) return null
  return standing.team.prevWeekRank - standing.rank
}

/** Revenue per unit, or `null` before the first unit — a ₹0 average is not a price. */
export function avgTicket(team: Team): number | null {
  return team.totalUnits > 0 ? team.totalRevenue / team.totalUnits : null
}

/** This team's slice of the whole board's figure, 0–1, or `null` when the board is empty. */
export function shareOf(standings: readonly Standing[], teamId: TeamId): number | null {
  const total = standings.reduce((sum, s) => sum + Math.max(0, s.figure), 0)
  if (total <= 0) return null
  const self = standings.find((s) => s.team.teamId === teamId)
  return self === undefined ? null : Math.max(0, self.figure) / total
}

/** Case- and accent-insensitive search over venture name and team id. */
export function matchesQuery(team: Team, query: string): boolean {
  const fold = (text: string) =>
    text
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .toLowerCase()
  const needle = fold(query.trim())
  if (needle === '') return true
  return fold(team.ventureName).includes(needle) || fold(team.teamId).includes(needle)
}
