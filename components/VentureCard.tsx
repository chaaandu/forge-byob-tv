'use client'

import { useEffect } from 'react'
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
 * The three metals, by rank. **The podium's tokens, not copies of them** — the
 * two boards are in one rotation and a wall that says gold two ways is a wall
 * with a bug in it. Bronze is the settled `--metal-bronze`; the redder value it
 * replaced read as orange against `--tangerine-600`.
 */
const METALS = ['var(--metal-gold)', 'var(--metal-silver)', 'var(--metal-bronze)'] as const

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
   * A team that has traded today gets a green figure and a mark pointing up. A
   * team that has not gets neither, and the line stays empty.
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
   */
  const attacker = cue?.role === 'attacker'
  useEffect(() => {
    if (!attacker) return
    return () => onSettled?.()
  }, [attacker, onSettled])

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
      {/* Board apparatus, not the team's — see the header note. */}
      {rank <= 3 ? (
        <span
          className="tv-card-numeral"
          style={{ '--pod-metal': METALS[rank - 1] } as React.CSSProperties}
        >
          {/* `/podium`'s class, carrying the face, the cap trim, the metal and
              the lustre. This board contributes only the size. */}
          <span className="tv-pod-numeral" role="img" aria-label={`Rank ${rank}`}>
            {rank}
          </span>
        </span>
      ) : (
        // Ranks 4-40, as type. The ink is chosen here rather than by a CSS
        // descendant selector because this is a child of the *cell* and the card
        // is its sibling — the rule this replaced was `.tv-card-quiet
        // .tv-card-badge`, a descendant selector with no descendant, which never
        // once matched and left every pale card wearing a dark chip.
        <span className={quiet ? 'tv-card-rank tv-card-rank-quiet' : 'tv-card-rank'}>{rank}</span>
      )}

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
          // The three cards carrying a metal numeral sit 3% higher inside
          // themselves, so the mark closes some of the gap the numeral opens
          // above it. The card box does not move; only what is in it does.
          rank <= 3 ? 'tv-card-lifted' : undefined,
        ]
          .filter(Boolean)
          .join(' ')}
        style={{
          // The metal the foot below is cut from, on the card so both the foot
          // and its sweep can read it. Ranks 4-40 never set it and never render
          // a foot.
          ...(rank <= 3 ? ({ '--pod-metal': METALS[rank - 1] } as React.CSSProperties) : {}),
          position: 'absolute',
          inset: 0,
          display: 'grid',
          // **The rank's strip is the first row, and it is empty.** The numeral
          // that fills it belongs to the cell, not to this card — see the note
          // on the rank above — so what the card contributes is the *height*
          // the mark is not allowed to enter. Reserved on ranks 1-3 as well,
          // whose numeral is outside the card entirely: without it their discs
          // would sit a strip higher than row 1's other seven and the row would
          // read as broken rather than as three cards being special.
          //
          // No `gap`. Every one of these tracks carries its own separation, so a
          // figure line that collapses to zero on a row where nobody traded
          // takes its space with it instead of leaving a gap behind.
          gridTemplateRows:
            'var(--h-card-rank) auto var(--h-card-name) var(--h-card-fig) var(--h-card-today)',
          justifyItems: 'center',
          alignContent: 'start',
          minWidth: 0,
        }}
      >
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
        <div className="tv-card-name tv-card-detail">{nameOf(team)}</div>

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
          className="tv-figure tv-card-week tv-card-detail"
          style={{ font: 'var(--t-tv-card-week)', color: 'var(--card-fig-ink)' }}
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

            **The tag rides the figure and appears only with it.** Two bare rupee
            amounts on a card with no room for column headings leave a passer-by
            no way to tell the week from the day; a permanent caption over an
            empty line would be apparatus describing absence, on all forty cards
            every morning before the first sale. */}
        <div
          className={[
            'tv-card-today tv-card-detail',
            traded ? 'tv-card-today-traded' : undefined,
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {team.todayRevenue > 0 ? (
            <>
              {/* A shape, not a glyph: `▲` comes from whatever font in the
                  stack answers for it, at whatever weight and height that font
                  drew it. This is a box with a triangle clipped out of it, so it
                  is the same mark on every machine. */}
              <span className="tv-day-mark" aria-hidden="true" />
              {formatRupees(team.todayRevenue)}
            </>
          ) : (
            ''
          )}
        </div>
        {/* ── The metal foot, ranks 1-3 ──

            `/podium`'s plinth at card scale: the same gradient cut from the same
            `--pod-metal`, and the same travelling sweep, so one board's gold is
            the other's. It sits in the bottom padding the 3% lift opened on
            these three cards, which is why it needs no room from the rhythm and
            the mark does not pay for it. */}
        {rank <= 3 ? <span className="tv-card-foot" aria-hidden="true" /> : null}
      </motion.div>
    </div>
  )
}
