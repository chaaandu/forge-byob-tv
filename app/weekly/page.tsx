'use client'

import { useEffect, useState } from 'react'

import { BoardLegend } from '@/components/BoardLegend'
import { DevFlipTrigger } from '@/components/DevFlipTrigger'
import { WallHeader } from '@/components/WallHeader'
import { WeeklyGrid } from '@/components/WeeklyGrid'
import { WATCH_RANKS_WEEKLY } from '@/config'
import { boardHeading, boardEarned, boardMode, boardPeriod, rankForMode } from '@/lib/board'
import { baselineLabel } from '@/lib/challenge'
import { cohortInstant, openWeek } from '@/lib/feed'
import { competingTeams } from '@/lib/ranking'
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
  // **Both read the mode off the cohort they are handed**, rather than closing
  // over one. The spec is a module constant so the 60-second loop is never torn
  // down (see `useWallData`), which means the mode cannot be captured here — it
  // is a property of each fetch, and `challenge_mode` can change between two.
  rank: (teams, cohort) => rankForMode(boardMode(cohort), competingTeams(teams)),
  earned: (team, cohort) => boardEarned(boardMode(cohort), team),
  // Ranks 1–20 are the top two rows of the grid. The old justification was "the
  // whole first column", which the columns took with them — see the spec's
  // WATCH_RANKS_WEEKLY note for why the number survived the reasoning.
  watchTo: WATCH_RANKS_WEEKLY,
  // **Not `openWeek`, which is the default**, and not `currentChallenge`
  // either. Which of those two this board resets with is itself decided by
  // `challenge_mode`, and the flip between them is a third reset that neither
  // one can see — every card's figure changes in the poll the cell is edited.
  // `boardPeriod` folds all three into one number so `detect` stays silent
  // through each of them. Its docblock has the arithmetic.
  period: boardPeriod,
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
  // **Week mode until the sheet says otherwise**, including before the first
  // fetch lands. `boardMode`'s docblock has the argument: the safe guess is the
  // one whose column always holds real figures.
  const mode = snapshot === null ? 'week' : boardMode(snapshot.cohort)
  // In production this hook returns its argument — see lib/devOvertake.ts. In
  // development it is what makes a triggered climb change the standings, so a
  // flip settles onto a board that has actually re-sorted rather than onto the
  // one it started from.
  const { teams, commit: devCommit, reset: devReset } = useDevOvertakes(
    competingTeams(snapshot?.teams ?? []),
  )

  return (
    // ── `surface-dark`, and this used to be the light half of the rotation ──
    //
    // Both slides are dark now. `AGENTS.md` pinned this one as `.surface-light`
    // on the grounds that alternating dark and light every thirty seconds is
    // the Forge deck's own rhythm, and that rule has been rewritten rather than
    // quietly broken — see the note there.
    //
    // The argument for the change is that this board is thirty-nine marks and
    // seventy-eight figures, and on Lavender Mist every one of those marks had
    // to carry its own white ground to have an edge. On Deep Aubergine the
    // marks *are* the light, so the board reads as content on a field rather
    // than as ink on paper. What it costs is the flip: two dark slides thirty
    // seconds apart do not announce the rotation the way a dark-to-light cut
    // did. The layouts are what has to carry that now, and they are about as
    // different as two leaderboards can be.
    //
    // ── The editorial frame ──
    //
    // Five stacked bands: masthead, rule, board, rule, footer — inside a safe
    // margin on all four sides. Both slides are built this way now; `/podium`'s
    // `<main>` is the same five rows with different things in them.
    //
    // **The frame has padding again, and the masthead no longer bleeds.** It
    // used to be `gridTemplateRows: 'auto minmax(0,1fr)'` with no padding at
    // all, because `.tv-band` was a full-bleed material and a material that
    // stops short of the edge reads as a wide dark card. There is no material.
    // What is at the top of the frame now is type, and type at y=0 on a
    // television is type the panel's overscan crops before the wall ever sees
    // it — see `--s-safe-y`.
    <main
      className="tv-frame surface-dark"
      style={{
        display: 'grid',
        gridTemplateRows: 'auto auto minmax(0, 1fr) auto auto',
        padding: 'var(--s-safe-y) var(--s-safe-x)',
        rowGap: 0,
      }}
    >
      {/* **The heading no longer carries the week number**, so it no longer
          depends on the sheet having published one. It used to read `BYOB Week
          4` and disappear entirely when `current_open_week` was missing — the
          right call then, because captioning a board "BYOB Week ?" is worse than
          not captioning it. A heading that says nothing numeric cannot be wrong
          about the number, so it is unconditional now, and the board keeps its
          masthead on a morning when the sheet is late.

          **It does carry the contest**, which is a different thing from
          carrying a number. `challenge_mode` decides which figure all
          thirty-nine cards print, and a board titled `10-Day Challenge` while
          ranking the week's revenue is the precise failure this project is
          built around: entirely plausible, reported by nothing, and good for
          weeks. The heading is not decoration here — it is the only thing on
          the frame that says which contest the figures belong to.

          `openWeek` is still read: it is what the dev trigger stamps into an
          event id, whichever contest is on. */}
      <WallHeader snapshot={snapshot} label={boardHeading(mode)} mode={mode} tone="dark" />

      <div className="tv-rule" style={{ marginTop: 'var(--s-mast-rule)' }} />

      <div
        style={{
          display: 'grid',
          minHeight: 0,
          padding: 'calc(var(--s-rule-board) + var(--s-board-top)) 0 var(--s-board-bottom)',
        }}
      >
        <WeeklyGrid
          teams={teams}
          mode={mode}
          kick={kick}
          // One commit: the standings move and the kick clears together, so the
          // board is never seen reordering under a mark that has landed.
          onSettled={() => {
            devCommit()
            settled()
          }}
        />
      </div>

      <div className="tv-rule" />

      {/* **The legend is a row of the frame now, not an absolute in its margin.**
          It used to be positioned against the board's padding box, which put its
          baseline 4.3px above the frame's bottom edge — measured — where a
          television's overscan crops it outright. A stated row cannot be
          clipped by something it does not overlap.

          **The baseline caption belongs to the challenge and leaves with it.**
          In week mode the figure is the open week's own revenue, which has no
          photographed baseline to be "since" — printing one would caption the
          board with a date its numbers are not measured from. */}
      <BoardLegend
        snapshot={snapshot}
        since={
          snapshot === null || mode !== 'challenge'
            ? null
            : baselineLabel(cohortInstant(snapshot.cohort, 'challenge_start_iso'))
        }
      />

      <DevFlipTrigger
        teams={teams}
        mode={mode}
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
