import { ChallengeDay } from '@/components/ChallengeDay'
import { cohortInstant } from '@/lib/feed'
import type { BoardMode, Snapshot } from '@/lib/types'

/**
 * The masthead, and **both slides use it**.
 *
 * One row of three columns: an empty cell, the board's name, then whatever
 * apparatus the slide carries pushed hard against the right edge. A rule
 * underneath it, drawn by the page.
 *
 * ── The Mesa lockup is gone, and the heading is centred on the frame ──
 *
 * Asked for directly on 13 September 2026: no lockup, the heading centred,
 * larger, bold and in capitals. The tick went with the lockup rather than
 * being left behind — it existed to bind two objects into one masthead, and
 * one object does not need binding.
 *
 * **The two outer columns are equal `1fr`s and that is the whole centring
 * mechanism.** The heading is centred on the *frame*, not inside whatever the
 * slide's apparatus leaves over — `/podium` carries a Flea countdown on the
 * right and `/weekly` carries a day chip or nothing at all, so a heading
 * centred in the remainder would sit at three different x positions across the
 * rotation, on two slides thirty seconds apart. The empty cell is doing work.
 *
 * What it costs is the brand. Mesa is named nowhere on either slide now; the
 * wall says `BYOB LEADERBOARD` and the corridor is expected to know whose
 * corridor it is. Recorded rather than argued away — it is one `<Image>` back
 * in the first column if that turns out to be wrong, and the first column
 * exists.
 *
 * ── There is no provenance stamp on this wall, and this is the second time ──
 *
 * It sat here, moved to the footer on both slides, left with the footers on 11
 * September 2026, came back here on the 13th after a design review, and was
 * removed again on the 13th. Recorded at this length rather than forgotten,
 * because it will be proposed a third time and whoever proposes it should get
 * the argument rather than have to rediscover it.
 *
 * **What it was carrying: this wall shows no error state by design.** A failed
 * fetch, a revoked sheet, a stalled consolidator or a sleeping laptop all keep
 * the last good data and go on rendering perfectly healthy stale numbers for
 * days. `as_of` was the only thing on either slide that made that visible, and
 * `docs/DESIGN.md` §2 added it for exactly that reason, calling it a deliberate
 * exception to the brief's layout. So **a board frozen on Tuesday's figures is
 * now pixel-identical to a working one.** That is the cost, and it is the whole
 * of it.
 *
 * ── Why it went anyway ──
 *
 * Asked for directly, twice, with the case above put first and overruled. The
 * reason given is that the wall refreshes on a ten-minute cycle. **That is not
 * the argument that wins it** — a fast cadence is what gives the stamp its
 * teeth, since `10:00` showing at 4pm is obvious in a way that nothing else on
 * this board can be. The argument that wins it is the one the stamp's own
 * removal in September already made: this is a display, the corridor is
 * thirty-nine teams who live the programme daily, and a line of provenance
 * apparatus is furniture on a slide that is meant to be figures.
 *
 * **The stamp is not the only defence and it was never the best one.** A wall
 * that has genuinely stopped is visible from the consolidator's own `Sync
 * Status` tab, which is where someone who suspects a freeze should look. What
 * the stamp did was make it visible to a passer-by who was not suspecting
 * anything, and that is the capability being given up here — knowingly.
 *
 * If it comes back a third time, the right of this masthead is where it goes:
 * one `<AsOf snapshot={snapshot} />` as the last child of `.tv-mast-meta`.
 * `AsOf.tsx` and `.tv-mast-stamp` are both in git at `b01eb5d`.
 *
 * ── What this replaced ──
 *
 * `/weekly` had `.tv-band`: a full-bleed gradient bar 82px tall carrying a 70px
 * display heading tracked to 973px — half the width of the wall — with the
 * lockup at 67px on one side and 15px metadata on the other. `/podium` had
 * `PodiumMasthead`, a 240px full-height spine with BYOB set as four stacked
 * 187px letters.
 *
 * Both were the loudest thing on their own frame, and between them they carried
 * one heading, one wordmark and a countdown. They were also two entirely
 * different systems for the same job, on two slides that rotate on one screen
 * every thirty seconds. `PodiumMasthead`'s own docblock argued that what the
 * slides must share is the *data* rather than the furniture; that was the right
 * principle stopped one step short. Sharing the furniture is what makes the
 * rotation read as one wall rather than as two designs.
 *
 * ── `tone` went with the lockup, and nothing branches on the surface now ──
 *
 * This was the **one** place in the tree that knew which surface it was sitting
 * on: `/weekly` is light in the design and `/podium` is dark, the green-on-white
 * lockup vanishes on aubergine and the reversed one vanishes on lavender, so the
 * lockup picked itself with an explicit `tone` prop rather than by reading a
 * class — a component that guesses its own surface guesses wrong the first time
 * it is reused.
 *
 * With no lockup there is nothing left to pick. Everything this file draws is a
 * token away from naming a colour, which is the rule the whole wall runs on, and
 * the branch is deleted rather than kept dark. **If an image comes back here it
 * needs the prop back with it** — that is the lesson worth keeping, not the
 * prop.
 */
