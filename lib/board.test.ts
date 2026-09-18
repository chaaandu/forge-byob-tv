import { describe, expect, it } from 'vitest'

import { boardEarned, boardHeading, boardMode, boardScope, rankForMode } from '@/lib/board'
import type { DailyWindow } from '@/lib/daily'
import { team } from '@/test/fixtures'

/**
 * `challenge_mode`, the one cell that decides which contest `/daily` shows.
 *
 * Every assertion here is about a *silent* failure. Nothing in this module can
 * throw, and every wrong answer it could give renders a complete, plausible
 * board — which is why the reading of a single sheet cell earns this much test.
 */
describe('boardMode', () => {
  it('is challenge only when the cell says so', () => {
    expect(boardMode({ challenge_mode: 'Yes' })).toBe('challenge')
    expect(boardMode({ challenge_mode: 'No' })).toBe('daily')
  })

  /** Typed by hand into a spreadsheet, so the casing and the spaces drift. */
  it('does not care about case or surrounding space', () => {
    for (const raw of ['yes', 'YES', 'Yes ', '  yes  ', 'Y', 'y']) {
      expect(boardMode({ challenge_mode: raw })).toBe('challenge')
    }
  })

  /** A checkbox cell publishes as `TRUE`, and nobody should have to know that. */
  it('accepts a checkbox', () => {
    expect(boardMode({ challenge_mode: 'TRUE' })).toBe('challenge')
    expect(boardMode({ challenge_mode: 'FALSE' })).toBe('daily')
  })

  /**
   * **The asymmetry is the safety**, and it survived the figure changing under
   * it. Guessing wrong towards daily puts a true, ranked, finished day on the
   * board under a heading that says so, and self-corrects the moment the cell is
   * fixed. Guessing wrong towards challenge puts ₹0 on thirty-nine cards under
   * the name of a contest that is not running, and nothing recovers it.
   */
  it('falls to daily on blank, missing or misspelt', () => {
    expect(boardMode({})).toBe('daily')
    expect(boardMode({ challenge_mode: '' })).toBe('daily')
    expect(boardMode({ challenge_mode: '   ' })).toBe('daily')
    expect(boardMode({ challenge_mode: 'Yse' })).toBe('daily')
    expect(boardMode({ challenge_mode: 'maybe' })).toBe('daily')
  })
})

const day: DailyWindow = {
  opened: '2026-09-17',
  closed: '2026-09-18',
  earned: { VBC101: 1_998, VBC102: 0, VBC103: 6_167 },
}

/**
 * The figure and the sort are one decision, taken twice. A board that orders by
 * one revenue and prints the other turns every rank on it into a visible lie,
 * and nothing anywhere reports it — so they are pinned to each other rather
 * than each pinned to a literal.
 */
describe('the figure and the comparator agree', () => {
  const rows = [
    team({ teamId: 'VBC101', challengeRevenue: 100, totalRevenue: 90_000 }),
    team({ teamId: 'VBC102', challengeRevenue: 9_000, totalRevenue: 50_000 }),
    team({ teamId: 'VBC103', challengeRevenue: 4_000, totalRevenue: 70_000 }),
  ]

  it.each(['challenge', 'daily'] as const)('prints a descending board in %s mode', (mode) => {
    const figures = rankForMode(mode, rows, day).map((row) => boardEarned(mode, row, day))
    expect(figures).toEqual([...figures].sort((a, b) => b - a))
  })

  it('puts a different team first in each mode', () => {
    expect(rankForMode('challenge', rows, day)[0].teamId).toBe('VBC102')
    expect(rankForMode('daily', rows, day)[0].teamId).toBe('VBC103')
  })

  /** A team below its baseline sorts below one that simply has not traded, and
      its card says so. Nothing is clamped, here or at the card. */
  it('keeps a negative negative', () => {
    const short = team({ teamId: 'VBC104', challengeRevenue: -3_850 })
    expect(boardEarned('challenge', short, day)).toBe(-3_850)
    expect(
      rankForMode('challenge', [short, team({ teamId: 'VBC105' })], day)[1].teamId,
    ).toBe('VBC104')

    const below: DailyWindow = { ...day, earned: { VBC104: -3_850, VBC105: 0 } }
    expect(boardEarned('daily', short, below)).toBe(-3_850)
    expect(
      rankForMode('daily', [short, team({ teamId: 'VBC105' })], below)[1].teamId,
    ).toBe('VBC104')
  })

  /**
   * **The daily figure is not on the row**, so this is the one mode where the
   * card could be handed a figure the board never sorted on. `boardEarned` and
   * `rankForMode` are given the same window by construction; this pins that
   * reading the row instead would be visibly different.
   */
  it('reads the daily figure off the window, never off the team', () => {
    const rich = team({ teamId: 'VBC101', totalRevenue: 90_000, weekRevenue: 88_000 })
    expect(boardEarned('daily', rich, day)).toBe(1_998)
  })

  /**
   * The cold start: a wall with fewer than two marks. Every card prints ₹0 and
   * the order falls to all-time, which is the standing a passer-by already has
   * in their head rather than an order nobody chose.
   */
  it('prints zero and falls back to all-time with no window at all', () => {
    expect(boardEarned('daily', rows[0], null)).toBe(0)
    expect(rankForMode('daily', rows, null).map((row) => row.teamId)).toEqual([
      'VBC101',
      'VBC103',
      'VBC102',
    ])
  })

  /** A team the window never saw is ₹0 rather than its whole all-time total. */
  it('prints zero for a team the window cannot measure', () => {
    expect(boardEarned('daily', team({ teamId: 'VBC140', totalRevenue: 250_000 }), day)).toBe(0)
  })
})

describe('boardHeading', () => {
  it('names the contest the figures belong to', () => {
    expect(boardHeading('challenge')).toBe('10-Day Challenge')
    expect(boardHeading('daily')).toBe('Daily Leaderboard')
  })
})

/**
 * The board is **locked** — its figures stopped at ten this morning and do not
 * move for twenty-four hours — so the masthead is the only thing on the frame
 * that can say which day it is locked on. Every previous board on this wall was
 * live, which is why every previous caption was removed and this one is not.
 */
describe('boardScope', () => {
  it('names the window the figures cover', () => {
    expect(boardScope('daily', day)).toBe('17 Sep → 18 Sep, 10am')
  })

  /**
   * The one visible sign of a window having widened. A laptop that slept
   * through ten o'clock takes its mark late, the figures stay true, and the
   * board goes on calling whatever it is holding a day.
   */
  it('shows a widened window as the two dates it actually spans', () => {
    expect(boardScope('daily', { ...day, opened: '2026-09-16' })).toBe('16 Sep → 18 Sep, 10am')
  })

  it('crosses a month without a stray zero', () => {
    expect(boardScope('daily', { opened: '2026-09-30', closed: '2026-10-01', earned: {} })).toBe(
      '30 Sep → 1 Oct, 10am',
    )
  })

  /**
   * Nothing before there is a window — the same rule the `as_of` stamp had, for
   * the same reason: a provenance line with no figures beside it states the
   * provenance of nothing. And nothing in challenge mode, whose board is live
   * and whose day chip already binds its window.
   */
  it('says nothing when there is nothing to say', () => {
    expect(boardScope('daily', null)).toBeUndefined()
    expect(boardScope('challenge', day)).toBeUndefined()
  })
})
