'use client'

import { AsOf } from '@/components/AsOf'
import { VentureLogo } from '@/components/VentureLogo'
import { biggestMover } from '@/lib/climber'
import { formatRupees, ordinal } from '@/lib/format'
import type { Snapshot, Team } from '@/lib/types'

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
export function MoverPanel({ snapshot, ranked }: { snapshot: Snapshot | null; ranked: readonly Team[] }) {
  const mover = biggestMover(ranked)

  return (
    <aside className="tv-pod-mover">
      {/* ── One sentence, and it stays together ──

          Label, venture, standing, figure — read in that order, grouped as one
          clump at the frame's left. The figure used to be pushed to the frame's
          right edge by `margin-left: auto`, which left a **1167px hole** in the
          middle of the line: 552px of content in an 1824px row, measured. Two
          fragments at opposite ends of a wall read as two unrelated things, not
          as "this venture earned this much".

          The figure is still the emphasis. It is the largest thing on the line
          and the only accent-inked one — it does not also need to be the
          furthest right, and being at the end of its own sentence is where the
          payoff of a sentence belongs. */}
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

          <span className="tv-pod-mover-name">
            {mover.team.ventureName || mover.team.teamId}
          </span>

          {/* Where the venture stands, in the same tracked caps as the label.
              It was sentence case at 16.5px between two uppercase elements,
              which made one line carry three casings and read as a fragment
              somebody forgot to finish. */}
          <span className="tv-pod-mover-line">
            {mover.kind === 'climb'
              ? `${ordinal(mover.fromRank)} to ${ordinal(mover.toRank)} on ${formatRupees(mover.weekRevenue)}`
              : `${ordinal(mover.toRank)} overall`}
          </span>

          {/* The headline number is whatever the state is actually about:
              places gained when somebody climbed, the week's takings when
              nobody did. Showing "+0" in the second state would be a climb of
              zero dressed as news.

              Which is also why the standing beside it does *not* repeat the
              money in the earner state — the first render printed ₹25,870
              twice, once as the headline and once in its own sub-line. Each
              element says one thing: the standing places them on the board, the
              figure is the news. */}
          <span className="tv-pod-mover-gain tv-figure">
            {mover.kind === 'climb' ? `+${mover.gained}` : formatRupees(mover.weekRevenue)}
          </span>
        </div>
      )}

      {/* ── Provenance moved down here, from the masthead ──

          It gives this line a second end, which is what stops a single
          left-aligned statement looking like a row that failed to fill. It is
          also simply where a colophon goes, and it takes one item out of a
          masthead that was carrying a lockup, a heading, a countdown and a
          timestamp.

          `/weekly`'s footer does the same, so the two slides carry provenance
          in one place. It stays load-bearing wherever it sits: the wall shows
          no error state, so a failed fetch renders perfectly healthy stale
          numbers for days and this is the only tell. */}
      <span className="tv-pod-mover-stamp">
        <AsOf snapshot={snapshot} />
      </span>
    </aside>
  )
}