export function WallHeader({
  snapshot,
  label,
  scope,
  mode = 'challenge',
  trailing,
}: {
  snapshot: Snapshot | null
  label?: string
  /**
   * Which contest is on. **The day count belongs to the challenge and leaves
   * with it.**
   *
   * `challenge_start_iso` and `challenge_end_iso` stay in the sheet when
   * `challenge_mode` goes to `No` — that is the point of a separate switch,
   * the window is kept for the next time rather than deleted. But a board
   * ranking the open week's revenue under a chip reading `Day 7 of 10` tells a
   * passer-by the figures below are a fortnight's when they are not. The
   * window still exists; this board is simply not the one measuring against it.
   */
  mode?: BoardMode
  /**
   * What the board's figures are measured over, set beside its name.
   *
   * Nothing passes it today. `/podium` passed `All time` until 13 September
   * 2026 and the removal was asked for directly; `/weekly` never passed
   * anything, because its own day chip and its `Revenue since` caption already
   * say what its window is. The prop stays because it is what decides — a
   * slide cannot come to carry the wrong window, and putting the word back on
   * either board is this one line.
   */
  scope?: string
  /**
   * Slide-specific apparatus, drawn between the heading and the stamp.
   * `/podium` hands its Flea countdown in here; `/weekly` hands nothing and
   * gets its day chip from `mode` instead.
   */
  trailing?: React.ReactNode
}) {
  return (
    <header className="tv-mast">
      {/* The left counterweight. It draws nothing and it is not optional: it is
          the `1fr` that matches the apparatus column's `1fr`, and the pair is
          what puts the heading on the frame's centre line rather than on the
          centre of whatever the apparatus leaves. */}
      <span aria-hidden="true" />

      {/* An empty cell when there is no heading, so the right-hand group still
          lands in the last column rather than sliding left. */}
      {label === undefined ? (
        <span />
      ) : (
        <h1 className="tv-mast-title">
          {/* ── The scope's counterweight, and it is measured rather than
              cosmetic ──

              Exactly the trick `.tv-mast`'s own left counterweight uses, one
              level down, and it exists because the outer one is not enough.
              `.tv-mast` is `[1fr][auto][1fr]`, so what it centres is the whole
              heading — and with the scope inside the heading, the *words* go
              off centre by half the scope's width. Measured at 1920 without
              this: `DAILY LEADERBOARD` sat **103.3px left** of the frame's
              centre line while `/podium`'s `BYOB LEADERBOARD` sat at 0.

              That is a rotation fault rather than a layout preference. The two
              slides cut every thirty seconds and both are dark, so the layouts
              are what has to carry the cut — `AGENTS.md` says exactly that
              where it records both slides going dark. A masthead that jumps a
              hundred pixels sideways on the cut is motion the wall did not
              choose, on the one band of either slide that is nothing but type.

              Mirroring the string is what makes it exact: identical text is
              identical width in the same face, at every viewport, in any
              language, so the words are centred by construction rather than by
              a number that has to be maintained. `visibility: hidden` rather
              than `display: none` — it has to occupy its space, which is the
              whole job. `aria-hidden` because it is the same string twice and a
              screen reader should hear the window once. */}
          {scope === undefined ? null : (
            <span className="tv-mast-scope tv-mast-scope-ghost" aria-hidden="true">
              {scope}
            </span>
          )}
          {label}
          {/* ── What the figures below are measured over ──

              The same venture reads ₹2,42,546 on `/podium` and ₹12,400 on
              `/weekly` thirty seconds later, and until this line neither slide
              said why. The wall's audience is thirty-nine teams who live the
              programme daily and know the difference, which is the argument
              that removed the old caption — but it is an argument about the
              people in the corridor rather than about the board, and it costs
              one word to stop relying on it.

              Inside the heading rather than beside it, so it reads as part of
              what the board is called and cannot drift into the apparatus at
              the masthead's right, which is the slide's own furniture. */}
          {scope === undefined ? null : <span className="tv-mast-scope">{scope}</span>}
        </h1>
      )}

      <div className="tv-mast-meta">
        {trailing}
        {mode === 'challenge' ? (
          <ChallengeDay
            start={snapshot === null ? null : cohortInstant(snapshot.cohort, 'challenge_start_iso')}
            end={snapshot === null ? null : cohortInstant(snapshot.cohort, 'challenge_end_iso')}
          />
        ) : null}
      </div>
    </header>
  )
}
