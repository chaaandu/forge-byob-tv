import { describe, expect, it } from 'vitest'

import { boardEarned, boardHeading, boardMode, rankForMode } from '@/lib/board'
import { team } from '@/test/fixtures'

/**
 * `challenge_mode`, the one cell that decides which contest `/weekly` shows.
 *
 * Every assertion here is about a *silent* failure. Nothing in this module can
 * throw, and every wrong answer it could give renders a complete, plausible
 * board — which is why the reading of a single sheet cell earns this much test.
 */
describe('boardMode', () => {
  it('is challenge only when the cell says so', () => {
    expect(boardMode({ challenge_mode: 'Yes' })).toBe('challenge')
    expect(boardMode({ challenge_mode: 'No' })).toBe('week')
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
    expect(boardMode({ challenge_mode: 'FALSE' })).toBe('week')
  })

  /**
   * **The asymmetry is the safety.** Week revenue is a required column and
   * always holds real figures; `challenge_revenue` is optional and, between
   * challenges, holds whatever the consolidator last left there. So every
   * unreadable answer resolves to week — true numbers under an honest heading —
   * rather than to ₹0 on thirty-nine cards, which renders perfectly and would
   * run for weeks.
   */
  it('falls to week on blank, missing or misspelt', () => {
    expect(boardMode({})).toBe('week')
    expect(boardMode({ challenge_mode: '' })).toBe('week')
    expect(boardMode({ challenge_mode: '   ' })).toBe('week')
    expect(boardMode({ challenge_mode: 'Yse' })).toBe('week')
    expect(boardMode({ challenge_mode: 'maybe' })).toBe('week')
  })
})

/**
 * The figure and the sort are one decision, taken twice. A board that orders by
 * one revenue and prints the other turns every rank on it into a visible lie,
 * and nothing anywhere reports it — so they are pinned to each other rather
 * than each pinned to a literal.
 */
describe('the figure and the comparator agree', () => {
  const rows = [
    team({ teamId: 'VBC101', challengeRevenue: 100, weekRevenue: 90_000 }),
    team({ teamId: 'VBC102', challengeRevenue: 9_000, weekRevenue: 0 }),
    team({ teamId: 'VBC103', challengeRevenue: 4_000, weekRevenue: 12_000 }),
  ]

  it.each(['challenge', 'week'] as const)('prints a descending board in %s mode', (mode) => {
    const figures = rankForMode(mode, rows).map((row) => boardEarned(mode, row))
    expect(figures).toEqual([...figures].sort((a, b) => b - a))
  })

  it('puts a different team first in each mode', () => {
    expect(rankForMode('challenge', rows)[0].teamId).toBe('VBC102')
    expect(rankForMode('week', rows)[0].teamId).toBe('VBC101')
  })

  /** A team below its baseline sorts below one that simply has not traded, and
      its card says so. Nothing is clamped, here or at the card. */
  it('keeps a negative negative', () => {
    const short = team({ teamId: 'VBC104', challengeRevenue: -3_850 })
    expect(boardEarned('challenge', short)).toBe(-3_850)
    expect(rankForMode('challenge', [short, team({ teamId: 'VBC105' })])[1].teamId).toBe('VBC104')
  })
})

describe('boardHeading', () => {
  it('names the contest the figures belong to', () => {
    expect(boardHeading('challenge')).toBe('10-Day Challenge')
    expect(boardHeading('week')).toBe('Weekly Leaderboard')
  })
})
