'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'

import { PodiumTravel, type TravelPath } from '@/components/PodiumTravel'
import { VentureLogo } from '@/components/VentureLogo'
import { formatRupees } from '@/lib/format'
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
 * ── What moves at rest, and it is three things ──
 *
 * This wall's rule is that movement means something happened. The only things
 * spending it are the three podium marks, which idle — see `idleOf` for why
 * that is scoped to exactly the top three and why `/weekly` does not get it.
 * Everything else on both slides holds completely still: the other thirty-six
 * cards, the list of seven, both mastheads, the numerals. No lustre sweeps, no
 * numeral dance, no plinth sheens — all of those went with the metals.
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
  // Rank 1 centre and largest, 2 to its left, 3 to its right.
  //
  // **One property each, where there were four.** A place used to carry a card
  // fill, a metal, a riser count and a mark-foot count — because it was a
  // filled card of a stated height standing on a plinth under a metal numeral.
  // It is a mark, a name and a figure sharing a baseline with two others, so
  // the only thing that differs is how big the mark is.
  //
  // The `--d-pod-disc` / `--d-pod-disc-rest` pair is what draws the staircase.
  // See the token: the ratio is the podium, because a shared text baseline
  // turns a wider mark into a higher one at no further cost.
  1: { disc: 'var(--d-pod-disc)', fig: 'var(--t-pod-fig)', lead: true },
  2: { disc: 'var(--d-pod-disc-rest)', fig: 'var(--t-pod-fig-rest)', lead: false },
  3: { disc: 'var(--d-pod-disc-rest)', fig: 'var(--t-pod-fig-rest)', lead: false },
} as const

type Place = keyof typeof PLACES

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
 * Which of the three idle timelines this mark runs.
 *
 * **By podium place, not by team.** Three places and three timelines, so the
 * marks on screen can never fall into lockstep — the entire visible
 * requirement, and one a hash cannot promise: three ids into three buckets
 * collide about one time in nine even with a good hash, and `lib/seed.ts`
 * documents a worse failure on top of that.
 *
 * ── This was removed and then asked for back ──
 *
 * The argument for removing it was `/weekly`'s: this board has one thing it
 * needs to be able to say — a rank changed hands — and it says it with a
 * two-and-a-half-second interrupt, which reads as an interrupt only against a
 * still frame. That argument is sound and it is **overruled here on purpose**,
 * for the top three and nowhere else.
 *
 * What makes it survivable is the scope. Three marks idling is not the same
 * proposition as forty: the wall's rule is that movement *means* something, and
 * on this slide the movement is confined to exactly the three ventures the
 * slide exists to celebrate, so it reads as those three being alive rather than
 * as the page being busy. Everything else on both boards — the other
 * thirty-six cards, the list of seven, both mastheads — holds completely still,
 * which is what the overtake still has to rise above.
 *
 * The idle is also deliberately unlike the kick: slow, small, and
 * non-directional, where an overtake is fast, large and travels across the
 * frame. `app/mesa-tv.css` has the keyframes and the amplitudes.
 *
 * `/weekly` does **not** get this back. Ten idling marks on a board of
 * thirty-nine is the case the rule was written for.
 */
