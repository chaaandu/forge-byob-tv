// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { FleaDial } from '@/components/FleaDial'
import { Podium, podiumTeams } from '@/components/Podium'
import { VentureCard } from '@/components/VentureCard'
import { pagesOf } from '@/components/VentureName'
import { WallHeader } from '@/components/WallHeader'
import { ROW_LENGTH, WeeklyGrid, rowsOf } from '@/components/WeeklyGrid'
import { SOLID_RANKS, SPARE_TEAM_IDS } from '@/config'
import type { CountdownState } from '@/lib/countdown'
import { formatRupees, ordinal } from '@/lib/format'
import { competingTeams, rankByChallenge, rankTeams } from '@/lib/ranking'
import { COMPETING_SIZE, cohort, team, teams } from '@/test/fixtures'

/**
 * Smoke tests: every surface renders with mock data and puts the right words on
 * screen. Layout and colour are verified by measuring the running app at
 * 1920x1080 — a DOM assertion cannot tell you a row overflowed the frame.
 */

// React reads this global to decide whether `act` is legal. Cast rather than a
// `declare global`, which would leak the flag into the app's type surface.
;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

function render(ui: React.ReactNode): string {
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  act(() => root.render(ui))
  const html = host.textContent ?? ''
  act(() => root.unmount())
  host.remove()
  return html
}

/**
 * The same render, kept as markup rather than as text.
 *
 * For the handful of assertions that are about *which* treatment a card got
 * rather than what it says. Colour itself is still measured in a browser — a
 * class name is not a colour — but which class the component chose is a
 * decision the component makes, and it is worth pinning where it is made.
 */
function markup(ui: React.ReactNode): string {
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  act(() => root.render(ui))
  const html = host.innerHTML
  act(() => root.unmount())
  host.remove()
  return html
}

const TRADING = teams([
  { teamId: 'VBC101', ventureName: 'Aurora Bakes', totalRevenue: 240_000, totalUnits: 571 },
  { teamId: 'VBC102', ventureName: 'Kite Coffee', totalRevenue: 228_200, totalUnits: 543 },
  { teamId: 'VBC103', ventureName: 'Solstice', totalRevenue: 216_400, totalUnits: 515 },
])

describe('FleaDial', () => {
  const state = (over: Partial<CountdownState>): CountdownState => ({
    display: '25',
    mode: 'days',
    numeric: 25,
    progress: 0.5,
    // The dial reads none of these three — they exist so `/podium`'s masthead
    // can band the same state differently without differencing the clock a
    // second time. They are spelled out anyway so this fixture stays a complete
    // `CountdownState` and the compiler keeps checking that it is one.
    remainingMs: 25 * 86_400_000,
    daysRemaining: 25,
    weeksRemaining: 4,
    ...over,
  })

  it('puts the figure beside the ring in every mode, never inside it', () => {
    // The ring is a dial and nothing else. Every mode has identical structure,
    // so nothing relocates at a threshold the wall crosses at 3am unobserved.
    expect(render(<FleaDial state={state({})} />)).toContain('25 days')
    expect(
      render(<FleaDial state={state({ display: '9D 4H', mode: 'daysHours', numeric: 9 })} />),
    ).toContain('9D 4H')
    expect(
      render(<FleaDial state={state({ display: '04:12:33', mode: 'timer', numeric: 300 })} />),
    ).toContain('04:12:33')
    expect(
      render(<FleaDial state={state({ display: 'LIVE NOW', mode: 'live', numeric: null })} />),
    ).toContain('LIVE NOW')
  })

  it('names the countdown for a screen reader', () => {
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    act(() => root.render(<FleaDial state={state({})} />))
    expect(host.querySelector('[role="img"]')?.getAttribute('aria-label')).toBe(
      'Time until Mesa Flea: 25 days',
    )
    act(() => root.unmount())
    host.remove()
  })

  it('draws the arc from the progress, and closes it entirely when live', () => {
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    act(() => root.render(<FleaDial state={state({ progress: 0 })} />))
    const empty = host.querySelectorAll('circle')[1].getAttribute('stroke-dashoffset')
    act(() => root.render(<FleaDial state={state({ mode: 'live', display: 'LIVE NOW', progress: 1 })} />))
    const full = host.querySelectorAll('circle')[1].getAttribute('stroke-dashoffset')
    expect(Number(empty)).toBeCloseTo(2 * Math.PI * 19.5, 3)
    expect(Number(full)).toBeCloseTo(0, 6)
    act(() => root.unmount())
    host.remove()
  })
})

