import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { SPARE_TEAM_IDS } from '@/config'
import { compareChallenge, compareDaily, compareTeams } from '@/lib/ranking'
import type { Team, TeamId } from '@/lib/types'

/**
 * ── The wall is a second implementation, and this is what stops it drifting ──
 *
 * `public/tv/` is served as static files so the board paints before Next has
 * booted anything, which means it carries its own copy of everything that
 * decides a number. That is a real cost and it is paid deliberately; what is
 * NOT acceptable is the copy quietly disagreeing with `lib/`. A wall that said
 * a venture was fourth while the phone in the same corridor said fifth would
 * be worse than no wall.
 *
 * It has already happened once. The wall ranked every board on
 * `revenue → units → id`, which is right for all-time and wrong for a period
 * board; measured against `lib/ranking.ts` on a real feed, the all-time board
 * agreed on 41 of 41 and the daily board disagreed on SIX, because 19 of 41
 * ventures sit on ₹0 and the tie-break is what orders them. A comment would
 * not have caught that. This does.
 *
 * `lib/useDesktop.ts` and `live.css` are pinned to each other the same way and
 * for the same reason.
 */
const WALL = readFileSync('public/tv/tv.js', 'utf8')

const team = (id: string, total: number, units: number, today: number, challenge = 0): Team =>
  ({
    teamId: id as TeamId,
    ventureName: id,
    totalRevenue: total,
    weekRevenue: 0,
    todayRevenue: today,
    totalUnits: units,
    challengeBaseline: 0,
    challengeRevenue: challenge,
  }) as Team

/** The same shape `tv.js` builds out of the CSV. */
const wallTeam = (t: Team) => ({
  id: t.teamId,
  total: t.totalRevenue,
  units: t.totalUnits,
  today: t.todayRevenue,
  challenge: t.challengeRevenue,
})

/** Lifted out of `tv.js` rather than re-typed, so the test reads what ships. */
function wallComparators() {
  const src = WALL.slice(WALL.indexOf('const rankAllTime'), WALL.indexOf('const rankBy ='))
  const rankPeriodSrc = WALL.slice(WALL.indexOf('const rankPeriod'), WALL.indexOf('const rankBy ='))
  expect(src).toContain('b.total - a.total || b.units - a.units')
  expect(rankPeriodSrc).toContain('b.total - a.total || a.id.localeCompare(b.id)')
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  return new Function(`${src}; return { rankAllTime, rankPeriod }`)() as {
    rankAllTime: (t: unknown[]) => { id: string }[]
    rankPeriod: (t: unknown[], k: string) => { id: string }[]
  }
}

describe('the static wall ranks exactly as lib/ranking does', () => {
  /* Ties on every key in turn, which is the only part a shared rule gets wrong. */
  const fixture: Team[] = [
    team('VBC101', 5000, 9, 100),
    team('VBC102', 5000, 12, 0), // ties all-time revenue — units decide
    team('VBC103', 9000, 2, 0), // ties today at ₹0 — all-time decides
    team('VBC104', 1000, 40, 0),
    team('VBC105', 9000, 2, 0), // ties today AND all-time — id decides
  ]

  it('ranks the all-time board the same', () => {
    const { rankAllTime } = wallComparators()
    expect(rankAllTime(fixture.map(wallTeam)).map((t) => t.id)).toEqual(
      [...fixture].sort(compareTeams).map((t) => t.teamId),
    )
  })

  it('ranks the daily board the same, tie-break included', () => {
    const { rankPeriod } = wallComparators()
    const earned = Object.fromEntries(fixture.map((t) => [t.teamId, t.todayRevenue]))
    expect(rankPeriod(fixture.map(wallTeam), 'today').map((t) => t.id)).toEqual(
      [...fixture].sort(compareDaily(earned)).map((t) => t.teamId),
    )
  })

  it('ranks the challenge board the same', () => {
    const { rankPeriod } = wallComparators()
    const withChallenge = fixture.map((t) => team(t.teamId, t.totalRevenue, t.totalUnits, 0, t.todayRevenue))
    expect(rankPeriod(withChallenge.map(wallTeam), 'challenge').map((t) => t.id)).toEqual(
      [...withChallenge].sort(compareChallenge).map((t) => t.teamId),
    )
  })

  /**
   * The spares are two workbooks `TV_Feed` publishes that are not in the
   * cohort. The wall cannot import `config.ts`, so it repeats the list — and a
   * spare that fell off one side would take a card on the board while never
   * trading, which looks exactly like a venture that has sold nothing.
   */
  it('drops the same spare teams config.ts does', () => {
    const declared = WALL.match(/const SPARES = \[([^\]]*)\]/)
    expect(declared).not.toBeNull()
    const ids = [...declared![1].matchAll(/'([^']+)'/g)].map((m) => m[1])
    expect(ids).toEqual([...SPARE_TEAM_IDS])
  })

  /** 39 ventures, one locked colour each — the map is the authority, not a hash. */
  it('has a locked livery for every team it can show', () => {
    const map = WALL.match(/const TEAM_LIVERY = \{([\s\S]*?)\}/)
    expect(map).not.toBeNull()
    const entries = [...map![1].matchAll(/"(VBC\d+)":\s*(\d+)/g)]
    expect(entries).toHaveLength(39)
    expect(new Set(entries.map((e) => e[2])).size).toBe(39)
  })
})
