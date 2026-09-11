import { describe, expect, it } from 'vitest'

import { biggestMover } from '@/lib/climber'
import { rankTeams } from '@/lib/ranking'
import { team } from '@/test/fixtures'

/**
 * The ₹0 rule is the reason this file exists.
 *
 * Everything else here is ordinary coverage; the third test is the one that
 * stops a future simplification turning the panel back into a machine for
 * celebrating whoever made their first sale this morning.
 */

const board = (...teams: Parameters<typeof team>[0][]) => rankTeams(teams.map(team))

describe('biggestMover', () => {
  it('finds the largest climb among teams that have banked something', () => {
    const ranked = board(
      { teamId: 'VBC101', ventureName: 'Alpha', totalRevenue: 90_000, weekRevenue: 1_000 },
      // Up from 17th to 2nd: fifteen places, the largest here.
      { teamId: 'VBC102', ventureName: 'Bravo', totalRevenue: 80_000, weekRevenue: 18_400, prevWeekRank: 17 },
      { teamId: 'VBC103', ventureName: 'Cadet', totalRevenue: 70_000, weekRevenue: 500, prevWeekRank: 4 },
    )
    expect(biggestMover(ranked)).toMatchObject({
      kind: 'climb',
      fromRank: 17,
      toRank: 2,
      gained: 15,
      weekRevenue: 18_400,
    })
  })

  it('does not count passing teams that have never traded', () => {
    // **The rule this module exists for.** Delta has just logged its first ₹500
    // and has leapt over three teams sitting on nothing. The sheet publishes no
    // `prev_week_rank` for it, because it had no standing at last week's close —
    // so it has no climb, and the panel falls back to the biggest week instead
    // of announcing a fifteen-place surge that did not happen.
    const ranked = board(
      { teamId: 'VBC101', ventureName: 'Alpha', totalRevenue: 90_000, weekRevenue: 2_000, prevWeekRank: 1 },
      { teamId: 'VBC104', ventureName: 'Delta', totalRevenue: 500, weekRevenue: 500 },
      { teamId: 'VBC105', ventureName: 'Echo', totalRevenue: 0, weekRevenue: 0, totalUnits: 3 },
      { teamId: 'VBC106', ventureName: 'Fox', totalRevenue: 0, weekRevenue: 0, totalUnits: 2 },
      { teamId: 'VBC107', ventureName: 'Golf', totalRevenue: 0, weekRevenue: 0, totalUnits: 1 },
    )
    const mover = biggestMover(ranked)
    expect(mover?.kind).toBe('earn')
    expect(mover?.team.ventureName).toBe('Alpha')
  })

  it('ignores a team that slipped, and one that held its place', () => {
    const ranked = board(
      { teamId: 'VBC101', ventureName: 'Alpha', totalRevenue: 90_000, weekRevenue: 400, prevWeekRank: 1 },
      { teamId: 'VBC102', ventureName: 'Bravo', totalRevenue: 80_000, weekRevenue: 900, prevWeekRank: 1 },
    )
    // Bravo is 2nd having been 1st: a fall, not a climb. Alpha held.
    expect(biggestMover(ranked)?.kind).toBe('earn')
  })

  it('breaks a tie on the bigger week rather than on sort order', () => {
    const ranked = board(
      { teamId: 'VBC101', ventureName: 'Alpha', totalRevenue: 90_000, weekRevenue: 1_000, prevWeekRank: 4 },
      { teamId: 'VBC102', ventureName: 'Bravo', totalRevenue: 80_000, weekRevenue: 9_000, prevWeekRank: 5 },
    )
    // Both up three. Bravo had the bigger week, and comes second in sort order —
    // so a naive "first match wins" would pick Alpha.
    expect(biggestMover(ranked)).toMatchObject({ gained: 3, weekRevenue: 9_000 })
  })

  it('falls back to the biggest week when the sheet publishes no previous rank', () => {
    // The state the wall runs in until `prev_week_rank` exists.
    const ranked = board(
      { teamId: 'VBC101', ventureName: 'Alpha', totalRevenue: 90_000, weekRevenue: 1_000 },
      { teamId: 'VBC102', ventureName: 'Bravo', totalRevenue: 80_000, weekRevenue: 18_400 },
    )
    expect(biggestMover(ranked)).toMatchObject({ kind: 'earn', toRank: 2, weekRevenue: 18_400 })
  })

  it('returns nothing at all when nobody has traded this week', () => {
    const ranked = board(
      { teamId: 'VBC101', ventureName: 'Alpha', totalRevenue: 90_000, weekRevenue: 0, prevWeekRank: 2 },
      { teamId: 'VBC102', ventureName: 'Bravo', totalRevenue: 80_000, weekRevenue: 0 },
    )
    // Alpha climbed one, so this is still a climb — the week being quiet does
    // not erase last week's movement.
    expect(biggestMover(ranked)?.kind).toBe('climb')
    // With nothing to report at all, the caller gets null and draws a dash.
    expect(biggestMover([])).toBeNull()
  })
})