describe('Podium', () => {
  it('renders the top three with names, ranks and revenue', () => {
    const text = render(<Podium ranked={rankTeams(TRADING)} />)
    expect(text).toContain('Aurora Bakes')
    expect(text).toContain('Kite Coffee')
    expect(text).toContain('Solstice')
    expect(text).toContain(formatRupees(240_000))
    // Names are uppercased by CSS, not in the markup — the assertions above are
    // on the text the component actually renders, which is what a screen reader
    // and a copy-paste both get.
    //
    // **The "total revenue" caption is no longer asserted here.** It moved to
    // the masthead when the board gained one, and it is deliberately printed
    // *once* for the whole slide rather than on each of three cards. Its
    // coverage moved with it — see the PodiumMasthead block below.
  })

  it('ranks 4-10 land in the strip, in order', () => {
    const all = teams().map((row, index) => ({ ...row, totalRevenue: 1_000 * (42 - index) }))
    const text = render(<Podium ranked={rankTeams(competingTeams(all))} />)
    expect(text).toContain('Venture 4')
    expect(text).toContain('Venture 10')
    // Rank 11 is off the board entirely — this is a top ten, not a leaderboard
    // that trails off.
    expect(text).not.toContain('Venture 11')
  })

  it('renders the waiting board when nobody has traded', () => {
    const text = render(<Podium ranked={rankTeams(teams())} />)
    // The structure still reads as "the leaderboard, waiting" — never a "no
    // data" message, which tells a passer-by the wall is broken. A dash rather
    // than ₹0: zero asserts the team traded and earned nothing.
    expect(text).toContain('—')
    expect(text).not.toContain(formatRupees(0))
    expect(text.toLowerCase()).not.toContain('no data')
  })

  it('renders three cards with no feed at all', () => {
    // An empty first paint is a real state and the board holds its shape through
    // it rather than assembling on screen.
    //
    // **Asserted per element, not by counting dashes in the whole slide.** This
    // counted three em dashes and broke the day the mover panel gained a fourth
    // for its own empty state — a true change that looked like a regression,
    // because the count was standing in for "one per card" and stopped meaning
    // it. Reaching for the cards directly cannot drift that way.
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    act(() => root.render(<Podium ranked={[]} />))
    const figures = [...host.querySelectorAll('.tv-pod-card .tv-figure')]
    expect(figures).toHaveLength(3)
    expect(figures.every((el) => el.textContent === '—')).toBe(true)
    // The panel has nothing to report either, and says so the same way.
    expect(host.querySelector('.tv-pod-mover-empty')?.textContent).toBe('—')
    act(() => root.unmount())
    host.remove()
  })

  it('draws three cards on plinths and seven pills, borrowing nothing from /weekly', () => {
    // `.tv-pill` is /weekly's language — rows that close around their own mark.
    // Borrowing it here made slide 1 look like a shorter slide 2. This is the
    // executable form of "do not borrow it back".
    //
    // The counts are the shape of the slide: three floating cards for the
    // podium places and one bar per rank 4-10. They replace an assertion on the
    // pillars' shafts and slabs, which is the same claim about the design that
    // preceded this one.
    const all = teams().map((row, index) => ({ ...row, totalRevenue: 1_000 * (42 - index) }))
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    act(() => root.render(<Podium ranked={rankTeams(competingTeams(all))} />))
    expect(host.querySelectorAll('.tv-pill')).toHaveLength(0)
    expect(host.querySelectorAll('.tv-pod-card')).toHaveLength(3)
    // One numeral per pillar, and one metal foot under each. The numeral used to
    // be drawn twice and split by the card's edge; it floats clear of the card
    // now, so three is the right count and six would mean the split came back.
    expect(host.querySelectorAll('.tv-pod-numeral')).toHaveLength(3)
    expect(host.querySelectorAll('.tv-pod-foot')).toHaveLength(3)
    // One row and one bar per rank 4-10. The pill that used to be both is gone:
    // a shape doing two jobs is what this list was rejected for.
    expect(host.querySelectorAll('.tv-pod-stack')).toHaveLength(7)
    expect(host.querySelectorAll('.tv-pod-underbar')).toHaveLength(7)
    // Each card stands on its own metal. Three plinths and three cards, never
    // three cards and one plinth — the plinth is where the metal is declared,
    // and a shared one would give second place first place's gold.
    expect(host.querySelectorAll('.tv-pod-slot')).toHaveLength(3)
    act(() => root.unmount())
    host.remove()
  })

  it('gives the three marks three different idle timelines', () => {
    // Never in lockstep. Assigning these by hashing the team id put all three
    // on the same timeline on the real feed — three ids into three buckets
    // collide about one time in nine even with a good hash, and this one is
    // worse than that. Place-based assignment cannot collide at all.
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    act(() => root.render(<Podium ranked={rankTeams(TRADING)} />))
    // **Scoped to the mark band.** The rank numerals dance on the same
    // repertoire now, so an unscoped query returns six elements and this
    // assertion would fail on a board that is behaving correctly.
    const marks = [...host.querySelectorAll('.tv-pod-mark-band [class*="tv-idle-"]')]
    expect(marks).toHaveLength(3)
    expect(new Set(marks.map((el) => el.className)).size).toBe(3)

    // And each numeral runs a *different* timeline from the mark beneath it, or
    // the pair would bob as one rigid object rather than as two things that
    // happen to be near each other.
    const slots = [...host.querySelectorAll('.tv-pod-slot')]
    expect(slots).toHaveLength(3)
    for (const slot of slots) {
      // The idle lives on the numeral's *wrapper*, not on the glyph: the glyph
      // carries the travelling shine, and one element cannot hold both
      // animations — the class that came second simply won.
      const numeral = slot.querySelector('.tv-pod-numeral-dance')?.className ?? ''
      const mark = slot.querySelector('.tv-pod-mark-band [class*="tv-idle-"]')?.className ?? ''
      expect(numeral).toMatch(/tv-idle-/)
      expect(numeral.replace('tv-pod-numeral-dance ', '')).not.toBe(mark)
    }
    act(() => root.unmount())
    host.remove()
  })
})

