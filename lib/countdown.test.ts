import { describe, expect, it } from 'vitest'

import { PROGRAMME_START_MS } from '@/config'
import { computeCountdownState, mastheadCountdown } from '@/lib/countdown'

/** The real target: Mesa Flea, 6 September 2026, 10:00 IST. */
const FLEA = Date.parse('2026-09-06T10:00:00+05:30')

const at = (iso: string) => computeCountdownState(FLEA, Date.parse(iso))

describe('computeCountdownState', () => {
  it('shows the IST calendar-day count when the Flea is 15 or more days out', () => {
    // 12 Aug, midday IST — 24d 22h remain, said aloud as "25 days away".
    expect(at('2026-08-12T12:00:00+05:30')).toMatchObject({
      display: '25',
      mode: 'days',
      numeric: 25,
    })
    // Still 25 at three in the morning of the same IST date: the count is
    // calendar days, so it changes at midnight IST, never mid-morning.
    expect(at('2026-08-12T03:22:00+05:30').display).toBe('25')
    expect(at('2026-08-11T23:59:00+05:30').display).toBe('26')
    // Exactly 15 days: still the plain count.
    expect(at('2026-08-22T10:00:00+05:30')).toMatchObject({
      display: '15',
      mode: 'days',
      numeric: 15,
    })
  })

  it('shows days and hours inside 15 days, floored like a clock', () => {
    expect(at('2026-08-27T10:00:00+05:30')).toMatchObject({
      display: '10D 0H',
      mode: 'daysHours',
      numeric: 10,
    })
    expect(at('2026-08-31T05:30:00+05:30')).toMatchObject({
      display: '6D 4H',
      mode: 'daysHours',
      numeric: 6,
    })
    // Exactly 24 hours left is still this mode; the ticking timer starts below it.
    expect(at('2026-09-05T10:00:00+05:30')).toMatchObject({
      display: '1D 0H',
      mode: 'daysHours',
      numeric: 1,
    })
  })

  it('ticks a live HH:MM:SS timer inside the final 24 hours', () => {
    expect(at('2026-09-05T23:00:00+05:30')).toMatchObject({
      display: '11:00:00',
      mode: 'timer',
      numeric: 11 * 3600,
    })
    const state = at('2026-09-06T05:47:27+05:30')
    expect(state.display).toBe('04:12:33')
    expect(state.mode).toBe('timer')
    expect(state.numeric).toBe(4 * 3600 + 12 * 60 + 33)
  })

  it('says LIVE NOW from the opening bell to the end of the event', () => {
    expect(at('2026-09-06T10:00:00+05:30').mode).toBe('live')
    const mid = at('2026-09-06T12:00:00+05:30')
    expect(mid).toMatchObject({ display: 'LIVE NOW', mode: 'live', numeric: null })
    // 17:59 IST — the eighth hour is still running.
    expect(at('2026-09-06T17:59:59+05:30').mode).toBe('live')
  })

  it('hides entirely once the event has ended', () => {
    // 18:00 IST on the day — exactly flea + 8 hours.
    expect(at('2026-09-06T18:00:00+05:30')).toMatchObject({
      display: '',
      mode: 'hidden',
      numeric: null,
    })
    expect(at('2026-09-07T10:00:00+05:30').mode).toBe('hidden')
  })

  it('defaults `now` to the real clock', () => {
    // Target one hour ahead of whatever now is: must land in timer mode.
    const state = computeCountdownState(Date.now() + 3_600_000 + 500)
    expect(state.mode).toBe('timer')
  })
})

/**
 * The dial's arc. Progress is elapsed *programme* time — anchor to Flea — not
 * a trailing window, so a half-full ring means the cohort is half over and
 * says something true rather than decorative.
 */
