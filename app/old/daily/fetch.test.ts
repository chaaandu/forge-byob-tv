// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { BOARD } from '@/app/old/daily/page'
import { KEYS } from '@/lib/storage'

/**
 * `/daily` goes to the network **once a day**, and this is the gate that makes
 * that true. It lives in its own file because it is the one test here that needs
 * `localStorage` and a clock, and `board.test.ts` is deliberately neither.
 *
 * ── Why this is worth a test at all ──
 *
 * Both ways of getting it wrong are silent and neither is visible on screen.
 * Stuck open, the board polls 1,440 times a day and nothing looks different —
 * the figures are locked either way, so the only symptom is traffic nobody is
 * watching. Stuck shut, the wall stops fetching *for good*: the window is never
 * photographed again, the board holds the same finished day for the rest of the
 * cohort, and it renders perfectly while doing it. That second one is the exact
 * failure this project is built around, and nothing in the product would report
 * it.
 */

const TOTALS = { VBC101: 96_167, VBC102: 899 }
const at = (iso: string) => vi.setSystemTime(new Date(iso))

const seed = (keys: readonly string[]) =>
  localStorage.setItem(KEYS.daily, JSON.stringify(keys.map((key) => ({ key, totals: TOTALS }))))

const withCache = () =>
  localStorage.setItem(KEYS.csv, JSON.stringify({ feedCsv: 'team_id', cohortCsv: 'key,value' }))

beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers({ toFake: ['Date'] })
})
afterEach(() => vi.useRealTimers())

describe('/daily fetches once a day', () => {
  it('fetches when the window has not been photographed, and not after', () => {
    withCache()
    seed(['2026-09-17'])

    // 09:59 — still yesterday's window, and it is already shot.
    at('2026-09-18T09:59:00+05:30')
    expect(BOARD.shouldFetch?.()).toBe(false)

    // 10:00 — a new window opens. This is the one fetch of the day.
    at('2026-09-18T10:00:00+05:30')
    expect(BOARD.shouldFetch?.()).toBe(true)

    // Once photographed, nothing for the rest of the day — including the
    // minute after, the afternoon, and the small hours.
    seed(['2026-09-17', '2026-09-18'])
    for (const iso of [
      '2026-09-18T10:01:00+05:30',
      '2026-09-18T16:00:00+05:30',
      '2026-09-19T03:00:00+05:30',
      '2026-09-19T09:59:00+05:30',
    ]) {
      at(iso)
      expect(BOARD.shouldFetch?.(), iso).toBe(false)
    }

    // And open again at the next ten.
    at('2026-09-19T10:00:00+05:30')
    expect(BOARD.shouldFetch?.()).toBe(true)
  })

  /**
   * **What replaces the retry a timer could not have had.** A `setTimeout` that
   * fires while the network is down has fired and gone, and the day is lost. The
   * gate stays open until a mark is actually written, so the wall keeps asking
   * every minute until one succeeds.
   */
  it('stays open while the fetch keeps failing', () => {
    withCache()
    seed(['2026-09-17'])
    at('2026-09-18T10:00:00+05:30')
    // Five minutes of failed fetches write nothing, so the answer does not change.
    for (let minute = 0; minute < 5; minute += 1) expect(BOARD.shouldFetch?.()).toBe(true)
    seed(['2026-09-17', '2026-09-18'])
    expect(BOARD.shouldFetch?.()).toBe(false)
  })

  /** A browser that has never run the wall fetches whatever the hour is. */
  it('fetches on a completely cold browser', () => {
    at('2026-09-18T16:00:00+05:30')
    expect(BOARD.shouldFetch?.()).toBe(true)
  })

  /**
   * **Marks but no CSV cache is the edge the window condition alone misses.**
   * The board's *teams* come from the cache and only its *figures* come from the
   * marks, so this state has everything needed to compute a board and nothing to
   * draw one on: thirty-nine cards' worth of blank, on a page that has decided
   * it need not fetch until tomorrow morning.
   */
  it('fetches when it holds marks but has nothing to draw', () => {
    seed(['2026-09-17', '2026-09-18'])
    at('2026-09-18T16:00:00+05:30')
    expect(BOARD.shouldFetch?.()).toBe(true)
    withCache()
    expect(BOARD.shouldFetch?.()).toBe(false)
  })

  /**
   * A clock corrected backwards is not a new window. Without the `<` this would
   * re-open the gate and re-photograph a window already on screen.
   */
  it('does not reopen when the clock goes backwards', () => {
    withCache()
    seed(['2026-09-17', '2026-09-18'])
    at('2026-09-17T11:00:00+05:30')
    expect(BOARD.shouldFetch?.()).toBe(false)
  })
})
