'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'

import { VentureCard } from '@/components/VentureCard'
import { STAGGER, type FlipCue } from '@/lib/flipTimeline'
import { rankForMode } from '@/lib/board'
import type { BoardMode, OvertakeEvent, Team } from '@/lib/types'

/**
 * Slide 2 — the whole competing cohort as forty cards, ranked on this week's
 * revenue.
 *
 * **Forty cards, always, all visible.** Not paged, not scrolled, not rotated: a
 * team that has to wait for its turn on screen effectively is not on the wall,
 * and forty teams each glancing at it for four seconds is the entire point. If
 * this stops fitting at some viewport, the height comes out of the ramp in
 * `app/mesa-tv.css` — paging is not the escape hatch.
 *
 * Ten per row, ranked left to right then top to bottom: rank 1 at the top-left
 * of row 1, rank 40 at the bottom-right of row 4. Reading order, so finding your
 * own card means scanning the way you already read.
 *
 * ── Rank is carried by the row's height, not by the card's width ──
 *
 * Every card is the same width — the grid gives each row ten equal columns — so
 * the only thing that changes down the board is how much vertical room a row
 * gets, and therefore how large its marks are. Cards within a row are identical
 * to each other.
 */

export const ROW_LENGTH = 10
export const ROWS = 4

/**
 * ── ROW 1'S IDLE IS GONE, AND THE BOARD IS STILL AT REST ──
 *
 * Ten marks on the top row carried one of three looping timelines each, offset
 * by a 2.3s phase step so they never fell into unison. It was well built. It is
 * removed for the same reason `/podium` removed its numeral dance, recorded in
 * `components/Podium.tsx`: the board has exactly one thing it needs to be able
 * to say — a rank changed hands — and it says it with a two-and-a-half-second
 * interrupt. **An interrupt only reads as one against a still frame.** Ten
 * permanently bobbing marks left the kick nothing to rise above.
 *
 * The old argument was that an idle on row 1 is what makes it read as the live
 * row. That was true when row 1 also had its own fill, its own shadow and a
 * numeral in gold — it was one signal among four. With the board reduced to a
 * ruled matrix it would be the *only* moving thing on either slide that does
 * not mean something happened, which is precisely the rule this wall is built
 * on.
 *
 * The `tv-look-*` and `tv-idle-*` classes still exist in app/mesa-tv.css with
 * their `animation` declarations removed rather than the rules deleted, because
 * `/podium` still hands `idleOf(place)` to its three discs. One place decides
 * whether the wall idles.
 */


/**
 * Four rows, four heights, descending.
 *
 * The board had one height for all four and therefore no direction: rank 1 and
 * rank 31 were the same object in different places. The ramp is back and the
 * *disc* absorbs it — every text line is the same size in row 4 as in row 1,
 * because a name and a figure have a legibility floor that does not care about
 * rank. The four values and the budget they must stay inside are documented in
 * app/mesa-tv.css.
 *
 * This array is also what says there are four rows: `rowsOf` slices on its
 * length.
 */
const ROW_HEIGHTS = [
  'var(--h-row-1)',
  'var(--h-row-2)',
  'var(--h-row-3)',
  'var(--h-row-4)',
] as const

/**
 * Ranks 1–40 in four rows of ten. Short boards simply produce shorter rows.
 *
 * **This sorts again, independently of the page's board spec, and the two must
 * agree.** If the grid renders in one order while `detect` reasons about
 * another, an overtake animates the wrong two cards — on a board that otherwise
 * looks entirely correct. `app/weekly/board.test.ts` pins them together.
 */
export function rowsOf(teams: readonly Team[], mode: BoardMode = 'challenge'): Team[][] {
  const ranked = rankForMode(mode, teams)
  return ROW_HEIGHTS.map((_, i) => ranked.slice(i * ROW_LENGTH, (i + 1) * ROW_LENGTH))
}

