'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

import { POLL_INTERVAL_MS } from '@/config'
import { markWindow, windowOf, type DailyWindow } from '@/lib/daily'
import { fetchCsv, parseSnapshot, passesRowGate } from '@/lib/feed'
import { openWeek } from '@/lib/feed'
import { detect } from '@/lib/overtake'
import { istWindowKey } from '@/lib/schedule'
import {
  enqueueKicks,
  readBoard,
  readCsvCache,
  readDailyMarks,
  writeBoard,
  writeCsvCache,
  writeDailyMarks,
} from '@/lib/storage'
import type { Cohort, Snapshot, Team } from '@/lib/types'

/**
 * The 60-second loop. The only module in the project that touches `fetch`,
 * `setInterval` or the visibility API.
 *
 * ── Only a visible page fetches ──
 *
 * `/podium` and `/daily` stay reachable as standalone URLs for inspection, so
 * two of them can be open at once with only one on screen. Without this gate,
 * two renderers would each run a read-compute-write cycle every 60 seconds
 * against the same localStorage: duplicated animations and clobbered writes.
 *
 * The rotation shell in session 2 fetches once at the shell level and passes
 * data down, which is the normal path. This gate is what keeps the standalone
 * URLs honest alongside it.
 */
export type WallData = {
  snapshot: Snapshot | null
  /**
   * The finished day `/daily` is showing, or `null` before a wall has two
   * marks. `/podium` ignores it.
   *
   * **Applied in the same commit as the snapshot it was computed beside**, which
   * is why the two are held in one piece of state rather than two. A window that
   * landed a render before or after its snapshot would rank the board on one
   * poll's figures while printing another's — briefly, silently, and at exactly
   * the tick a flip might be reading positions.
   */
  day: DailyWindow | null
  /** Bumped whenever kicks were queued, so the player knows to look. */
  queueVersion: number
  /** Start holding snapshots instead of applying them. Called when a kick starts. */
  freeze: () => void
  /** Stop holding, and apply the newest held snapshot if one arrived. Called on settle. */
  thaw: () => void
}

/**
 * How a board ranks itself and how far down it cares about a change.
 *
 * Passed in by the page rather than looked up here, because the two boards rank
 * on different figures and a shared answer would be wrong for one of them.
 */
export type BoardSpec = {
  /** Storage namespace. `/podium` and `/daily` must not share a memory. */
  name: string
  /**
   * Both are handed the cohort as well as the teams, because `/daily` ranks on
   * a figure the *sheet* chooses — `challenge_mode` decides between the
   * challenge total and the week's. The spec itself must stay a stable module
   * constant (see the note at the foot of `tick`), so the mode cannot be baked
   * into it at construction; it has to be read per fetch, from the fetch.
   */
  rank: (teams: readonly Team[], cohort: Cohort, day: DailyWindow | null) => Team[]
  earned: (team: Team, cohort: Cohort, day: DailyWindow | null) => number
  watchTo: number
  /**
   * What counts as "the period this board's figure resets with", read off the
   * cohort and the day. Defaults to the programme week.
   *
   * `detect` goes silent when this number changes, because that is the tick
   * where every figure on the board drops to zero together and forty resets
   * must not read as forty overtakes.
   *
   * `/daily` overrides it with `boardPeriod`, which folds three such ticks into
   * one number space: ten o'clock every morning, a challenge rolling over, and
   * the `challenge_mode` cell being edited. `/podium` leaves it alone — its
   * figure is the all-time total, which never resets at all.
   */
  period?: (cohort: Cohort, day: DailyWindow | null) => number | null
  /**
   * Whether this tick should go to the network at all. Default: every tick,
   * which is what `/podium` wants and what this loop has always done.
   *
   * ── `/daily` fetches once a day, and this is how ──
   *
   * Its figures are a *finished* day that changes only at 10:00, so polling the
   * sheet every sixty seconds asks 1,439 questions a day whose answer cannot
   * change anything on screen. This lets the board say so: it returns `true`
   * only when the current window has not been photographed yet, which happens
   * exactly once per day.
   *
   * **The clock keeps ticking; only the fetching stops.** The interval below is
   * untouched and still runs every sixty seconds — it just asks a local
   * question first and usually answers it without a request. That is the whole
   * mechanism, and it is deliberately not a `setTimeout` to the next ten
   * o'clock: `needsMark` in `lib/daily.ts` has the three reasons, all of which
   * are about a laptop that sleeps and that nobody is standing at.
   *
   * **A board that skips its fetch still renders.** Nothing about the board's
   * figures comes from the tick — they come from the two marks in storage — and
   * the mount-time cache read above is what keeps everything else it draws
   * current. On the wall that cache is warm, because `/podium` is fetching every
   * sixty seconds and the two slides share it.
   */
  shouldFetch?: () => boolean
}

