import { describe, expect, it } from 'vitest'

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
 * The three days the Ganesha is on the wall, and the two instants either side.
 *
 * Every one of these is written with an explicit `+05:30`, like the constants
 * they test. A bare `new Date('2026-09-14')` is parsed as **UTC midnight**,
 * which is 05:30 IST on the 14th — inside the window either way, so a test
 * written that way would pass while proving nothing about the boundary it
 * claims to check.
 */
const BEFORE_GANESH = new Date('2026-09-13T23:59:59+05:30')
const GANESH_OPENS = new Date('2026-09-14T00:00:00+05:30')
const GANESH_MIDDLE = new Date('2026-09-15T12:00:00+05:30')
const GANESH_LAST_MOMENT = new Date('2026-09-16T23:59:59+05:30')
const GANESH_SHUT = new Date('2026-09-17T00:00:00+05:30')

describe('isFestival', () => {
  it('opens at the first instant of 14 September IST', () => {
    expect(isFestival(BEFORE_GANESH)).toBe(false)
    expect(isFestival(GANESH_OPENS)).toBe(true)
  })

  /**
   * The half-open end, and the reason it is the 17th in `config.ts` rather than
   * the 16th. Naming the last day there would take the ornament down entering
   * the 16th and give two days rather than three — an off-by-one that reports
   * nothing, because a wall that stopped a day early looks exactly like a wall
   * configured to stop a day early.
   */
  it('runs through all of 16 September and shuts as the 17th begins', () => {
    expect(isFestival(GANESH_MIDDLE)).toBe(true)
    expect(isFestival(GANESH_LAST_MOMENT)).toBe(true)
    expect(isFestival(GANESH_SHUT)).toBe(false)
  })

  /**
   * The same guarantee `istHour` exists for, reached a different way. A laptop
   * back from a trip and still set to another timezone must not open or shut
   * the window on its own calendar — and because both bounds are absolute
   * instants, the comparison is correct without asking `Intl` anything.
   */
  it('answers on the instant, not on the machine’s calendar', () => {
    // 2026-09-13T18:30:00Z *is* 2026-09-14T00:00:00+05:30. Same instant, and
    // the window opens on it however the machine is set.
    expect(isFestival(new Date('2026-09-13T18:30:00Z'))).toBe(true)
    // One second earlier is still the 13th in IST, whatever a UTC clock calls it.
    expect(isFestival(new Date('2026-09-13T18:29:59Z'))).toBe(false)
  })

  /** The state that has to be right for 362 days a year. */
  it('is shut the rest of the year, including the Flea', () => {
    expect(isFestival(new Date('2026-09-25T12:00:00+05:30'))).toBe(false) // Anant Chaturdashi
    expect(isFestival(new Date('2026-10-25T10:00:00+05:30'))).toBe(false) // Mesa Flea
    expect(isFestival(new Date('2026-08-31T00:00:00+05:30'))).toBe(false) // programme start
  })
})