/**
 * Where a rank's mark sits, and how big it is — in **untransformed layout**.
 *
 * Every value here is read from the box model rather than from a transformed
 * rectangle. That distinction is load-bearing: row 1's marks are permanently
 * mid-idle, so `getBoundingClientRect` on one returns a bobbing, rotating box
 * and the deltas computed from it would be different on every frame. The cell
 * never moves, and `offsetTop` / `offsetLeft` / `offsetWidth` ignore transforms,
 * so together they describe where the mark *would* be at rest — which is where
 * it has to travel to.
 */
type Slot = { x: number; y: number; d: number }

function slotOf(grid: HTMLElement, rank: number): Slot | null {
  const cell = grid.querySelector<HTMLElement>(`[data-rank="${rank}"]`)
  if (cell === null || cell === undefined) return null
  const disc = cell.querySelector<HTMLElement>('.tv-disc')
  if (disc === null || disc === undefined) return null
  // The cell's own rect is safe — cells never move, only what is inside them
  // does — and the mark's offset chain up to the cell is transform-free.
  const box = cell.getBoundingClientRect()
  let ox = 0
  let oy = 0
  for (let e: HTMLElement | null = disc; e !== null && e !== cell; e = e.offsetParent as HTMLElement | null) {
    ox += e.offsetLeft
    oy += e.offsetTop
  }
  const d = disc.offsetWidth
  // The mark's centre, which is what travels: the marks differ in size down the
  // ramp, so corner-to-corner would land a big mark's edge on a small mark's
  // seat and read as a miss.
  return { x: box.left + ox + d / 2, y: box.top + oy + d / 2, d }
}

/**
 * The choreography, in one place. The grid reads the event and hands each card
 * its instruction; no card ever computes its own.
 *
 * ── What moves ──
 *
 * **The marks, and nothing else.** The attacker's mark climbs from `fromRank`
 * to `toRank` and turns over; the mark it displaces — the defender, holding
 * `toRank` — turns a beat later and drops one place. Everything between them
 * drops one place as well without turning: a climb of one is the pure exchange
 * the design describes and has nothing in between, where a climb of seven moves
 * six other marks that are not part of the contest.
 *
 * The cards hold still and keep their colour. They used to travel, and that is
 * what made an overtake across rank 20 change a card's fill in mid-flight —
 * which read as a fault. A slot's colour is a fact about the slot.
 */
export function cuesFor(grid: HTMLElement, kick: OvertakeEvent): Map<number, FlipCue> {
  const cues = new Map<number, FlipCue>()
  const move = (from: number, to: number, role: FlipCue['role'], shift: number) => {
    const a = slotOf(grid, from)
    const b = slotOf(grid, to)
    // A slot the board does not currently render — the climb reached past the
    // bottom of a short board. Nothing to animate, and the data still re-sorts.
    if (a === null || b === null) return
    cues.set(from, { role, dx: b.x - a.x, dy: b.y - a.y, shift, scale: b.d / a.d })
  }

  move(kick.fromRank, kick.toRank, 'attacker', 0)
  move(kick.toRank, kick.toRank + 1, 'defender', STAGGER)
  for (let rank = kick.toRank + 1; rank < kick.fromRank; rank += 1) {
    move(rank, rank + 1, 'slide', STAGGER)
  }
  return cues
}

