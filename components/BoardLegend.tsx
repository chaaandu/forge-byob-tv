import { AsOf } from '@/components/AsOf'
import type { Snapshot } from '@/lib/types'

/**
 * What the green mark on a card means, in the corner of the board.
 *
 * ── Why the board needs a legend at all ──
 *
 * Every other element on this wall explains itself: a venture name is a name, a
 * rupee figure is money, a rank is a rank. The green triangle is the one mark
 * that carries meaning by convention rather than by being what it is, and the
 * convention is this board's own — nobody arrives knowing it. One line in the
 * corner is cheaper than the alternative, which is a passer-by deciding it must
 * mean something it does not.
 *
 * ── It is a row of the frame, under the board's own rule ──
 *
 * It used to be absolutely positioned in the board's bottom margin, which put
 * its box 4.3px above the frame's edge — measured — where a television's
 * overscan crops it. It is a stated grid row now: the board above shrinks to
 * make room for it rather than the legend being pushed off the bottom, which is
 * the right way round on a wall with nobody watching to notice.
 *
 * The mark is `VentureCard`'s own class, not a copy of it, so a change to the
 * triangle's shape or size reaches the legend automatically. Two drawings of
 * one symbol is how a legend starts lying about what it explains.
 */
export function BoardLegend({
  snapshot,
  since,
}: {
  snapshot: Snapshot | null
  since?: string | null
}) {
  return (
    <p className="tv-legend">
      {/* **The mark and its phrase are one flex item, not two.** The footer is
          `space-between` now, and left loose the triangle would be pushed to the
          frame's left edge with its own explanation 1,400px away at the other
          end — a legend that separates a symbol from what it means. */}
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--s-2)' }}>
        <span className="tv-day-mark tv-legend-mark" aria-hidden="true" />
        Today&rsquo;s revenue
      </span>
      {/* **What the big figure now measures.** It changed meaning from "this
          week" to "since the baseline", and nothing else on the board says so —
          which is the same argument that put the green triangle's explanation
          here. A passer-by deciding a number must mean something it does not is
          the failure this component exists to prevent.

          `since` comes from `challenge_start_iso`, never a literal: on 1
          September it reads "31 Aug" because one sheet cell changed. Absent
          until the sheet publishes the window, at which point the phrase simply
          appears — the wall says nothing rather than naming a date it is
          guessing at. */}
      {since ? <span className="tv-legend-since">Revenue since {since}</span> : null}

      {/* Provenance, moved down from the masthead so both slides carry it in
          one place — see `components/WallHeader.tsx`. It stays load-bearing
          wherever it sits: the wall shows no error state, so a failed fetch
          renders perfectly healthy stale numbers for days and this is the only
          tell. */}
      <span className="tv-legend-stamp">
        <AsOf snapshot={snapshot} />
      </span>
    </p>
  )
}
