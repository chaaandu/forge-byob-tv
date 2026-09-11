'use client'

import { useEffect, useState } from 'react'

import { DevFlipTrigger } from '@/components/DevFlipTrigger'
import { WallHeader } from '@/components/WallHeader'
import { WeeklyGrid } from '@/components/WeeklyGrid'
import { WATCH_RANKS_WEEKLY } from '@/config'
import { boardHeading, boardEarned, boardMode, boardPeriod, rankForMode } from '@/lib/board'
import { openWeek } from '@/lib/feed'
import { matchesBoard } from '@/lib/overtake'
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
    mode,
    competingTeams(snapshot?.teams ?? []),
  )
  // The order the grid is about to render — `WeeklyGrid` sorts the same list the
  // same way. What the gate compares an event against is the board a passer-by
  // can see, so it has to be this list and not the freshest fetch.
  const ranked = rankForMode(mode, teams)
  const { playing: kick, waiting, settled } = useKick(
    BOARD.name,
    queueVersion + devTicks,
    (event) => matchesBoard(ranked, event),
  )

  /**
   * ── The freeze spans the whole batch, not one animation ──
   *
   * `waiting` is the difference. One poll routinely detects three rank changes,
   * and all three describe transitions out of the ordering currently on screen;
   * thawing after the first would re-sort the board under the other two, which
   * then animate whichever cards happen to be standing in those slots. So the
   * snapshot lands when the queue is *empty*, which is the first moment the
   * board is allowed to move.
   *
   * `devCommit` rides the same edge, for the same reason and not merely for
   * symmetry: it is the development stand-in for the snapshot, and applying it
   * one event early re-sorts the board just as visibly.
   */
  useEffect(() => {
    if (kick !== null || waiting) freeze()
    else {
      thaw()
      devCommit()
    }
  }, [kick, waiting, freeze, thaw, devCommit])

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
        // Three bands: masthead, rule, board. It was five — the board used to
        // be followed by a second rule and a footer line, and both left with
        // the legend. See `--h-board`, which subtracts exactly these terms and
        // has to move in the same commit.
        gridTemplateRows: 'auto auto minmax(0, 1fr)',
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
          // **`settled` and nothing else.** This used to be an inline arrow
          // that also ran `devCommit`, and a new function identity every render
          // was enough to make `VentureCard`'s unmount guard fire its cleanup —
          // so every click of a dev button, and every poll that queued an
          // event, cut the running flip off wherever it had got to. The data
          // commit moved to the thaw above, where it belongs; what is left is
          // a callback that is stable by construction.
          onSettled={settled}
        />
      </div>

      {/* ── The footer line is gone ──

          It carried the green mark's meaning, the baseline caption and the
          provenance stamp. Removed by decision, and the stamp is the part worth
          recording: **this wall shows no error state.** A failed fetch keeps the
          last good data and goes on rendering perfectly healthy stale numbers
          for days, and that stamp was the only thing that made it visible. A
          board frozen on Tuesday's figures now looks exactly like a working
          one. `docs/DESIGN.md` §2 added it for that reason; if it comes back,
          the masthead is where it goes. */}

      <DevFlipTrigger
        teams={teams}
        mode={mode}
        week={week}
        onQueued={() => setDevTicks((n) => n + 1)}
        onReset={() => {
          devReset()
          settled()
          setDevTicks((n) => n + 1)
        }}
      />
    </main>
  )
}
