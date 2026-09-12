// @vitest-environment jsdom
import { readFileSync, readdirSync } from 'node:fs'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { FleaDial } from '@/components/FleaDial'
import { monogramFor } from '@/components/VentureLogo'
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
    const figures = [...host.querySelectorAll('.tv-pod-slot .tv-figure')]
    expect(figures).toHaveLength(3)
    expect(figures.every((el) => el.textContent === '—')).toBe(true)
    act(() => root.unmount())
    host.remove()
  })


  it('draws three places and seven ruled rows, borrowing nothing from /weekly', () => {
    // `.tv-pill` is /weekly's language — rows that close around their own mark.
    // Borrowing it here made slide 1 look like a shorter slide 2. This is the
    // executable form of "do not borrow it back".
    //
    // The counts are the shape of the slide: three places and one row per rank
    // 4-10. They replace an assertion on cards, plinths and bars, which is the
    // same claim about the design that preceded this one, which in turn
    // replaced one about the pillars' shafts and slabs.
    const all = teams().map((row, index) => ({ ...row, totalRevenue: 1_000 * (42 - index) }))
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    act(() => root.render(<Podium ranked={rankTeams(competingTeams(all))} />))
    expect(host.querySelectorAll('.tv-pill')).toHaveLength(0)
    expect(host.querySelectorAll('.tv-pod-slot')).toHaveLength(3)
    // One numeral per place. The numeral used to be drawn twice and split by a
    // card's edge; three is the right count and six would mean the split came
    // back.
    expect(host.querySelectorAll('.tv-pod-numeral')).toHaveLength(3)

    // ── The ornaments stay gone ──
    //
    // Each of these classes was a real element on this slide and each was
    // removed in the editorial pass: a filled card with three inset shadows, a
    // metal plinth with a travelling sheen, and a share bar under every list
    // row whose reference the frame never named. Asserting zero is the cheap
    // half of that decision — the expensive half is that reintroducing any of
    // them is a design argument someone has to make, not a CSS rule that can
    // drift back in.
    expect(host.querySelectorAll('.tv-pod-card')).toHaveLength(0)
    expect(host.querySelectorAll('.tv-pod-foot')).toHaveLength(0)
    expect(host.querySelectorAll('.tv-pod-underbar')).toHaveLength(0)

    // One row per rank 4-10. `.tv-pod-row` is also the class `measurePath`
    // queries to find where a promoted venture's mark starts from, so a rename
    // here silently breaks an overtake into the podium — see `PodiumBoard`.
    expect(host.querySelectorAll('.tv-pod-row')).toHaveLength(7)
    // Six rules, not seven: the last row does not draw one, because the frame's
    // own rule above the footer is the board's bottom edge.
    expect(host.querySelectorAll('.tv-pod-row-rule')).toHaveLength(6)
    act(() => root.unmount())
    host.remove()
  })

  /**
   * ── Every rule in the monogram is a decision, and none of them is visible ──
   *
   * A rendered disc shows two letters. Whether those are the *right* two is a
   * question about a string transformation, and the failure mode is a venture
   * carrying somebody's idea of its initials on a wall for a fortnight with
   * nobody able to tell it was a bug. `ATC (All Things Camphor)` shipped to a
   * screen as `A(` before this existed.
   */
  it('derives a venture\'s two letters', () => {
    const of = (ventureName: string, teamId = 'VBC107') =>
      monogramFor(team({ teamId, ventureName }))

    // The shape the whole thing is for.
    expect(of('Banana Chips')).toBe('BC')
    expect(of('Apple')).toBe('AP')

    // A parenthetical is an expansion, not the name. This is the one that
    // reached a screen.
    expect(of('ATC (All Things Camphor)')).toBe('AT')

    // Punctuation is not a word, so the second letter is the second *venture*.
    expect(of('Wake & Wyze')).toBe('WW')
    expect(of("Nature's Nibbles")).toBe('NN')

    // A leading article is grammar. Five of the current cohort start with
    // `The`, and without this they collapse onto `T?`.
    expect(of('The Nibble Co')).toBe('NC')
    expect(of('The Ugly Mugling')).toBe('UM')
    // ...but an article that is the *whole* name stays, because then it is the
    // name. Nothing is called this; the rule just must not return empty.
    expect(of('The')).toBe('TH')

    // One letter stays one letter. Inventing a second would name a venture
    // something it is not called.
    expect(of('S')).toBe('S')

    // Case and diacritics survive intact.
    expect(of('snackerly')).toBe('SN')
    expect(of('Yōki')).toBe('YŌ')

    // No name yet: the team ID's last two, which agrees with the label printed
    // under the mark, since `nameOf` gives that team its ID as its name.
    expect(of('', 'VBC107')).toBe('07')
    expect(of('   ', 'VBC139')).toBe('39')
  })

  it('idles nothing on /podium, marks included', () => {
    // ── This has been asserted four ways, and the history is the point ──
    //
    // It pinned that the three marks idle on three *different* timelines
    // (hashing the team id put all three on the same one on the real feed —
    // three ids into three buckets collide about one time in nine, and that
    // hash is worse than that). Then it pinned that nothing idles at all, when
    // both boards were stilled. Then the three again, by decision. Now none
    // again, and this time for a reason that is not a preference: the glance is
    // a `rotateY` under a `perspective`, which displaces an off-centre child
    // differently from the element's own centre, so it swung the crown off the
    // mark it sits on once every seventeen seconds.
    //
    // Every version has asserted the same underlying property: **exactly which
    // elements are allowed to move at rest.** That is what the overtake is
    // spending, and it is not something a reader can check from a screenshot,
    // because a screenshot of a moving frame and a still one are the same
    // picture.
    //
    // **The answer to "which" is no longer "none".** The crown's two glints
    // loop, by decision — see the block below and `AGENTS.md`. So this test has
    // stopped meaning "the board is still" and now means the narrower thing it
    // always literally checked: the marks, the numerals and the rows do not
    // move, and the only element that does is the one counted three assertions
    // down. Do not read a passing run here as a quiet slide.
    //
    // Unscoped on purpose. Scoping to the mark band would pass just as happily
    // with a numeral dancing again, which is half the regression this catches.
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    act(() => root.render(<Podium ranked={rankTeams(TRADING)} />))

    expect(host.querySelectorAll('[class*="tv-idle-"]')).toHaveLength(0)
    expect(host.querySelectorAll('[class*="tv-look-"]')).toHaveLength(0)

    // **The crown is the exception, and it is bounded rather than trusted.**
    // One element, and the class it carries is the one whose animation ends —
    // `tv-crown-drop` runs once on mount. A second crown class, or the drop
    // moving onto the mark itself, fails here.
    expect(host.querySelectorAll('.tv-crown-glyph')).toHaveLength(1)

    // **The glints are bounded by count, and by count alone now.** They loop —
    // a pair strikes every six seconds, for as long as the slide is up — so
    // unlike every other assertion in this test they are not a thing that
    // stops. The count is therefore the whole of the budget: six positions on
    // the crown, on `/podium`, firing two at a time. A spark on every stone, or
    // one added to `/weekly`'s cards, renders beautifully and turns three brief
    // events into a wall of twinkling, and it would pass every other test here.
    //
    // **Six elements, two lit.** The number that governs what a passer-by sees
    // is not this one — it is how many share each `animationDelay`, which is
    // the line below. Six sparks on one delay is a crown that flashes all over
    // at once and is still "six glints" to the assertion above it.
    //
    // The *period* is the third thing and a render test cannot reach it; it
    // lives in `@keyframes tv-crown-glint`, where each spark occupies 4% of an
    // eighteen-second cycle and the comment says to lengthen that before
    // shortening it. Measure it in a browser, not here.
    const glints = [...host.querySelectorAll('.tv-crown-glint')]
    expect(glints).toHaveLength(6)
    expect(glints.every((g) => g.closest('.tv-crown') !== null)).toBe(true)

    // Three pairs, two sparks each, and no two pairs on the same beat. This is
    // what stops the crown twinkling in one place — the whole of the change
    // that put six positions on it rather than two.
    const beats = glints.map((g) => (g as HTMLElement).style.animationDelay)
    const perBeat = new Map<string, number>()
    for (const b of beats) perBeat.set(b, (perBeat.get(b) ?? 0) + 1)
    expect(perBeat.size).toBe(6)
    expect([...perBeat.values()].every((n) => n === 1)).toBe(true)

    // And the six sit in six distinct places. A table with a duplicated row
    // fires two sparks from one point, which is the old behaviour wearing the
    // new structure and looks exactly like a single brighter spark.
    const places = new Set(glints.map((g) => g.getAttribute('d')))
    expect(places.size).toBe(6)

    act(() => root.unmount())
    host.remove()
  })

  it('crowns first place, once, and nobody else', () => {
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    act(() => root.render(<Podium ranked={rankTeams(TRADING)} />))

    // One crown on the whole slide. The count is the assertion: a crown on
    // every podium place renders perfectly well and says nothing.
    const crowns = [...host.querySelectorAll('.tv-crown')]
    expect(crowns).toHaveLength(1)

    // And it is on the place the board draws first, which is **not** the first
    // slot in the DOM — the pillars are ordered 2 · 1 · 3, so a crown that had
    // drifted onto rank 2 would still be "the only crown" and would still be at
    // the left of the frame. Anchor it to the leading venture's own mark.
    const slot = crowns[0]!.closest('.tv-pod-slot')
    expect(slot?.textContent).toContain('Aurora Bakes')
    expect(slot?.textContent).toContain('1')
  })

  it('does not crown a board where nobody has traded', () => {
    // Rank 1 on an untraded board is whoever the tie-break put first — lowest
    // team id, on zero, against thirty-eight other ventures on zero. Crowning
    // that is a lie that renders perfectly, for however many days it takes the
    // first sale to land.
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    const nobody = teams([
      { teamId: 'VBC101', ventureName: 'Aurora Bakes', totalRevenue: 0, totalUnits: 0 },
      { teamId: 'VBC102', ventureName: 'Kite Coffee', totalRevenue: 0, totalUnits: 0 },
    ])
    act(() => root.render(<Podium ranked={rankTeams(nobody)} />))
    expect(host.querySelectorAll('.tv-crown')).toHaveLength(0)
  })

  it('crowns one card on /weekly, and its crown does not glint', () => {
    // ── THIS TEST USED TO ASSERT THE OPPOSITE, AND THE OLD ARGUMENT STANDS ──
    //
    // It read: `/podium` ranks all-time revenue and `/weekly` ranks the week or
    // the challenge, so the two boards' rank 1 is usually a **different
    // venture** — crowning both means the wall crowns two teams thirty seconds
    // apart, which a passer-by reads as a fault rather than as two contests.
    //
    // That cost is real and was accepted rather than answered: the crown was
    // asked for on this board directly. What is *not* accepted is the glint.
    // The sparks loop, and this board's whole discipline is that movement means
    // a rank changed hands — so the crown crosses to `/weekly` and its loop
    // does not. `AGENTS.md` scopes the motion exception to "one object, on one
    // slide"; that scope is what this second assertion keeps.
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    act(() => root.render(<WeeklyGrid teams={TRADING} />))
    expect(host.querySelectorAll('.tv-crown')).toHaveLength(1)
    expect(host.querySelectorAll('.tv-crown-glint')).toHaveLength(0)
    act(() => root.unmount())
    host.remove()
  })

  it('idles nothing at all on /weekly', () => {
    // The crown is on this board now, and the glint is not — see the test
    // above. This is where a change that let the sparks follow it across has to
    // fail.
    // The other half of the scope, and the half that is easy to lose. Ten
    // idling marks on a board of thirty-nine is the case the wall's
    // movement rule was written for; three on a slide that exists to celebrate
    // three is the deliberate exception. A change that puts the idle back on
    // this board has to fail here.
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    act(() => root.render(<WeeklyGrid teams={TRADING} />))
    expect(host.querySelectorAll('[class*="tv-idle-"]')).toHaveLength(0)
    expect(host.querySelectorAll('[class*="tv-look-"]')).toHaveLength(0)
    expect(host.querySelectorAll('.tv-crown-glint')).toHaveLength(0)
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
    // No provenance stamp — it is not in the masthead and it is no longer
    // anywhere. See the dedicated test below for why that is pinned.
    expect(text).not.toContain('Updated')
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
    expect(text).not.toContain('Updated')
  })

  /**
   * ── There is no provenance stamp anywhere on the wall ──
   *
   * There was, and this pinned that exactly one of the masthead or the footer
   * carried it. The footers are gone and the stamp went with them, by decision.
   *
   * The assertion is kept, inverted, because **the thing it guards is now a
   * silence rather than a presence.** This wall shows no error state: a failed
   * fetch keeps the last good data and renders perfectly healthy stale numbers
   * for days. The stamp was the only tell, and a future change that quietly
   * reinstates it in one place and not the other would recreate the drift this
   * test caught last time — a wall stamping itself twice is as much a bug as
   * one that does not stamp at all, and neither is visible across a room.
   */
  it('carries no provenance stamp in the masthead', () => {
    const text = render(<WallHeader snapshot={snapshotAt(...WINDOW)} label="Weekly Leaderboard" />)
    expect(text).toContain('Weekly Leaderboard')
    expect(text).not.toContain('Updated')
  })
})

