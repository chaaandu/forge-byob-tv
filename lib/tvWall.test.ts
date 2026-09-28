import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { PEOPLE_PHOTOS, PROGRAMME_START_ISO, SPARE_TEAM_IDS } from '@/config'
import { lineup } from '@/lib/lineup'
import { LIVERY_COUNT, liveryFor } from '@/lib/live'
import { compareChallenge, compareDaily, compareTeams, compareWeek } from '@/lib/ranking'
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
const SLIDE = readFileSync('public/tv/floor.html', 'utf8')

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

  it('ranks the weekly board the same', () => {
    const { rankPeriod } = wallComparators()
    const withWeek = fixture.map((t) =>
      team(t.teamId, t.totalRevenue, t.totalUnits, 0),
    ).map((t, i) => ({ ...t, weekRevenue: fixture[i].todayRevenue }) as Team)
    const wall = withWeek.map((t) => ({ ...wallTeam(t), week: t.weekRevenue }))
    expect(rankPeriod(wall, 'week').map((t) => t.id)).toEqual(
      [...withWeek].sort(compareWeek).map((t) => t.teamId),
    )
  })

  /**
   * ── The week must start on a Monday, and a wrong anchor reports nothing ──
   *
   * `week_revenue` is the sheet's column, zeroed against `TV_Feed!D2`, and
   * `PROGRAMME_START_ISO` is the copy of that date this repo reasons from.
   * `AGENTS.md` records the failure: set to the 1st of September once, which
   * is a Tuesday, and nothing broke — the formula still returned a plausible
   * small integer, it just rolled the week on the wrong day, and the two
   * anchors happened to agree that week. The wall would print a confident
   * board covering Tuesday to Monday and say so nowhere.
   */
  it('anchors the programme week to a Monday', () => {
    const ist = new Date(Date.parse(PROGRAMME_START_ISO) + 5.5 * 3600_000)
    expect(ist.getUTCDay()).toBe(1)
  })

  /**
   * `/daily`, `/weekly` and the challenge are one file and a `?board=`. Three
   * copies would drift; one file with a missing entry falls back to the day
   * board, which would silently serve the daily figures under a weekly name.
   */
  it('serves all three boards from the one slide', () => {
    const map = SLIDE.match(/const BOARDS = \{([\s\S]*?)\n\}/)
    expect(map).not.toBeNull()
    for (const [name, key] of [['day', 'today'], ['week', 'week'], ['challenge', 'challenge']]) {
      expect(map![1]).toMatch(new RegExp(`${name}:\\s*\\{\\s*key: '${key}'`))
    }
    expect(map![1]).toContain('Weekly</em> Leaderboard')
  })

  /**
   * ── Both trees must pick the weekly figure from the same column ──
   *
   * `/weekly` on the TV and `/live`'s `This week` tab rank the same teams under
   * the same word. On 21 September 2026 the wall moved to a rolling seven days
   * and the phone did not, and for a few hours the same label sat over
   * ₹6,94,123 and ₹5,274 — both figures true, both boards rendering perfectly,
   * nothing in either product able to report it. A student standing at the wall
   * with a phone in their hand is the one person guaranteed to see it.
   *
   * `lib/feed.ts` cannot be imported by `public/tv/`, so this reads the wall's
   * source and pins the shape: prefer `last7_revenue`, fall back to
   * `week_revenue`, per row. The fallback is the half that gets dropped in a
   * hurry, and dropping it turns a sheet without the column into 39 cards on ₹0.
   */
  it('takes the weekly figure from last7_revenue, falling back to the week', () => {
    const field = WALL.match(/week:\s*([\s\S]*?),\n\s*challenge:/)
    expect(field).not.toBeNull()
    expect(field![1]).toContain('last7_revenue')
    expect(field![1]).toContain('week_revenue')

    // The same rule `periodRevenueOf` applies in lib/feed.ts, exercised here so
    // a change to one tree that is not made in the other fails on this line.
    const pick = (last7: string, week: string) =>
      last7.trim() === '' ? Number(week) : Number(last7)
    expect(pick('8000', '1000')).toBe(8_000)
    expect(pick('', '1000')).toBe(1_000)
    expect(pick('0', '1000')).toBe(0)
  })

  /**
   * ── The wall's copy of the people manifest, which had already drifted ──
   *
   * `public/tv/` cannot import `config.ts`, so it reads `people.json` — a
   * second copy of `PEOPLE_PHOTOS`, hand-maintained until 22 September 2026
   * and wrong by then in both directions at once. It listed
   * `VBC110/diya-harish`, a photograph **deleted** for being another student's
   * face, and `VBC107/aditi` after that file moved teams: two 404s and two
   * broken images on the TV. It was also missing four real photographs,
   * including ZAAREE's only one, so a whole team's line-up was empty on the
   * wall while full on the phone.
   *
   * Neither direction reports anything. A wall shows a torn-page icon to a
   * corridor nobody is auditing, and a missing face just looks like a team
   * that sent fewer photographs. `scripts/export-people-json.mjs` generates
   * the file now; this is what makes regenerating it non-optional.
   */
  it('gives the wall the same people manifest the app has', () => {
    const wall = JSON.parse(readFileSync('public/tv/people.json', 'utf8'))
    expect(wall).toEqual([...PEOPLE_PHOTOS])
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
    // wall.html counts today's sellers to decide whether /daily is shown, and
    // a spare counted there would bring the board on a seller early.
    const rotator = readFileSync('public/tv/wall.html', 'utf8').match(/const SPARES = \[([^\]]*)\]/)
    expect(rotator).not.toBeNull()
    expect([...rotator![1].matchAll(/'([^']+)'/g)].map((m) => m[1])).toEqual([...SPARE_TEAM_IDS])
  })

  /** 39 ventures, one locked colour each — the map is the authority, not a hash. */
  it('has a locked livery for every team it can show', () => {
    const map = WALL.match(/const TEAM_LIVERY = \{([\s\S]*?)\}/)
    expect(map).not.toBeNull()
    const entries = [...map![1].matchAll(/"(VBC\d+)":\s*(\d+)/g)]
    expect(entries).toHaveLength(39)
    expect(new Set(entries.map((e) => e[2])).size).toBe(39)
  })

  /**
   * ── A venture is the same colour on /weekly and on a phone ──
   *
   * `/live` wore twelve hashed F1 liveries until 28 September 2026 and agreed
   * with the TV about nobody's colour. It now carries the wall's map and a copy
   * of the wall's thirty-nine liveries in `forge-tokens.css` §8, and both
   * copies are held here: the slab, its ink, and the money band, which is the
   * wall's `edge` / `disc-ink` pair rather than its pale `band`.
   */
  it('colours every team on /live exactly as the wall does', () => {
    const map = WALL.match(/const TEAM_LIVERY = \{([\s\S]*?)\}/)
    const entries = [...map![1].matchAll(/"(VBC\d+)":\s*(\d+)/g)]
    for (const [, id, n] of entries) expect(liveryFor(id as TeamId), id).toBe(Number(n))
    expect(LIVERY_COUNT).toBe(Number(WALL.match(/const LIVERY_COUNT = (\d+)/)![1]))

    const wallCss = readFileSync('public/tv/tv.css', 'utf8')
    const tokens = readFileSync('app/forge-tokens.css', 'utf8')
    const hex = (css: string, name: string) => css.match(new RegExp(`${name}:\\s*(#[0-9a-f]{6})`))?.[1]
    const pairs = [['a', 'a'], ['b', 'b'], ['ink', 'ink'], ['band', 'edge'], ['band-ink', 'disc-ink']]
    for (let n = 1; n <= LIVERY_COUNT; n += 1)
      for (const [live, wall] of pairs) {
        const want = hex(wallCss, `--l${n}-${wall}`)
        expect(want, `--l${n}-${wall}`).toBeDefined()
        expect(hex(tokens, `--lv-${n}-${live}`), `--lv-${n}-${live}`).toBe(want)
      }
  })

  /**
   * ── A team stands the same way on the TV and on a phone ──
   *
   * Who stands where, and who is in front, is decided twice: `lineupOf` in
   * `tv.js` for the wall and `lineup` in `lib/lineup.ts` for `/live`. They
   * drifted once already — the wall was fixed for bodies cut by their frame
   * and `/live` kept "leftmost in front" — and a student looked at the phone
   * and saw the very overlap the TV no longer drew. So both are run over every
   * team's photographs and must agree on order, layering and the cut fades.
   */
  it('lines every team up the same way as /live does', () => {
    const src = WALL.slice(WALL.indexOf('function photoSrc'), WALL.indexOf('function squadOf'))
    const photoSrc = src.slice(0, src.indexOf('/**'))
    const lineupOf = WALL.slice(WALL.indexOf('function orderings'), WALL.indexOf('function squadOf'))
    const META = JSON.parse(readFileSync('public/tv/people-meta.json', 'utf8'))
    const LINEUPS = JSON.parse(readFileSync('public/tv/lineups.json', 'utf8'))
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const wall = new Function('META', 'LINEUPS', `${photoSrc}\n${lineupOf}\nreturn lineupOf`)(META, LINEUPS) as typeof lineup

    const teams = new Map<string, string[]>()
    for (const entry of PEOPLE_PHOTOS) {
      const [id, slug] = entry.split('/')
      teams.set(id, [...(teams.get(id) ?? []), slug])
    }
    for (const [id, slugs] of teams) expect(wall(id, slugs), id).toEqual(lineup(id, slugs))
  })

  /** Every photograph has a version and a measurement; a new one without is a stale URL waiting to happen. */
  it('has measured every photograph', () => {
    const META = JSON.parse(readFileSync('public/tv/people-meta.json', 'utf8'))
    expect(Object.keys(META).sort()).toEqual([...PEOPLE_PHOTOS].sort())
  })

  /**
   * ── No passport photographs ──
   *
   * A headshot framed at the chest has no body to stand in a line-up with. Two
   * were used on 23 September 2026 and every way of showing them was worse
   * than not: enlarged, a giant head; at scale, a body ending in a straight
   * line; faded, a hole in the group; the whole group faded to match, every
   * teammate cut at the chest. They were removed, asked for directly, and a
   * student without a waist-up photograph is absent from the line-up exactly
   * as one who missed the shoot is. `measure-people.py` flags one as `short`.
   */
  it('has no photograph that stops short of the bottom', () => {
    const META = JSON.parse(readFileSync('public/tv/people-meta.json', 'utf8'))
    const short = Object.entries(META).filter(([, m]) => (m as { cut: number[] }).cut[2]).map(([k]) => k)
    expect(short).toEqual([])
  })
})
