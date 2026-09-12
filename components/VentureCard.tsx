'use client'

import { useEffect, useRef } from 'react'
import { motion, type Easing } from 'motion/react'

import { VentureDisc } from '@/components/VentureDisc'
import { SOLID_RANKS } from '@/config'
import { boardEarned } from '@/lib/board'
import { formatRupees } from '@/lib/format'
import { BEATS, TOTAL, at, type FlipCue } from '@/lib/flipTimeline'
import { nameOf } from '@/lib/team'
import type { BoardMode, Team } from '@/lib/types'

/**
 * One team's card: a solid Deep Forest object carrying rank, mark, venture name
 * and figure — the same anatomy a podium pillar has, at grid scale.
 *
 * ── What this replaced, and why ──
 *
 * The board used to be forty marks floating over forty near-invisible bases, and
 * it read as a sticker sheet. Four things caused that and all four are fixed
 * here rather than softened:
 *
 * - **The rank was painted on the artwork.** It needed a triple white
 *   drop-shadow to survive forty unknown logos and still lost — ranks 12 and 13
 *   were half-swallowed by SORTD and Blunnt. The badge is on the card's own
 *   surface now, where nothing of the venture's can cover it.
 * - **Nothing bound a mark to its figure.** The card does.
 * - **Every card was as loud as every other.** The bottom half of the board is
 *   the pale outlined kind now — see `quiet` below. The rule was revenue and is
 *   rank; the figure is what still follows revenue.
 *
 * ── One treatment per card, never both ──
 *
 * Ranks 4–40 get the badge. Ranks 1–3 get `/podium`'s metal numeral instead,
 * breaking above the card's top edge, in the podium's own class so the two
 * boards say gold with one implementation rather than two that drift.
 *
 * ── Rank sits on the cell, not on the card ──
 *
 * Both treatments are outside the travelling element, deliberately. Rank is a
 * fact about the *board*: a number that flew across the frame with a card would
 * be claiming to belong to the venture rather than to the position.
 */

/**
 * ── THE NAME WENT AND TODAY CAME BACK, ONTO THE SAME LINE ──
 *
 * The anatomy is rank, mark, week, today. It was rank, mark, name, week for one
 * revision, and the swap is deliberate rather than a reversal that lost track of
 * itself:
 *
 * - **The mark already identifies the venture at this size.** A 116px disc of a
 *   team's own artwork and its name underneath are the same fact printed twice,
 *   and the second printing cost the only line the card had spare.
 * - **Today was the only thing on the board that said who is moving *now*.**
 *   Without it the wall is a weekly summary on a screen; a passer-by at 4pm on a
 *   busy Friday has no way to see the afternoon in it.
 *
 * It also settles the overflow question the name never answered: five of forty
 * names did not fit on one line at 156px, and no truncation, marquee or short
 * display-name column is needed for a line that is no longer there.
 *
 * **The cost, stated rather than buried:** a team with no artwork is now a
 * coloured initial with no name anywhere on the card. Two teams are in that
 * state today. The disc's `alt` still carries the venture name, so the board is
 * not lying to anything that reads it — but at six metres those two cards say
 * only a letter, and that is the price of the line.
 */

/**
 * ── THE METALS ARE GONE FROM THIS BOARD ──
 *
 * Ranks 1-3 carried a gold, silver or bronze numeral straddling the card's top
 * corner with a lustre sweep travelling inside the glyph, and a matching metal
 * foot under the card with a second sweep. Four ornaments, all saying a number
 * that was already printed.
 *
 * `LEAD_RANKS` is what says it now: the top three take a larger numeral in the
 * surface's accent and nothing else. `/podium` makes the identical move, so the
 * two boards still say "first" one way — which was the whole reason the metals
 * were shared between them, and the reason dropping them had to be done on both
 * at once.
 */
const LEAD_RANKS = 3

/**
 * **The mark crosses to the other slot. The card does not move at all.**
 *
 * The whole card used to travel, and an overtake across rank 20 therefore had
 * to change a card's fill in mid-flight — a box that changes colour while it
 * slides reads as a rendering fault rather than as an overtake. Slots hold
 * still and keep their colour; what moves between them is the mark, and what
 * changes is whose details are printed under it.
 *
 * The resize rides the travel because the rows descend: a mark crossing a row
 * boundary is 107px at one end and 88px at the other, and a snap at either end
 * would read as the mark arriving twice.
 *
 * `x`/`y`/`scale` hold at their start until the travel opens, so the turn
 * happens in place, and hold at the destination afterwards so the unturn
 * happens there. All three end exactly on the seat the re-sorted board is about
 * to give this mark, which is what makes the settle invisible.
 */
