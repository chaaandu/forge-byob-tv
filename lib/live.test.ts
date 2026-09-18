import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { rankForMode } from '@/lib/board'
import {
  EMBLEM_COUNT,
  LIVERY_COUNT,
  avgTicket,
  climbOf,
  emblemFor,
  liveryFor,
  matchesQuery,
  raceFor,
  shareOf,
  standingsFor,
} from '@/lib/live'
import { competingTeams, rankTeams } from '@/lib/ranking'
import { COMPETING_SIZE, team, teams } from '@/test/fixtures'

describe('standingsFor', () => {
  const cohort = teams([
    { teamId: 'VBC101', totalRevenue: 90_000, weekRevenue: 1_000, todayRevenue: 0, challengeRevenue: 5 },
    { teamId: 'VBC102', totalRevenue: 50_000, weekRevenue: 9_000, todayRevenue: 400, challengeRevenue: 50 },
    { teamId: 'VBC103', totalRevenue: 70_000, weekRevenue: 4_000, todayRevenue: 900, challengeRevenue: 500 },
  ])

  // The phone must never disagree with the TV in the corridor about who is
  // ahead, so the two wall boards are asserted against the wall's own sorts.
  it('ranks all-time exactly as /podium does', () => {
    expect(standingsFor('all', 'week', cohort).map((s) => s.team.teamId)).toEqual(
      rankTeams(competingTeams(cohort)).map((t) => t.teamId),
    )
  })

  it('ranks the period exactly as /weekly does, in both modes', () => {
    for (const mode of ['week', 'challenge'] as const) {
      expect(standingsFor('period', mode, cohort).map((s) => s.team.teamId)).toEqual(
        rankForMode(mode, competingTeams(cohort)).map((t) => t.teamId),
      )
    }
  })

  it('prints the figure it ranks on', () => {
    expect(standingsFor('period', 'challenge', cohort)[0]).toMatchObject({ rank: 1, figure: 500 })
    expect(standingsFor('period', 'week', cohort)[0]).toMatchObject({ rank: 1, figure: 9_000 })
  })

  it('ranks today by today, falling back to all-time', () => {
    const today = standingsFor('today', 'week', cohort)
    expect(today.slice(0, 3).map((s) => s.team.teamId)).toEqual(['VBC103', 'VBC102', 'VBC101'])
    expect(today[0]!.figure).toBe(900)
  })

  it('leaves the spares off every board', () => {
    for (const key of ['all', 'period', 'today'] as const) {
      expect(standingsFor(key, 'week', cohort)).toHaveLength(COMPETING_SIZE)
    }
  })
})

describe('liveries and emblems', () => {
  it('stay in range and belong to the id, not the rank', () => {
    for (let n = 101; n <= 141; n += 1) {
      const id = `VBC${n}`
      expect(liveryFor(id)).toBeGreaterThanOrEqual(1)
      expect(liveryFor(id)).toBeLessThanOrEqual(LIVERY_COUNT)
      expect(emblemFor(id)).toBeGreaterThanOrEqual(0)
      expect(emblemFor(id)).toBeLessThan(EMBLEM_COUNT)
      expect(liveryFor(id)).toBe(liveryFor(id))
    }
  })

  // Every id shares a `VBC1` prefix; a hash without mixing would bunch them.
  it('spread across the cohort', () => {
    const used = new Set(Array.from({ length: 39 }, (_, i) => liveryFor(`VBC${101 + i}`)))
    expect(used.size).toBeGreaterThanOrEqual(10)
  })

  it('has a CSS class and token for every livery', () => {
    const css = readFileSync('app/live/live.css', 'utf8')
    const tokens = readFileSync('app/forge-tokens.css', 'utf8')
    for (let n = 1; n <= LIVERY_COUNT; n += 1) {
      expect(css).toContain(`.lv-livery-${n} {`)
      for (const part of ['a', 'b', 'ink', 'band', 'band-ink'])
        expect(tokens).toContain(`--lv-${n}-${part}:`)
    }
  })
})

describe('raceFor', () => {
  const board = standingsFor(
    'all',
    'week',
    teams([
      { teamId: 'VBC101', totalRevenue: 300 },
      { teamId: 'VBC102', totalRevenue: 200 },
    ]),
  )

  it('names the team either side', () => {
    const race = raceFor(board, 'VBC102')!
    expect(race.self.rank).toBe(2)
    expect(race.ahead?.team.teamId).toBe('VBC101')
    expect(race.behind?.rank).toBe(3)
  })

  it('has nobody ahead of the leader and nobody behind last', () => {
    expect(raceFor(board, 'VBC101')!.ahead).toBeUndefined()
    expect(raceFor(board, board.at(-1)!.team.teamId)!.behind).toBeUndefined()
  })

  it('is null for a team not on the board', () => {
    expect(raceFor(board, 'VBC999')).toBeNull()
  })
})