describe('podiumTeams', () => {
  it('never shows more than ten', () => {
    const all = teams().map((row, index) => ({ ...row, totalRevenue: 1000 * (42 - index) }))
    expect(podiumTeams(rankTeams(all))).toHaveLength(10)
  })

  it('keeps the order it is handed', () => {
    // No filtering of its own — it ranks nothing and hides nobody, so the three
    // trading teams lead purely because the comparator put them there.
    expect(podiumTeams(rankTeams(TRADING)).slice(0, 3).map((row) => row.teamId)).toEqual([
      'VBC101',
      'VBC102',
      'VBC103',
    ])
  })
})

describe('WallHeader', () => {
  const snapshotAt = (start: string, end: string) => ({
    teams: teams(),
    cohort: cohort({ challenge_start_iso: start, challenge_end_iso: end }),
  })

  const WINDOW = ['2026-08-18T00:00:00+05:30', '2026-08-31T09:00:00+05:30'] as const

  /**
   * `Date` only, so the component's `setInterval` stays real and `act` behaves.
   * The clock has to be pinned rather than derived from `Date.now()`: a relative
   * window would make the closed-challenge case below pass or fail depending on
   * the day the suite happened to run, which is not a test.
   */
  afterEach(() => {
    vi.useRealTimers()
  })

  it('counts the day while the challenge is open', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-08-19T12:41:00+05:30'))
    const text = render(<WallHeader snapshot={snapshotAt(...WINDOW)} label="2-Week Challenge" />)
    expect(text).toContain('2-Week Challenge')
    expect(text).toContain('Day')
    expect(text).toContain('2')
    expect(text).toContain('of 14')
  })

  /**
   * ── The fifteen hours after the deadline ──
   *
   * Challenge 1 closes at 09:00 on 31 August and challenge 2 opens at midnight,
   * so the wall spends the rest of the 31st with the challenge over and the
   * figures frozen. The day count leaves rather than sticking on "Day 14 of 14",
   * and the band has to stay a band without it — heading and provenance both
   * still present, nothing collapsed into the hole it left.
   */
  it('drops the day count once the deadline passes, and stays a band', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    // 14:00 on 31 August: five hours after the close, seventeen before the next.
    vi.setSystemTime(new Date('2026-08-31T14:00:00+05:30'))
    const text = render(<WallHeader snapshot={snapshotAt(...WINDOW)} label="2-Week Challenge" />)
    expect(text).toContain('2-Week Challenge')
    expect(text).not.toContain('Day')
    // Provenance survives, so a frozen results board still says when it last read.
    expect(text).toContain('Updated')
  })

  /**
   * **The day count belongs to the challenge, not to the window.**
   *
   * Turning `challenge_mode` off deliberately leaves `challenge_start_iso` and
   * `challenge_end_iso` in the sheet — the window is kept for next time rather
   * than deleted, which is the whole reason the switch is its own cell. So the
   * chip is perfectly computable here and must still not render: a board
   * ranking the open week's revenue under `Day 2 of 14` tells a passer-by the
   * figures below are a fortnight's, in the second-loudest element on the
   * frame, with nothing anywhere to report it.
   */
  it('drops the day count in week mode even with a live window', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-08-19T12:41:00+05:30'))
    const text = render(
      <WallHeader snapshot={snapshotAt(...WINDOW)} label="Weekly Leaderboard" mode="week" />,
    )
    expect(text).toContain('Weekly Leaderboard')
    expect(text).not.toContain('Day')
    expect(text).toContain('Updated')
  })
})

