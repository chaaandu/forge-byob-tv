import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { MARKS_KEPT, dailyEarned, markWindow, needsMark, windowOf, windowPeriod } from '@/lib/daily'
import type { DailyMark } from '@/lib/daily'
import { istWindowKey } from '@/lib/schedule'
import { team } from '@/test/fixtures'

const at = (iso: string) => new Date(iso)

/**
 * Where a day begins for `/daily`.
 *
 * Every assertion here is about a boundary that is wrong by exactly one day, and
 * a board that is one day out is a complete, plausible, well-ranked leaderboard
 * of the wrong twenty-four hours. Nothing on the wall would report it.
 */
describe('istWindowKey', () => {
  it('closes the window at ten, not at midnight', () => {
    expect(istWindowKey(at('2026-09-18T09:59:59+05:30'))).toBe('2026-09-17')
    expect(istWindowKey(at('2026-09-18T10:00:00+05:30'))).toBe('2026-09-18')
  })

  /** The whole point of the hour: the roll happens with the building empty. */
  it('holds one key from ten in the morning until ten the next morning', () => {
    const key = '2026-09-18'
    for (const iso of [
      '2026-09-18T10:00:00+05:30',
      '2026-09-18T13:44:00+05:30',
      '2026-09-18T23:59:59+05:30',
      '2026-09-19T00:00:00+05:30',
      '2026-09-19T09:59:59+05:30',
    ]) {
      expect(istWindowKey(at(iso)), iso).toBe(key)
    }
    expect(istWindowKey(at('2026-09-19T10:00:00+05:30'))).toBe('2026-09-19')
  })

  /** Stepping back a day must cross a month and a year, not just a date. */
  it('steps back across a month and a year boundary', () => {
    expect(istWindowKey(at('2026-10-01T09:00:00+05:30'))).toBe('2026-09-30')
    expect(istWindowKey(at('2027-01-01T09:00:00+05:30'))).toBe('2026-12-31')
  })

  /**
   * The failure this is guarding: the wall runs from a laptop that travels, and
   * one still set to another timezone would close the window at whatever 10am
   * meant there. `Intl` is asked for IST explicitly, so the machine cannot reach
   * it — this pins that, by asking about the same instants expressed elsewhere.
   */
  it('reads the same instant the same way whatever the machine is set to', () => {
    // 10:00 IST is 04:30 UTC and 21:30 the previous day in Los Angeles. All
    // three spellings are one instant, and all three are inside the same window.
    expect(istWindowKey(at('2026-09-18T04:30:00Z'))).toBe('2026-09-18')
    expect(istWindowKey(at('2026-09-17T21:30:00-07:00'))).toBe('2026-09-18')
    // And one minute earlier is the previous window, in every spelling.
    expect(istWindowKey(at('2026-09-18T04:29:00Z'))).toBe('2026-09-17')
  })
})

const rows = [
  team({ teamId: 'VBC101', totalRevenue: 96_167 }),
  team({ teamId: 'VBC107', totalRevenue: 37_972 }),
]

