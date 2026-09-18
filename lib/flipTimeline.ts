/**
 * The overtake flip's clock. Every number that says *when* lives here.
 *
 * ── One shared timeline, not N animations ──
 *
 * A beat is a window on this timeline. Nothing waits for a completion callback
 * and nothing waits on a timeout: every animation in the sequence runs for
 * `TOTAL` seconds and uses `times` to say which part of that span it occupies.
 *
 * Rows are unmounted mid-sequence every time the rotation moves on, so a chain
 * of callbacks would need teardown at every beat to avoid firing into a dead
 * component, and a chain of timeouts would need the same plus it would drift. A
 * shared timeline has nothing to tear down — one unmount stops everything — and
 * two beats cannot disagree about when the first one ended, because neither of
 * them decides.
 *
 * ── The sequence ──
 *
 * 1. **Flip out.** The mark turns to its back — Mesa on Deep Forest Green — and
 *    the card's details fade out under it. **The card itself does not move.** It
 *    used to: the whole card travelled, which meant a card crossing rank 20 had
 *    to change colour in flight, and a box changing colour while it slides reads
 *    as a rendering fault rather than as an overtake. The slots hold still and
 *    keep their colour; what moves is the mark, and what changes is whose
 *    details are printed under it.
 * 2. **The defender goes a beat later.** `STAGGER` behind the attacker, so the
 *    two read as cause and effect rather than as a simultaneous blink. This is
 *    the whole reason the flip communicates an overtake at all.
 * 3. **Travel.** Both face-down discs cross to each other's slots, resizing on
 *    the way if the two slots are in rows of different heights. The resize rides
 *    the travel rather than snapping at either end.
 * 4. **Flip in.** Each turns face-up in its new place.
 * 5. **Base in.** The base slides back down out of the disc and reappears.
 *
 * Unlike the boot kick this replaced, the timeline is **not** a function of the
 * climb size. The kick's length scaled with Δ because its climb was a vertical
 * ride down a column and a longer ride needed longer. A flip's travel is a
 * straight line between two cells and reads the same whether it crosses one slot
 * or nine, so one clock serves every event and the queue's guard has one answer.
 */

export type Beat = readonly [start: number, end: number]

/** Seconds, start to finish. */
export const TOTAL = 2.6

/**
 * How far behind the attacker the defender's flip runs.
 *
 * 150ms, which is the figure the spec asks for and the one to tune by watching.
 * Below about 80ms the two read as one event; above about 250ms the defender
 * looks like a second, unrelated thing happening.
 */
export const STAGGER = 0.15

export const BEATS = {
  /** The attacker turns to its back. The defender's runs `STAGGER` later. */
  flipOut: [0, 0.45] as Beat,
  /** The base is drawn up into the disc and gone. Ends before the turn does, so
      nothing is still legible while the card is edge-on. */
  baseOut: [0, 0.32] as Beat,
  /** Both discs cross, resizing if the two slots differ in size. */
  travel: [0.7, 1.7] as Beat,
  /** Face-up again, in the new place. */
  flipIn: [1.7, 2.15] as Beat,
  /** The base slides back down and reappears. */
  baseIn: [2.15, 2.6] as Beat,
} as const

/** A beat as a pair of fractions of the whole, for Motion's `times`. */
export function at(beat: Beat, shift = 0): [number, number] {
  return [(beat[0] + shift) / TOTAL, (beat[1] + shift) / TOTAL]
}

/**
 * What one card does during a flip.
 *
 * The grid is the brain and the cards are the actors: `DailyGrid` reads the
 * event once and hands each involved card a cue; a card never looks at the
 * event, the other cards, or its own rank to decide what to do. Cards without a
 * cue are inert — nothing about them is animated, or even configured to be.
 */
export type FlipCue = {
  /** Contestants flip; a card merely making room slides and keeps its face. */
  role: 'attacker' | 'defender' | 'slide'
  /**
   * Where this card is going, relative to where it sits now, in pixels.
   *
   * **One delta for the whole card, which it did not used to be.** The mark and
   * the base travelled separately and by *different* vertical amounts, because
   * the mark was centred in the space above the base while the base was pinned
   * to the cell's bottom edge — so between rows of different heights the two
   * moved by different distances, and a cue that ignored the difference landed a
   * card in two pieces with one venture's mark over another's figures. The four
   * rows are one height now and the card is one object, so one delta covers it,
   * and there is no resize on the way either.
   */
  dx: number
  dy: number
  /** Seconds this card's sequence is offset by. Only the defender's is non-zero. */
  shift: number
  /**
   * The destination mark's diameter as a multiple of this one's.
   *
   * The rows descend, so a mark crossing a row boundary arrives somewhere its
   * own size is wrong — 107px in row 1 against 60px in row 4. The resize rides
   * the travel rather than snapping at either end, which is also why it is one
   * number on the cue rather than two sizes the card would have to reconcile.
   */
  scale: number
}