describe('WeeklyGrid', () => {
  const board = () =>
    competingTeams(teams().map((row, index) => ({ ...row, challengeRevenue: 1_000 * (42 - index) })))

  /**
   * Identified by figure, not by name: the card no longer prints the venture
   * name at all. The fixtures give every team a distinct challenge revenue, so
   * the figures are what say who is on the board.
   */
  it('puts every competing team on screen at once', () => {
    const text = render(<WeeklyGrid teams={board()} />)
    const ranked = rankByChallenge(board())
    expect(text).toContain(formatRupees(ranked[0].challengeRevenue))
    expect(text).toContain(formatRupees(ranked[COMPETING_SIZE - 1].challengeRevenue))
    // The spares are not on the board at all.
    expect(ranked).toHaveLength(COMPETING_SIZE)
    for (const spare of SPARE_TEAM_IDS) {
      expect(ranked.some((t) => t.teamId === spare)).toBe(false)
    }
  })

  /**
   * Reading order: ten per row, left to right then top to bottom. Rank 1 at the
   * top-left of row 1, the last rank at the end of row 4.
   *
   * **The final row is allowed to be short.** Forge C1 competes 39 teams into
   * 40 slots, so row 4 holds nine cards and the bottom-right slot is empty.
   * `ROW_HEIGHTS` states each row's height rather than using `1fr`, so a short
   * last row keeps its size instead of stretching to swallow the gap — which is
   * what would quietly destroy the rank ramp.
   */
  it('lays the ranks out in reading order, ten to a row', () => {
    const rows = rowsOf(board())
    expect(rows).toHaveLength(4)
    for (const row of rows.slice(0, 3)) expect(row).toHaveLength(ROW_LENGTH)
    expect(rows[3]).toHaveLength(COMPETING_SIZE - 3 * ROW_LENGTH)
    expect(rows[0][0].teamId).toBe('VBC101')
    expect(rows[0][9].teamId).toBe('VBC110')
    expect(rows[1][0].teamId).toBe('VBC111')
    expect(rows[3][rows[3].length - 1].teamId).toBe('VBC139')
  })

  /**
   * Every competing team, always, all visible — never paged, scrolled or
   * rotated. A fit problem is solved by taking height out of the ramp, so a
   * board that quietly started rendering thirty is the failure this asserts
   * against.
   */
  it('renders a card for every competing team, never a subset', () => {
    expect(rowsOf(board()).flat()).toHaveLength(COMPETING_SIZE)
  })

  it('renders an empty board without inventing anything to put in it', () => {
    expect(render(<WeeklyGrid teams={[]} />)).toBe('')
  })
})

