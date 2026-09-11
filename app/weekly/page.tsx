'use client'

import { useEffect, useState } from 'react'

import { BoardLegend } from '@/components/BoardLegend'
import { DevFlipTrigger } from '@/components/DevFlipTrigger'
import { WallHeader } from '@/components/WallHeader'
import { WeeklyGrid } from '@/components/WeeklyGrid'
import { WATCH_RANKS_WEEKLY } from '@/config'
import { baselineLabel } from '@/lib/challenge'
import { cohortInstant, currentChallenge, openWeek } from '@/lib/feed'
import { competingTeams, rankByChallenge } from '@/lib/ranking'
import { useDevOvertakes } from '@/lib/devOvertake'
import { useKick } from '@/lib/useKick'
import { useWallData, type BoardSpec } from '@/lib/useWallData'

/**
 * Slide 2 — the weekly board, forty cards in a 4 × 10 grid.
 *
 * The board is inert unless a rank changed hands. **No `layout` prop anywhere in
 * this tree**: a team's week revenue ticking up by ₹200 without moving changes
 * the sort input, and Motion's layout animation would answer that with a small
 * shift on every poll. Movement on this wall means something happened.
 *
 * ── The freeze rides the flip exactly ──
 *
 * Cards are keyed by team id, so a snapshot applied mid-flip would re-slot the
 * two contestants underneath their own animation — they would arrive at a
 * destination that had moved. Held snapshots land on settle instead, which is
 * also what makes the ending invisible: both cards finish exactly on the
 * positions the re-sorted board is about to give them.
 */
// Exported so `board.test.ts` can assert the wiring. Both ways of getting this
// wrong are invisible on screen — see that file for why they earn a test.
export const BOARD: BoardSpec = {
  name: 'weekly',
  rank: (teams) => rankByChallenge(competingTeams(teams)),
  earned: (team) => team.challengeRevenue,
  // Ranks 1–20 are the top two rows of the grid. The old justification was "the
  // whole first column", which the columns took with them — see the spec's
  // WATCH_RANKS_WEEKLY note for why the number survived the reasoning.
  watchTo: WATCH_RANKS_WEEKLY,
  // **Not `openWeek`, which is the default.** This board's figure resets when a
  // challenge rolls over — a Tuesday — and not on the Monday a programme week
  // turns. The two clocks never align: week 7 spans both the end of challenge 1
  // and the start of challenge 2. Left at the default the wall would go deaf to
  // real overtakes every Monday and stay talkative through the one tick where
  // forty figures drop to zero together.
  period: currentChallenge,
}

export default function WeeklyPage() {
  const { snapshot, queueVersion, freeze, thaw } = useWallData(BOARD)
  // The dev trigger writes to the same queue the detector writes to; this
  // counter is only the nudge that tells `useKick` to look, exactly as
  // `queueVersion` does. Adding to it keeps one drain and one reader.
  const [devTicks, setDevTicks] = useState(0)
  const { playing: kick, settled } = useKick(BOARD.name, queueVersion + devTicks)

  useEffect(() => {
    if (kick !== null) freeze()
    else thaw()
  }, [kick, freeze, thaw])

  const week = snapshot === null ? null : openWeek(snapshot.cohort)
  // In production this hook returns its argument — see lib/devOvertake.ts. In
  // development it is what makes a triggered climb change the standings, so a
  // flip settles onto a board that has actually re-sorted rather than onto the
  // one it started from.
  const { teams, commit: devCommit, reset: devReset } = useDevOvertakes(
    competingTeams(snapshot?.teams ?? []),
  )

  return (
    // **`surface-light` — the light half of the rotation.** See the note in
    // app/podium/page.tsx; these two classes are the pair.
    <main
      className="tv-frame surface-light"
      style={{
        display: 'grid',
        gridTemplateRows: 'auto minmax(0, 1fr)',
        // **No padding on the frame.** The band is full-bleed — a material that
        // stopped short of the frame edge would read as a wide dark card rather
        // than as the board's masthead — so the padding belongs to the grid
        // underneath it, which is the only thing that still wants a margin.
      }}
    >
      {/* **The heading no longer carries the week number**, so it no longer
          depends on the sheet having published one. It used to read `BYOB Week
          4` and disappear entirely when `current_open_week` was missing — the
          right call then, because captioning a board "BYOB Week ?" is worse than
          not captioning it. A heading that says nothing numeric cannot be wrong
          about the number, so it is unconditional now, and the board keeps its
          masthead on a morning when the sheet is late.

          `openWeek` is still read: `/weekly`'s board is the *open week's*
          revenue whatever the heading says, and the value is what the dev
          trigger stamps into an event id. */}
      <WallHeader snapshot={snapshot} label="10-Day Challenge" />

      <div
        style={{
          display: 'grid',
          minHeight: 0,
          // The legend is positioned against this box, so it sits in the
          // board's own bottom margin rather than taking height from the rows.
          position: 'relative',
          padding: 'var(--s-board-top) var(--s-12) var(--s-board-bottom)',
        }}
      >
        <WeeklyGrid
          teams={teams}
          kick={kick}
          // One commit: the standings move and the kick clears together, so the
          // board is never seen reordering under a mark that has landed.
          onSettled={() => {
            devCommit()
            settled()
          }}
        />
        <BoardLegend
          since={
            snapshot === null
              ? null
              : baselineLabel(cohortInstant(snapshot.cohort, 'challenge_start_iso'))
          }
        />
      </div>

      <DevFlipTrigger
        teams={teams}
        week={week}
        onQueued={() => setDevTicks((n) => n + 1)}
        onReset={() => {
          devReset()
          settled()
        }}
      />
    </main>
  )
}
