'use client'

import { useEffect, useState } from 'react'

import { DevFlipTrigger } from '@/components/DevFlipTrigger'
import { WallHeader } from '@/components/WallHeader'
import { DailyGrid } from '@/components/DailyGrid'
import { WATCH_RANKS_DAILY } from '@/config'
import {
  boardHeading,
  boardEarned,
  boardMode,
  boardPeriod,
  boardScope,
  rankForMode,
} from '@/lib/board'
import { needsMark } from '@/lib/daily'
import { openWeek } from '@/lib/feed'
import { istWindowKey } from '@/lib/schedule'
import { readCsvCache, readDailyMarks } from '@/lib/storage'
import { matchesBoard } from '@/lib/overtake'
import { competingTeams } from '@/lib/ranking'
import { useDevOvertakes } from '@/lib/devOvertake'
import { useKick } from '@/lib/useKick'
import { useWallData, type BoardSpec } from '@/lib/useWallData'

/**
 * Slide 2 — the daily board, thirty-nine cards in a 4 × 10 grid.
 *
 * ── It is a finished day, and it does not move ──
 *
 * The figure every card prints is what that venture banked between 10:00
 * yesterday and 10:00 today, computed in `lib/daily.ts` from two photographs of
 * `total_revenue` this laptop took and kept. So the board is **locked**: it is
 * decided once a morning and is identical for the next twenty-four hours.
 *
 * That has one consequence worth stating at the top of the file rather than
 * burying: **this slide no longer produces overtakes.** Not because the detector
 * was weakened — `boardPeriod` is what silences the ten o'clock roll, and it has
 * to, since every figure on the board changes in that one poll. A locked board
 * simply has no moment left where a rank can be seen changing hands. The flip
 * choreography below is still wired and still runs in challenge mode; `/podium`
 * is what exercises it the rest of the time.
 *
 * What does still move is the chevrons, and they are the only live thing on the
 * slide: a card wears them when that team has sold *today* — `today_revenue`,
 * current to the last poll — so they say "this venture is already trading again"
 * against a board whose figures stopped at ten. See `DailyGrid`.
 *
 * **No `layout` prop anywhere in this tree**: a team's figure ticking up by ₹200
 * without moving changes the sort input, and Motion's layout animation would
 * answer that with a small shift on every poll. Movement on this wall means
 * something happened.
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
  // **This is a `localStorage` namespace, not a label.** It keys
  // `byob-tv.v2.board.daily` and `byob-tv.v2.queue.daily`, and it was `weekly`
  // until the route was renamed on 18 September 2026.
  //
  // Renaming it makes every running wall's stored state simply *absent*, which
  // routes into the branch a brand-new TV already takes: `detect` records what
  // it sees and animates nothing. That is the documented safe path — the same
  // one `lib/storage.ts` describes for a version bump — and it is the reason
  // this could be renamed at all rather than left saying `weekly` forever. The
  // old keys are orphaned rather than migrated; there is no migration code,
  // because everything in them can be rebuilt from the sheet in one poll.
  name: 'daily',
  // **Both read the mode off the cohort they are handed**, rather than closing
  // over one. The spec is a module constant so the 60-second loop is never torn
  // down (see `useWallData`), which means the mode cannot be captured here — it
  // is a property of each fetch, and `challenge_mode` can change between two.
  rank: (teams, cohort, day) => rankForMode(boardMode(cohort), competingTeams(teams), day),
  earned: (team, cohort, day) => boardEarned(boardMode(cohort), team, day),
  // Ranks 1–20 are the top two rows of the grid. The old justification was "the
  // whole first column", which the columns took with them — see the spec's
  // WATCH_RANKS_DAILY note for why the number survived the reasoning.
  watchTo: WATCH_RANKS_DAILY,
  // **Not `openWeek`, which is the default**, and not `currentChallenge`
  // either. This board has three ticks where every figure changes at once —
  // ten o'clock each morning, a challenge rolling over, and the
  // `challenge_mode` cell being edited — and no single sheet reader can see all
  // three. `boardPeriod` folds them into one number space so `detect` stays
  // silent through each. Its docblock has the arithmetic, and the note about
  // what the first of the three costs this slide.
  period: boardPeriod,
  /**
   * ── This board goes to the network once a day ──
   *
   * Asked for directly. Its figures are a finished day and change only at
   * 10:00, so the other 1,439 polls a day could not move anything on screen;
   * `needsMark` answers `true` exactly once per day, when the current window
   * has not been photographed yet.
   *
   * **Gated on the data, not on a timer**, which is what makes it survive a
   * laptop that sleeps and a network that is down at ten — the question is
   * asked afresh every minute and stays `true` until a fetch actually succeeds.
   * `lib/daily.ts` has the argument.
   *
   * **`/podium` is deliberately not given one of these.** It ranks live
   * all-time revenue, it is the only board on the wall that still animates an
   * overtake, and freezing it to once a day would leave the whole wall static.
   * It also has a second job now: its sixty-second poll is what keeps the shared
   * CSV cache warm, and this page re-reads that cache every time the rotation
   * brings it back — which is how a board that fetches once a day still knows
   * who has sold today and which contest is on.
   */
  /**
   * **Or there is nothing to draw yet**, which is the edge the window condition
   * alone does not cover. The board renders `snapshot.teams`, and those come
   * from the CSV cache on mount — *not* from the marks, which only carry
   * figures. So a browser holding marks but no cache has everything it needs to
   * compute a board and no teams to put on one: thirty-nine cards' worth of
   * nothing, on a page that has decided it does not need to fetch until ten
   * tomorrow morning. Blank, plausible, and reported by nothing.
   *
   * It takes a partial clear or a failed cache write to get there — the two keys
   * are written in the same tick but separately, so a quota error on one is
   * enough. Cheap to rule out, and the check pays for itself on a truly cold
   * browser too, where it is simply the first condition to answer `true`.
   */
  shouldFetch: () =>
    readCsvCache() === null || needsMark(readDailyMarks(), istWindowKey(new Date())),
}

