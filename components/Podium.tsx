'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'

import Image from 'next/image'

import { Crown } from '@/components/Crown'
import { PodiumTravel, type TravelPath } from '@/components/PodiumTravel'
import { VentureLogo, tintFor } from '@/components/VentureLogo'
import { formatRupees } from '@/lib/format'
import { BLOCKS as ANCHORS, BLOCK_IMAGE } from '@/lib/podiumBlocks'
import { BEATS, TOTAL, at, entersPodium } from '@/lib/podiumFlip'
import { nameOf } from '@/lib/team'
import type { OvertakeEvent, Team } from '@/lib/types'

/**
 * Slide 1 — the absolute leaderboard: three marks and a list of seven.
 *
 * ── The composition ──
 *
 * Three places across the left of the board, drawn 2 · 1 · 3, all three sharing
 * one text baseline. Ranks 4–10 down the right, as ruled rows. Both columns run
 * the full height of the board, so the frame has one floor rather than two.
 *
 * ── Rank is the size of the mark, and that is the only place it is said ──
 *
 * It used to be said three times: the card's height, the metal, and the
 * numeral. The redundancy was deliberate and well argued — a greyscale
 * reproduction loses the metals, a crop loses the numerals' overhang, and either
 * one still ranks.
 *
 * **That argument is spent, knowingly.** It was written for a slide made of
 * objects, where a card could be tall and gold and numbered independently. This
 * one is made of marks on a surface, and the mark's diameter carries the whole
 * ranking: because the three columns share a baseline, first place's mark being
 * 1.31x wider *is* first place's mark sitting 76px higher. One attribute, two
 * readings, and a greyscale crop still ranks because a bigger circle is still a
 * bigger circle. The numerals are printed, but they are captions now rather than
 * a third encoding.
 *
 * ── Nothing moves at rest, and that is the third time this has been decided ──
 *
 * The three marks idled: a slow bob, a glance on a `rotateY`, a tilt, on three
 * timelines so they could never fall into lockstep. It was removed once, asked
 * for back, and is now removed again — by decision, after seeing it next to the
 * crown.
 *
 * **What settled it was a measurement, not a preference.** The glance is a
 * `rotateY` of up to 34 degrees under a 900px `perspective`, and a perspective
 * transform moves an off-centre child *differently from the element's own
 * centre*. The crown sits on the disc's upper-left rim, a long way off centre,
 * so every glance swung it out of contact with the head it is sitting on and
 * back again — a crown visibly detaching from its mark once every seventeen
 * seconds, on a wall nobody is watching closely enough to catch it. The bob
 * alone would have been survivable; the glance could not be, because the crown
 * cannot be welded to a rotation it does not share the centre of.
 *
 * The two fixes were "take the crown off the idle" and "take the idle off the
 * board", and only one of them leaves the slide saying something true. So the
 * board is still, and the only motion on it is an arrival: the crown landing,
 * and an overtake. Both are things that happened.
 *
 * `lib/seed.ts` stays — `VentureLogo` still reads it for the mark tints.
 *
 * **No `layout` prop**, here or anywhere in the board tree — there is a source
 * scan in render.test.tsx that fails the build on one.
 */

const TOP = 10
const PODIUM_PLACES = 3

/**
 * The ranks in the order the pillars are drawn: 2 · 1 · 3.
 *
 * The array is the *drawing* order, so `PLACE_ORDER.indexOf(rank)` is the index
 * of that rank's pillar in the DOM. Reaching for a pillar by its rank without
 * going through this would find second place's when asked for first place's.
 */
const PLACE_ORDER: readonly number[] = [2, 1, 3]

/**
 * ── There is no per-place table any more ──
 *
 * There used to be one, and it has been four different tables: a card fill and
 * a metal and two riser counts; then one mark diameter; then a metal ramp, a
 * face, a height and an entrance delay. Every version existed because the three
 * places were drawn in CSS and something had to say how they differed.
 *
 * They are drawn in a render now — `scripts/render-podium.mjs` — and
 * `lib/podiumBlocks.ts` is what says where the three blocks are. So the only
 * thing this file needs is which of the three a card is, and the anchors do the
 * rest. The type sizes fall out of it too: the name, the figure and the
 * numeral are all container units against the block's own face, so first
 * place's figure is larger than second's *because first place's block is
 * wider*, and no token has to state the ratio.
 */
type Place = 1 | 2 | 3

/** How far the mark rises above the centre of the top face it stands on, as a
    share of its own diameter. Zero would bury it in the platform. */
const MARK_LIFT = 0.17

/**
 * ── `MARK_IN_DISC` moved into `VentureLogo` ──
 *
 * It was the mark's share of the white mount it sat in — 0.93, so a cream logo
 * had a ring of white giving it an edge against the dark page. Correct for
 * artwork, and wrong for the two-letter monogram that now draws every mark on
 * this wall: a tinted disc is its own ground, so the inset put a white ring
 * around thirty-nine of them.
 *
 * The mount and the inset are one decision and they belong together, on the
 * side of the branch that knows which kind of mark it is drawing. The three
 * call sites below pass the full diameter.
 */

/**
 * Who is on the board. The top ten of whatever it is handed, and nothing else.
 *
 * The three cards render whether or not anyone is trading: a podium with second
 * and third missing tells a passer-by the wall is broken, where three cards
 * reading "—" tell them the cohort has not started. Filtering the spares and
 * ranking are both the caller's job — this component ranks nothing, so the sort
 * stays the single authority on order.
 */
export function podiumTeams(ranked: readonly Team[]): Team[] {
  return ranked.slice(0, TOP)
}

