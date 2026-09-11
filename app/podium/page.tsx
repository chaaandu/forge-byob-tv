'use client'

import { useEffect, useState } from 'react'

import { DevPodiumTrigger } from '@/components/DevPodiumTrigger'
import { Podium } from '@/components/Podium'
import { PodiumMasthead } from '@/components/PodiumMasthead'
import { WATCH_RANKS_PODIUM } from '@/config'
import { competingTeams, rankTeams } from '@/lib/ranking'
import { useKick } from '@/lib/useKick'
import { useWallData, type BoardSpec } from '@/lib/useWallData'

/**
 * Slide 1 — the absolute leaderboard.
 *
 * A full-height masthead at the left and the board beside it. **No
 * `WallHeader`** — `/weekly` keeps the shared strip across the top, and this
 * slide replaced it with the spine. What the two boards must still share is the
 * data rather than the furniture: the same lockup, the same provenance stamp and
 * the same countdown brain all appear on both, arranged differently.
 *
 * The page has no padding of its own. The spine is full-bleed to three edges by
 * design, so the frame's margins belong to the board and are declared there.
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
    <main
      className="tv-frame surface-dark"
      style={{ display: 'grid', gridTemplateColumns: 'auto 1fr' }}
    >
      <PodiumMasthead snapshot={snapshot} />
      <Podium ranked={rankTeams(teams)} kick={kick} onSettled={settled} />

      <DevPodiumTrigger
        teams={teams}
        onQueued={() => setDevTicks((n) => n + 1)}
        onReset={() => setDevTicks((n) => n + 1)}
      />
    </main>
  )
}