/**
 * What the board renders from, applied as one unit.
 *
 * The snapshot and the window are a pair by construction: the window is
 * computed from the marks as they stood when that snapshot was gated, and the
 * comparator reads one while the cards print the other. Two `useState` calls
 * would let them land in separate commits, and a board sorted on one poll's
 * window while printing the next poll's figures is the precise failure this
 * project is built around — plausible, well-ranked, and reported by nothing.
 */
type Applied = { snapshot: Snapshot; day: DailyWindow | null }

export function useWallData(board: BoardSpec): WallData {
  const [applied, setApplied] = useState<Applied | null>(null)
  const [queueVersion, setQueueVersion] = useState(0)
  const running = useRef(false)

  /**
   * ── The freeze is what keeps a kick self-contained ──
   *
   * Rows are keyed by team id, so the moment a re-sorted snapshot lands, React
   * moves every keyed row to its new grid slot — instantly, silently, under
   * whatever is animating. A poll arriving mid-kick would reorder the board
   * beneath the two rows performing on it, and the whole rows-are-the-actors
   * architecture fails without a visible error. So while a kick plays, ticks
   * still fetch, gate, cache and detect exactly as always — but the snapshot is
   * *held* here rather than applied, and lands when the animation settles. The
   * sequence never depends on when the data poll happens to arrive.
   *
   * The hold has a second arm: the tick that *detects* an overtake also holds
   * its own snapshot. That tick's data is the re-sorted board; applying it
   * immediately would put the attacker in its new slot one render before the
   * kick starts, and the animation would then perform a climb that had already
   * happened. Holding it is what makes the end of the kick seamless — the
   * animation carries the rows to exactly the positions the held snapshot
   * assigns them on settle.
   *
   * One mechanism, not two: there is no polling pause and no second ordering
   * path. Ticks run on their clock; only `setSnapshot` is deferred.
   */
  const frozen = useRef(false)
  const pending = useRef<Applied | null>(null)

  const freeze = useCallback(() => {
    frozen.current = true
  }, [])

  const thaw = useCallback(() => {
    frozen.current = false
    if (pending.current === null) return
    const held = pending.current
    pending.current = null
    setApplied(held)
  }, [])

  /**
   * First paint reads the cached CSV, before the browser paints. This is why
   * the wall never shows a spinner: it comes up holding the last thing it knew,
   * and a cold cache renders the empty structure, which is a valid state.
   */
  /**
   * First paint reads the cached CSV **and the stored marks**, so a wall that
   * has been running comes up with a full board rather than with thirty-nine
   * names and thirty-nine zeroes for the first minute. The window is the half
   * that matters here: the CSV cache alone would paint the right teams under the
   * right heading with every figure missing, which looks like a wall whose feed
   * has died and is exactly what the cache exists to prevent.
   */
  useLayoutEffect(() => {
    const cached = readCsvCache()
    if (!cached) return
    try {
      // A mount-only read of an external store that must land before paint.
      //
      // A lazy `useState` initialiser cannot be used here: both pages are
      // prerendered, so seeding state from localStorage during the first render
      // would disagree with the server HTML and break hydration.
      // `useLayoutEffect` re-renders synchronously before the browser paints, so
      // the wall never shows a frame of nothing — which is the whole reason it
      // needs no spinner. The rule guards against cascading renders; this runs
      // once, on mount, and sets state that nothing else in the effect reads.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setApplied({ snapshot: parseSnapshot(cached), day: windowOf(readDailyMarks()) })
    } catch (error) {
      // A cache written by an older schema. Nothing to repair — the next
      // successful fetch overwrites it.
      console.error('[tv] cached CSV no longer parses; waiting for a fresh fetch', error)
    }
  }, [])

  const tick = useCallback(async () => {
    if (running.current) return
    // **Asked before the in-flight guard is taken, and before the network.**
    // A board whose window is already photographed does nothing here at all —
    // no request, no parse, no write — which is what makes "once a day" true of
    // the fetching rather than merely of the figures.
    if (board.shouldFetch !== undefined && !board.shouldFetch()) return
    running.current = true
    try {
      const raw = await fetchCsv()
      const fresh = parseSnapshot(raw)

      // Discard the whole tick on a short feed and keep the last good data.
      // Google's CSV export can re-read the sheet inside the clearContent →
      // setValues window of a full rebuild; acting on what comes back would
      // vanish teams and reshuffle ranks around the hole. Nothing is written,
      // not even the cache.
      if (!passesRowGate(fresh.teams)) {
        console.error(`[tv] short feed (${fresh.teams.length} rows); keeping last good data`)
        return
      }

      writeCsvCache(raw)

      /**
       * ── Ten o'clock is closed here, on a gated fetch, and nowhere else ──
       *
       * **After the row gate, deliberately.** The mark is a photograph of what
       * the sheet held, and it is the opening edge of tomorrow's board as well
       * as the closing edge of today's — so a short feed must never be allowed
       * to become one. Google's CSV export can be read inside a rebuild's
       * `clearContent` → `setValues` window, and a photograph taken then would
       * record a handful of teams at ₹0 and hand every one of them its whole
       * all-time revenue as the next day's takings, on the board, for
       * twenty-four hours. The gate already discards that tick; this simply
       * sits behind it.
       *
       * **Written only when the window actually rolled.** `markWindow` returns
       * the array it was given, by identity, when the current window is already
       * closed — which is 1,439 of the 1,440 polls in a day — so the reference
       * check is what keeps this from being a `localStorage` write a minute
       * forever.
       */
      const marks = readDailyMarks()
      const marked = markWindow(marks, fresh.teams, istWindowKey(new Date()))
      if (marked !== marks) writeDailyMarks(marked)
      const day = windowOf(marked)

      // Detection runs only on a freshly gated fetch. The boot cache is
      // render-only: reconciling it would emit nothing anyway, since detection
      // is idempotent, and would cost a write for nothing.
      const { name, rank, earned, watchTo, period = openWeek } = board
      const { state, events } = detect(readBoard(name), {
        ranked: rank(fresh.teams, fresh.cohort, day),
        // `BoardState.week` keeps its name while carrying a challenge number on
        // `/daily`. Renaming the stored field would change the shape of what
        // every TV holds in localStorage and force a storage key version bump —
        // and buy nothing, because the mismatch heals itself: a wall's stored
        // `week: 5` meets the new `period: 1` on the first poll after deploy,
        // the guard fires once, and the wall records what it sees and animates
        // nothing. Which is exactly the seeding the version bump was for.
        week: period(fresh.cohort, day),
        watchTo,
        // Bound to this tick's cohort and window rather than passed bare:
        // `detect` calls it per team and has neither of its own to hand it.
        earned: (team) => earned(team, fresh.cohort, day),
      })
      writeBoard(name, state)
      if (events.length > 0) {
        enqueueKicks(name, events)
        setQueueVersion((version) => version + 1)
      }

      // Held, not applied, in two cases: a kick is already playing, or this
      // very tick just queued one — see the freeze docblock above. Only the
      // newest hold is kept; an older held snapshot is superseded, never
      // replayed.
      if (frozen.current || events.length > 0) {
        pending.current = { snapshot: fresh, day }
      } else {
        pending.current = null
        setApplied({ snapshot: fresh, day })
      }
    } finally {
      running.current = false
    }
    // `board` is a module-level constant in each page, so this identity is
    // stable and the 60-second interval below is never torn down and rebuilt.
    // A page constructing its spec inline would restart the loop every render.
  }, [board])

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined

    /**
     * The one `catch` in the whole subsystem, and it is loop isolation rather
     * than a fallback: a single bad tick must not kill the interval, and the
     * failure self-heals because the next tick retries against unchanged
     * persisted state. Every other error path here is an uncaught throw — do
     * not add a second `try`.
     */
    const safeTick = () => {
      tick().catch((error: unknown) => console.error('[tv] tick failed', error))
    }

    const start = () => {
      if (timer !== undefined) return
      safeTick()
      timer = setInterval(safeTick, POLL_INTERVAL_MS)
    }

    const stop = () => {
      if (timer === undefined) return
      clearInterval(timer)
      timer = undefined
    }

    const sync = () => (document.visibilityState === 'visible' ? start() : stop())

    sync()
    document.addEventListener('visibilitychange', sync)
    return () => {
      document.removeEventListener('visibilitychange', sync)
      stop()
    }
  }, [tick])

  return {
    snapshot: applied?.snapshot ?? null,
    day: applied?.day ?? null,
    queueVersion,
    freeze,
    thaw,
  }
}
