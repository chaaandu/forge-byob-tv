import LINEUPS from '@/public/tv/lineups.json'
import META from '@/public/tv/people-meta.json'

/**
 * ── Who stands where, and who stands in front ──
 *
 * One rule for every line-up on every surface. `public/tv/tv.js` carries the
 * wall's copy (it cannot import from here), and `lib/tvWall.test.ts` holds the
 * two to the same answer for every team.
 *
 * **Why position alone was wrong.** 76 of 113 photographs have a body cut dead
 * straight by the original frame, at x=20 or x=350 of the crop. A cut is
 * invisible on its own and glaring when that student stands IN FRONT of a
 * neighbour: the straight edge runs down across the other person. The line-up
 * used to stack by position — leftmost in front on `/live`, middle in front on
 * the wall — and both put cut bodies over clean ones.
 *
 * So, in order:
 *  1. **A hand-set line-up wins.** `public/tv/lineups.json` names an order,
 *     front-to-back layering, or both, for a team someone has looked at and
 *     decided. Anyone it does not name falls through to the rules below.
 *  2. **Nobody's cut side on the outside.** Without a hand-set order, the
 *     team is arranged so the fewest cut sides end up at the group's two
 *     outer edges, where nobody can cover them.
 *  3. **A cut facing a neighbour costs a place.** Clean silhouettes in front;
 *     a student cut on a side stands behind the neighbour on that side. Among
 *     equals the middle stands in front, ties to the left. A cut left exposed
 *     is faded from its own line outward (`cut-l` / `cut-r`, positioned by
 *     `--cl` / `--cr`).
 */

type Cut = [number | null, number | null, number]
type Meta = { v: string; cut: Cut }
type Lineup = { order?: string[]; front?: string[] }

const meta = META as unknown as Record<string, Meta>
const lineups = LINEUPS as unknown as Record<string, Lineup>

export type Placed = {
  slug: string
  src: string
  z: number
  /** Where the body is cut, as % of the crop's width in from that side; null if it is not. */
  cutL: number | null
  cutR: number | null
}

/** `/people/<team>/<slug>.webp?v=<hash>` — a replaced photograph is a new URL. */
export function photoSrc(teamId: string, slug: string): string {
  const v = meta[`${teamId}/${slug}`]?.v
  return `/people/${teamId}/${slug}.webp${v ? `?v=${v}` : ''}`
}

/** Every ordering of `items`, the given order first. */
function orderings<T>(items: T[]): T[][] {
  if (items.length <= 1) return [items]
  const out: T[][] = []
  items.forEach((item, i) => {
    for (const rest of orderings([...items.slice(0, i), ...items.slice(i + 1)])) out.push([item, ...rest])
  })
  return out
}

/** Place `slugs` (in roster order) as a line-up: left to right, with a z each. */
export function lineup(teamId: string, slugs: string[]): Placed[] {
  const hand = lineups[teamId] ?? {}
  const cutOf = (slug: string): Cut => meta[`${teamId}/${slug}`]?.cut ?? [null, null, 0]

  // 1 · order: hand-set names first, in their order, everyone else after.
  //     Otherwise the ordering that leaves the fewest cut sides on the OUTSIDE
  //     of the group, where no teammate can cover them; ties keep the roster's
  //     own order.
  let order: string[]
  if (hand.order) {
    order = [...hand.order.filter((s) => slugs.includes(s)), ...slugs.filter((s) => !hand.order!.includes(s))]
  } else {
    const exposed = (o: string[]) =>
      o.length === 0 ? 0 : (cutOf(o[0]!)[0] !== null ? 1 : 0) + (cutOf(o[o.length - 1]!)[1] !== null ? 1 : 0)
    order = slugs
    for (const o of orderings(slugs)) if (exposed(o) < exposed(order)) order = o
  }

  // 2 · layers: hand-set front-to-back first, then by cost.
  const n = order.length, centre = (n - 1) / 2
  const cost = order.map((s, i) => {
    const [l, r] = cutOf(s)
    const hand_ = hand.front?.indexOf(s) ?? -1
    if (hand_ >= 0) return -1000 + hand_
    return ((i > 0 && l !== null ? 1 : 0) + (i < n - 1 && r !== null ? 1 : 0)) * 10
      + Math.abs(i - centre) + (i > centre ? 0.01 : 0)
  })
  const z = new Array<number>(n)
  ;[...cost.keys()].sort((a, b) => cost[a]! - cost[b]!).forEach((i, rank) => { z[i] = n - rank })

  return order.map((slug, i) => {
    const [l, r] = cutOf(slug)
    return { slug, src: photoSrc(teamId, slug), z: z[i]!, cutL: l, cutR: r }
  })
}
