'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { clearKicks, hasKicks, takeKick } from '@/lib/storage'
import type { OvertakeEvent } from '@/lib/types'

/**
 * What is on screen, and when it is over.
 *
 * ── The invariant ──
 *
 * **`playing` is the only thing that says what is animating. The queue is a
 * mailbox and is never rendered.** Nothing outside this hook calls `takeKick`.
 * Two things reading the queue is the two-sources-of-truth bug that makes an
 * animation appear twice or vanish halfway.
 *
 * The queue is drained one at a time and never in parallel. Two kicks at once on
 * a forty-row board is unreadable — the eye cannot follow two arcs, and the
 * second one is invisible whether it plays or not.
 *
 * ── Sequential, and therefore `waiting` ──
 *
 * One fetch routinely detects several rank changes: one team's sale moves it
 * three places and everyone it passed moves one. All of those events describe
 * transitions out of **the same ordering** — the one currently on screen — so
 * the board must not re-sort between them. It is the page that holds the
 * snapshot back, and `waiting` is what tells it to keep holding: the queue is
 * not empty, so the batch is not over, so the board this batch was measured
 * against has to stay on screen. Without it the second event of three plays
 * against a board that already jumped to the final order, and moves two teams
 * that had nothing to do with each other.
 *
 * ── And therefore `playable` ──
 *
 * Holding the board still is the *intent*; `playable` is the check. An event is
 * only ever played while the two slots it names still hold the two ventures it
 * names — see `matchesBoard`. Anything else is dropped on the spot and the drain
 * moves to the next one, because an overtake between the wrong two cards is
 * indistinguishable from a real one at six metres.
 *
 * `queueVersion` is the nudge from the data loop: the queue lives in
 * localStorage, so nothing about writing to it would otherwise re-render this.
 *
 * ── There is no timer here ──
 *
 * A kick ends when its last beat ends, reported by the animation itself. The
 * previous version ran a fixed `setTimeout(KICK_MS)` alongside it, which was a
 * second opinion about the same fact: it happened to be longer than the
 * sequence, so it looked right, but nothing tied the two together and extending
 * a beat past it would have started the next kick over the tail of the current
 * one with nothing to report it.
 */
export type Kick = {
  playing: OvertakeEvent | null
  /** More events behind this one, so the board must stay where it is. */
  waiting: boolean
  /** Handed to `BootKick`; the animation calls it when its last beat finishes. */
  settled: () => void
}

export function useKick(
  board: string,
  queueVersion: number,
  /**
   * Does this event still describe the board on screen? Called immediately
   * before play, against whatever is rendered at that moment.
   *
   * Read through a ref rather than taken as a dependency: it closes over the
   * ranked list, so it is a new function on every render, and a drain effect
   * that re-ran on every render would take a second event out of the queue
   * while the first one was still on screen.
   */
  playable?: (event: OvertakeEvent) => boolean,
): Kick {
  const [playing, setPlaying] = useState<OvertakeEvent | null>(null)
  const [waiting, setWaiting] = useState(false)
  const settled = useCallback(() => setPlaying(null), [])

  const gate = useRef(playable)
  // Declared above the drain so it runs first: effects fire in declaration
  // order, so the drain always asks the *current* render's board.
  useEffect(() => {
    gate.current = playable
  })

  /**
   * Anything already in the queue at mount is stale news. Drop it.
   *
   * Only a mounted board detects and enqueues, and a mounted board drains within
   * milliseconds — so a queue that is *not* empty here can only hold what was
   * left behind when this slide last rotated away. Meanwhile the board re-sorted
   * itself: the CSV cache is written on every tick, freeze or no freeze, so the
   * remount paints the new order before this hook ever runs.
   *
   * Playing that leftover against the new order is the failure this project is
   * built to avoid, because it renders perfectly. `cuesFor` picks the cards to
   * animate by **board position** — `kick.fromRank`, `kick.toRank` — so a stale
   * event moves whichever ventures now occupy those slots, and the wall shows a
   * confident, well-timed overtake between two teams that did not overtake
   * anyone. Discarding is also what the queue already does with superseded news
   * everywhere else: latest wins, and an event nobody could see before the slide
   * left is not the latest any more.
   *
   * Declared above the drain below so it runs first — effects fire in
   * declaration order, so the drain finds the queue already empty.
   */
  useEffect(() => {
    clearKicks(board)
  }, [board])

  // Take the next event, but only while nothing is playing. The dependency on
  // `playing` is what makes this run again the moment the previous one ends.
  //
  // `waiting` is recomputed on every run, including the ones that take nothing
  // because something is already playing — a poll landing mid-animation queues
  // into the mailbox and bumps `queueVersion`, and the page has to learn that
  // the batch just grew *before* the current animation settles, or it thaws in
  // the one commit between two events.
  //
  // The rule this suppresses guards against cascading renders. Draining is a
  // *destructive* read of an external store — `takeKick` removes what it
  // returns — so it cannot happen during render, and nothing emits an event to
  // react to instead: the queue is written by a different hook into
  // localStorage. `queueVersion` is that missing event, and the drain runs at
  // most once per completed animation, which is once per three seconds.
  useEffect(() => {
    if (playing === null) {
      // Drops stale events rather than stopping at one: a rotation or a re-sort
      // can invalidate a whole batch at once, and leaving the rest in the queue
      // would only play them a slide later — the same lie, delayed.
      let next = takeKick(board)
      while (next !== null && gate.current?.(next) === false) next = takeKick(board)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (next !== null) setPlaying(next)
    }
    // Outside the branch above: this has to stay true while something is
    // playing and more has arrived behind it. Re-rendering on an unchanged
    // value is a no-op, so running it on every pass costs nothing.
    setWaiting(hasKicks(board))
  }, [board, playing, queueVersion])

  return { playing, waiting, settled }
}