describe('markWindow', () => {
  it('photographs every team‘s all-time total under the window‘s key', () => {
    expect(markWindow([], rows, '2026-09-18')).toEqual([
      { key: '2026-09-18', totals: { VBC101: 96_167, VBC107: 37_972 } },
    ])
  })

  /**
   * **Once per window, and the identity is load-bearing.** The caller skips its
   * `localStorage` write when the array comes back unchanged, which is 1,439 of
   * the 1,440 polls in a day.
   */
  it('returns the same array, by identity, for a window already closed', () => {
    const marks = markWindow([], rows, '2026-09-18')
    const grown = rows.map((row) => ({ ...row, totalRevenue: row.totalRevenue + 5_000 }))
    expect(markWindow(marks, grown, '2026-09-18')).toBe(marks)
  })

  /**
   * The bug this forbids: re-photographing on every poll would walk the opening
   * edge forward all day, so by six in the evening the board would be showing a
   * shrinking eight-hour window under a masthead claiming a day.
   */
  it('never moves a window‘s opening edge once it is set', () => {
    let marks = markWindow([], rows, '2026-09-17')
    marks = markWindow(marks, rows, '2026-09-18')
    const opened = windowOf(marks)?.opened
    const later = markWindow(
      marks,
      rows.map((row) => ({ ...row, totalRevenue: row.totalRevenue * 2 })),
      '2026-09-18',
    )
    expect(windowOf(later)?.opened).toBe(opened)
    expect(windowOf(later)).toEqual(windowOf(marks))
  })

  /** A laptop corrected by NTP, or one whose timezone was just fixed. */
  it('writes nothing when the clock has gone backwards', () => {
    const marks = markWindow([], rows, '2026-09-18')
    expect(markWindow(marks, rows, '2026-09-17')).toBe(marks)
  })

  it('keeps only the newest pair', () => {
    let marks: readonly DailyMark[] = []
    for (const key of ['2026-09-15', '2026-09-16', '2026-09-17', '2026-09-18']) {
      marks = markWindow(marks, rows, key)
    }
    expect(marks).toHaveLength(MARKS_KEPT)
    expect(marks.map((mark) => mark.key)).toEqual(['2026-09-17', '2026-09-18'])
  })
})

/**
 * The gate on `/daily`'s network access. It is the same condition `markWindow`
 * acts on — that function asks this one — so the board cannot come to fetch on
 * a schedule that disagrees with when it photographs.
 */
describe('needsMark', () => {
  const marks = markWindow([], rows, '2026-09-18')

  it('is true exactly once per window', () => {
    expect(needsMark(marks, '2026-09-18')).toBe(false)
    expect(needsMark(marks, '2026-09-19')).toBe(true)
  })

  /** A wall that has never run has to fetch whatever the hour is. */
  it('is true for a wall with no marks at all', () => {
    expect(needsMark([], '2026-09-18')).toBe(true)
  })

  /**
   * **It stays true until a mark is actually written**, which is what replaces
   * the retry a `setTimeout` could not have. The network being down at ten does
   * not cost the day: nothing was photographed, so the next minute asks again.
   */
  it('stays true while the fetch keeps failing', () => {
    let held: readonly DailyMark[] = marks
    for (let minute = 0; minute < 5; minute += 1) {
      expect(needsMark(held, '2026-09-19')).toBe(true)
      // the fetch failed, so nothing was marked
      held = held
    }
    expect(needsMark(markWindow(held, rows, '2026-09-19'), '2026-09-19')).toBe(false)
  })

  /** A clock corrected backwards is not a new window to go and fetch. */
  it('is false for a key older than the newest mark', () => {
    expect(needsMark(marks, '2026-09-17')).toBe(false)
  })

  /**
   * The pair that must never drift: if these two disagreed, the board would
   * either fetch 1,440 times a day or stop fetching for good.
   */
  it('agrees with markWindow on every key', () => {
    for (const key of ['2026-09-17', '2026-09-18', '2026-09-19', '2026-10-01']) {
      const wrote = markWindow(marks, rows, key) !== marks
      expect(wrote, key).toBe(needsMark(marks, key))
    }
  })
})

