import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import {
  compareChallenge,
  compareTeams,
  compareWeek,
  competingTeams,
  rankByChallenge,
  rankByWeek,
  rankTeams,
} from '@/lib/ranking'
import { SPARE_TEAM_IDS } from '@/config'
import { COMPETING_SIZE, teams } from '@/test/fixtures'

describe('rankTeams', () => {
  it('orders by revenue, then units, then team id', () => {
    const ranked = rankTeams(
      teams([
        { teamId: 'VBC103', totalRevenue: 50_000, totalUnits: 10 },
        { teamId: 'VBC101', totalRevenue: 50_000, totalUnits: 25 },
        { teamId: 'VBC102', totalRevenue: 90_000 },
      ]),
    )
    expect(ranked.slice(0, 3).map((team) => team.teamId)).toEqual([
      'VBC102',
      'VBC101',
      'VBC103',
    ])
  })

  it('does not mutate its input', () => {
    const input = teams([{ teamId: 'VBC141', totalRevenue: 1 }])
    rankTeams(input)
    expect(input[0].teamId).toBe('VBC101')
  })
})

describe('rankByWeek', () => {
  it('orders by week revenue, then all-time revenue, then team id', () => {
    const ranked = rankByWeek(
      teams([
        { teamId: 'VBC101', weekRevenue: 4_000, totalRevenue: 10_000 },
        { teamId: 'VBC102', weekRevenue: 9_000, totalRevenue: 9_000 },
        { teamId: 'VBC103', weekRevenue: 4_000, totalRevenue: 80_000 },
      ]),
    )
    expect(ranked.slice(0, 3).map((team) => team.teamId)).toEqual([
      'VBC102',
      'VBC103',
      'VBC101',
    ])
  })

  /**
   * Monday morning: every team on ₹0 for the week. The order still has to be
   * *the same* order on the next fetch, or the board reshuffles for no reason
   * and every shuffle reads as an overtake.
   */
  it('is total when the whole cohort is on zero for the week', () => {
    const monday = teams().map((team, index) => ({ ...team, totalRevenue: 1_000 * (42 - index) }))
    const once = rankByWeek(monday).map((team) => team.teamId)
    const again = rankByWeek([...monday].reverse()).map((team) => team.teamId)
    expect(again).toEqual(once)
    // and it falls back to the standing the wall showed all last week
    expect(once[0]).toBe('VBC101')
  })

  it('never returns 0 for two different teams', () => {
    const [a, b] = teams()
    expect(compareWeek(a, b)).not.toBe(0)
    expect(compareTeams(a, b)).not.toBe(0)
  })

  /**
   * Two teams identical on both revenue keys. `Array.sort` is stable, so without
   * the team-id key their order is *input* order — and input order is CSV row
   * order, which the wall does not control.
   */
  it('orders teams tied on both revenues by team id, whatever order they arrive in', () => {
    const tied = teams([
      { teamId: 'VBC101', weekRevenue: 5_000, totalRevenue: 5_000 },
      { teamId: 'VBC102', weekRevenue: 5_000, totalRevenue: 5_000 },
    ]).slice(0, 2)
    expect(rankByWeek(tied)[0].teamId).toBe('VBC101')
    expect(rankByWeek([...tied].reverse())[0].teamId).toBe('VBC101')
  })
})

describe('rankByChallenge', () => {
  it('orders by challenge revenue, then all-time revenue, then team id', () => {
    const ranked = rankByChallenge(
      teams([
        { teamId: 'VBC101', challengeRevenue: 4_000, totalRevenue: 10_000 },
        { teamId: 'VBC102', challengeRevenue: 9_000, totalRevenue: 9_000 },
        { teamId: 'VBC103', challengeRevenue: 4_000, totalRevenue: 80_000 },
      ]),
    )
    expect(ranked.slice(0, 3).map((team) => team.teamId)).toEqual([
      'VBC102',
      'VBC103',
      'VBC101',
    ])
  })

  /**
   * A baseline is a photograph of a proof-gated figure, and proof can be revoked
   * after the shutter closes — so a team can sit below the total it started the
   * fortnight on. It belongs *beneath* the teams that have simply not traded,
   * not tied with them, which is why nothing clamps this value on its way here.
   */
  it('sorts a team below its baseline beneath a team that has not traded', () => {
    const ranked = rankByChallenge(
      teams([
        { teamId: 'VBC101', challengeRevenue: -3_850, totalRevenue: 57_826 },
        { teamId: 'VBC102', challengeRevenue: 0, totalRevenue: 12_075 },
      ]).slice(0, 2),
    )
    expect(ranked.map((team) => team.teamId)).toEqual(['VBC102', 'VBC101'])
  })

  /**
   * Day one of a challenge: every team on ₹0, exactly as Monday morning is for
   * the daily board. The order has to be the *same* order on the next fetch, or
   * forty cards reshuffle and every shuffle reads as an overtake.
   */
  it('is total when the whole cohort is on zero for the challenge', () => {
    const dayOne = teams().map((team, index) => ({ ...team, totalRevenue: 1_000 * (42 - index) }))
    const once = rankByChallenge(dayOne).map((team) => team.teamId)
    const again = rankByChallenge([...dayOne].reverse()).map((team) => team.teamId)
    expect(again).toEqual(once)
    // and it falls back to the standing the wall showed all last fortnight
    expect(once[0]).toBe('VBC101')
  })

  it('never returns 0 for two different teams', () => {
    const [a, b] = teams()
    expect(compareChallenge(a, b)).not.toBe(0)
  })
})

describe('competingTeams', () => {
  it('drops the spare workbooks', () => {
    const competing = competingTeams(teams())
    expect(competing).toHaveLength(COMPETING_SIZE)
    for (const spare of SPARE_TEAM_IDS) {
      expect(competing.map((team) => team.teamId)).not.toContain(spare)
    }
  })
})

/**
 * The executable form of "ranking reads no clock".
 *
 * Without this the claim is a comment, and a comment does not stop the next
 * change from reaching for `Date.now()` to break a tie. A rank that varies with
 * the machine it ran on fires boot kicks that no data change justifies.
 */
describe('purity', () => {
  it('lib/ranking.ts touches no clock, randomness, storage, network or DOM', () => {
    const source = readFileSync(new URL('./ranking.ts', import.meta.url), 'utf8')
    const body = source.replace(/\/\*\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    expect(body).not.toMatch(
      /\bDate\b|Math\.random|localStorage|sessionStorage|\bfetch\b|\bwindow\b|\bdocument\b/,
    )
  })
})
