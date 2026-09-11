'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

import { POLL_INTERVAL_MS } from '@/config'
import { fetchCsv, parseSnapshot, passesRowGate } from '@/lib/feed'
import { openWeek } from '@/lib/feed'
import { detect } from '@/lib/overtake'
import { enqueueKicks, readBoard, readCsvCache, writeBoard, writeCsvCache } from '@/lib/storage'
import type { Cohort, Snapshot, Team } from '@/lib/types'

/**
 * The 60-second loop. The only module in the project that touches `fetch`,
 * `setInterval` or the visibility API.
 *
 * ── Only a visible page fetches ──
 *
 * `/podium` and `/weekly` stay reachable as standalone URLs for inspection, so
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
  /** Storage namespace. `/podium` and `/weekly` must not share a memory. */
  name: string
  /**
   * Both are handed the cohort as well as the teams, because `/weekly` ranks on
   * a figure the *sheet* chooses — `challenge_mode` decides between the
   * challenge total and the week's. The spec itself must stay a stable module
   * constant (see the note at the foot of `tick`), so the mode cannot be baked
   * into it at construction; it has to be read per fetch, from the fetch.
   */
  rank: (teams: readonly Team[], cohort: Cohort) => Team[]
  earned: (team: Team, cohort: Cohort) => number
  watchTo: number
  /**
   * What counts as "the period this board's figure resets with", read off the
   * cohort. Defaults to the programme week.
   *
   * `detect` goes silent when this number changes, because that is the tick
   * where every figure on the board drops to zero together and forty resets
   * must not read as forty overtakes.
   *
   * `/weekly` overrides it with `currentChallenge`: its figure resets when a
   * challenge rolls over, which is a Tuesday, and not on the Monday a programme
   * week turns. `/podium` leaves it alone — its figure is the all-time total,
   * which never resets at all.
   */
  period?: (cohort: Cohort) => number | null
}

export function useWallData(board: BoardSpec): WallData {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
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
  const pending = useRef<Snapshot | null>(null)

  const freeze = useCallback(() => {
    frozen.current = true
  }, [])

  const thaw = useCallback(() => {
    frozen.current = false
    if (pending.current === null) return
    const held = pending.current
    pending.current = null
    setSnapshot(held)
  }, [])

  /**
   * First paint reads the cached CSV, before the browser paints. This is why
   * the wall never shows a spinner: it comes up holding the last thing it knew,
   * and a cold cache renders the empty structure, which is a valid state.
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
      setSnapshot(parseSnapshot(cached))
    } catch (error) {
      // A cache written by an older schema. Nothing to repair — the next
      // successful fetch overwrites it.
      console.error('[tv] cached CSV no longer parses; waiting for a fresh fetch', error)
    }
  }, [])

  const tick = useCallback(async () => {
    if (running.current) return
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

      // Detection runs only on a freshly gated fetch. The boot cache is
      // render-only: reconciling it would emit nothing anyway, since detection
      // is idempotent, and would cost a write for nothing.
      const { name, rank, earned, watchTo, period = openWeek } = board
      const { state, events } = detect(readBoard(name), {
        ranked: rank(fresh.teams, fresh.cohort),
        // `BoardState.week` keeps its name while carrying a challenge number on
        // `/weekly`. Renaming the stored field would change the shape of what
        // every TV holds in localStorage and force a storage key version bump —
        // and buy nothing, because the mismatch heals itself: a wall's stored
        // `week: 5` meets the new `period: 1` on the first poll after deploy,
        // the guard fires once, and the wall records what it sees and animates
        // nothing. Which is exactly the seeding the version bump was for.
        week: period(fresh.cohort),
        watchTo,
        // Bound to this tick's cohort rather than passed bare: `detect` calls it
        // per team and has no cohort of its own to hand it.
        earned: (team) => earned(team, fresh.cohort),
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
        pending.current = fresh
      } else {
        pending.current = null
        setSnapshot(fresh)
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

  return { snapshot, queueVersion, freeze, thaw }
}