describe('progress', () => {
  /**
   * **Read from config, not restated here.** `computeCountdownState` defaults
   * its third argument to `PROGRAMME_START_MS`, so a literal date in this file
   * is a second copy of the anchor that goes stale silently: when the anchor
   * moved to Forge C1's 1 September, the two "is 0 / clamps" assertions kept
   * passing by accident — everything before the real start clamps to 0 — and
   * only the halfway case failed.
   */
  const START = PROGRAMME_START_MS

  it('is 0 at the programme start and 1 at the Flea', () => {
    expect(computeCountdownState(FLEA, START).progress).toBe(0)
    expect(computeCountdownState(FLEA, FLEA - 1).progress).toBeCloseTo(1, 3)
  })

  it('is the elapsed fraction of the programme in between', () => {
    const halfway = START + (FLEA - START) / 2
    expect(computeCountdownState(FLEA, halfway).progress).toBeCloseTo(0.5, 3)
  })

  it('clamps rather than going negative before the programme starts', () => {
    // A wall booted early shows an empty ring, never a backwards arc.
    expect(computeCountdownState(FLEA, Date.parse('2026-07-01T00:00:00+05:30')).progress).toBe(0)
  })

  it('is 1 once the event is live and after it is hidden', () => {
    expect(computeCountdownState(FLEA, FLEA + 1000).progress).toBe(1)
    expect(computeCountdownState(FLEA, FLEA + 9 * 60 * 60 * 1000).progress).toBe(1)
  })

  it('does not divide by zero when the Flea is at or before the anchor', () => {
    // A misconfigured sheet, not a countdown. A full ring is the honest
    // answer: there is no journey left to show.
    expect(computeCountdownState(START, START - 1000, START).progress).toBe(1)
  })
})

describe('mastheadCountdown', () => {
  const band = (iso: string) => mastheadCountdown(at(iso))

  it('counts whole weeks beyond seven days, rounded to nearest', () => {
    // 25 calendar days out. 25/7 is 3.57, which rounds to 4 and floors to 3 —
    // and 4 is what the approved design renders, which is what settles it.
    expect(band('2026-08-12T12:00:00+05:30')).toEqual({ figure: '4', label: 'Weeks to go' })
    // Worth pinning: nearest is *not* the same as "never understates". 24 days
    // rounds down to 3 weeks and understates by three. If that ever matters more
    // than matching the design, this is the assertion that has to change first.
    expect(band('2026-08-13T12:00:00+05:30')).toEqual({ figure: '3', label: 'Weeks to go' })
  })

  it('counts days between three and seven out', () => {
    expect(band('2026-08-31T12:00:00+05:30')).toEqual({ figure: '6', label: 'Days to go' })
    expect(band('2026-09-03T09:00:00+05:30')).toEqual({ figure: '3', label: 'Days to go' })
  })

  it('becomes a days:hours:minutes clock inside three days', () => {
    // Not padded to two digits. `2:14:30` is a duration; `02:14:30` reads as a
    // time of day, and the wall has no reason to show one.
    expect(band('2026-09-03T19:30:00+05:30')).toEqual({ figure: '2:14:30', label: 'To go' })
  })

  it('becomes an hours:minutes:seconds clock on the final day', () => {
    expect(band('2026-09-06T05:47:12+05:30')).toEqual({ figure: '4:12:48', label: 'To go' })
  })

  it('says LIVE during the event and nothing at all after it', () => {
    expect(band('2026-09-06T12:00:00+05:30')).toEqual({ figure: 'LIVE', label: 'Now' })
    // Gone for good rather than showing a stale memento. The spine closes up
    // around the gap; there is no placeholder.
    expect(band('2026-09-07T12:00:00+05:30')).toBeNull()
  })

  it('bands the same state the dial does, without differencing the clock again', () => {
    // The one brain, two presentations. At 25 days out the dial says "25" and
    // the masthead says "4 weeks" — the same `CountdownState`, read differently.
    const state = at('2026-08-12T12:00:00+05:30')
    expect(state.mode).toBe('days')
    expect(state.display).toBe('25')
    expect(mastheadCountdown(state)?.figure).toBe('4')
  })
})
