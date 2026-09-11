'use client'

import { VentureLogo } from '@/components/VentureLogo'
import { biggestMover } from '@/lib/climber'
import { formatRupees, ordinal } from '@/lib/format'
import type { Team } from '@/lib/types'

/**
 * Who has moved the most this week, as the frame's footer line.
 *
 * ── It was a pale panel, and the panel was the problem ──
 *
 * It sat at the top of `/podium`'s right-hand column as a filled box with a
 * rounded corner, a label, a mark, a name, a standing line and a 61px figure.
 * The fill was load-bearing: the podium's places were dark cards standing on
 * metal, and this had to say "not fourth place" before any of its words were
 * read. A different *kind* of object did that in one move.
 *
 * There are no cards to be a different kind of object from, so the fill has
 * nothing left to distinguish it from. And the panel cost the composition
 * directly: taking the top of the right-hand column pushed the seven list rows
 * down, which left the podium bottoming out at y=881 against the list's y=1029
 * — measured — with 200px of empty aubergine under the podium and nothing to
 * put in it.
 *
 * As a line in the footer it cannot be mistaken for a rank, because nothing
 * around it carries one, and both columns above it now run to the same floor.
 *
 * Its three states and the rule that decides between them live in
 * `lib/climber.ts`. This file only draws them.
 *
 * The figure on the right is **`--accent`, deliberately not a metal** — and now
 * that the metals are off the wall entirely, deliberately the only accent-ink
 * figure on the slide. A climb is not a podium position. Spending the accent
 * once is what keeps it an accent.
 */
export function MoverPanel({ ranked }: { ranked: readonly Team[] }) {
  const mover = biggestMover(ranked)

  return (
    <aside className="tv-pod-mover">
      <span className="tv-pod-mover-label">
        {mover?.kind === 'climb' ? 'Biggest climber this week' : 'Highest earner this week'}
      </span>

      {mover === null ? (
        // Nobody has traded yet. An em dash, which is what the podium's own
        // figures already say for "no figure yet" — the same silence in the same
        // words, rather than a sentence explaining that the week is young.
        <span className="tv-pod-mover-empty tv-figure">—</span>
      ) : (
        <div className="tv-pod-mover-row">
          <span className="tv-pod-mover-mark">
            <VentureLogo team={mover.team} size="var(--d-pod-mover-logo)" />
          </span>

          {/* **Name and standing are two items on one line, not a stacked
              pair.** They were a two-line block inside the panel, which on a
              single-row footer rendered as `DOSA CRISPS1st overall` — two
              inline spans in a wrapper with no gap of its own, run together
              with nothing between them. The wrapper is gone; both are direct
              children of the flex row, which is what spaces them. */}
          <span className="tv-pod-mover-name">
            {mover.team.ventureName || mover.team.teamId}
          </span>
          <span className="tv-pod-mover-line tv-figure">
            {mover.kind === 'climb'
              ? `${ordinal(mover.fromRank)} to ${ordinal(mover.toRank)} on ${formatRupees(mover.weekRevenue)}`
              : `${ordinal(mover.toRank)} overall`}
          </span>

          {/* The headline number is whatever the state is actually about:
              places gained when somebody climbed, the week's takings when
              nobody did. Showing "+0" in the second state would be a climb of
              zero dressed as news.

              Which is also why the line beside it does *not* repeat the money in
              the earner state — the first render printed ₹25,870 twice, once as
              the headline and once in its own sub-line. Each element says one
              thing: the standing places them on the board, the figure is the
              news. */}
          <span className="tv-pod-mover-gain tv-figure">
            {mover.kind === 'climb' ? `+${mover.gained}` : formatRupees(mover.weekRevenue)}
          </span>
        </div>
      )}
    </aside>
  )
}
