'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

import { POLL_INTERVAL_MS } from '@/config'
import { fetchCsv, parseSnapshot, passesRowGate } from '@/lib/feed'
import { readCsvCache, writeCsvCache } from '@/lib/storage'
import type { Snapshot } from '@/lib/types'

/**
 * `/live`'s loop: the same fetch, the same gate, the same cache as the wall —
 * and **none of the wall's detection.**
 *
 * `useWallData` is not reused, deliberately. Every tick there runs `detect`
 * and writes `byob-tv.v2.board.*` and the kick queue; a phone doing that would
 * be a third writer to state the two boards own, for animations a phone never
 * plays. What is shared is everything that decides whether a figure is
 * *true*: `fetchCsv` (with its `no-store`), `parseSnapshot`, `passesRowGate`,
 * and the raw CSV cache, which is blindly overwritten and so safe for anyone.
 *
 * Two things this has that the wall does not, because somebody is holding it:
 *
 * - **`fetchedAt`** — when the last *gated* fetch landed. The wall removed its
 *   stamp as furniture on a display; on a phone a reader can act on staleness,
 *   so `/live` shows it.
 * - **`refresh`** — a tap on the live chip fetches now.
 */
export type LiveData = {
  snapshot: Snapshot | null
  /** Epoch ms of the last fetch that passed the gate, or `null` for cache-only. */
  fetchedAt: number | null
  refreshing: boolean
  refresh: () => void
}

export function useLiveData(): LiveData {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [fetchedAt, setFetchedAt] = useState<number | null>(null)
  // `true` from the start: the first tick fires on mount, and a prerendered
  // chip reading "Offline" for the frame before it would be a small lie.
  const [refreshing, setRefreshing] = useState(true)
  const running = useRef(false)

  // First paint from the cache, before the browser paints — the wall's
  // reasoning, unchanged. See `useWallData`.
  useLayoutEffect(() => {
    const cached = readCsvCache()
    if (!cached) return
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSnapshot(parseSnapshot(cached))
    } catch (error) {
      console.error('[live] cached CSV no longer parses; waiting for a fresh fetch', error)
    }
  }, [])

  const tick = useCallback(async () => {
    if (running.current) return
    running.current = true
    setRefreshing(true)
    try {
      const raw = await fetchCsv()
      const fresh = parseSnapshot(raw)
      if (!passesRowGate(fresh.teams)) {
        console.error(`[live] short feed (${fresh.teams.length} rows); keeping last good data`)
        return
      }
      writeCsvCache(raw)
      setSnapshot(fresh)
      setFetchedAt(Date.now())
    } finally {
      running.current = false
      setRefreshing(false)
    }
  }, [])

  const safeTick = useCallback(() => {
    // The one catch, as in `useWallData`: a bad tick must not kill the loop.
    tick().catch((error: unknown) => console.error('[live] tick failed', error))
  }, [tick])

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined
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
    // A phone is pocketed far more often than a TV is hidden; coming back to
    // the page fetches immediately rather than showing a minute-old board.
    const sync = () => (document.visibilityState === 'visible' ? start() : stop())
    sync()
    document.addEventListener('visibilitychange', sync)
    return () => {
      document.removeEventListener('visibilitychange', sync)
      stop()
    }
  }, [safeTick])

  return { snapshot, fetchedAt, refreshing, refresh: safeTick }
}