describe('VentureCard', () => {
  /**
   * Forty cards showing ₹0 every morning is noise, and the figure exists to say
   * who is moving today. Silence is the honest answer for everyone else.
   */
  it('shows nothing rather than a zero for a team that has not sold today', () => {
    const text = render(<VentureCard team={team({ challengeRevenue: 4_000, todayRevenue: 0 })} rank={7} />)
    expect(text).toContain(formatRupees(4_000))
    expect(text).not.toContain(formatRupees(0))
  })

  it('prints the challenge figure, not the week', () => {
    const text = render(
      <VentureCard team={team({ challengeRevenue: 16_141, weekRevenue: 999 })} rank={7} />,
    )
    expect(text).toContain(formatRupees(16_141))
    expect(text).not.toContain(formatRupees(999))
  })

  /**
   * A team can sit below the total it started the fortnight on, when proof is
   * revoked on a sale logged before the baseline was photographed. Three were on
   * 19 August. The card says so rather than hiding it — and `compareChallenge`
   * has already put such a team at the bottom of the board, beneath the teams
   * that have simply not traded.
   */
  it('prints a team below its baseline in full', () => {
    const text = render(<VentureCard team={team({ challengeRevenue: -3_850 })} rank={38} />)
    expect(text).toContain('-₹3,850')
  })

  /**
   * **Both figures, and the week is the larger.** The card carries the week's
   * revenue and, under it, today's — the anatomy is rank, mark, week, today.
   * The venture name that briefly sat between them is gone: the mark identifies
   * the venture, and today was the only thing on the board saying who is moving
   * now.
   */
  it('prints the week figure and today underneath it', () => {
    const text = render(
      <VentureCard team={team({ challengeRevenue: 12_000, todayRevenue: 3_000 })} rank={7} />,
    )
    expect(text).toContain(formatRupees(12_000))
    expect(text).toContain(formatRupees(3_000))
  })

  /**
   * The name is on the card again. The mark identifies a venture to anyone who
   * already knows it; the name is what the other thirty-nine teams read.
   */
  it('prints the venture name', () => {
    const text = render(
      <VentureCard team={team({ teamId: 'VBC118', ventureName: 'Aurora Bakes' })} rank={9} />,
    )
    expect(text).toContain('Aurora Bakes')
  })

  /**
   * The name left the card's *text*, not the card. An unnamed team competes like
   * any other — `AGENTS.md` is explicit — and with no printed name the mark's
   * alternative text is the only thing naming either kind of team to anything
   * that reads rather than looks. It falls back to the team ID, as `/podium`
   * does, through the same `lib/team.ts`.
   */
  it('names the venture in the mark, falling back to the team id', () => {
    expect(markup(<VentureCard team={team({ ventureName: 'Aurora Bakes' })} rank={9} />)).toContain(
      'Aurora Bakes',
    )
    expect(
      markup(<VentureCard team={team({ teamId: 'VBC122', ventureName: '' })} rank={31} />),
    ).toContain('VBC122')
  })

  /**
   * ── Today is shown, or it is not ──
   *
   * A day that happened is green with a mark; a day that has not happened shows
   * nothing. There is no second colour, because there is no second state: the
   * figure was once compared against the board's average, which meant a team
   * that had sold well still read as failing when the cohort's average was
   * higher.
   */
  it('marks a day that happened and shows nothing for one that did not', () => {
    const traded = markup(<VentureCard team={team({ todayRevenue: 900 })} rank={4} />)
    const quiet = markup(<VentureCard team={team({ todayRevenue: 0 })} rank={4} />)
    expect(traded).toContain('tv-card-today-traded')
    expect(traded).toContain('tv-day-mark')
    expect(quiet).not.toContain('tv-card-today-traded')
    expect(quiet).not.toContain('tv-day-mark')
  })

  it('has no second direction to draw', () => {
    const html = markup(<VentureCard team={team({ todayRevenue: 50 })} rank={4} />)
    expect(html).not.toContain('tv-day-down')
    expect(html).not.toContain('tv-card-today-below')
  })

  it('prints no today tag on a card with no day yet', () => {
    const html = markup(<VentureCard team={team({ challengeRevenue: 9_000, todayRevenue: 0 })} rank={4} />)
    expect(html).toContain('tv-card-today')
    expect(html).not.toContain('tv-card-today-tag')
  })

  /**
   * **A zero week is a figure, not a blank.** The card printed nothing at all
   * for a team that had not traded, on the argument that absence is carried by
   * the card being quiet. On the board it read as ten cards that had failed to
   * load rather than ten teams on nothing — every other card in the column has a
   * number where those had a gap. The em dash stays gone; a zero is not a dash.
   */
  it('prints a zero week as a figure', () => {
    const text = render(<VentureCard team={team({ challengeRevenue: 0, todayRevenue: 0 })} rank={38} />)
    expect(text).toContain(formatRupees(0))
    expect(text).not.toContain('—')
  })

  /**
   * ── The two rules are separate, and this is the pair that proves it ──
   *
   * The surface follows **rank**: past `SOLID_RANKS` a card is the pale kind.
   * The figure is printed on every card whatever it says. Keying the surface off
   * `weekRevenue`, which is what the first build did, put thirty solid cards on
   * a forty-card board.
   */
  it('keeps the figure on a pale card when the team traded', () => {
    const text = render(<VentureCard team={team({ challengeRevenue: 6_440 })} rank={25} />)
    expect(text).toContain(formatRupees(6_440))
  })

  it('prints the zero on a solid card too', () => {
    // A Monday: someone holds rank 3 on a week that has barely started.
    const text = render(<VentureCard team={team({ challengeRevenue: 0, todayRevenue: 0 })} rank={3} />)
    expect(text).toContain(formatRupees(0))
  })

  it('takes the surface from the rank and not from the revenue', () => {
    const earner = team({ challengeRevenue: 6_440 })
    expect(markup(<VentureCard team={earner} rank={SOLID_RANKS} />)).not.toContain('tv-card-quiet')
    expect(markup(<VentureCard team={earner} rank={SOLID_RANKS + 1} />)).toContain('tv-card-quiet')
  })

  /**
   * The rank's ink follows the card it sits on. Asserted because the rule that
   * used to do this — `.tv-card-quiet .tv-card-badge` — was a descendant
   * selector matching a *sibling*, so it never applied and every pale card wore
   * a dark chip. A dead CSS rule reports nothing; this does.
   */
  it('inks a pale card\'s rank for the pale surface', () => {
    const earner = team({ challengeRevenue: 6_440 })
    expect(markup(<VentureCard team={earner} rank={SOLID_RANKS + 1} />)).toContain(
      'tv-card-rank-quiet',
    )
    expect(markup(<VentureCard team={earner} rank={SOLID_RANKS} />)).not.toContain(
      'tv-card-rank-quiet',
    )
  })

  /**
   * ── The rank never lands on artwork ──
   *
   * The card reserves a strip at its top and the mark starts below it, so the
   * separation is a constant of the rhythm rather than a per-rank nudge. This
   * asserts the *structure* that guarantees it — the rendered geometry is
   * measured in a browser at 1920x1080, where a jsdom box has no size.
   */
  it('reserves the rank strip on every card, including the metal ranks', () => {
    for (const rank of [1, 4, COMPETING_SIZE]) {
      expect(markup(<VentureCard team={team({})} rank={rank} />)).toContain('var(--h-card-rank)')
    }
  })

  /**
   * ── What moves during an overtake, and what does not ──
   *
   * The mark travels; the card holds still and keeps its colour. The whole card
   * used to travel, which meant an overtake across rank `SOLID_RANKS` had to
   * change a card's fill in mid-flight — a box changing colour while it slides
   * reads as a rendering fault. This asserts the *structure* that replaced it:
   * a card in a flip wears `tv-card-away`, which is what fades its details out,
   * and it carries no travel of its own.
   */
  it('fades a card in a flip and leaves its surface alone', () => {
    const cue = { role: 'attacker', dx: 0, dy: -120, shift: 0, scale: 0.82 } as const
    const html = markup(
      <VentureCard team={team({ challengeRevenue: 6_440 })} rank={SOLID_RANKS + 3} cue={cue} />,
    )
    expect(html).toContain('tv-card-away')
    expect(html).toContain('tv-card-detail')
    // Nothing schedules a surface change any more.
    expect(html).not.toContain('tv-card-turn')
    expect(html).not.toContain('--tv-turn-at')
  })

  it('leaves a card with no cue unfaded', () => {
    const html = markup(<VentureCard team={team({ challengeRevenue: 6_440 })} rank={9} />)
    expect(html).not.toContain('tv-card-away')
  })
})