describe('climbOf', () => {
  it('compares last week’s rank with the all-time board only', () => {
    const standing = { team: team({ prevWeekRank: 7 }), rank: 4, figure: 1 }
    expect(climbOf('all', standing)).toBe(3)
    expect(climbOf('period', standing)).toBeNull()
    expect(climbOf('today', standing)).toBeNull()
  })

  it('says nothing when the sheet does not publish a previous rank', () => {
    expect(climbOf('all', { team: team(), rank: 4, figure: 1 })).toBeNull()
  })
})

describe('figures', () => {
  it('has no average ticket before the first unit', () => {
    expect(avgTicket(team({ totalRevenue: 0, totalUnits: 0 }))).toBeNull()
    expect(avgTicket(team({ totalRevenue: 2_600, totalUnits: 10 }))).toBe(260)
  })

  it('has no share on an empty board', () => {
    expect(shareOf(standingsFor('today', 'week', teams()), 'VBC101')).toBeNull()
  })

  it('does not let a negative challenge figure inflate anyone’s share', () => {
    const board = standingsFor(
      'period',
      'challenge',
      teams([
        { teamId: 'VBC101', challengeRevenue: 100 },
        { teamId: 'VBC102', challengeRevenue: -100 },
      ]),
    )
    expect(shareOf(board, 'VBC101')).toBe(1)
    expect(shareOf(board, 'VBC102')).toBe(0)
  })
})

describe('matchesQuery', () => {
  it('ignores case and accents, and matches the team id', () => {
    expect(matchesQuery(team({ ventureName: 'YŌKI' }), 'yoki')).toBe(true)
    expect(matchesQuery(team({ teamId: 'VBC117' }), 'c117')).toBe(true)
    expect(matchesQuery(team({ ventureName: 'Snapp' }), 'dosa')).toBe(false)
  })
})

describe('/live source rules', () => {
  const liveFiles = [
    'lib/live.ts',
    'app/live/page.tsx',
    'app/live/layout.tsx',
    'app/live/live.css',
    ...readdirSync('components/live').map((f) => `components/live/${f}`),
  ]
  const strip = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1')

  it('reads no clock, storage, network or DOM in lib/live.ts', () => {
    const source = strip(readFileSync('lib/live.ts', 'utf8'))
    expect(source).not.toMatch(/\bDate\b|Math\.random|localStorage|fetch\(|window|document/)
  })

  // AGENTS.md: `forge-tokens.css` is the only file that may contain a hex.
  it('names no colour outside forge-tokens.css', () => {
    for (const file of liveFiles) {
      expect(strip(readFileSync(file, 'utf8')), file).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(/)
    }
  })

  /**
   * **There is no sample data on this page, and that is a rule rather than a
   * state.** A strip of invented products with invented unit counts shipped
   * here for a day and was deleted: it rendered beautifully and said false
   * things about a team, which is the one failure this project is built
   * around. What a venture sells now comes from the sheet or not at all.
   */
  it('invents no product data', () => {
    for (const file of liveFiles) {
      expect(strip(readFileSync(file, 'utf8')), file).not.toMatch(/sampleProducts|Sample data/)
    }
    expect(existsSync('lib/liveSample.ts')).toBe(false)
  })

  /**
   * Archivo is variable on 100–900. A weight outside a face's axis is
   * **synthesised rather than refused** — the browser smears the outlines —
   * so the range is read out of the layout that bundles the face, exactly as
   * `render.test.tsx` does for the wall. A face swapped for one with a
   * narrower axis fails here the moment the file is replaced.
   */
  it('never asks its face for a weight it does not have', () => {
    const layout = readFileSync('app/live/layout.tsx', 'utf8')
    const [, lo, hi] = layout.match(/weight:\s*'(\d+)(?:\s+(\d+))?'/)!
    const css = strip(readFileSync('app/live/live.css', 'utf8'))
    const weights = [...css.matchAll(/font-weight:\s*(\d{3})/g)].map((m) => Number(m[1]))
    expect(weights.length).toBeGreaterThan(10)
    for (const weight of weights) {
      expect(weight).toBeGreaterThanOrEqual(Number(lo))
      expect(weight).toBeLessThanOrEqual(Number(hi ?? lo))
    }
  })
})