describe('windowOf', () => {
  const opened = { key: '2026-09-17', totals: { VBC101: 90_000, VBC107: 37_000 } }
  const closed = { key: '2026-09-18', totals: { VBC101: 96_167, VBC107: 37_972 } }

  it('is the difference between the two photographs', () => {
    expect(windowOf([opened, closed])).toEqual({
      opened: '2026-09-17',
      closed: '2026-09-18',
      earned: { VBC101: 6_167, VBC107: 972 },
    })
  })

  /**
   * The cold start, and it is a state rather than a fault: a laptop plugged in
   * for the first time prints ₹0 on every card until the next ten o'clock.
   */
  it('is null until there are two marks', () => {
    expect(windowOf([])).toBeNull()
    expect(windowOf([closed])).toBeNull()
    expect(dailyEarned(null, 'VBC101')).toBe(0)
  })

  /**
   * **The one that would have put a false leader on the board.** `TV_Feed`
   * publishes whatever is in `Team Links` and has already grown; reading "absent
   * from the older photograph" as "had ₹0 then" hands a newly listed team its
   * entire all-time revenue as one day's takings, at the top of the board, for
   * twenty-four hours, with nothing to report it.
   */
  it('leaves out a team the opening mark never saw', () => {
    const grown = {
      key: '2026-09-18',
      totals: { ...closed.totals, VBC140: 250_000 },
    }
    const day = windowOf([opened, grown])
    expect(day?.earned).not.toHaveProperty('VBC140')
    expect(dailyEarned(day, 'VBC140')).toBe(0)
  })

  /**
   * Proof revoked on a sale logged before the mark shrinks the all-time total
   * while the photograph still shows the larger number. Three teams were in that
   * state on 19 August. Clamping would collapse "went backwards" into "has not
   * traded", and the first is news.
   */
  it('carries a negative day', () => {
    const revoked = { key: '2026-09-18', totals: { VBC101: 86_000, VBC107: 37_972 } }
    expect(windowOf([opened, revoked])?.earned.VBC101).toBe(-4_000)
  })

  /** A team that dropped out of the feed is simply not in the window. */
  it('leaves out a team the closing mark no longer sees', () => {
    const shrunk = { key: '2026-09-18', totals: { VBC101: 96_167 } }
    expect(windowOf([opened, shrunk])?.earned).toEqual({ VBC101: 6_167 })
  })
})

/**
 * The field `detect` compares to decide whether to stay quiet. It has to change
 * at ten o'clock — that is the tick where all thirty-nine figures change at
 * once, and every team whose new day beat its old one would otherwise read as
 * having overtaken somebody.
 */
describe('windowPeriod', () => {
  const day = (closed: string) => ({ opened: 'x', closed, earned: {} })

  it('changes when the window rolls and holds while it does not', () => {
    expect(windowPeriod(day('2026-09-18'))).toBe(20_260_918)
    expect(windowPeriod(day('2026-09-18'))).toBe(windowPeriod(day('2026-09-18')))
    expect(windowPeriod(day('2026-09-19'))).not.toBe(windowPeriod(day('2026-09-18')))
  })

  /** Ordered, so a stored period from last week can never equal this one's. */
  it('increases with the date across a month and a year', () => {
    const keys = ['2026-09-30', '2026-10-01', '2026-12-31', '2027-01-01']
    const periods = keys.map((key) => windowPeriod(day(key)) ?? 0)
    expect(periods).toEqual([...periods].sort((a, b) => a - b))
    expect(new Set(periods).size).toBe(keys.length)
  })

  /** Both unreadable answers route into the silence a cold start already has. */
  it('is null for no window and for a malformed key', () => {
    expect(windowPeriod(null)).toBeNull()
    expect(windowPeriod(day('18 Sep'))).toBeNull()
    expect(windowPeriod(day(''))).toBeNull()
  })
})

/**
 * The executable form of "the window reads no clock".
 *
 * Which window an instant belongs to is `istWindowKey`'s single job, in the one
 * module allowed to ask the time. If this file reached for `Date` as well there
 * would be two answers to that question, and the day they disagreed — the day a
 * laptop is set to another timezone — the wall would photograph a window it had
 * already closed and re-base the whole board onto it. Same guard, and the same
 * argument, as `lib/overtake.ts` and `lib/ranking.ts`.
 */
describe('purity', () => {
  it('lib/daily.ts touches no clock, randomness, storage, network or DOM', () => {
    const source = readFileSync(new URL('./daily.ts', import.meta.url), 'utf8')
    const body = source.replace(/\/\*\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    expect(body).not.toMatch(
      /\bDate\b|Math\.random|localStorage|sessionStorage|\bfetch\b|\bwindow\b|\bdocument\b/,
    )
  })
})