export default function WeeklyPage() {
  const { snapshot, day, queueVersion, freeze, thaw } = useWallData(BOARD)
  // The dev trigger writes to the same queue the detector writes to; this
  // counter is only the nudge that tells `useKick` to look, exactly as
  // `queueVersion` does. Adding to it keeps one drain and one reader.
  const [devTicks, setDevTicks] = useState(0)

  const week = snapshot === null ? null : openWeek(snapshot.cohort)
  // **Daily until the sheet says otherwise**, including before the first fetch
  // lands. `boardMode`'s docblock has the argument: guessing wrong towards
  // daily puts a true, ranked, finished day under a heading that says so, and
  // self-corrects; guessing wrong towards challenge puts ₹0 on thirty-nine
  // cards under the name of a contest that is not running.
  const mode = snapshot === null ? 'daily' : boardMode(snapshot.cohort)
  // In production this hook returns its argument — see lib/devOvertake.ts. In
  // development it is what makes a triggered climb change the standings, so a
  // flip settles onto a board that has actually re-sorted rather than onto the
  // one it started from.
  const {
    teams,
    day: devDay,
    commit: devCommit,
    reset: devReset,
  } = useDevOvertakes(mode, day, competingTeams(snapshot?.teams ?? []))
  // The order the grid is about to render — `DailyGrid` sorts the same list the
  // same way. What the gate compares an event against is the board a passer-by
  // can see, so it has to be this list and not the freshest fetch.
  const ranked = rankForMode(mode, teams, devDay)
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
        // Top and bottom differ — 20px over the masthead, 40 under the board.
        // `--s-mast-top` carries why, and `--h-board` subtracts both terms.
        padding: 'var(--s-mast-top) var(--s-safe-x) var(--s-safe-y)',
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
      {/* ── The board says which day it is locked on ──

          `scope` has sat unused since `/podium`'s `All time` was removed, and
          this is the first board that genuinely needs it: every previous one was
          live, so its window was "now" and a caption could only add
          provenance. This one stopped at ten this morning, and at four in the
          afternoon nothing else on the frame would say so. It is also the only
          visible sign of a window having quietly widened to 25 or 48 hours
          after a laptop slept through the roll. `boardScope` has the full
          argument; challenge mode still passes nothing. */}
      <WallHeader
        snapshot={snapshot}
        label={boardHeading(mode)}
        scope={boardScope(mode, day)}
        mode={mode}
      />

      <div className="tv-rule" style={{ marginTop: 'var(--s-mast-rule)' }} />

      <div
        style={{
          display: 'grid',
          minHeight: 0,
          padding: 'calc(var(--s-rule-board) + var(--s-board-top)) 0 var(--s-board-bottom)',
        }}
      >
        <DailyGrid
          teams={teams}
          mode={mode}
          day={devDay}
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
        day={devDay}
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