const TRAVEL_EASE: Easing[] = ['linear', 'easeInOut', 'linear']

function travelMotion(cue: FlipCue) {
  const window = at(BEATS.travel, cue.role === 'defender' ? cue.shift : 0)
  return {
    animate: {
      x: [0, 0, cue.dx, cue.dx],
      y: [0, 0, cue.dy, cue.dy],
      scale: [1, 1, cue.scale, cue.scale],
    },
    transition: { duration: TOTAL, times: [0, ...window, 1], ease: TRAVEL_EASE },
  }
}

export function VentureCard({
  team,
  rank,
  mode = 'challenge',
  idle,
  delaySeconds,
  cue,
  onSettled,
  arriving,
}: {
  team: Team
  rank: number
  /** Which contest is on, from `challenge_mode`. The figure below is the one
      the board sorted by — a card printing the other one turns every rank on
      the board into a visible lie, with nothing to report it. */
  mode?: BoardMode
  /** Set for one render on the two cards an overtake just settled, and on
      nobody else. It is what lets their details fade in after a remount without
      every unrelated re-sort doing the same. */
  arriving?: boolean
  /** An idle timeline class. Only row 1 gets one; the other thirty hold still. */
  idle?: string
  /** Phase offset, so ten marks on one row never fall into step. */
  delaySeconds?: number
  /** Set only while this card is in a flip. Absent means an ordinary, inert card. */
  cue?: FlipCue
  /** Called once, by the attacker's card, when the last beat finishes. */
  onSettled?: () => void
}) {
  /**
   * **Quiet is a fact about the slot now, not about the team.**
   *
   * It used to be `weekRevenue <= 0`, which in week 4 left thirty solid cards on
   * a forty-card board. Rank is the rule instead: the top `SOLID_RANKS` are
   * solid Deep Forest, the rest are the pale outlined kind — see the token for
   * why the line sits where it does.
   *
   * **A team with no revenue this week still prints no figure**, wherever it
   * ranks. The two rules are deliberately separate: one governs how much of the
   * board a card claims, the other whether there is a number to say. A pale card
   * that earned keeps its figure, and a solid card that has not traded — which
   * happens on a Monday, when twenty cards are at zero and someone still holds
   * rank 1 — shows nothing rather than `₹0`.
   */
  const quiet = rank > SOLID_RANKS

  /**
   * ── Today is shown, or it is not ──
   *
   * A team that has traded today gets a capsule carrying the figure and a mark
   * pointing up. A team that has not gets no capsule, and the row stays empty —
   * reserved, so the board does not re-flow as the day's first sales land.
   *
   * **One condition, read once.** This was computed here and then re-derived
   * inline for the render, which is two expressions that have to agree about
   * what "traded" means — and they did agree, right up until the modifier class
   * one of them fed was deleted and the other was left behind.
   *
   * **There is no second state and no comparison.** The figure was coloured
   * against the board's average for a while, green above and red below, which
   * meant a team that had sold well still read as failing if the cohort's
   * average happened to be higher. Trading today is the thing worth saying; how
   * it ranks against everyone else's day is what the board itself already shows
   * by putting them in order.
   */
  const traded = team.todayRevenue > 0

  const flips = cue !== undefined && cue.role !== 'slide'
  // `false`, not `undefined`, for a card with no cue: the reset to x/y 0 has to
  // land in the same commit as the settle's re-slot, or the board would be seen
  // reordering under a card that had already finished moving.
  const travel =
    cue === undefined
      ? { animate: { x: 0, y: 0, scale: 1 }, transition: { duration: 0 } }
      : travelMotion(cue)

  /**
   * The deadlock guard. `onSettled` is the only thing standing between the queue
   * and a wedge: if this card unmounts before its animation completes — the
   * rotation moving on mid-flip, or a board that re-sorted underneath it —
   * nothing would ever report the flip finished and `playing` would pin forever.
   * The cleanup reports it instead. Idempotent by construction, so the normal
   * path calling both is harmless.
   *
   * ── The callback is held in a ref, and that is the whole point ──
   *
   * `onSettled` used to be a dependency, which turned an unmount guard into a
   * **re-render** guard: React runs an effect's cleanup before re-running it, so
   * any new function identity from the page fired the settle at whatever frame
   * the flip had reached. The page handed down an inline arrow, so *every* one
   * of its renders did it — a dev button pressed during a flip, a poll bumping
   * `queueVersion`, anything. The flip stopped dead and the next one started
   * over the top of it, which is what "the animations pause when overtakes
   * arrive together" was.
   *
   * Depending on the role alone is what makes the effect mean what it says: it
   * arms when this card becomes the attacker and disarms when it stops being
   * one, and unmount is the only other way out.
   */
  const attacker = cue?.role === 'attacker'
  const settle = useRef(onSettled)
  // Declared before the guard so the ref is current by the time any cleanup can
  // read it. Written in an effect rather than during render, which is the rule
  // that keeps a ref from disagreeing with a discarded render.
  useEffect(() => {
    settle.current = onSettled
  })
  /**
   * **And it has to be an unmount, not merely the end of a cue.**
   *
   * React runs this cleanup whenever `attacker` goes false, which includes the
   * ordinary, healthy ending: the flip completes, `playing` clears, the cue goes
   * with it. By then the queue has already handed the board the *next* event in
   * the very same commit — so the cleanup's settle cancelled a kick that had
   * just started, one render into its own life. Every overtake after the first
   * was taken out of the queue and thrown away with nothing on screen, and the
   * board stood still while the wall worked through a batch of three.
   *
   * That is the whole of "the animations pause when I fire two or three". The
   * ref below is what distinguishes the two cases: cleanups run in declaration
   * order, so on a real unmount this one has already been marked and the guard
   * fires; on a cue simply clearing it has not, and the guard stays quiet.
   */
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  useEffect(() => {
    if (!attacker) return
    return () => {
      if (!mounted.current) settle.current?.()
    }
  }, [attacker])

  return (
    <div
      // Named so `scripts/measure-fit.mjs` can find the grid's true top edge.
      className="tv-card-cell"
      // The brain reads cell geometry by rank when a flip starts. Untransformed
      // layout only — `getBoundingClientRect` on a cell is safe because cells
      // never move; it is the card inside them that does.
      data-rank={rank}
      style={{
        height: '100%',
        position: 'relative',
        // **No z-index here, deliberately.** Lifting the whole cell was the
        // obvious fix for a travelling mark passing under its neighbours, and it
        // does not work: both cells in an exchange are in a flip, so both were
        // lifted to the same level and DOM order decided — the mark descending
        // out of rank 20 went behind rank 21's card for 56 of 145 frames,
        // measured. A cell that creates a stacking context also traps its own
        // mark inside it, which is what made the problem unfixable from here.
        // The marks are lifted instead; see the travelling wrapper below.
      }}
    >
      {/* ── The rank ──
          Board apparatus, not the team's — see the header note. **One element
          for all thirty-nine now.** It used to branch: ranks 1-3 got
          `/podium`'s metal numeral in a positioned wrapper, ranks 4-40 got
          plain type. Two treatments for one fact, and the branch is what made
          the top three cards need their own vertical lift and the whole grid
          need headroom above row 1.

          The class does the differing instead. `tv-card-rank-lead` is one step
          of size and the surface's accent; everything else about the numeral —
          where it sits, how it tracks, that it is tabular — is shared by
          construction and cannot drift. */}
      <span className={rank <= LEAD_RANKS ? 'tv-card-rank tv-card-rank-lead' : 'tv-card-rank'}>
        {rank}
      </span>

      <motion.div

        className={[
          quiet ? 'tv-card tv-card-quiet' : 'tv-card',
          // Fades the details out while this card's mark is away, and back in
          // when the cue clears — which is the same commit the board re-sorts
          // in, so what fades back in is the *new* team's. A transition rather
          // than keyframes: the two ends are the two states, and nothing has to
          // agree about when the middle is.
          cue === undefined ? undefined : 'tv-card-away',
          arriving === true ? 'tv-card-arriving' : undefined,
        ]
          .filter(Boolean)
          .join(' ')}
        style={{
          position: 'absolute',
          inset: 0,
          display: 'grid',
          // **Four rows, and the first one is the head band.** It used to be
          // five: a strip for the rank, the mark, the name, the figure and a
          // fifth row at the bottom holding the day capsule. That fifth row was
          // reserved on all thirty-nine cards and drawn on six, which is the
          // empty band that sat under every `₹0`, and it cost every mark on the
          // board 34px it could not spare — measured, the mark was 40% of its
          // own card.
          //
          // The capsule sits in the head band now, at the right-hand end. The
          // rank is absolutely positioned over the left of that same band and
          // belongs to the *cell* rather than to this card (see the note on the
          // rank above), so the band was 155.6px wide and spending 26.6px of
          // it. Sharing it costs nothing and returns the whole fifth row to the
          // marks: 90.6 → 113.1px on row 1, 66.2 → 88.7 on row 4.
          //
          // The band is still reserved on ranks 1-3, whose numeral is outside
          // the card entirely — without it their discs would sit a strip higher
          // than row 1's other seven and the row would read as broken.
          //
          // No `gap`. Every one of these tracks carries its own separation, so
          // nothing leaves a gap behind if it ever stops being drawn.
          gridTemplateRows:
            'var(--h-card-head) auto var(--h-card-name) var(--h-card-fig) var(--h-card-today)',
          justifyItems: 'center',
          alignContent: 'start',
          minWidth: 0,
        }}
      >
        {/* The head band: the rank, and the rank only. The rank numeral is
            absolutely positioned on the *cell* rather than on this card (see
            the note on it above), so what this row contributes is the height
            the mark is not allowed to enter — reserved on ranks 1-3 as well,
            whose numeral is larger, so their discs do not sit a strip higher
            than row 1's other seven. */}
        <span aria-hidden="true" />
        <motion.div
          {...travel}
          // The travel is the longest-running property in the sequence, so its
          // completion is the sequence's. Component-level, not
          // transition-level: the old kick measured the per-transition
          // `onComplete` never firing at all once the transition carried
          // per-property overrides, which wedged the queue with nothing on
          // screen progressing.
          onAnimationComplete={attacker ? onSettled : undefined}
          style={{
            display: 'grid',
            placeItems: 'center',
            // ── The marks live in a layer above every card ──
            //
            // `position` matters as much as the number: this wrapper was
            // `static` and carried `zIndex: 4`, which does nothing at all — a
            // static element takes no z-index. With the cells no longer creating
            // stacking contexts, every one of these resolves against the same
            // root, so a mark is above every card whatever the DOM order, and a
            // travelling mark is above every resting mark.
            position: 'relative',
            zIndex: cue === undefined ? 2 : 5,
            // **On the mark's direct parent, not on the cell.** `perspective`
            // applies only to an element's own children, so one level further
            // up it does nothing and the turn renders orthographically — a flat
            // squash rather than a mark tipping its face. Measured while it sat
            // on the cell: the disc's height was exactly cos(30°) of its width,
            // which is the signature of no perspective at all.
            perspective: '900px',
          }}
        >
          <VentureDisc
            team={team}
            idle={idle}
            delaySeconds={delaySeconds}
            {...(flips ? { flipShift: cue.shift } : {})}
          />
        </motion.div>

        {/* **The name is back.** The mark identifies a venture to anyone who
            already knows it; the name is what the other thirty-nine teams read.
            `nameOf` gives an unnamed team its team id rather than a blank — the
            wall names every card it draws. Two lines are reserved for it: five
            of forty do not fit on one at this width, and the fix for that is
            the report's to propose, not this component's to pick. */}
        {/* The inner span is what carries the two-line clamp — see
            `.tv-card-name > span`. The box outside it is what seats the block
            at a stated distance under the mark inside the height the rhythm
            reserves, and a `-webkit-box` cannot do both. It used to *centre*
            the block, which put every wrapped name half a line above its
            neighbours' — measured at 9px across row 1. */}
        <div className="tv-card-name tv-card-detail">
          <span>{nameOf(team)}</span>
        </div>

        {/* The figure the board exists to show, **on every card, including a
            challenge of zero and a challenge below zero**.

            It used to print nothing at all for a team that had not traded, on
            the argument that absence is carried by the card being quiet rather
            than by a character in a box. The board disagreed in practice: ten
            cards with a name and a blank where every other card has a number
            read as ten cards that failed to load, not as ten teams on nothing.
            A zero is a fact about a team's fortnight and it says so.

            **A negative prints as a negative.** A team can sit below the total
            it started the fortnight on — proof revoked on a sale logged before
            the baseline was photographed — and that is what happened, so the
            card says it. The board's ordering already agrees:
            `compareChallenge` sorts the true value, so such a team is at the
            bottom rather than tied with the teams that simply have not traded.
            Nothing is clamped, here or in the comparator; clamping either would
            collapse the two into one. The `-₹0` a sub-rupee shortfall used to
            print is fixed in `formatRupees`, where it belongs — it was a
            rounding bug, not a rule about this board. */}
        <div
          className={
            // ── The ink follows the figure, not the rank ──
            //
            // `--card-fig-ink` is set by the card's tier: full ink on ranks
            // 1-20, muted below. Which means rank 7's `₹0` is printed at full
            // strength and rank 21's `₹0` is not, and the two are **the same
            // fact**. Early in a week that is thirty-one identical zeroes, of
            // which fourteen are the brightest type on the board, and the
            // loudest repeated element on the wall is the one saying nothing
            // happened.
            //
            // A zero takes the quiet ink wherever it ranks. The bright figures
            // on the board are then exactly the teams that have traded, which
            // is the thing a passer-by is actually looking for — and it costs
            // the zeroes nothing they were carrying, because a zero says "not
            // yet" at either weight.
            //
            // **Not `<= 0`.** A negative challenge figure is news — a team
            // below the total it started on, proof revoked after the baseline
            // was photographed — and it is the one figure on this board nobody
            // should have to look twice at. `Math.round` rather than the raw
            // value, so this agrees with what `formatRupees` decided to print
            // rather than with what the sheet happens to hold; a team on ₹0.40
            // prints `₹0` and reads as one. Negative zero rounds to `-0`, and
            // `-0 === 0`, so a sub-rupee shortfall lands quiet with the zeroes
            // it is indistinguishable from.
            Math.round(boardEarned(mode, team)) === 0
              ? 'tv-figure tv-card-week tv-card-week-idle tv-card-detail'
              : 'tv-figure tv-card-week tv-card-detail'
          }
          style={{ font: 'var(--t-tv-card-week)' }}
        >
          {formatRupees(boardEarned(mode, team))}
        </div>
        {/* ── Today, back on the card ──

            The line the venture name occupied is today's again. The name went
            because the mark already identifies the venture at this size — forty
            logos and forty names is the same fact printed twice — and what the
            board lost when today went was the only thing on it that said who is
            moving *right now*. A wall glanced at on a busy Friday answers that
            question or it is a weekly summary that happens to be on a screen.

            **It appears only when there is a day to report.** A permanent
            caption over an empty line would be apparatus describing absence, on
            all thirty-nine cards every morning before the first sale. */}
        {/* ── A delta, not a capsule, and not a badge ──

            This has been three things. A **bare line** in the same type as the
            week's figure, which failed for a stated reason: two centred rupee
            amounts one under the other, differing only in size and ink, are the
            hardest pair of things to tell apart at six metres. Then a **filled
            capsule**, which fixed that by form — a pill reads as a tag before it
            reads as a number — and which then moved to the head band, where it
            cost no height at all.

            Both of those were true about the element and wrong about the card.
            In the corner the capsule was **the loudest thing on it**: the only
            filled object among five pieces of type, so the eye landed on the
            smallest number on six cards in thirty-nine, ahead of the figure the
            whole board is sorted by. And a filled capsule in a top corner is a
            *badge* — a count, an alert, something that wants dealing with — set
            opposite a rank it has no relationship to.

            It is a delta now, and the shape of the fix is the original bare
            line with the thing that was actually missing put back. The failure
            was never "two amounts stacked"; it was two amounts stacked that
            differed in **two** attributes, both of which were busy elsewhere on
            the card. This differs in four: half the size, the accent rather
            than the ink, a direction mark in front, and adjacency to the figure
            it is a fraction of. That is Stocks, Fitness and every other Apple
            surface carrying a value and its change — big number, small coloured
            number beneath — and it puts the two numbers where relating them
            costs no eye travel.

            **No `tv-card-today-traded` modifier.** It switched the line to a
            heavier weight and the accent ink on exactly the condition that
            decides whether anything renders here at all, so it was a modifier
            that could never appear on the thing it modified being absent. The
            element's existence is the state. */}
        <div className="tv-card-today tv-card-detail">
          {traded ? (
            <span className="tv-day-delta">
              {/* A shape, not a glyph: `▲` comes from whatever font in the
                  stack answers for it, at whatever weight and height that font
                  drew it. This is a box with a triangle clipped out of it, so it
                  is the same mark on every machine. */}
              <span className="tv-day-mark" aria-hidden="true" />
              {/* **The figure is its own element, and that is not cosmetic.**
                  As a bare text node it was an *anonymous* flex item, which
                  `text-overflow` does not apply to — measured with a crore-scale
                  day, the figure drew straight out past the card's edge with
                  the ellipsis the CSS asks for never appearing. A real element
                  can shrink, clip and ellipsise. */}
              <span className="tv-day-figure">{formatRupees(team.todayRevenue)}</span>
            </span>
          ) : (
            ''
          )}
        </div>

      </motion.div>
    </div>
  )
}