/**
 * An em dash, not `₹0`.
 *
 * Zero is a figure, and a card carrying one asserts that the team traded and
 * earned nothing. Before the cohort opens that is false for all forty of them.
 * The dash says "no figure yet", which is the only true thing available.
 */
function revenueOf(team: Team | undefined): string {
  if (team === undefined || team.totalRevenue <= 0) return '—'
  return formatRupees(team.totalRevenue)
}

/**
 * One place on the podium: a numeral, a mark, a name, a figure.
 *
 * **Bottom-aligned**, which is what makes the three of them a podium. The
 * column grows upward from a shared text baseline, so the place with the larger
 * mark is also the place whose mark sits higher, and neither fact has to be
 * declared.
 */
function PodiumCard({
  team,
  place,
  departing = false,
  arriving,
}: {
  team: Team | undefined
  place: Place
  /** This place's mark has left — it is the disc crossing the board. */
  departing?: boolean
  /** The venture taking this place, shown once the seat is visibly empty. */
  arriving?: Team
}) {
  /* ── Where this place is on the rendered image ──
   *
   * Every number here is read from the manifest the renderer wrote, converted
   * once from *fractions of the image* into *fractions of this slot*, because
   * the slot is the positioned box and everything inside it is laid out
   * against that. **Nothing is re-derived.** The renderer's camera is the only
   * thing that knows where a block's top face projects to, and a second
   * opinion about it here is how a mark ends up hovering off its platform at
   * one viewport and looking fine at another.
   */
  const a = ANCHORS[place]!
  const aspect = BLOCK_IMAGE.width / BLOCK_IMAGE.height
  /* The mark's diameter is given against the image's *width*; its height as a
     share of the image is therefore scaled by the aspect, which is what makes
     the two axes below comparable. */
  const markH = a.mark * aspect
  const markPct = (a.mark / a.front.w) * 100
  const markLeft = ((a.top.x - a.front.x) / a.front.w) * 100
  const markTop = ((a.top.y - markH * MARK_LIFT - a.front.y) / a.front.h) * 100
  /* Where the face's type starts: under the mark, which overhangs the block. */
  const faceTop = markTop + ((markH / 2 / a.front.h) * 100)

  /* ── Who wears the crown ──
   *
   * **The crown belongs to the seat, not to the venture.** It is mounted on
   * place 1's mark band and stays there through an overtake, so the head under
   * it changes while it holds still — which is the thing a crown actually
   * means. Handing it to the team would mean animating it across the board
   * alongside the travelling disc, for no gain: the wall is not saying "this
   * venture acquired a crown", it is saying "this seat is first".
   *
   * `arriving ?? team` is what makes that true during the two seconds a
   * handover takes. The board's data is frozen for the sequence, so `team` is
   * still the *departing* venture right up to the last beat; reading it alone
   * would strip the crown at the moment a new leader appeared under it.
   *
   * **The zero gate is not defensive, it is the difference between a fact and a
   * lie.** Before anyone has traded, rank 1 is whoever the tie-break put first
   * — lowest team ID, on ₹0, against thirty-eight other ventures on ₹0. There
   * is no leader yet, and a crown on `SLE-C401` for being alphabetically early
   * is the exact class of bug this project is built around: it renders
   * perfectly and it is false. An uncrowned podium says "nobody is ahead yet",
   * which is true, and empty is a valid state on this wall.
   */
  const holder = arriving ?? team
  const crowned = place === 1 && holder !== undefined && holder.totalRevenue > 0

  /* The name and figure, as one block. Both states of a place being handed over
     render this, stacked and cross-faded, so the arriving venture's details
     cannot appear over the departing venture's — see the note below. */
  const details = (of: Team | undefined) => (
    <>
      <span className="tv-pod-name">{of === undefined ? '' : nameOf(of)}</span>
      <span className="tv-figure tv-stage-figure">{revenueOf(of)}</span>
    </>
  )

  return (
    /* ── One place, laid over the render ──
     *
     * The slot *is* the block's front face: the manifest gives that face as a
     * rectangle, which it genuinely is, because the render's camera is
     * off-axis. So the venture's name and its figure are ordinary flat type at
     * ordinary sizes, sitting on a lit 3D object. That is the whole reason this
     * approach beat five attempts at building the blocks in CSS — those either
     * had no lighting, or had a pitched camera that raked the type.
     *
     * `.tv-pod-slot` stays the class `measurePath` finds a place by, and the
     * three are still drawn 2 · 1 · 3 so `PLACE_ORDER` still indexes them.
     */
    <div
      // `tv-stage-rest` is the whole of what still differs between the three
      // places: how much air sits between a mark and the name under it. See
      // `--s-stage-mark-gap-rest`.
      className={place === 1 ? 'tv-pod-slot' : 'tv-pod-slot tv-stage-rest'}
      style={{
        left: `${a.front.x * 100}%`,
        top: `${a.front.y * 100}%`,
        width: `${a.front.w * 100}%`,
        height: `${a.front.h * 100}%`,
      }}
    >
      {/* The rank, once, as a watermark low on the face — tone on tone, the way
          the reference's numeral is a shade of its own block. It was solid
          white for a pass and competed with the figure above it; it was a
          badge *and* a watermark for another, and "why 1, 2, 3 again?" was the
          review. It carries `role="img"` and the `Rank N` label. */}
      <span className="tv-pod-numeral" role="img" aria-label={`Rank ${place}`}>
        {place}
      </span>

      {/* **The details cross with the mark, not after it.** The data behind the
          board is frozen for the sequence, so the place would otherwise
          announce the arriving venture's logo above the departing venture's
          name and figure — which is a worse lie than showing nothing. Both
          blocks are stacked and their opacity is swapped on the same beat. */}
      <div className="tv-stage-face tv-stage-in" style={{ top: `${faceTop}%` }}>
        {arriving === undefined ? null : (
          <motion.div
            // **Anchored to the top, not `inset: 0`.** A name can run to two
            // lines, so the arriving block and the departing block may not be
            // the same height. Pinned to the top, both start under the mark and
            // a taller name grows down the face, which has room.
            style={{ position: 'absolute', left: 0, right: 0, top: 0, zIndex: 1 }}
            initial={false}
            animate={{ opacity: [0, 0, 1, 1] }}
            transition={{
              duration: TOTAL,
              times: [0, ...at(BEATS.arrive), 1],
              ease: ['linear', 'easeOut', 'linear'],
            }}
          >
            {details(arriving)}
          </motion.div>
        )}

        <motion.div
          initial={false}
          // **`{ opacity: 1 }`, never `{}`.** An empty `animate` does not mean
          // "back to normal", it means "animate nothing" — so Motion left the
          // last value it committed, which is the 0 this block fades to when a
          // venture arrives. The details were still in the DOM and still
          // correct; they were simply invisible, and they never came back.
          //
          // It compounded. Every overtake blanked one more place, so after
          // three the whole podium was three logos with no name and no figure
          // under any of them — on a wall nobody is watching closely enough to
          // notice a number going missing. Measured with the dev triggers: 4→1
          // blanked rank 1, then 4→3 blanked rank 3, then 5→2 blanked rank 2,
          // and nothing ever restored them.
          //
          // The reset has to be a *value*, so it lands in the same commit that
          // drops `arriving`. `components/VentureCard.tsx` carries the same
          // warning about `false` versus `undefined` for the same reason.
          animate={arriving === undefined ? { opacity: 1 } : { opacity: [1, 1, 0, 0] }}
          transition={{
            duration: TOTAL,
            times: [0, ...at(BEATS.arrive), 1],
            ease: ['linear', 'easeOut', 'linear'],
          }}
        >
          {details(team)}
        </motion.div>
      </div>

      {/* ── The mark, standing on the block's top face ──

          Last in the slot so it paints over the face's type, which it overhangs.
          **`100%`, and it used to be `100cqw`.** The mark's interior is sized
          in container units against its own box, which `VentureLogo` declares
          on itself — see the note there. It was declared in the stylesheet one
          level up for a while, and when that rule failed to arrive from a
          stale dev build the unit fell back to the viewport and one venture's
          mark rendered across the whole wall. A percentage cannot do that. */}
      <div
        className="tv-pod-mark-band tv-stage-in"
        style={{ left: `${markLeft}%`, top: `${markTop}%`, width: `${markPct}%` }}
      >
        {/* The band renders whether or not there is a team, so the place holds
            its size through the first paint rather than assembling itself on
            the wall. Empty rather than a placeholder mark — a grey circle is
            filler, and this wall carries none.

            **`position: relative` is what anchors the crown.** It was inherited
            from a transform for a long time and is stated here because the
            transform has come and gone three times; the crown re-parenting to
            the band silently is not a thing to leave to luck. */}
        <div style={{ width: '100%', aspectRatio: 1, position: 'relative' }}>
          {/* Drawn before the disc so it sits *under* the mark in paint order.
              A crown overlapping the monogram's edge would cover the one thing
              on the card that identifies the venture; behind it, the mark stays
              whole and the crown reads as resting against the rim. */}
          {crowned ? (
            <span className="tv-crown">
              <Crown className="tv-crown-glyph" />
            </span>
          ) : null}

          {/* **Hidden rather than unmounted while it travels.** The travelling
              disc is measured against this element's box, and an unmounted
              element has no box — the path would be measured from nothing on
              the very frame it is needed. */}
          <div
            className="tv-pod-disc"
            style={{ width: '100%', height: '100%', opacity: departing ? 0 : 1 }}
          >
            {team === undefined ? null : <VentureLogo team={team} size="100%" />}
          </div>

          {/* The promoted venture, arriving last. It is drawn over the empty
              mount rather than replacing the place's own mark, because the data
              behind the board is frozen for the length of the sequence — what
              puts this venture here permanently is the next snapshot. */}
          {arriving === undefined ? null : (
            <motion.div
              className="tv-pod-disc"
              style={{ position: 'absolute', inset: 0 }}
              initial={false}
              animate={{ opacity: [0, 0, 1, 1], scale: [0.72, 0.72, 1, 1] }}
              transition={{
                duration: TOTAL,
                times: [0, ...at(BEATS.arrive), 1],
                ease: ['linear', 'easeOut', 'linear'],
              }}
            >
              <VentureLogo team={arriving} size="100%" />
            </motion.div>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Ranks 4–10, as ruled rows.
 *
 * ── The bars are gone ──
 *
 * Each row carried a pill bar whose length was that venture's revenue as a
 * share of third place's. The reasoning was good and is worth keeping on the
 * record, because it is the reasoning any replacement has to beat: measuring
 * against rank 1, or against the list's own leader, both draw whoever leads the
 * list as *finished*, and rank 4 is not finished — it is ₹466 behind third
 * place, the tightest gap on the board. Against third place a full bar is
 * impossible by construction, because you cannot be 100% of the venture ahead
 * of you without being ahead of them.
 *
 * **What it never did was say so.** The reference was named nowhere on the
 * frame, and a passer-by at six metres reading seven bars of seven lengths
 * against an unstated scale will assume "share of the leader" — which is the
 * one thing it was carefully not. A chart whose axis is a comment in a source
 * file is a chart that reports nothing, which is the exact failure class this
 * project is built around.
 *
 * The ranking is the comparison, and the figures are printed beside it.
 */
function Strip({
  ranked,
  fromRank,
  above,
  kick = null,
  vacating = null,
  incoming,
}: {
  ranked: readonly Team[]
  fromRank: number
  /** The venture on the podium's lowest step, which row one is measured against. */
  above: Team | undefined
  kick?: OvertakeEvent | null
  /** A rank in this list whose venture is on its way to the podium. */
  vacating?: number | null
  /** The venture dropping out of the podium into that vacated row. */
  incoming?: Team
}) {
  const teams = ranked.slice(fromRank - 1)

  /**
   * ── HOW FAR A ROW TRAVELS, IN PIXELS, MEASURED WHILE THE ROWS ARE AT REST ──
   *
   * **`y: '100%'` was wrong and looked nearly right, which is the worst kind.**
   * A percentage `y` resolves against the element's *own height* — 68.1px — while
   * the distance to the next row is its height plus the gap, 118.7px. Two rows
   * swapping each moved 68px toward the other, crossed, and stopped 50.6px short
   * of the seat they were heading for: rows at 387.5 and 506.2 finished at 455.6
   * and 438, overlapping in the middle of the gap.
   *
   * **Every row's resting position, re-read on every idle render — not one pitch
   * cached at mount.** A single mount-time measurement is a number that can go
   * stale without ever announcing it: a web font landing after first paint, or a
   * board that first rendered while the feed was still empty, both change the
   * row height afterwards, and the cached figure then sends the rows a distance
   * that no longer exists. Worse, if it were ever measured before the rows were
   * laid out it would be zero, and the swap would degrade to two rows shuffling
   * sideways in their own seats — a plausible-looking animation that has stopped
   * doing the one thing it is for.
   *
   * `if (kick !== null) return` is what makes this safe to run on every render:
   * the rows only ever carry a transform during a kick, so the recorded numbers
   * are always untransformed layout. Same discipline as `cuesFor` on /weekly —
   * measure at rest, then animate from pure numbers and touch no DOM.
   *
   * Positions rather than a pitch, so nothing assumes the gaps are equal.
   * `alignContent: space-between` distributes leftover height into them, so the
   * real spacing is not `--s-pod-row-gap` and no arithmetic over the tokens
   * would agree with the board.
   */
  const stripRef = useRef<HTMLDivElement>(null)
  const restingTops = useRef<number[]>([])
  useLayoutEffect(() => {
    if (kick !== null) return
    const strip = stripRef.current
    if (strip === null) return
    // **`offsetTop`, not `getBoundingClientRect`.** The rect is the *transformed*
    // box, so it is only the resting position if nothing is mid-move — and the
    // render where `kick` drops back to null is exactly the render where a row
    // may still be carrying the transform Motion is about to clear. Ordering
    // between Motion's own layout effects and this one is not something to bet a
    // wall on. `offsetTop` ignores transforms outright, which is the same reason
    // `slotOf` in components/WeeklyGrid.tsx reads it.
    //
    // The cost is that it is rounded to whole pixels, so a 118.7px pitch is
    // recorded as 119 — 0.3px of error at the far end of a move whose last act
    // is the settle re-slotting the row exactly. Sub-pixel and invisible, and
    // the alternative was a measurement that is occasionally, silently, wrong by
    // a whole row.
    restingTops.current = ([...strip.children] as HTMLElement[]).map(
      (row) => row.offsetTop,
    )
  })

  // An empty strip carries no heading. Apparatus describing absence is the same
  // filler as a "no data" message, in a smaller typeface.
  if (teams.length === 0) return null

  /* ── A bare numeral, and the tab it replaced needed an edge ──
   *
   * This has been right-aligned type, then a round chip, then `/weekly`'s tag.
   * The tag is the one worth recording, because it was asked for and it was
   * wrong for a structural reason: on a card that shape works because its
   * square side *is* the card's edge, so it reads as a tab fixed to something.
   * A row inside a pane has no edge to fix it to, so seven of them floated with
   * a square side against nothing.
   *
   * **Ornament scales with singularity.** One object can wear a crown; seven
   * cannot wear badges. What keeps the two boards one system is the condensed
   * face and the ink, which this keeps — the shape was never the part doing
   * that work.
   */
  const rank = (index: number) => (
    <span className="tv-figure tv-pod-row-rank">{fromRank + index}</span>
  )

  /* The mark of a venture on its way up is hidden, not removed: the travelling
     disc lands on this element's box, and an unmounted element has none. */
  const mark = (team: Team, rowRank: number) => (
    <span className="tv-pod-row-mark" style={{ opacity: rowRank === vacating ? 0 : 1 }}>
      <VentureLogo team={team} size="var(--d-pod-row-logo)" />
    </span>
  )

  /* The row a venture is dropping into carries *its* name and figure, opening
     on the same beat its mark does. Without this the mark lands as one venture
     over another venture's name — the same lie the pillar above would tell. */
  const name = (team: Team, rowRank: number) =>
    rowRank === vacating && incoming !== undefined ? (
      <span style={{ display: 'grid', minWidth: 0 }}>
        <motion.span
          className="tv-pod-row-name"
          style={{ gridArea: '1/1' }}
          initial={false}
          animate={{ opacity: [1, 1, 0, 0] }}
          transition={{ duration: TOTAL, times: [0, ...at(BEATS.open), 1], ease: 'linear' }}
        >
          {nameOf(team)}
        </motion.span>
        <motion.span
          className="tv-pod-row-name"
          style={{ gridArea: '1/1' }}
          initial={false}
          animate={{ opacity: [0, 0, 1, 1] }}
          transition={{ duration: TOTAL, times: [0, ...at(BEATS.open), 1], ease: 'linear' }}
        >
          {nameOf(incoming)}
        </motion.span>
      </span>
    ) : (
      <span className="tv-pod-row-name">{nameOf(team)}</span>
    )

  const figureStyle: React.CSSProperties = {
    font: 'var(--t-pod-fig-row)',
    letterSpacing: 'var(--track-pod-fig)',
    // **`--ink`, which the surface defines, not a brand colour.** This was
    // `--deep-teal` — "deepest brand surface" — which is exactly the page
    // colour once the slide went dark: measured at 1.00:1, a figure painted in
    // its own background. A token that is a surface in one place and ink in
    // another cannot survive a surface flip.
    color: 'var(--ink)',
    textAlign: 'right',
  }

  /**
   * How far this venture is behind the one directly above it.
   *
   * **The gap to the row above, not to the leader.** Both were on the table.
   * Against first place every row reads as hopelessly behind and the number is
   * the same story seven times; against the row above it is the distance a team
   * would actually have to close this week, and it changes every day.
   *
   * It also answers the criticism that this list said *order* and never
   * *distance* — rank 4 is nearly double rank 10 and nothing on the board
   * showed it. The share bars that used to say it were removed because their
   * scale was never stated anywhere on the frame; a gap needs no scale, it is
   * denominated in rupees like everything beside it.
   *
   * The first row on this list has a row above it — third place, on the podium
   * — so every one of the seven carries one. Nothing is shown where either
   * figure is missing or the gap is not positive, which is the tie case: two
   * ventures level is not "+₹0", it is nothing to say.
   */
  const behind = (index: number): string | null => {
    const here = teams[index]
    const ahead = index === 0 ? above : teams[index - 1]
    if (here === undefined || ahead === undefined) return null
    const gap = ahead.totalRevenue - here.totalRevenue
    return gap > 0 ? formatRupees(gap) : null
  }

  const figure = (team: Team, rowRank: number) =>
    rowRank === vacating && incoming !== undefined ? (
      <span style={{ display: 'grid' }}>
        <motion.span
          className="tv-figure"
          style={{ ...figureStyle, gridArea: '1/1' }}
          initial={false}
          animate={{ opacity: [1, 1, 0, 0] }}
          transition={{ duration: TOTAL, times: [0, ...at(BEATS.open), 1], ease: 'linear' }}
        >
          {revenueOf(team)}
        </motion.span>
        <motion.span
          className="tv-figure"
          style={{ ...figureStyle, gridArea: '1/1' }}
          initial={false}
          animate={{ opacity: [0, 0, 1, 1] }}
          transition={{ duration: TOTAL, times: [0, ...at(BEATS.open), 1], ease: 'linear' }}
        >
          {revenueOf(incoming)}
        </motion.span>
      </span>
    ) : (
      <span className="tv-figure" style={figureStyle}>
        {revenueOf(team)}
      </span>
    )

  /* The grid the rows sit in, and the grid the rules sit in, are the same
     grid — `--s-pod-row-gap` and seven equal tracks, declared once here and
     handed to both. Two grids that merely agreed would be two grids that
     stop agreeing. */
  const track: React.CSSProperties = {
    display: 'grid',
    // ── `1fr` rows with a real gap, and the rules are why ──
    //
    // This was `auto` rows with `alignContent: space-between`, so the slack
    // went into the gaps and the rows sat flush to the column's top and
    // bottom edges. That was right when a row was a stack over a bar and
    // nothing was drawn *between* two rows.
    //
    // A rule seated at `-0.5 * --s-pod-row-gap` assumes the gap **is**
    // `--s-pod-row-gap`, and under `space-between` it is not: measured at
    // 1920 the rows were 59.6px tall in a 131.1px pitch, so the real gap was
    // 71.6px against the token's 28.8px and every rule landed 21px above
    // the middle of its gap.
    //
    // Equal fractional rows make the gap the token again.
    gridTemplateRows: `repeat(${teams.length}, minmax(0, 1fr))`,
    rowGap: 'var(--s-pod-row-gap)',
    height: '100%',
    minHeight: 0,
  }

  return (
    <div style={{ position: 'relative', display: 'grid', minHeight: 0 }}>
      {/* ── The separators are gone, and a band is why ──

          They were an `::after` on each row, then a static layer of their own
          on this same grid — which fixed a real fault, that a rule seated half
          a gap under a row's *content* box sat 16px under one row and 50px over
          the next, and put every row high in its segment.

          A row with its own four edges does not need a line drawn between it
          and the next one. `/weekly` retired its row rules on the identical
          argument the day its cells became cards: a hairline in the gap is a
          second horizontal edge a few pixels from thirty-nine first ones. The
          measurement that fix was built on is kept in `.tv-pod-row`, because
          the *pane's* padding is still half a row gap for the same reason. */}
      <div ref={stripRef} style={track}>
      {/* **A deliberate render-phase ref read, not an oversight.**

          `restingTops` is a cache of measured layout, written by the
          `useLayoutEffect` above on every *idle* render and read here to work
          out how far a row travels. The effect returns early while a kick
          plays, so what this reads is always the last untransformed geometry —
          which is exactly the number the animation needs and the only render at
          which it can be asked for.

          The alternative is holding the measurement in state, which trades this
          suppression for a `react-hooks/set-state-in-effect` one (the pattern
          `lib/useWallData.ts` and `lib/useKick.ts` already use) plus an extra
          render pass through animation code whose failure mode is a row
          travelling a distance that no longer exists. Not worth it for a
          mutable layout cache, which is what a ref is for.

          If this is ever restructured, the thing to verify is not the lint
          output: it is that two bars trading places still land on each other's
          seats, measured in a browser at 1920x1080. */}
      {/* eslint-disable-next-line react-hooks/refs */}
      {teams.map((team, index) => {
        const rowRank = fromRank + index
        // **A slide, and nothing more.** Two bars trading places inside the list
        // is information rather than an event; the podium keeps the wall's one
        // interrupt. This is the rank the row is exchanging with; the distance
        // it implies is measured below, in pixels, off the resting layout.
        const swap =
          kick !== null && !entersPodium(kick.toRank)
            ? rowRank === kick.fromRank
              ? kick.toRank - rowRank
              : rowRank === kick.toRank
                ? kick.fromRank - rowRank
                : 0
            : 0
        /**
         * The exact distance to the seat this row is taking, from the resting
         * layout — and **zero unless both ends of the move are really there.**
         *
         * `toRank` is capped at `WATCH_RANKS_PODIUM`, but `fromRank` is not:
         * `lib/overtake.ts` bounds only the destination, so a team climbing from
         * 25th to 8th emits `fromRank: 25`. The row holding 8th is then told to
         * travel to index 21 of a seven-row list. Read with a `?? 0` fallback
         * that resolved to `0 - 743.7`, which is not "no movement" — it is the
         * defender's bar leaving through the top of the frame.
         */
        const target = index + swap
        const here = restingTops.current[index]
        const there = restingTops.current[target]
        const travel =
          swap !== 0 && here !== undefined && there !== undefined ? there - here : 0

        /**
         * **Everything keys off `travel`, not off `swap`.**
         *
         * A row that has a swap but no measurable distance must hold completely
         * still. Keyed off `swap` it would instead run the lane offset and the
         * opacity dip with no vertical movement at all — two bars shuffling
         * sideways in their own seats and returning, which looks like a
         * deliberate animation and communicates nothing. That is precisely the
         * shape this board showed when the distance came back zero, and it is
         * not a state worth being able to reach.
         */
        const moving = travel !== 0
        return (
        <motion.div
          key={team.teamId}
          style={{
            display: 'grid',
            // A moving row is drawn over the still ones for the length of the
            // move, so it is never half-hidden behind a bar it is passing.
            zIndex: moving ? 2 : undefined,
          }}
          initial={false}
          // ── THE KEYFRAMES WERE IN THE WRONG ORDER, AND IT FROZE ──
          //
          // They used to read `[0, far, far, 0]` against times
          // `[0, slideStart, slideEnd, 1]`, which says: jump the whole row in
          // 100ms, **hold there motionless for 900ms**, then drift back to where
          // it started over 1200ms. Measured on the running board — the two rows
          // sat at an identical transform across three samples 300ms apart. The
          // move also undid itself, because the far position was a waypoint
          // rather than the destination.
          //
          // A travel holds at the start, moves through its window, and holds at
          // the destination — `[0, 0, far, far]`. That is what
          // `components/VentureCard.tsx` does on /weekly, and it is what this
          // should always have been. The extra midpoint keyframe is what carries
          // the lane and the dip, which only exist during the crossing.
          animate={
            !moving
              ? // **A value, not `{}`.** An empty `animate` leaves the last
                // committed transform in place — the same fault that stranded
                // the podium cards' details at opacity 0. A row whose swap has
                // ended must be told it is home.
                { x: 0, y: 0, opacity: 1 }
              : {
                  y: [0, 0, travel / 2, travel, travel],
                  // **They pass side by side, not through each other.** Two rows
                  // swapping along one axis occupy the same space at the
                  // midpoint, and the first version had one venture's name
                  // printed over another's — which reads as a rendering fault
                  // rather than as a move. A small lateral offset, out and back,
                  // gives them separate lanes for the crossing and none at the
                  // ends. The one going up takes the left lane, which is the
                  // same direction the eye already reads the rank from.
                  x: [0, 0, swap < 0 ? '-13%' : '13%', 0, 0],
                  // The lane alone was not enough — two full-width rows still
                  // overlapped enough for one venture's name to print over
                  // another's. Dipping through the crossing is what makes the
                  // pass legible: at the midpoint both are ghosts, and at either
                  // end both are solid rows in their own place.
                  opacity: [1, 1, 0.45, 1, 1],
                }
          }
          transition={
            !moving
              ? // **`duration: 0`, and this is the half of the reset that
                // matters.** The row ends its slide a whole row-height from
                // where it started, and the settle re-slots it into exactly that
                // place — so the transform has to drop to zero in the *same*
                // commit. Given a duration it instead eases 68px back to zero
                // over two seconds, on top of a row that has already moved:
                // measured, the two rows crossed correctly and then visibly slid
                // back apart. The move undoing itself is what this whole fix
                // exists to stop.
                { duration: 0 }
              : {
                  duration: TOTAL,
                  // Five stops: rest, the crossing opens, the midpoint the lane
                  // and the dip live at, the crossing closes, rest again.
                  times: [
                    0,
                    at(BEATS.slide)[0],
                    (at(BEATS.slide)[0] + at(BEATS.slide)[1]) / 2,
                    at(BEATS.slide)[1],
                    1,
                  ],
                  ease: ['linear', 'easeInOut', 'easeInOut', 'linear'],
                }
          }
        >
          {/* **`.tv-pod-row` is the class `measurePath` looks for**, and it
              replaced `.tv-pod-stack` when the bar below it went — a row and
              its stack are the same box now, so two names for it is one name
              too many. See `PodiumBoard`'s `querySelectorAll`; the two have to
              be changed together or an overtake into the podium measures its
              path from nothing.

              It fills its track rather than sitting in the middle of it, so a
              row's box and its segment are the same box. The separators are a
              layer above; see the note there. */}
          {/* ── The row is a band, and the band is what pairs the two ends ──

              It was four items on a hairline grid, and the venture's name
              finished up to 388px short of its own figure — measured, on
              `AARA`. Nothing aligns across a void that wide at six metres.
              A shared surface does the pairing that alignment could not: the
              gap stops being space *between two things* and becomes space
              *inside one*.

              It is also what closes the split between the two halves of this
              slide. The left was a lit, modelled object and the right was flat
              glass with hairlines, which read as a render parked beside a
              spreadsheet. The band answers the render's own key light — a pale
              top edge, a shadow beneath — at a fraction of its amplitude.

              **The wash is the venture's own tint**, from the same hash that
              colours its mark, so the 44px disc beside it is the row's colour
              source rather than a coloured dot that identifies nothing. */}
          <div
            className="tv-pod-row"
            style={{ '--row-tint': tintFor(team.teamId) } as React.CSSProperties}
          >
            {rank(index)}
            {mark(team, rowRank)}
            {name(team, rowRank)}
            {/* The figure, and under it the distance to the row above —
                prefixed, unlabelled, with real air between them. See
                `.tv-pod-row-behind` for why it is here rather than in a column
                of its own. */}
            <span className="tv-pod-row-figures">
              {figure(team, rowRank)}
              {behind(index) === null ? null : (
                <span className="tv-pod-row-behind">+{behind(index)}</span>
              )}
            </span>
          </div>
        </motion.div>
        )
      })}
      </div>
    </div>
  )
}

/**
 * ── `useCentroidShift` is gone, and what it was for is worth keeping ──
 *
 * The three places are arranged 2 · 1 · 3 with heights descending 1 > 2 > 3, so
 * the left column carries more ink than the right one. Its bounding box was
 * perfectly symmetric — measured at 0.0px off centre — and the group still read
 * left, because the eye weighs ink rather than edges. The hook measured the
 * area-weighted centroid off the rendered pillars and nudged the row right by
 * it: 17.9px at 1920, 14.9px at 1600, 18.6px at 2000, not a constant and so not
 * something the stylesheet could hold.
 *
 * It has nothing to do now. The three blocks are one image composed in
 * `scripts/render-podium.mjs`, and the imbalance is answered there, in the
 * scene, where it belongs — the view is symmetric about the leader and the
 * eye is looking at a rendered object rather than at three boxes that happen to
 * be adjacent. **If the blocks are ever re-arranged asymmetrically, this is the
 * argument to re-read**, and the fix goes in the renderer's `VIEW`, not here.
 */

/**
 * Where the travelling disc starts and ends, measured off the rendered board.
 *
 * **Measured, never derived.** The pillar's mark and the row's mark are sized by
 * different tokens in different containers, and the distance between them
 * depends on which pillar and which row — computing it would mean re-deriving
 * the whole layout in JS and being wrong the first time either changes.
 *
 * `getBoundingClientRect` and not `offsetTop`: the podium carries a `translateX`
 * for its centroid and the marks bob on an idle, so the untransformed layout
 * position is not where the disc actually is.
 */
function measurePath(
  board: HTMLDivElement,
  fromSlot: Element | null,
  toRow: Element | null,
  team: Team,
): TravelPath | null {
  const a = fromSlot?.querySelector('.tv-pod-disc')?.getBoundingClientRect()
  const b = toRow?.querySelector('.tv-pod-row-mark')?.getBoundingClientRect()
  if (a === undefined || b === undefined || a === null || b === null) return null
  const root = board.getBoundingClientRect()
  return {
    team,
    from: { x: a.left + a.width / 2 - root.left, y: a.top + a.height / 2 - root.top, d: a.width },
    to: { x: b.left + b.width / 2 - root.left, y: b.top + b.height / 2 - root.top, d: b.width },
  }
}

export function Podium({
  ranked,
  kick = null,
  onSettled,
}: {
  ranked: readonly Team[]
  /** The overtake to play, or `null`. The board never looks at the queue itself. */
  kick?: OvertakeEvent | null
  onSettled?: () => void
}) {
  const board = useRef<HTMLDivElement | null>(null)
  const [path, setPath] = useState<TravelPath | null>(null)

  const podiumEntry = kick !== null && entersPodium(kick.toRank)

  // Measure once, when the event arrives, before the browser paints — the disc
  // must be over its pillar on the first frame or it visibly jumps into place.
  useLayoutEffect(() => {
    if (!podiumEntry || kick === null || board.current === null) {
      setPath(null)
      return
    }
    const leaving = podiumTeams(ranked).find((t) => t.teamId === kick.defender)
    if (leaving === undefined) return
    const slots = board.current.querySelectorAll('.tv-pod-slot')
    const rows = board.current.querySelectorAll('.tv-pod-row')
    // The pillar the departing venture is standing on, and the row the arriving
    // one is vacating — which is the row it drops into.
    setPath(
      measurePath(
        board.current,
        slots[PLACE_ORDER.indexOf(kick.toRank)] ?? null,
        rows[kick.fromRank - PODIUM_PLACES - 1] ?? null,
        leaving,
      ),
    )
  }, [kick, podiumEntry, ranked])

  // One timer for the whole sequence, and it is the only one. Every beat is a
  // window on the shared timeline; this just says when the timeline is over.
  useEffect(() => {
    if (kick === null || onSettled === undefined) return
    const done = setTimeout(onSettled, TOTAL * 1000)
    return () => clearTimeout(done)
  }, [kick, onSettled])

  return <PodiumBoard {...{ ranked, kick, board, path, podiumEntry }} />
}

/** Split out so the hooks above read as one block rather than being threaded
    through three hundred lines of markup. */
function PodiumBoard({
  ranked,
  kick,
  board,
  path,
  podiumEntry,
}: {
  ranked: readonly Team[]
  kick: OvertakeEvent | null
  board: React.RefObject<HTMLDivElement | null>
  path: TravelPath | null
  podiumEntry: boolean
}) {
  const visible = podiumTeams(ranked)
  // Explicit indices, not a destructure of `visible`: the three cards have to
  // exist before the feed does, and `slice` on an empty list yields nothing to
  // destructure. `undefined` is the card's empty state, and it is a real one.
  const [first, second, third] = [visible[0], visible[1], visible[2]]
  const arriving = podiumEntry && kick !== null
    ? visible.find((t) => t.teamId === kick.attacker)
    : undefined

  return (
    <div
      ref={board}
      style={{
        // **The travelling disc's positioning context.** Without this the
        // overlay resolves against whatever ancestor happens to be positioned,
        // and the disc starts over the wrong place — measured against this
        // element's own box but painted against another's.
        position: 'relative',
        display: 'grid',
        // ── **Not two equal halves, and 1.32 is measured twice over** ──
        //
        // They were `1fr 1fr`, which gave the list the same width as three
        // podium columns and left its names and figures in a 912px row with a
        // 400px hole between them. The podium needs the width because three
        // marks and three figures sit side by side in it; a list of seven
        // single lines does not.
        //
        // **It went to 1.45 for one commit and came back.** The reason for
        // widening was real — `scripts/measure-figures.mjs` showed a
        // twelve-glyph figure with only 3px of slack in first place's column at
        // 1366x768 — and the fix was wrong, because the width came out of the
        // list and `ATC (All Things Camphor)` started ellipsising at 1920,
        // where it had fitted. That trades a name a passer-by can read today
        // for headroom against ₹1,00,00,000, which thirty-nine student ventures
        // will not reach this programme.
        //
        // The slack came out of the two gaps instead — see `--w-pod-half-gap`
        // — which is space neither column was reading.
        //
        // **1.25 now, because the list sits in a pane.** The glass takes 24px
        // of padding a side, and at 1.32 the list column went from 766px to
        // 702 of usable width — `ATC (ALL THINGS CAMPHOR)` ellipsised at 1920,
        // which is the exact regression the note above records for 1.45.
        //
        // The stage gives the width back rather than losing anything: the
        // blocks are a rendered image laid in at the column's full width, so
        // this number changes how large the podium is drawn and nothing about
        // how it is composed. `scripts/render-podium.mjs` owns the latter.
        gridTemplateColumns: 'minmax(0, 1.25fr) minmax(0, 1fr)',
        gridTemplateRows: 'minmax(0, 1fr)',
        columnGap: 'var(--w-pod-half-gap)',
        padding: 'var(--s-pod-top) 0 var(--s-pod-bottom)',
        // Both load-bearing. Without the height the halves are auto-sized;
        // without `minHeight: 0` a grid item refuses to shrink under its content
        // and the board runs off the bottom.
        height: '100%',
        minHeight: 0,
        minWidth: 0,
      }}
    >
      {/* ── The stage ──

          One rendered image with three places laid over it. The image is the
          form — lit, shadowed, occluded — and everything on it is live type at
          its ordinary size and angle. `scripts/render-podium.mjs` draws it and
          `lib/podiumBlocks.ts` says where its blocks are.

          **`alignSelf: end`.** The image is wider than it is tall and the
          column is not, so the blocks sit on the column's floor with the slack
          above them, which is where the marks overhang. Centred instead, the
          blocks float and the marks crowd the masthead's rule.

          `overflow: visible` is implied and load-bearing: the marks are
          positioned against their slots and reach well above the image's own
          top edge. Anything that clips this box decapitates first place. */}
      <div
        className="tv-stage"
        style={{ alignSelf: 'end' }}
      >
        {/* Decorative. Every word on this slide is in the DOM beside it —
            `unoptimized` for the same reason every other image here is: the
            wall must not depend on an optimiser endpoint being up. */}
        <Image
          className="tv-stage-art"
          src={BLOCK_IMAGE.src}
          alt=""
          width={BLOCK_IMAGE.width}
          height={BLOCK_IMAGE.height}
          priority
          unoptimized
        />

        <PodiumCard
          team={second}
          place={2}
          departing={podiumEntry && kick?.toRank === 2}
          arriving={kick?.toRank === 2 ? arriving : undefined}
        />
        <PodiumCard
          team={first}
          place={1}
          departing={podiumEntry && kick?.toRank === 1}
          arriving={kick?.toRank === 1 ? arriving : undefined}
        />
        <PodiumCard
          team={third}
          place={3}
          departing={podiumEntry && kick?.toRank === 3}
          arriving={kick?.toRank === 3 ? arriving : undefined}
        />
      </div>

      {/* **The list is the whole right-hand column now.** It shared it with the
          mover panel, which took the top of it as a filled pale box — and that
          is what pushed the seven rows down and left the podium bottoming out at
          y=881 against the list's y=1029, with 200px of empty page beneath the
          podium. The mover is a line in the frame's footer; see
          `components/MoverPanel.tsx`. */}
      {/* In a pane of glass — see `.tv-stage-list`. The pane is the grid item;
          the strip inside it still takes the full height and lays its seven
          rows out exactly as before, so `restingTops` and the swap's travel
          are measured off the same geometry they always were. */}
      <div className="tv-stage-list">
        <Strip
          ranked={visible}
          fromRank={PODIUM_PLACES + 1}
          // Row one is measured against third place, which is on the podium
          // beside it — so every row in the list carries a gap, including the
          // first. Reading `visible` rather than `ranked` keeps it the same
          // frozen ordering the rest of the board is rendering.
          above={visible[PODIUM_PLACES - 1]}
          kick={kick}
          vacating={podiumEntry && kick !== null ? kick.fromRank : null}
          incoming={
            podiumEntry && kick !== null
              ? podiumTeams(ranked).find((t) => t.teamId === kick.defender)
              : undefined
          }
        />
      </div>

      {path === null ? null : <PodiumTravel path={path} />}
    </div>
  )
}
