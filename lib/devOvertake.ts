'use client'

import { useCallback, useMemo, useState } from 'react'

import { boardEarned } from '@/lib/board'
import type { DailyWindow } from '@/lib/daily'
import type { BoardMode, Team, TeamId } from '@/lib/types'

/**
 * Development only: makes a triggered overtake change the board, not just
 * animate over it.
 *
 * ── The bug this exists for ──
 *
 * `DevFlipTrigger` enqueues an event, and an event is only half of an overtake.
 * The other half is the data moving, which is what the real pipeline gets from
 * the sheet — so a triggered flip played the whole choreography and then settled
 * onto a board that had re-sorted to *exactly the order it started in*. The
 * marks crossed, the details faded out, and the same details faded back in on
 * the same cards. Measured: rank 20 read `Aara ₹7,030` before the trigger and
 * `Aara ₹7,030` after it, with the details correctly returning to opacity 1 the
 * whole time. Nothing was wrong with the animation; there was nothing for it to
 * arrive at.
 *
 * So the trigger records what the climb *would* have done to the figures, and
 * this applies it — **at the settle, never at the click**. Applying it when the
 * button is pressed would re-sort the board underneath cards that are already
 * mid-flight, which is the exact race `freeze`/`thaw` exists to prevent for real
 * snapshots.
 *
 * ── Why it lives here and not in the trigger ──
 *
 * `DevFlipTrigger` is stripped from production builds entirely, and the page
 * importing a hook out of it would have kept the whole module — controls
 * included — in the bundle. This is a separate module so that the component
 * stays independently strippable: what ships to production from here is a hook
 * that returns its argument.
 */

const DEV = process.env.NODE_ENV === 'development'

/** Queued by the trigger on click, drained by the board on settle. */
let pending: { teamId: TeamId; earned: number }[] = []

/**
 * What the climb is worth, in revenue.
 *
 * Halfway between the team being passed and the one above it where there is
 * room, and one rupee above the defender where there is not — so the attacker
 * lands strictly between them and the sort has an unambiguous answer rather than
 * a tie broken by units or team id.
 *
 * **It moves the figure the board is actually ranking on.** This wrote
 * `challengeRevenue` unconditionally, which was silently a no-op for the whole
 * of `challenge_mode` being anything but `Yes` — the default, and what every
 * local fixture boots into. The flip played, the settle landed, and the board
 * re-sorted itself to precisely the order it started in, which is the exact bug
 * this module's docblock exists to describe. `boardEarned` is the one place that
 * says which figure a mode ranks; this reads it rather than guessing.
 */
export function devQueueClimb(
  mode: BoardMode,
  day: DailyWindow | null,
  attacker: Team,
  defender: Team,
  above: Team | undefined,
): void {
  if (!DEV) return
  const held = boardEarned(mode, defender, day)
  const ceiling = above === undefined ? held + 2 : boardEarned(mode, above, day)
  const gap = ceiling - held
  const earned = gap > 2 ? held + Math.floor(gap / 2) : held + 1
  pending.push({ teamId: attacker.teamId, earned })
}

export function useDevOvertakes(
  mode: BoardMode,
  day: DailyWindow | null,
  teams: readonly Team[],
): {
  teams: readonly Team[]
  day: DailyWindow | null
  commit: () => void
  reset: () => void
} {
  const [applied, setApplied] = useState<ReadonlyMap<TeamId, number>>(() => new Map())

  // Drained in the same commit the kick settles in, so the re-sort and the
  // cards' reset to their resting transforms land together — the board is never
  // seen reordering under a mark that has already arrived.
  const commit = useCallback(() => {
    if (!DEV || pending.length === 0) return
    const taken = pending
    pending = []
    setApplied((prev) => {
      const next = new Map(prev)
      for (const p of taken) next.set(p.teamId, p.earned)
      return next
    })
  }, [])

  const reset = useCallback(() => {
    pending = []
    setApplied(new Map())
  }, [])

  const adjusted = useMemo(() => {
    if (!DEV || applied.size === 0) return teams
    return teams.map((t) => {
      const figure = applied.get(t.teamId)
      if (figure === undefined) return t
      // Both, deliberately: the card prints one of these and the comparator
      // sorts the same one, and which is which is the mode's business. Writing
      // only the mode's figure would leave a triggered climb behind the moment
      // `challenge_mode` was edited mid-session.
      return { ...t, challengeRevenue: figure, weekRevenue: figure }
    })
  }, [teams, applied])

  /**
   * The daily half of the same override.
   *
   * It has to be a second one, because the daily figure is not on the row: it
   * lives in the window's map. Patching only the row above would have made
   * every dev-triggered flip on the daily board a no-op that looked like a
   * working animation — the choreography would play and the board would re-sort
   * to exactly the order it started in, which is the bug this whole module's
   * docblock exists to describe, reintroduced by the change of figure.
   *
   * **Nothing is written back to `localStorage`.** A dev trigger that rewrote a
   * real photograph would leave the laptop holding a fabricated day, locked, for
   * twenty-four hours, and the only way out would be clearing the store.
   */
  const adjustedDay = useMemo(() => {
    if (!DEV || applied.size === 0 || day === null) return day
    const earned = { ...day.earned }
    for (const [teamId, figure] of applied) earned[teamId] = figure
    return { ...day, earned }
  }, [day, applied])

  return { teams: adjusted, day: adjustedDay, commit, reset }
}
