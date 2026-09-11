import { describe, expect, it } from 'vitest'

import { GANESH_FROM_MS, GANESH_UNTIL_MS } from '@/config'
import { isEndOfDay, isFestival, istHour } from '@/lib/schedule'

/** 17:59 and 18:00 IST, written as the absolute instants they are. */
const BEFORE_SIX = new Date('2026-08-11T17:59:00+05:30')
const AT_SIX = new Date('2026-08-11T18:00:00+05:30')
const LATE = new Date('2026-08-11T23:59:00+05:30')
const AFTER_MIDNIGHT = new Date('2026-08-12T00:01:00+05:30')

describe('istHour', () => {
  /**
   * The whole reason this module exists. A laptop back from a trip and still set
   * to another timezone would otherwise open the celebration in the middle of
   * the afternoon and look completely deliberate doing it.
   */
  it('reads the hour in Asia/Kolkata whatever the machine is set to', () => {
    expect(istHour(AT_SIX)).toBe(18)
    // The same instant, expressed in UTC. Same answer.
    expect(istHour(new Date('2026-08-11T12:30:00Z'))).toBe(18)
  })
})

describe('isEndOfDay', () => {
  it('starts at 18:00 IST and runs to midnight', () => {
    expect(isEndOfDay(BEFORE_SIX)).toBe(false)
    expect(isEndOfDay(AT_SIX)).toBe(true)
    expect(isEndOfDay(LATE)).toBe(true)
    expect(isEndOfDay(AFTER_MIDNIGHT)).toBe(false)
  })
})

/**
 * The Ganesha window.
 *
 * **Derived from the constants rather than restating them**, and that is the
 * point of this block. The dates move — they are widened for testing and put
 * back — and a test that hardcoded 14 and 16 September would fail every time
 * somebody did that, which trains people to edit the test until it passes.
 * What must never move is the *shape* of the window, so that is what is pinned
 * here: half-open, absolute, and answered on the instant.
 *
 * The one thing this deliberately does not check is which days are configured.
 * That is a fact about the festival, not about this function, and it lives in
 * `config.ts` next to the note explaining why `UNTIL` names the day after the
 * last one.
 *
 * Every instant below carries an explicit `+05:30`, like the constants. A bare
 * `new Date('2026-09-14')` is parsed as **UTC midnight** — 05:30 IST — so a
 * test written that way can sit inside the window while claiming to test its
 * edge.
 */
const SECOND = 1000

describe('isFestival', () => {
  it('opens exactly at GANESH_FROM and not a second earlier', () => {
    expect(isFestival(new Date(GANESH_FROM_MS - SECOND))).toBe(false)
    expect(isFestival(new Date(GANESH_FROM_MS))).toBe(true)
  })

  /**
   * The half-open end, which is why `GANESH_UNTIL_ISO` names the day *after*
   * the last one the ornament shows. Closing it on the last day would take a
   * day off the window — an off-by-one that reports nothing, because a wall
   * that stopped a day early looks exactly like a wall configured to.
   */
  it('runs to the last instant before GANESH_UNTIL, then shuts', () => {
    expect(isFestival(new Date(GANESH_UNTIL_MS - SECOND))).toBe(true)
    expect(isFestival(new Date(GANESH_UNTIL_MS))).toBe(false)
  })

  it('is open somewhere in the middle', () => {
    expect(isFestival(new Date((GANESH_FROM_MS + GANESH_UNTIL_MS) / 2))).toBe(true)
  })

  /**
   * The same guarantee `istHour` exists for, reached a different way. A laptop
   * back from a trip and still set to another timezone must not open or shut
   * the window on its own calendar — and because both bounds are absolute
   * instants, the comparison is correct without asking `Intl` anything.
   *
   * Expressed here as the same instant written two ways: if the implementation
   * ever grew a date-component comparison, these two would stop agreeing.
   */
  it('answers on the instant, not on the machine’s calendar', () => {
    const opensAsUtc = new Date(new Date(GANESH_FROM_MS).toISOString())
    expect(isFestival(opensAsUtc)).toBe(true)
    expect(isFestival(new Date(opensAsUtc.getTime() - SECOND))).toBe(false)
  })

  /**
   * The state that has to be right for most of the year, pinned against fixed
   * dates on purpose: these are the ones that would actually hurt. **The Flea
   * is the important one** — it is the wall's next real event, and a widened
   * test window left in `config.ts` is the way a festival ornament ends up on
   * the board during its run-up.
   */
  it('is shut on the dates that would embarrass the wall', () => {
    expect(isFestival(new Date('2026-10-25T10:00:00+05:30'))).toBe(false) // Mesa Flea
    expect(isFestival(new Date('2026-08-31T00:00:00+05:30'))).toBe(false) // programme start
    expect(isFestival(new Date('2026-12-25T12:00:00+05:30'))).toBe(false)
  })
})
