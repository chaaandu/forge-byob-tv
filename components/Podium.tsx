'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'

import { MoverPanel } from '@/components/MoverPanel'
import { PodiumTravel, type TravelPath } from '@/components/PodiumTravel'
import { VentureLogo } from '@/components/VentureLogo'
import { formatRupees } from '@/lib/format'
import { BEATS, TOTAL, at, entersPodium } from '@/lib/podiumFlip'
import { nameOf } from '@/lib/team'
import type { OvertakeEvent, Team } from '@/lib/types'

/**
 * Slide 1 — the absolute leaderboard: three cards on metal plinths, and ranks
 * 4–10 as pill bars.
 *
 * ── The composition ──
 *
 * One tall card at the left, two short ones beside it, and the list filling the
 * well beneath the short pair. **The asymmetry is the ranking**: first place is
 * the only venture given a column to itself, and it does not have to be labelled
 * as first for that to read. Second and third are identical twins, as they are
 * on a real podium.
 *
 * The masthead spine that anchors all of this lives in `PodiumMasthead`.
 *
 * ── Rank is said three times ──
 *
 * Card size, the metal, and the numeral. Deliberately redundant: a greyscale
 * reproduction loses the metals, a photograph cropped to the cards loses the
 * numerals' overhang, and either one still ranks. This argument has survived
 * three redesigns of this slide and it is why none of the three carries rank
 * alone.
 *
 * ── What this deliberately spends ──
 *
 * This wall's rule is that movement means something happened. A permanently
 * idling mark spends that rule, and it was chosen knowingly: the idle is slow
 * and small where an overtake is fast, large and directional, so the two stay
 * distinguishable.
 *
 * **No `layout` prop**, here or anywhere in the board tree — there is a source
 * scan in render.test.tsx that fails the build on one. The idle is CSS keyframes
 * on `transform` alone, so it is compositor work rather than a JS loop running
 * for the weeks this page stays open without reloading.
 */

const TOP = 10
const PODIUM_PLACES = 3

const IDLE_TIMELINES = ['tv-idle-1', 'tv-idle-2', 'tv-idle-3'] as const

/**
 * The ranks in the order the pillars are drawn: 2 · 1 · 3.
 *
 * The array is the *drawing* order, so `PLACE_ORDER.indexOf(rank)` is the index
 * of that rank's pillar in the DOM. Reaching for a pillar by its rank without
 * going through this would find second place's when asked for first place's.
 */
const PLACE_ORDER: readonly number[] = [2, 1, 3]

/**
 * Everything that differs between the three cards, in one table.
 *
 * The alternative is three branches on `place` scattered through the render, and
 * the failure mode there is a card that picks up second place's metal and third
 * place's padding because two of the branches disagreed.
 */
const PLACES = {
  // Rank 1 centre and tallest, 2 to its left, 3 to its right. `riser` is how
  // many **fixed** steps this pillar stands above rank 3 — not a fraction of
  // anything, because a proportional step flattens the staircase the moment the
  // podium gets shorter, and the staircase is the composition.
  //
  // `markFoot` is air beneath the mark, and only third place asks for it: with
  // no riser, its band is exactly its mark and the logo lands on the pixel the
  // venture name starts on. The other two get theirs out of the riser already.
  //
  // **The fills are surface-aware gradients, not brand colours.** They were
  // `--deep-teal` and `--deep-forest-green`, which on the dark slide resolve to
  // the page colour and one step off it — so first place had no edge at all and
  // the staircase was three barely-different purples. `--pod-card-lead` is the
  // one place Vivid Violet is spent as a fill on this wall; `--pod-card-rest`
  // is the quieter pair behind it.
  1: { fill: 'var(--pod-card-lead)', metal: 'var(--metal-gold)', riser: 2, markFoot: 0 },
  2: { fill: 'var(--pod-card-rest)', metal: 'var(--metal-silver)', riser: 1, markFoot: 0 },
  3: { fill: 'var(--pod-card-rest)', metal: 'var(--metal-bronze)', riser: 0, markFoot: 1 },
} as const

