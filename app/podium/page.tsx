'use client'

import { useEffect, useState } from 'react'

import { DevPodiumTrigger } from '@/components/DevPodiumTrigger'
import { FleaCountdown } from '@/components/FleaCountdown'
import { Podium } from '@/components/Podium'
import { WallHeader } from '@/components/WallHeader'
import { WATCH_RANKS_PODIUM } from '@/config'
import { fleaInstant } from '@/lib/feed'
import { competingTeams, rankTeams } from '@/lib/ranking'
import { useKick } from '@/lib/useKick'
import { useWallData, type BoardSpec } from '@/lib/useWallData'

/**
 * Slide 1 — the absolute leaderboard.
 *
 * **The same five-row editorial frame `/weekly` uses**: masthead, rule, board,
 * rule, footer, inside a safe margin on all four sides. This slide had a
 * 240px-wide full-height spine down its left edge instead — `PodiumMasthead`,
 * now deleted — carrying the lockup, BYOB as four stacked 187px letters, a rule
 * and an 88px Flea countdown.
 *
 * That component's own docblock made the case for the split: a vertical band
 * anchors the frame at one edge and gives the countdown somewhere to be large,
 * and what the two slides must share is the *data* rather than the furniture —
 * "the same lockup, the same provenance stamp, the same countdown brain ... in a
 * different arrangement rather than a different system."
 *
 * **Two slides rotating on one screen every thirty seconds is one wall**, and
 * the furniture is most of what a passer-by sees of it. Sharing the data and not
 * the arrangement is how the rotation came to read as two designs. The lockup,
 * the countdown and the stamp are all still here; they are on one line across
 * the top, in the order `/weekly` puts them, at the sizes `/weekly` uses.
 *
 * The cost is stated in `components/WallHeader.tsx`: the Flea countdown is a
 * line of apparatus now rather than an 88px figure.
 */
const BOARD: BoardSpec = {
  // The spares are filtered *here*, not in the component, so the detector and
  // the board rank the same list. Ranking all 42 while rendering 40 would let a
  // spare hold a rank the wall never shows, and every team below it would carry
  // a rank one lower than the board's — including the rank changes that fire an
  // overtake. `/weekly` composes its spec the same way, for the same reason.
  name: 'podium',
  rank: (teams) => rankTeams(competingTeams(teams)),
  earned: (team) => team.totalRevenue,
  // **The whole top ten, not just rank 1.** `WATCH_RANKS_PODIUM` was 1 when the
  // board animated nothing: the only change worth an interrupt was a new leader.
  // The board now has two things to say — a venture crossing into the podium,
  // and two list rows trading places — and neither is visible if the detector
  // stops looking after first place.
  watchTo: WATCH_RANKS_PODIUM,
}

export default function PodiumPage() {
  const { snapshot, queueVersion, freeze, thaw } = useWallData(BOARD)
  // The dev trigger writes to the same queue the detector writes to; this
  // counter is only the nudge that tells `useKick` to look, exactly as
  // `queueVersion` does. Adding to it keeps one drain and one reader.
  const [devTicks, setDevTicks] = useState(0)
  const { playing: kick, settled } = useKick(BOARD.name, queueVersion + devTicks)

  // **The freeze rides the sequence exactly.** A snapshot applied mid-flight
  // would re-slot the pillars under an animation that has already measured where
  // they are, and the travelling disc would land on a row that had moved.
  useEffect(() => {
    if (kick !== null) freeze()
    else thaw()
  }, [kick, freeze, thaw])

  const teams = competingTeams(snapshot?.teams ?? [])

  return (
    // **`surface-dark` — the dark half of the rotation.** Forge alternates dark
    // "moment" surfaces with light content ones, and this wall has exactly two
    // slides swapping every thirty seconds, so the rotation carries the
    // brand's own rhythm. The class is what re-points `--ink`, `--accent` and
    // the hairlines for a dark field; nothing inside this tree names a colour.
    //
    // The five rows are `/weekly`'s, exactly — see the note there on why the
    // masthead no longer bleeds to the frame's edge.
    <main
      className="tv-frame surface-dark"
      style={{
        display: 'grid',
        // Three bands: masthead, rule, board — `/weekly`'s exactly. It was
        // five until the footer line was removed; see the note there.
        gridTemplateRows: 'auto auto minmax(0, 1fr)',
        padding: 'var(--s-safe-y) var(--s-safe-x)',
        rowGap: 0,
      }}
    >
      {/* **No day chip on this slide**, which is what `mode="week"` buys: the
          10-day challenge is `/weekly`'s contest and these figures are all-time.
          A `Day 7 of 10` chip over a board of cumulative revenue is precisely
          the plausible-and-unreported failure this project is built around.

          The Flea countdown takes that slot instead, as `trailing`. It is the
          one piece of apparatus this slide has that `/weekly` does not. */}
      <WallHeader
        snapshot={snapshot}
        label="BYOB Leaderboard"
        mode="week"
        tone="dark"
        trailing={<FleaCountdown at={snapshot === null ? null : fleaInstant(snapshot.cohort)} />}
      />

      <div className="tv-rule" style={{ marginTop: 'var(--s-mast-rule)' }} />

      <div style={{ display: 'grid', minHeight: 0, paddingTop: 'var(--s-rule-board)' }}>
        <Podium ranked={rankTeams(teams)} kick={kick} onSettled={settled} />
      </div>

      {/* ── The footer line is gone, and the biggest mover with it ──

          It read `HIGHEST EARNER THIS WEEK · venture · standing · figure`, with
          the provenance stamp at the right. Removed by decision. `MoverPanel`
          and `lib/climber.ts` — the whole biggest-mover computation, its three
          states and its tests — are deleted rather than left unreachable; git
          has them if the line ever returns.

          The stamp's removal is the part worth recording: this wall shows no
          error state, so a failed fetch renders perfectly healthy stale numbers
          for days and that was the only tell. See the same note in
          app/weekly/page.tsx. */}

      <DevPodiumTrigger
        teams={teams}
        onQueued={() => setDevTicks((n) => n + 1)}
        onReset={() => setDevTicks((n) => n + 1)}
      />
    </main>
  )
}
