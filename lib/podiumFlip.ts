/**
 * The podium's overtake clock. Every number that says *when* lives here.
 *
 * ── Two shapes of overtake, and only one of them is a story ──
 *
 * A change inside ranks 4–10 is two rows trading places. It gets a slide, and
 * nothing more: seven near-identical bars swapping is information, not an event,
 * and dressing it up would spend the wall's one interrupt on the quietest thing
 * that can happen.
 *
 * A change that crosses **into the podium** is the event. A venture is leaving
 * the top three and another is taking its place, and the animation says exactly
 * that in the order it happens:
 *
 * 1. **Close.** The departing venture's mark turns to its back — Mesa on Deep
 *    Forest Green. It stops being that venture's mark before it moves, so the
 *    thing crossing the board is anonymous rather than a logo flying about.
 * 2. **Travel.** The closed disc crosses from its podium pillar to the row it is
 *    dropping into, resizing on the way.
 * 3. **Open.** It turns face-up in the list, and is that venture again.
 * 4. **Arrive.** Only then does the promoted venture appear on the pillar. Last,
 *    deliberately: the seat has to be visibly empty before someone takes it, or
 *    the two ventures read as having swapped by magic.
 *
 * ── One shared timeline, not four animations ──
 *
 * A beat is a window on this timeline. Nothing waits for a completion callback
 * and nothing waits on a timeout; every animation runs for `TOTAL` seconds and
 * uses `times` to say which part of that span it occupies. The board can be
 * unmounted mid-sequence — a rotation moving on, a resize — and one unmount stops
 * everything, where a chain of callbacks would need teardown at every beat.
 *
 * This is the same argument `lib/flipTimeline.ts` makes for `/daily`, and the
 * two are deliberately separate files: the beats differ, the geometry differs,
 * and a shared "flip timeline" that both boards bent would be a worse thing than
 * two clocks that each say what their own board does.
 */

export type Beat = readonly [start: number, end: number]

/** Seconds, start to finish. */
export const TOTAL = 2.2

export const BEATS = {
  /** The departing mark turns to its back. */
  close: [0, 0.45] as Beat,
  /** It crosses to the row it is dropping into, resizing as it goes. */
  travel: [0.5, 1.5] as Beat,
  /** It turns face-up again, in the list. */
  open: [1.5, 1.95] as Beat,
  /** The promoted venture appears on the pillar — after the seat is empty. */
  arrive: [1.55, 2.05] as Beat,
  /**
   * Two rows of the list trading places. The only beat a 4–10 overtake uses.
   *
   * **Widened from [0.1, 1.0], which was never the problem on its own.** The
   * keyframes were ordered wrongly against it — see the note in `Strip` — so the
   * row crossed in 100ms, sat motionless for 900ms and then drifted back. With
   * the keyframes fixed this window is what it always claimed to be: the span
   * the row is actually travelling in. 1.5s of travel, then 0.5s at rest in its
   * new place before the settle re-slots it, which is what makes the settle
   * invisible rather than a snap.
   */
  slide: [0.2, 1.7] as Beat,
} as const

/** A beat as a pair of fractions of the whole, for Motion's `times`. */
export function at(beat: Beat): [number, number] {
  return [beat[0] / TOTAL, beat[1] / TOTAL]
}

/**
 * Does this overtake cross into the podium?
 *
 * The podium is the top three, so an event whose destination is 1–3 puts someone
 * new on a pillar and pushes someone off it. Anything else is two list rows.
 */
export function entersPodium(toRank: number): boolean {
  return toRank <= 3
}