type Place = keyof typeof PLACES

/**
 * The mark's share of the white mount it sits in.
 *
 * **93%, up from 82%.** The mount exists so a cream logo has an edge against a
 * dark card, and a thin ring does that as well as a thick one — at 82% the white
 * was reading as part of the mark rather than as a border around it, which made
 * every logo look like it had been shrunk inside its own circle.
 *
 * Still not 100%: every source logo is already a circle with its own ground, so
 * a mark drawn flush to the mount's edge hides the mount entirely and the
 * treatment would exist only for the teams without artwork.
 */
const MARK_IN_DISC = 0.93

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
 * Which of the three idle timelines this mark runs.
 *
 * **By podium place, not by team.** Three places and three timelines, so the
 * marks on screen can never fall into lockstep — the entire visible requirement,
 * and one a hash cannot promise: three ids into three buckets collide about one
 * time in nine even with a good hash, and `lib/seed.ts` documents a worse
 * failure on top of that.
 */
function idleOf(place: number): string {
  return IDLE_TIMELINES[(place - 1) % IDLE_TIMELINES.length]
}

/**
 * One podium card: a numeral breaking its top edge, a mark in a white disc, a
 * name, a figure — standing on its metal.
 */
function PodiumCard({
  team,
  place,
  departing = false,
  arriving,
}: {
  team: Team | undefined
  place: Place
  /** This pillar's mark has left — it is the disc crossing the board. */
  departing?: boolean
  /** The venture taking this pillar, shown once the seat is visibly empty. */
  arriving?: Team
}) {
  const p = PLACES[place]

  return (
    <div
      className="tv-pod-slot"
      style={
        {
          '--pod-metal': p.metal,
          '--h-pod-riser-here': `calc(${p.riser} * var(--h-pod-riser))`,
          '--h-pod-mark-foot-here': `calc(${p.markFoot} * var(--h-pod-mark-foot))`,
        } as React.CSSProperties
      }
    >
      {/* Above the card, not on it — and **still**. It used to dance on the
          same repertoire the marks use, one timeline offset from its own mark so
          the pair did not move as one rigid object.

          ── Why the dance went ──

          Not because a moving numeral is ugly; measured, it was the largest
          moving object on the slide, the `2` swinging 13.8px sideways and its
          box stretching 29.7px. The cost is that this board has exactly one
          thing it needs to be able to say — a rank changed hands — and it says
          it with a three-second interrupt. An interrupt only reads as one
          against a still frame. Nineteen elements moving at rest left the kick
          nothing to rise above, and the three biggest were these.

          What the numeral keeps is `tv-metal-sweep`, which travels a highlight
          *inside* the glyph via `background-position`. It changes what the
          numeral is made of without moving where it is, so it costs the
          interrupt nothing. That is the line this trim draws: a sweep that
          describes a material stays, an object that displaces does not.

          The wrapper went with it. It existed only because the dance and the
          sweep both wanted `animation` and one element can hold that property
          once — with no dance there is nothing to separate, and a span named
          `-dance` that does not is worse than no span. */}
      <span className="tv-pod-numeral-slot">
        <span className="tv-pod-numeral">{place}</span>
      </span>

      <div
        className="tv-pod-card"
        style={{ '--pod-fill-card': p.fill } as React.CSSProperties}
      >
        <div className="tv-pod-mark-band">
          {/* The band renders whether or not there is a team, so the pillar holds
              its height through the first paint rather than assembling itself on
              the wall. Empty rather than a placeholder mark — a grey circle is
              filler, and this wall carries none. */}
          <div
            className={team === undefined ? undefined : idleOf(place)}
            style={{
              width: 'var(--d-pod-disc)',
              aspectRatio: 1,
              ...(team === undefined ? {} : { willChange: 'transform' }),
            }}
          >
            {/* **Hidden rather than unmounted while it travels.** The travelling
                disc is measured against this element's box, and an unmounted
                element has no box — the path would be measured from nothing on
                the very frame it is needed. */}
            <div
              className="tv-pod-disc"
              style={{ width: '100%', height: '100%', opacity: departing ? 0 : 1 }}
            >
              {team === undefined ? null : (
                <VentureLogo team={team} size={`calc(var(--d-pod-disc) * ${MARK_IN_DISC})`} />
              )}
            </div>

            {/* The promoted venture, arriving last. It is drawn over the empty
                mount rather than replacing the card's own mark, because the data
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
                <VentureLogo team={arriving} size={`calc(var(--d-pod-disc) * ${MARK_IN_DISC})`} />
              </motion.div>
            )}
          </div>
        </div>

        {/* **The details cross with the mark, not after it.** The data behind
            the board is frozen for the sequence, so the card would otherwise
            announce the arriving venture's logo above the departing venture's
            name and figure — which is a worse lie than showing nothing. Both
            blocks are stacked and their opacity is swapped on the same beat. */}
        <div style={{ width: '100%', textAlign: 'center', position: 'relative' }}>
          {arriving === undefined ? null : (
            <motion.div
              style={{ position: 'absolute', inset: 0, zIndex: 1 }}
              initial={false}
              animate={{ opacity: [0, 0, 1, 1] }}
              transition={{
                duration: TOTAL,
                times: [0, ...at(BEATS.arrive), 1],
                ease: ['linear', 'easeOut', 'linear'],
              }}
            >
              <span
                style={{
                  display: 'block',
                  font: 'var(--t-pod-name)',
                  letterSpacing: 'var(--track-pod-name)',
                  textTransform: 'uppercase',
                  color: 'var(--pod-name-ink)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {nameOf(arriving)}
              </span>
              <span
                className="tv-figure"
                style={{
                  display: 'block',
                  marginTop: '0.3em',
                  font: 'var(--t-pod-fig)',
                  letterSpacing: 'var(--track-pod-fig)',
                  color: 'var(--white)',
                }}
              >
                {revenueOf(arriving)}
              </span>
            </motion.div>
          )}

          <motion.div
            initial={false}
            // **`{ opacity: 1 }`, never `{}`.** An empty `animate` does not mean
            // "back to normal", it means "animate nothing" — so Motion left the
            // last value it committed, which is the 0 this card fades to when a
            // venture arrives. The details were still in the DOM and still
            // correct; they were simply invisible, and they never came back.
            //
            // It compounded. Every overtake blanked one more card, so after
            // three the whole podium was three logos with no name and no figure
            // under any of them — on a wall nobody is watching closely enough to
            // notice a number going missing. Measured with the dev triggers:
            // 4→1 blanked rank 1, then 4→3 blanked rank 3, then 5→2 blanked
            // rank 2, and nothing ever restored them.
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
          <span
            style={{
              display: 'block',
              font: 'var(--t-pod-name)',
              letterSpacing: 'var(--track-pod-name)',
              textTransform: 'uppercase',
              color: 'var(--pod-name-ink)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {team === undefined ? '' : nameOf(team)}
          </span>
          <span
            className="tv-figure"
            style={{
              display: 'block',
              marginTop: '0.3em',
              font: 'var(--t-pod-fig)',
              letterSpacing: 'var(--track-pod-fig)',
              color: 'var(--white)',
            }}
          >
            {revenueOf(team)}
          </span>
          </motion.div>
        </div>
      </div>

      <div className="tv-pod-foot" />
    </div>
  )
}

/**
 * Ranks 4–10, as pill bars.
 *
 * **Each bar measures the gap to the team immediately above it**, not a share of
 * some board-wide maximum. Two earlier versions measured against rank 1 and then
 * against the list's own leader, and both had the same defect: whoever led the
 * list drew a full bar and therefore looked finished. Rank 4 is not finished —
 * it is ₹466 behind third place, the tightest gap on the board and the one thing
 * about rank 4 worth showing.
 *
 * So the bar answers "how close am I to catching the venture above me", which is
 * a question every row can be losing. The row above rank 4 is third place, on
 * its podium card, which is why this takes the whole ranked list rather than the
 * slice it draws. A full bar becomes impossible by construction: you cannot be
 * 100% of the venture ahead of you without being ahead of them.
 */
function Strip({
  ranked,
  fromRank,
  kick = null,
  vacating = null,
  incoming,
}: {
  ranked: readonly Team[]
  fromRank: number
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

  // **One reference for all seven bars: the venture ranked immediately above the
  // list.** Measuring each row against the row directly above it — which this
  // did briefly — produces a chart that is not a ranking: rank 6 drew a longer
  // bar than rank 5, and rank 10 drew a nearly full one, because each was only
  // ever describing its own local gap. Against one shared reference the bars
  // descend, which is what a leaderboard has to do, and rank 4 still cannot fill
  // its track because it is behind third place.
  const above = ranked[fromRank - 2]
  const reference = above?.totalRevenue ?? teams[0]?.totalRevenue ?? 0

  const share = (team: Team) =>
    reference <= 0
      ? 0
      : // Floored at the pill's left cap. A bar three percent long is a lozenge
        // that reads as a rendering fault rather than as a small number.
        Math.max(11, Math.min(100, (100 * team.totalRevenue) / reference))

  const rank = (index: number) => (
    <span
      className="tv-figure"
      style={{
        font: 'var(--t-pod-rank-row)',
        letterSpacing: 'var(--track-pod-fig)',
        color: 'var(--pod-rank-ink)',
        textAlign: 'center',
      }}
    >
      {fromRank + index}
    </span>
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

  return (
    <div
      ref={stripRef}
      style={{
        display: 'grid',
        // **`auto` rows with the slack in the gaps, not `1fr`.** With equal
        // fractional rows each row centres its content and leaves a margin
        // inside itself, so the last bar stopped 16.6px above the column's
        // bottom and the podium's bases sat lower than it — two bottom edges on
        // one frame, neither of them wrong on its own. `space-between` puts the
        // first row flush to the top and the last flush to the bottom, so the
        // final bar's underside *is* the column's floor and the podium meets it.
        gridTemplateRows: `repeat(${teams.length}, auto)`,
        alignContent: 'space-between',
        rowGap: 'var(--s-pod-row-gap)',
        height: '100%',
      }}
    >
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
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
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
          <div className="tv-pod-stack">
            {rank(index)}
            {mark(team, rowRank)}
            {name(team, rowRank)}
            {figure(team, rowRank)}
          </div>
          <div className="tv-pod-underbar">
            {/* **No sheen on this bar.** A highlight travelling along a filled
                length reads as the length changing, which on a board whose one
                interrupt is a real rank change spends that meaning seven times a
                cycle for nothing. The bar states a share; it does not perform
                it. Sweeps that describe a *material* — the plinth feet, the
                metal poured into the numerals — stay, because they say what a
                surface is rather than that a figure moved. */}
            <span className="tv-pod-underbar-fill" style={{ width: `${share(team)}%` }} />
          </div>
        </motion.div>
        )
      })}
    </div>
  )
}

/**
 * How far right the podium has to move so its *mass* is centred, not its box.
 *
 * ── Why a bounding box is the wrong thing to centre ──
 *
 * The arrangement is 2-1-3 with heights descending 1 > 2 > 3, so the left pillar
 * is taller than the right one and carries more dark area. The bounding box is
 * perfectly symmetric — measured at 0.0px off the channel centre — and the group
 * still reads left, because the eye weighs ink rather than edges.
 *
 * Measured on the running board, the area-weighted centroid sits **17.9px left**
 * of the box centre at 1920, 14.9px at 1600 and 18.6px at 2000. It is not a
 * constant, so it cannot be a constant in the stylesheet.
 *
 * ── Why this is measured rather than derived in CSS ──
 *
 * With equal widths the closed form is `pitch × (hLeft − hRight) / Σh`, and
 * `Σh` depends on the pillars' content height — which CSS knows only after
 * layout. So the heights are read back from the rendered pillars, which is the
 * same thing `WeeklyGrid` does for the flip's travel.
 *
 * Transform rather than margin: it moves the group without moving the layout, so
 * observing the row's size cannot feed back into it.
 */
function useCentroidShift(): [React.RefObject<HTMLDivElement | null>, number] {
  const row = useRef<HTMLDivElement | null>(null)
  const [shift, setShift] = useState(0)

  const measure = useCallback(() => {
    const el = row.current
    if (el === null) return
    const slots = [...el.children].map((child) => child.getBoundingClientRect())
    if (slots.length !== 3) return
    const areas = slots.map((s) => s.width * s.height)
    const total = areas.reduce((sum, a) => sum + a, 0)
    if (total <= 0) return
    const centroid = slots.reduce((sum, s, i) => sum + (s.left + s.width / 2) * areas[i], 0) / total
    const box = (slots[0].left + slots[2].right) / 2
    setShift(box - centroid)
  }, [])

  useLayoutEffect(() => {
    measure()
    const el = row.current
    if (el === null || typeof ResizeObserver === 'undefined') return
    // Only fires when the frame itself changes, which on a wall is close to
    // never — this is not a loop, it is a re-measure after a resize.
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [measure])

  return [row, shift]
}

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
  const [row, shift] = useCentroidShift()
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
    const rows = board.current.querySelectorAll('.tv-pod-stack')
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

  return <PodiumBoard {...{ ranked, kick, row, shift, board, path, podiumEntry }} />
}

/** Split out so the hooks above read as one block rather than being threaded
    through three hundred lines of markup. */
function PodiumBoard({
  ranked,
  kick,
  row,
  shift,
  board,
  path,
  podiumEntry,
}: {
  ranked: readonly Team[]
  kick: OvertakeEvent | null
  row: React.RefObject<HTMLDivElement | null>
  shift: number
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
        // and the disc starts over the wrong pillar — measured against this
        // element's own box but painted against another's.
        position: 'relative',
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
        // The row is stated rather than left implicit. An `auto` row gives the
        // halves an indefinite height, and the podium's percentage step heights
        // then have nothing to be a percentage *of* — measured, all three slots
        // collapsed to zero and their cards spilled out of the bottom of the
        // frame on a page that otherwise looked fine.
        gridTemplateRows: 'minmax(0, 1fr)',
        columnGap: 'var(--w-pod-half-gap)',
        padding:
          'var(--s-pod-top) var(--s-pod-edge) var(--s-pod-bottom) var(--s-pod-gutter)',
        // Both load-bearing. Without the height the halves are auto-sized and
        // the podium's percentage step heights have nothing to be a percentage
        // *of*; without `minHeight: 0` a grid item refuses to shrink under its
        // content and the board runs off the bottom.
        height: '100%',
        minHeight: 0,
        minWidth: 0,
      }}
    >
      {/* ── The podium ──

          `flex-end`, so three cards of three heights share one baseline. That
          shared floor is the whole idea: without it they are three cards of
          arbitrary size, and with it they are steps. Drawn 2-1-3 so first place
          is centre, which is where a podium puts it and where nobody has to work
          the order out. */}
      <div
        ref={row}
        style={{
          display: 'flex',
          // `flex-end` keeps the three bases on one line; `align-self: center`
          // then centres that whole block in the column, so the white space
          // falls above *and* below the podium rather than all above it. The
          // row is content-height for the same reason — given `100%` it would
          // hang from the column's floor again.
          alignItems: 'flex-end',
          alignSelf: 'center',
          gap: 'var(--s-pod-gap)',
          minWidth: 0,
          minHeight: 0,
          // Centres the group's mass rather than its box — see `useCentroidShift`.
          transform: `translateX(${shift.toFixed(2)}px)`,
        }}
      >
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

      <div
        style={{
          display: 'grid',
          gridTemplateRows: 'auto minmax(0, 1fr)',
          rowGap: 'var(--s-pod-stack-gap, 2.8vw)',
          minWidth: 0,
          minHeight: 0,
        }}
      >
        <MoverPanel ranked={ranked} />
        <Strip
          ranked={visible}
          fromRank={PODIUM_PLACES + 1}
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