function idleOf(place: number): string {
  return IDLE_TIMELINES[(place - 1) % IDLE_TIMELINES.length]!
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
  const p = PLACES[place]

  /* The name and figure, as one block. Both states of a place being handed over
     render this, stacked and cross-faded, so the arriving venture's details
     cannot appear over the departing venture's — see the note below. */
  const details = (of: Team | undefined) => (
    <>
      <span className="tv-pod-name" style={{ marginTop: 'var(--s-pod-mark-gap)' }}>
        {of === undefined ? '' : nameOf(of)}
      </span>
      <span
        className="tv-figure"
        style={{
          display: 'block',
          marginTop: 'var(--s-pod-name-gap)',
          font: p.fig,
          letterSpacing: 'var(--track-pod-fig)',
          color: 'var(--ink)',
          textAlign: 'center',
        }}
      >
        {revenueOf(of)}
      </span>
    </>
  )

  return (
    <div className="tv-pod-slot">
      {/* Above the mark, and still. It used to dance on the same repertoire the
          marks use — measured, it was the largest moving object on the slide,
          the `2` swinging 13.8px sideways with its box stretching 29.7px. This
          board has exactly one thing it needs to be able to say, a rank changed
          hands, and it says it with an interrupt; an interrupt only reads as one
          against a still frame.

          What it no longer keeps is `tv-metal-sweep`. That was allowed to stay
          on the argument that a sweep describing a *material* costs the
          interrupt nothing — true, and moot, because there is no metal left for
          it to describe. */}
      <span className="tv-pod-numeral-slot">
        <span
          className={p.lead ? 'tv-pod-numeral' : 'tv-pod-numeral tv-pod-numeral-rest'}
          role="img"
          aria-label={`Rank ${place}`}
        >
          {place}
        </span>
      </span>

      <div className="tv-pod-mark-band" style={{ width: p.disc, height: p.disc }}>
        {/* The band renders whether or not there is a team, so the place holds
            its size through the first paint rather than assembling itself on
            the wall. Empty rather than a placeholder mark — a grey circle is
            filler, and this wall carries none. */}
        {/* The idle rides this box, not the disc inside it: a CSS animation
            beats an inline style, so sharing an element with the flip's
            `transform` would let the idle simply win and the mark would never
            turn over during an overtake. `VentureDisc` carries the same
            three-layer split on `/weekly` and says so at length.

            An empty seat does not idle. A place with no team yet is holding its
            size through the first paint, and a placeholder that bobs reads as
            content rather than as absence. */}
        <div
          className={team === undefined ? undefined : idleOf(place)}
          style={{
            width: '100%',
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
              <VentureLogo team={team} size={p.disc} />
            )}
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
              <VentureLogo team={arriving} size={p.disc} />
            </motion.div>
          )}
        </div>
      </div>

      {/* **The details cross with the mark, not after it.** The data behind the
          board is frozen for the sequence, so the place would otherwise announce
          the arriving venture's logo above the departing venture's name and
          figure — which is a worse lie than showing nothing. Both blocks are
          stacked and their opacity is swapped on the same beat. */}
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
          // It compounded. Every overtake blanked one more place, so after three
          // the whole podium was three logos with no name and no figure under
          // any of them — on a wall nobody is watching closely enough to notice
          // a number going missing. Measured with the dev triggers: 4→1 blanked
          // rank 1, then 4→3 blanked rank 3, then 5→2 blanked rank 2, and
          // nothing ever restored them.
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

  const rank = (index: number) => (
    <span
      className="tv-figure"
      style={{
        font: 'var(--t-pod-rank-row)',
        letterSpacing: 'var(--track-pod-fig)',
        // `--ink-muted`, which is what `/weekly` inks its rank numerals with.
        // It was `--pod-rank-ink`, a podium-only token that resolved to Mint
        // 300 on dark — chosen when this numeral was 15px and Violet 300 was
        // measurably too thin for it. At 23px Violet 300 is 5.6:1 and
        // comfortable, and the two boards now say "rank" in one ink.
        color: 'var(--ink-muted)',
        // **Right, not centre.** These are tabular figures in a vertical column
        // of ranks, and centring them puts the unit digit of `10` at a
        // different x from the unit digit of `4` — measured, the `10` hangs
        // 13px left of the single digits above it. Right-aligned, the units
        // line up and the gap to the mark beside them is constant, which is the
        // whole reason a list of numbers is set in tabular figures at all.
        //
        // `/weekly`'s ranks stay left-aligned: there they are a label on a
        // card's own top-left corner rather than a column of numbers, and they
        // align with the card's edge instead of with each other.
        textAlign: 'right',
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
        // the middle of its gap — hugging the row above it, which is exactly the
        // "reads as an underline rather than a separator" failure the rule is
        // written to avoid.
        //
        // Equal fractional rows make the gap the token again. Each row then
        // centres its content in its own track, which is also what puts a row's
        // content equidistant from the rules above and below it.
        gridTemplateRows: `repeat(${teams.length}, minmax(0, 1fr))`,
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
          {/* **`.tv-pod-row` is the class `measurePath` looks for**, and it
              replaced `.tv-pod-stack` when the bar below it went — a row and
              its stack are the same box now, so two names for it is one name
              too many. See `PodiumBoard`'s `querySelectorAll`; the two have to
              be changed together or an overtake into the podium measures its
              path from nothing.

              The rule under each row is drawn by the row itself, seated in the
              middle of the row gap. The last row does not draw one: the frame's
              own rule above the footer is the board's bottom edge. */}
          <div
            className={
              index < teams.length - 1 ? 'tv-pod-row tv-pod-row-rule' : 'tv-pod-row'
            }
          >
            {rank(index)}
            {mark(team, rowRank)}
            {name(team, rowRank)}
            {figure(team, rowRank)}
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
        // and the disc starts over the wrong place — measured against this
        // element's own box but painted against another's.
        position: 'relative',
        display: 'grid',
        // **Not two equal halves.** They were `1fr 1fr`, which gave the list the
        // same width as three podium columns and left its names and figures in a
        // 912px row with a 400px hole between them. The podium needs the width
        // because three marks and three figures sit side by side in it; a list
        // of seven single lines does not.
        gridTemplateColumns: 'minmax(0, 1.32fr) minmax(0, 1fr)',
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
      {/* ── The left column: a caption, then the podium ──

          **The caption is `PodiumMasthead`'s "Total revenue" line, restored.**
          That component's own docblock recorded its removal as a real loss —
          "the one line telling a passer-by that these figures are all-time where
          `/weekly`'s are the week's, on two slides that rotate on one screen
          minutes apart ... if a figure is ever misread between the two boards,
          this is the line that went."

          It comes back for that reason first and a compositional one second.
          The podium group is 419px tall in an 852px column, so centring it
          leaves 200px of empty aubergine above — at the top left of the frame,
          which is where the eye enters. A caption on the column's own top edge
          gives that half a top, so the air below it reads as a field the group
          sits in rather than as a corner nothing was put in.

          It is not filler by the wall's own test: it says something true that
          nothing else on the slide says, and removing it was recorded as a
          cost rather than a tidy-up. */}
      <div style={{ display: 'grid', gridTemplateRows: 'auto minmax(0, 1fr)', minHeight: 0 }}>
        <p className="tv-pod-caption">Total revenue, all time</p>

      {/* `flex-end`, so three places of three sizes share one text baseline.
          That shared floor is the whole idea: without it they are three marks of
          arbitrary size, and with it they are steps. Drawn 2-1-3 so first place
          is centre, which is where a podium puts it and where nobody has to work
          the order out. */}
      <div
        ref={row}
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          // ── `center`, and the alternative was measured before it was
          //    rejected ──
          //
          // `end` looks like the right answer: the list beside this runs the
          // column's full height, so sitting the podium on the same floor gives
          // the frame one baseline instead of two. Measured at 1920x1080 it
          // gives the frame one baseline and a **400px void of empty aubergine
          // above the podium** — the group is 447px tall in an 852px column and
          // bottom-aligning it puts every pixel of the slack in one place, at
          // the top left of the frame, which is where the eye enters.
          //
          // That is the same fault the old layout had, mirrored: it had 200px
          // of nothing *below* the podium because the mover panel pushed the
          // list down. Moving the mover to the footer fixed the cause; `end`
          // reintroduced it upside down.
          //
          // Centred, the slack is 202px above and 202px below, which reads as a
          // group placed in a field rather than as a group that has fallen to
          // the bottom of one. The two floors are the price and they are worth
          // it — a centred block does not look like it is resting on anything,
          // so there is nothing for the list's floor to disagree with.
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
      </div>

      {/* **The list is the whole right-hand column now.** It shared it with the
          mover panel, which took the top of it as a filled pale box — and that
          is what pushed the seven rows down and left the podium bottoming out at
          y=881 against the list's y=1029, with 200px of empty page beneath the
          podium. The mover is a line in the frame's footer; see
          `components/MoverPanel.tsx`. */}
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

      {path === null ? null : <PodiumTravel path={path} />}
    </div>
  )
}