/**
 * The marquee's one rule: the visible portion always ends at a word boundary.
 * A continuous scroll cannot promise that, so the name is paged by whole words.
 */
describe('VentureName paging', () => {
  // Every character is 10px wide — a stand-in for the real font, so the cases
  // below are about where the breaks land and not about Manrope's metrics.
  const measure = (s: string) => s.length * 10

  it('keeps whole words on every page', () => {
    const pages = pagesOf('Chai Point Collective', 120, measure)
    expect(pages).toEqual(['Chai Point', 'Collective'])
    for (const page of pages) expect(page).not.toMatch(/^\s|\s$/)
  })

  it('leaves a name that fits as a single page, so it never animates', () => {
    expect(pagesOf('Pluck', 120, measure)).toEqual(['Pluck'])
  })

  /**
   * A single word longer than the card gets its own page and is allowed to
   * overflow it. Splitting it would break the only rule this component has, and
   * a word that long is a data problem rather than a layout one.
   */
  it('never splits a word that is wider than the card', () => {
    expect(pagesOf('Supercalifragilistic', 100, measure)).toEqual(['Supercalifragilistic'])
  })

  it('treats runs of whitespace as one break', () => {
    expect(pagesOf('  Kite   Coffee  ', 120, measure)).toEqual(['Kite Coffee'])
  })

  it('has nothing to page when the name is empty', () => {
    expect(pagesOf('   ', 120, measure)).toEqual([])
  })
})

