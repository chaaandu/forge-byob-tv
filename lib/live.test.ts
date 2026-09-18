import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { rankForMode } from '@/lib/board'
import {
  EMBLEM_COUNT,
  LIVERY_COUNT,
  MAX_MEMBERS,
  avgTicket,
  climbOf,
  emblemFor,
  initialsOf,
  instagramUrl,
  linkLabel,
  membersOf,
  photoSlug,
  liveryFor,
  matchesQuery,
  raceFor,
  shareOf,
  standingsFor,
  websiteUrl,
} from '@/lib/live'
import { competingTeams, rankByWeek, rankTeams } from '@/lib/ranking'
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
    expect(standingsFor('all', 'daily', cohort).map((s) => s.team.teamId)).toEqual(
      rankTeams(competingTeams(cohort)).map((t) => t.teamId),
    )
  })

  /**
   * **In challenge mode the phone's middle tab is still `/daily`'s board**, to
   * the line: `challenge_revenue` is a published column and both devices read
   * it, so `rankForMode` is the authority for both.
   */
  it('ranks the challenge exactly as /daily does', () => {
    expect(standingsFor('period', 'challenge', cohort).map((s) => s.team.teamId)).toEqual(
      rankForMode('challenge', competingTeams(cohort), null).map((t) => t.teamId),
    )
  })

  /**
   * ── The one place the phone and the wall deliberately measure different
   * things, stated rather than asserted away ──
   *
   * `/daily`'s daily figure is not a column. It is a finished day, 10:00 to
   * 10:00, computed from two photographs of `total_revenue` that the **laptop
   * driving the TV** took and kept in its own `localStorage`. A phone is a
   * different machine; it has never held those marks and cannot be handed them
   * without the backend this project does not have.
   *
   * So the phone's period tab keeps the week, under its own honest label, and
   * the live daily board is the tab beside it. This pins that the middle tab is
   * `week_revenue` — because the direction this could fail in is the phone
   * quietly falling through to `rankForMode('daily', …, null)`, which ranks
   * every team at ₹0 and makes the tab an unlabelled duplicate of `All-time`.
   */
  it('ranks its period tab on the week, which is no longer what the wall shows', () => {
    expect(standingsFor('period', 'daily', cohort).map((s) => s.team.teamId)).toEqual(
      rankByWeek(competingTeams(cohort)).map((t) => t.teamId),
    )
    expect(standingsFor('period', 'daily', cohort).map((s) => s.team.teamId)).not.toEqual(
      standingsFor('all', 'daily', cohort).map((s) => s.team.teamId),
    )
  })

  it('prints the figure it ranks on', () => {
    expect(standingsFor('period', 'challenge', cohort)[0]).toMatchObject({ rank: 1, figure: 500 })
    expect(standingsFor('period', 'daily', cohort)[0]).toMatchObject({ rank: 1, figure: 9_000 })
  })

  it('ranks today by today, falling back to all-time', () => {
    const today = standingsFor('today', 'daily', cohort)
    expect(today.slice(0, 3).map((s) => s.team.teamId)).toEqual(['VBC103', 'VBC102', 'VBC101'])
    expect(today[0]!.figure).toBe(900)
  })

  it('leaves the spares off every board', () => {
    for (const key of ['all', 'period', 'today'] as const) {
      expect(standingsFor(key, 'daily', cohort)).toHaveLength(COMPETING_SIZE)
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
    'daily',
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
    expect(shareOf(standingsFor('today', 'daily', teams()), 'VBC101')).toBeNull()
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

describe('membersOf', () => {
  /**
   * **Every separator here was measured in the live master**, not imagined —
   * `Team Links` col D on 18 September 2026 writes forty-one cells at least
   * five different ways.
   */
  it('splits the cell however the sheet wrote it', () => {
    const cases: [string, string[]][] = [
      ['TANISHQUE JAIN, NIRMALYA SAH, SACHIDANANDA DEHURY', ['Tanishque Jain', 'Nirmalya Sah', 'Sachidananda Dehury']],
      ['Harsh Malani, Meith Jain and Ritesh Oswal', ['Harsh Malani', 'Meith Jain', 'Ritesh Oswal']],
      ['Aarav, Divy, Tushar.', ['Aarav', 'Divy', 'Tushar']],
      ['happy panjwani, diya harish , rishika choudhary', ['Happy Panjwani', 'Diya Harish', 'Rishika Choudhary']],
      ['Satvik & Soumanshu', ['Satvik', 'Soumanshu']],
    ]
    for (const [cell, expected] of cases) {
      expect(membersOf(team({ members: cell })), cell).toEqual(expected)
    }
  })

  // `titleCase`'s rule, inherited: a name the student cased themselves is left
  // alone, so an initial survives and `McCarthy` would too.
  it('keeps a name that was cased by a human', () => {
    expect(membersOf(team({ members: 'Rohit, Preethi S, Udhav Kothari' }))).toEqual([
      'Rohit',
      'Preethi S',
      'Udhav Kothari',
    ])
  })

  it('says nothing when the sheet does not publish the column', () => {
    expect(membersOf(team())).toEqual([])
    expect(membersOf(team({ members: '   ' }))).toEqual([])
  })

  it('caps a pasted paragraph rather than filling the sheet with faces', () => {
    const many = Array.from({ length: 12 }, (_, i) => `Person ${i}`).join(', ')
    expect(membersOf(team({ members: many })).length).toBe(MAX_MEMBERS)
  })

  /**
   * The slug is the **whole mapping** between a photograph and a student:
   * `scripts/prepare-people.py` writes the file from the filename and this
   * derives the same string from the sheet. They must agree character for
   * character or a photo silently never appears.
   */
  it('derives a file name from a person\'s name', () => {
    expect(photoSlug('Tanishque Jain')).toBe('tanishque-jain')
    expect(photoSlug('  Preethi   S ')).toBe('preethi-s')
    expect(photoSlug('Zuha Fathima')).toBe('zuha-fathima')
    expect(photoSlug('José Núñez')).toBe('jose-nunez')
  })

  it('initials a person for the placeholder portrait', () => {
    expect(initialsOf('Tanishque Jain')).toBe('TJ')
    expect(initialsOf('Aarav')).toBe('AA')
    expect(initialsOf('Preethi S')).toBe('PS')
  })
})

describe('links', () => {
  /**
   * **These cells are untrusted input**: `TV_Feed` is published from a
   * workbook forty teams type into, so a cell reading `javascript:…` would
   * become script on a page other people open. Only `https` is ever produced.
   */
  it('refuses any scheme that is not http(s)', () => {
    for (const hostile of [
      'javascript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'file:///etc/passwd',
      'JavaScript:alert(1)',
    ]) {
      expect(websiteUrl(hostile), hostile).toBeNull()
      expect(instagramUrl(hostile), hostile).toBeNull()
    }
  })

  it('accepts a handle however the sheet writes it', () => {
    for (const written of [
      'aks.perfumes',
      '@aks.perfumes',
      'instagram.com/aks.perfumes',
      'https://www.instagram.com/aks.perfumes/',
      'https://instagram.com/aks.perfumes?igsh=abc',
    ]) {
      expect(instagramUrl(written), written).toBe('https://instagram.com/aks.perfumes')
    }
  })

  it('refuses a handle that is not one, and an empty cell', () => {
    expect(instagramUrl('we are on insta! dm us')).toBeNull()
    expect(instagramUrl('   ')).toBeNull()
    expect(instagramUrl(undefined)).toBeNull()
  })

  it('gives a bare domain a scheme and keeps a real URL', () => {
    expect(websiteUrl('rooh.in')).toBe('https://rooh.in/')
    expect(websiteUrl('http://rooh.in/shop')).toBe('https://rooh.in/shop')
    expect(websiteUrl('https://rooh.in/shop?ref=tv')).toBe('https://rooh.in/shop?ref=tv')
  })

  it('refuses something that is not a domain at all', () => {
    for (const written of ['coming soon', 'localhost:3000', 'ask us', '']) {
      expect(websiteUrl(written), written).toBeNull()
    }
  })

  it('labels a link as a lockup rather than a URL', () => {
    expect(linkLabel('https://instagram.com/aks.perfumes')).toBe('instagram.com/aks.perfumes')
    expect(linkLabel('https://www.rooh.in/')).toBe('rooh.in')
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
   * **The stylesheet and the hook must ask the same question.**
   *
   * `live.css` decides where the panel sits; `useDesktop` decides which edge
   * it animates in from, whether it can be dragged away and whether the board
   * behind it is dimmed. If the two queries ever drift, a tablet gets a panel
   * docked by CSS that still animates up from the bottom and can be thrown
   * off the screen by a swipe — which looks like a bug in the animation and
   * is a bug in a media query.
   */
  it('asks the same question in the stylesheet and the hook', () => {
    const query = '(min-width: 1024px) and (hover: hover) and (pointer: fine)'
    expect(readFileSync('app/live/live.css', 'utf8')).toContain(`@media ${query}`)
    expect(readFileSync('lib/useDesktop.ts', 'utf8')).toContain(`matchMedia('${query}')`)
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