export function WeeklyGrid({
  teams,
  mode = 'challenge',
  kick = null,
  onSettled,
}: {
  teams: readonly Team[]
  /** Which contest is on, from `challenge_mode`. Decides the sort and the
      figure every card prints — the two must never disagree. */
  mode?: BoardMode
  /** The flip in progress, so the cards involved know what to do. */
  kick?: OvertakeEvent | null
  /** Called once, by the attacker's card, when the last beat finishes. */
  onSettled?: () => void
}) {
  /**
   * The two teams an overtake just put down, for one render.
   *
   * They are the only cards allowed to fade their details in. Every other card
   * that happens to be remounted by the same re-sort — anything crossing a row
   * boundary, which React unmounts and remounts because rows are separate
   * containers — keeps its details at full opacity. Without this the board
   * blinked figures at ranks nobody was watching, three deep in a quiet poll.
   *
   * Keyed by team id rather than by rank, because the whole point of the commit
   * this reads is that the ranks have just changed.
   */
  const lastKick = useRef<OvertakeEvent | null>(null)
  const [arriving, setArriving] = useState<ReadonlySet<string>>(() => new Set())
  useEffect(() => {
    if (kick !== null) {
      lastKick.current = kick
      return
    }
    const settledKick = lastKick.current
    if (settledKick === null) return
    lastKick.current = null
    setArriving(new Set([settledKick.attacker, settledKick.defender]))
    // Cleared once the fade has run. The class only carries an animation, so
    // dropping it changes nothing on screen — it exists so the *next* re-sort
    // does not inherit a reason to animate.
    const done = setTimeout(() => setArriving(new Set()), 600)
    return () => clearTimeout(done)
  }, [kick])

  const rows = rowsOf(teams, mode)
  const gridRef = useRef<HTMLDivElement>(null)
  const [cues, setCues] = useState<Map<number, FlipCue> | null>(null)

  /**
   * One layout read per flip, taken **before** the flip starts and never during
   * it. The cues are pure numbers from then on, so no card touches the DOM while
   * anything is moving — the same discipline `VenturePill`'s resting measurement
   * followed, and for the same reason.
   */
  useLayoutEffect(() => {
    const grid = gridRef.current
    if (kick === null || grid === null) {
      setCues(null)
      return
    }
    setCues(cuesFor(grid, kick))
  }, [kick])

  return (
    <div
      ref={gridRef}
      style={{
        display: 'grid',
        // Stated heights rather than `1fr` each: the ramp is the design, and
        // `1fr` would quietly redistribute it the moment a row was short — a
        // board with thirty teams would grow row 4 to match row 1 and the
        // hierarchy would vanish exactly when the wall was least populated.
        gridTemplateRows: ROW_HEIGHTS.join(' '),
        // **The row gap is its own value now.** It used to be `--s-card-gap`,
        // the same token the columns use — so opening the rows would have
        // narrowed every card, and narrowing the cards is not what opening the
        // rows is for.
        rowGap: 'var(--s-row-gap)',
        columnGap: 'var(--s-card-gap)',
        height: '100%',
        // **No headroom above row 1 any more.** It reserved `--h-card-headroom`
        // for the metal numerals over ranks 1-3, which broke above their cards'
        // top edge and were painted outside row 1 entirely. There are no metal
        // numerals; the rank sits inside its cell like every other, so the
        // board starts where the grid starts.
        //
        // `start`, not `center`: centring splits any leftover height half above
        // and half below, so half of it would be spent under row 4 where
        // nothing needs it.
        alignContent: 'start',
      }}
    >
      {rows.map((row, i) => (
        <div
          key={i}
          // **The row no longer publishes a `--h-card` of its own, and must not
          // start again.** It used to, because each row had a different height;
          // with one shared height the declaration became `--h-card:
          // var(--h-card)` on the row, which is a self-reference. CSS resolves a
          // cyclic custom property to *guaranteed-invalid*, so `--d-card-logo`
          // fell apart, `VentureDisc` computed `width: 0px`, and forty marks
          // vanished from a board that still rendered its cards, its badges and
          // all forty figures. Measured, not reasoned about.
          // **No rule between rows.** The cards carry their own edges now —
          // see the note at `.tv-row-rule` in app/mesa-tv.css for why a
          // hairline 11px under a row of bounded cells reads as a line drawn
          // through the gap rather than as a separator.
          className="tv-card-row"
          style={
            {
              display: 'grid',
              // **A short row centres rather than hanging left.** The competing
              // cohort is 39, so the rows are 10, 10, 10 and 9 — and a nine-card
              // row in a ten-column grid sits against the left edge with a
              // card-shaped hole at the right end. On a wall that reads as a
              // card that failed to load, not as a row that has nine teams in
              // it, which is the whole class of bug this project is built
              // around: nothing reports it and it renders perfectly.
              //
              // **The columns become a length rather than staying fractional.**
              // Leaving ten `1fr` columns and centring does nothing — fractions
              // consume the free space that centring needs. Cutting to nine
              // `1fr` columns would centre, but each would grow by a ninth and
              // the last row's cards would come out wider than every other
              // row's, which breaks the one thing the grid guarantees: rank is
              // carried by row *height*, and every card is the same width.
              //
              // `--w-card` is the length those ten fractions already resolve
              // to — `:root` states the arithmetic once and says it agrees with
              // the rendered card to 0.1px at 1920. Reusing it is what keeps a
              // centred row and a full row the same card.
              gridTemplateColumns:
                row.length < ROW_LENGTH
                  ? `repeat(${row.length}, var(--w-card))`
                  : `repeat(${ROW_LENGTH}, minmax(0, 1fr))`,
              // Only a short row is centred. A full row has no free space to
              // centre in, and asking for it there would be a no-op that looked
              // like a rule.
              justifyContent: row.length < ROW_LENGTH ? 'center' : undefined,
              gap: 'var(--s-card-gap)',
              minHeight: 0,
              // **The row publishes its own height under a different name.** It
              // used to declare `--h-card: var(--h-card)`, which is a cyclic
              // custom property: CSS resolves one to guaranteed-invalid, so
              // `--d-card-logo` fell apart, every disc computed `width: 0px`,
              // and forty marks vanished from a board that still rendered its
              // cards, its ranks and all forty figures. Measured, not reasoned
              // about — and the reason these two names differ.
              '--h-row': ROW_HEIGHTS[i],
              // **The row-3 and row-4 mark bonuses are gone, and they had to
              // go with the ramp.** They were 1.12 and 1.16, added because
              // those rows' marks were the smallest on a board whose heights
              // ran 12.64 → 9.86vw. Against the flat ramp they *invert* it:
              // measured at 1920 the discs came out 98.9 / 87.0 / 90.7 / 87.5,
              // so row 3's mark was larger than row 2's and the board grew
              // towards the bottom. Exactly the failure the old comment on the
              // collapsing figure lines describes, reintroduced by a constant
              // that outlived the ramp it was compensating for.
              //
              // Without them the four fall 98.9 / 87.0 / 81.1 / 75.5, which
              // descends, and row 4 still clears the ~50px legibility floor by
              // 25px. Nothing needs a bonus when the ramp itself is gentle.
              // **Both figure lines are reserved on every row, always.** They
              // used to collapse on a row where nobody had traded, which gave
              // row 4 its height back and was measurably wrong twice over. It
              // inverted the ramp — row 4's mark came out at 82.5px against row
              // 3's 64.3px, a board whose marks grew towards the bottom — and it
              // was unstable in the one direction that matters: a team at rank
              // 31 logging its first sale reinstates two lines, and the mark
              // took the whole reinstatement. Measured with revenue in row 4:
              // 48.0px, exactly the legibility floor, with the card overflowing
              // its row to hold the figures.
              //
              // A row is a rhythm unit and its rhythm should not depend on
              // whether anyone in it sold anything today. The empty lines on a
              // quiet row are the cost, and they are what keep the marks in
              // every row on one baseline.
            } as React.CSSProperties
          }
        >
          {row.map((team, j) => {
            const rank = i * ROW_LENGTH + j + 1
            const cue = cues?.get(rank)
            return (
              <VentureCard
                key={team.teamId}
                team={team}
                rank={rank}
                mode={mode}
                arriving={arriving.has(team.teamId)}
                cue={cue}
                onSettled={cue?.role === 'attacker' ? onSettled : undefined}
                // **Row 1 no longer idles**, so no card is handed a timeline.
                // The argument is at the top of this file; it is the same one
                // `/podium` used to retire its numeral dance.
              />
            )
          })}
        </div>
      ))}
    </div>
  )
}
