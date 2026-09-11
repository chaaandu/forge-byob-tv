import { describe, expect, it } from 'vitest'

import { challengeDay } from '@/lib/challenge'

const start = new Date('2026-08-18T00:00:00+05:30')
/** Challenge 1's real close: 09:00 IST on 31 August, not end of day. */
const end = new Date('2026-08-31T09:00:00+05:30')

describe('challengeDay', () => {
  it('counts a fourteen-day challenge from day one', () => {
    expect(challengeDay(start, end, Date.parse('2026-08-18T09:00:00+05:30'))).toEqual({
      day: 1,
      total: 14,
    })
    expect(challengeDay(start, end, Date.parse('2026-08-19T12:41:00+05:30'))).toEqual({
      day: 2,
      total: 14,
    })
    expect(challengeDay(start, end, Date.parse('2026-08-31T08:59:00+05:30'))).toEqual({
      day: 14,
      total: 14,
    })
  })

  /**
   * A window that is not a whole number of days.
   *
   * 18 Aug 00:00 → 31 Aug 09:00 is 13 days and 9 hours, and `ceil` is what makes
   * that a **fourteen**-day challenge rather than a thirteen-day one. `floor`
   * would print "of 13" and `round` would agree with `ceil` here only by luck —
   * at 13 days and 9 hours it rounds to 13.
   */
  it('counts the part-day at the end as a day', () => {
    expect(challengeDay(start, end, Date.parse('2026-08-18T09:00:00+05:30'))?.total).toBe(14)
  })

  /**
   * The deadline is 09:00, so the wall stops counting at 09:00 — it does not sit
   * on "Day 14 of 14" for the rest of the day. Between the close and the next
   * challenge opening the band simply shows nothing, which is the same silence
   * the Flea countdown keeps once its event is over.
   */
  it('shows nothing once the deadline passes, not a stuck final day', () => {
    expect(challengeDay(start, end, Date.parse('2026-08-31T09:30:00+05:30'))).toBeNull()
    expect(challengeDay(start, end, Date.parse('2026-08-31T20:00:00+05:30'))).toBeNull()
  })

  /**
   * ── The reason this module has no timezone arithmetic ──
   *
   * `challenge_start_iso` carries `+05:30`, so the instant it names *is* IST
   * midnight, and differencing two absolute instants rolls the day there
   * automatically. The last two assertions are the same two instants named from
   * UTC rather than IST: a laptop set to London must produce the same day
   * number as one set to Kolkata, or the wall is wrong on any machine but one.
   */
  it('rolls the day at IST midnight, whatever the machine is set to', () => {
    expect(challengeDay(start, end, Date.parse('2026-08-19T23:59:00+05:30'))?.day).toBe(2)
    expect(challengeDay(start, end, Date.parse('2026-08-20T00:01:00+05:30'))?.day).toBe(3)
    expect(challengeDay(start, end, Date.parse('2026-08-19T18:29:00Z'))?.day).toBe(2)
    expect(challengeDay(start, end, Date.parse('2026-08-19T18:31:00Z'))?.day).toBe(3)
  })

  /**
   * Four cases that all render as nothing and all mean the same thing: no claim
   * to make. A wall between challenges says nothing rather than counting a day
   * that does not exist — the convention the Flea countdown already follows once
   * its event is over.
   */
  it('is null before it opens, after it closes, and when the sheet is silent', () => {
    expect(challengeDay(start, end, Date.parse('2026-08-17T23:00:00+05:30'))).toBeNull()
    expect(challengeDay(start, end, Date.parse('2026-09-01T00:30:00+05:30'))).toBeNull()
    expect(challengeDay(null, end, Date.now())).toBeNull()
    expect(challengeDay(start, null, Date.now())).toBeNull()
  })

  /** Challenge 2, which the sheet rolls to on 1 September. Same arithmetic. */
  it('counts the next challenge without a code change', () => {
    const nextStart = new Date('2026-09-01T00:00:00+05:30')
    const nextEnd = new Date('2026-09-14T23:59:59+05:30')
    expect(challengeDay(nextStart, nextEnd, Date.parse('2026-09-01T08:00:00+05:30'))).toEqual({
      day: 1,
      total: 14,
    })
  })
})