describe('formatting', () => {
  it('groups rupees the Indian way', () => {
    expect(formatRupees(104_500)).toBe('₹1,04,500')
    expect(formatRupees(240_000)).toBe('₹2,40,000')
  })

  it('writes rank in words so a crop still ranks', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21].map(ordinal)).toEqual([
      '1st',
      '2nd',
      '3rd',
      '4th',
      '11th',
      '12th',
      '13th',
      '21st',
    ])
  })
})

/**
 * The executable form of "the board does not move unless a rank changed".
 *
 * Motion's `layout` prop answers any change in a laid-out child with a shift
 * animation — including a team's week revenue ticking up by ₹200 without moving,
 * which happens on most polls. On a wall that reads as movement, and movement
 * here is supposed to mean something happened. The rule is that the board tree
 * carries no `layout` prop at all; the flip moves cards explicitly instead.
 */
describe('silent reflow', () => {
  it('no component in the board tree uses Motion layout animation', () => {
    for (const file of ['VentureCard.tsx', 'WeeklyGrid.tsx', 'Podium.tsx']) {
      const source = readFileSync(`${process.cwd()}/components/${file}`, 'utf8')
      expect(source, file).not.toMatch(/\blayout(Id)?\b\s*[=:]|\blayout\}/)
    }
  })
})