/**
 * ── EVERY `var()` IN THE PROJECT RESOLVES TO A DECLARED TOKEN ──
 *
 * A CSS custom property that is read but never declared is not an error. The
 * `var()` yields nothing, the declaration it sits in becomes invalid at
 * computed-value time, and that one property falls back to its initial value.
 * Nothing logs. Nothing fails to build.
 *
 * **Measured, from a tidy-up that deleted `--d-card-logo-floor` by accident:**
 * `--d-card-logo` is a `max()` of that floor and whatever the row has left, so
 * the whole expression went invalid, `VentureDisc` laid out at `width: auto`,
 * and all thirty-nine marks collapsed to zero — on a board that still rendered
 * its cards, its rank numerals, its venture names and all thirty-nine figures.
 * The same delete took `--t-pod-numeral`, and a `--h-foot` removed with the
 * footers left the dev trigger bar's `bottom: calc(...)` invalid, which moved it
 * to the top of the frame over the masthead.
 *
 * Three silent breakages in one commit, none of them caught by typecheck, lint,
 * the other 170 tests or a build. This is the cheap check that would have.
 */
it('declares every custom property that anything reads', () => {
  const files = [
    'app/mesa-tv.css',
    'app/forge-tokens.css',
    'app/globals.css',
    ...readdirSync('components').filter((f) => f.endsWith('.tsx')).map((f) => `components/${f}`),
    'app/weekly/page.tsx',
    'app/podium/page.tsx',
  ]

  // **Comments are stripped first, and that is not a detail.** These files
  // explain past bugs by quoting the tokens involved — `--card-fill` and
  // `--h-card` are both named in prose about properties that no longer exist or
  // never should have. A scanner that reads prose reports the documentation as
  // the defect.
  const strip = (text: string) =>
    text.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1')
  const source = files.map((f) => strip(readFileSync(f, 'utf8'))).join('\n')

  // Declarations come from the stylesheets *and* from inline styles that set a
  // property on an element — `VentureCard` and `Podium` both do, and a token
  // declared only there is still declared.
  const declared = new Set(
    [
      ...source.matchAll(/(?:^[ \t]*|[;{][ \t]*)(--[a-z0-9-]+)[ \t]*:/gm),
      ...source.matchAll(/'(--[a-z0-9-]+)':/g),
    ].map((m) => m[1]),
  )

  // The design system's own tokens live in a file this does not otherwise scan.
  const system = new Set(
    [
      ...readFileSync('.claude/skills/mesa-design/colors_and_type.css', 'utf8').matchAll(
        /^\s*(--[a-z0-9-]+)\s*:/gm,
      ),
    ].map((m) => m[1]),
  )

  // `next/font` emits these into a class at build time, so they are declared in
  // generated CSS no source file contains. See app/layout.tsx.
  const external = new Set(['--font-mesa-body', '--font-mesa-serif', '--font-rank-italic'])

  // `var(--x, fallback)` cannot fail — a missing token yields the fallback
  // rather than an invalid declaration — so only bare reads are checked.
  const missing = [
    ...new Set([...source.matchAll(/var\(\s*(--[a-z0-9-]+)\s*\)/g)].map((m) => m[1])),
  ]
    .filter((t) => !declared.has(t) && !system.has(t) && !external.has(t))
    .sort()

  expect(missing).toEqual([])
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

  /**
   * ── The flip must survive the page re-rendering under it ──
   *
   * `onSettled` is the only thing that ends a flip and releases the queue, and
   * `VentureCard` arms it as an unmount guard. It used to list the callback in
   * that effect's dependencies, which quietly turned the guard into a
   * *re-render* guard: React runs a cleanup before re-running an effect, so a
   * new function identity from the page reported the flip finished wherever it
   * had got to.
   *
   * The page handed down an inline arrow, so every one of its renders did it —
   * and the renders that matter are exactly the ones that happen when overtakes
   * arrive together. A poll that queues an event bumps `queueVersion`; a dev
   * button does the same. So pressing two or three in a row cut each animation
   * off part-way and started the next over the top of it, which is what the
   * board looked like it was doing: stalling.
   *
   * Nothing about this is visible in a screenshot, and nothing reports it.
   */
  it('does not end a flip just because the page re-rendered', () => {
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    const ranked = rankByChallenge(board())
    const kick = {
      id: 'k',
      attacker: ranked[5].teamId,
      attackerName: ranked[5].ventureName,
      defender: ranked[4].teamId,
      defenderName: ranked[4].ventureName,
      fromRank: 6,
      toRank: 5,
    }
    const first = vi.fn()
    act(() => root.render(<WeeklyGrid teams={board()} kick={kick} onSettled={first} />))
    expect(first).not.toHaveBeenCalled()

    // Same flip, new callback identity — a page re-render, and nothing else.
    const second = vi.fn()
    act(() => root.render(<WeeklyGrid teams={board()} kick={kick} onSettled={second} />))
    expect(first).not.toHaveBeenCalled()
    expect(second).not.toHaveBeenCalled()

    // The guard itself still has to work, and it has to fire the *current*
    // callback: leaving the board mid-flip reports the settle, or the queue
    // wedges forever with nothing on screen moving.
    act(() => root.unmount())
    expect(second).toHaveBeenCalledTimes(1)
    expect(first).not.toHaveBeenCalled()
    host.remove()
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
    // **The capsule is the state.** This asserted a `tv-card-today-traded`
    // modifier alongside the mark; that class switched a bare line to a heavier
    // weight and the accent ink, and it was applied on exactly the condition
    // that decides whether anything renders here at all. A card that has not
    // traded draws no capsule, so its presence carries what the modifier did.
    const traded = markup(<VentureCard team={team({ todayRevenue: 900 })} rank={4} />)
    const quiet = markup(<VentureCard team={team({ todayRevenue: 0 })} rank={4} />)
    expect(traded).toContain('tv-day-delta')
    expect(traded).toContain('tv-day-mark')
    expect(quiet).not.toContain('tv-day-delta')
    expect(quiet).not.toContain('tv-day-mark')
    // The row itself is reserved either way, so thirty-nine cards keep their
    // figures on one line as the day's first sales land.
    expect(quiet).toContain('tv-card-today')
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
   * ── One rank numeral for ranks 4-39, and one for the top three ──
   *
   * This asserted the opposite: that a pale card's rank took its own
   * `tv-card-rank-quiet` ink. The claim behind it was real — the rule that
   * *originally* did this was `.tv-card-quiet .tv-card-badge`, a descendant
   * selector matching a sibling, so it never once applied and every pale card
   * wore a dark chip. A dead CSS rule reports nothing.
   *
   * The quiet class is gone, and for a reason worth pinning rather than
   * quietly dropping: it layered `opacity: 0.72` over `--ink-muted`, which put
   * those numerals near 3.2:1 on the light surface. That fails AA at 17px and
   * no contrast probe would ever have caught it, because a probe reads `color`
   * and not the opacity composited over it.
   *
   * What replaced it is the absence — the quiet half of the board is said by
   * the venture name and the figure stepping back an ink, which the test above
   * pins through `tv-card-quiet` on the card itself. Three statements of one
   * fact, in the element that is pure apparatus, is what got removed.
   */
  it('gives every rank below the top three the same numeral', () => {
    const earner = team({ challengeRevenue: 6_440 })
    for (const rank of [4, SOLID_RANKS, SOLID_RANKS + 1, COMPETING_SIZE]) {
      const html = markup(<VentureCard team={earner} rank={rank} />)
      expect(html).toContain('tv-card-rank')
      expect(html).not.toContain('tv-card-rank-lead')
      expect(html).not.toContain('tv-card-rank-quiet')
    }
  })

  it('gives the top three the lead numeral, and nobody else', () => {
    const earner = team({ challengeRevenue: 6_440 })
    for (const rank of [1, 2, 3]) {
      expect(markup(<VentureCard team={earner} rank={rank} />)).toContain('tv-card-rank-lead')
    }
    expect(markup(<VentureCard team={earner} rank={4} />)).not.toContain('tv-card-rank-lead')
  })

  /**
   * ── The rank never lands on artwork ──
   *
   * The card reserves a band at its top and the mark starts below it, so the
   * separation is a constant of the rhythm rather than a per-rank nudge. This
   * asserts the *structure* that guarantees it — the rendered geometry is
   * measured in a browser at 1920x1080, where a jsdom box has no size.
   *
   * **The band is gone and the mark's own outset replaced it.** The mark sits
   * on the cell now, centred on the card's top edge, so the card starts
   * `--h-mark-out` down and reserves `--h-mark-in` for the overhang. Both are
   * asserted: dropping either is a mark that renders over the name, or a card
   * that starts at the cell's top with the mark floating clear of it.
   */
  it('offsets the card by the mark\u2019s outset on every card', () => {
    for (const rank of [1, 4, COMPETING_SIZE]) {
      const html = markup(<VentureCard team={team({})} rank={rank} />)
      expect(html).toContain('var(--h-mark-out)')
      expect(html).toContain('var(--h-mark-in)')
    }
  })

  /**
   * ── The crown is first place's, on this slide as on `/podium` ──
   *
   * `AGENTS.md` spends gold's whole budget on "one glyph, one rank, one slide",
   * and this is that glyph on that rank on the other slide. What this pins is
   * the "one rank" half: a crown that reached rank 2 would be a second gold
   * object, which the rule says is a new argument rather than an extension.
   */
  it('crowns rank 1 and nobody else', () => {
    expect(markup(<VentureCard team={team({})} rank={1} />)).toContain('tv-crown')
    for (const rank of [2, 3, 4, COMPETING_SIZE]) {
      expect(markup(<VentureCard team={team({})} rank={rank} />)).not.toContain('tv-crown')
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
