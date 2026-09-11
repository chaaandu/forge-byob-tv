import Image from 'next/image'

import { ChallengeDay } from '@/components/ChallengeDay'
import { cohortInstant } from '@/lib/feed'
import type { BoardMode, Snapshot } from '@/lib/types'

/**
 * The masthead, and **both slides use it**.
 *
 * One row, left to right: the Mesa lockup, a hairline tick, the board's name,
 * then whatever apparatus the slide carries pushed hard against the right edge.
 * A rule underneath it, drawn by the page.
 *
 * **The provenance stamp is not here any more.** It moved to the footer on both
 * slides — a colophon is where a colophon goes, it gives each footer a second
 * end so a single left-aligned statement does not read as a row that failed to
 * fill, and it takes one item out of a masthead that was carrying a lockup, a
 * heading, a countdown *and* a timestamp. See `components/MoverPanel.tsx` and
 * `components/BoardLegend.tsx`.
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
 * ── The lockup picks itself off the surface ──
 *
 * `/weekly` is light and `/podium` is dark, so the same file cannot serve both:
 * the green-on-white lockup vanishes on aubergine and the reversed one vanishes
 * on lavender. This is the **one** place in the tree that branches on which
 * surface it is sitting on, and it does it with an explicit prop rather than by
 * reading a class — a component that guesses its own surface is a component
 * that guesses wrong the first time it is reused.
 */
export function WallHeader({
  snapshot,
  label,
  mode = 'challenge',
  tone = 'light',
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
  /** Which lockup to draw. The surface the masthead is sitting on. */
  tone?: 'light' | 'dark'
  /**
   * Slide-specific apparatus, drawn between the heading and the stamp.
   * `/podium` hands its Flea countdown in here; `/weekly` hands nothing and
   * gets its day chip from `mode` instead.
   */
  trailing?: React.ReactNode
}) {
  return (
    <header className="tv-mast">
      <Image
        src={tone === 'dark' ? '/brand/logo-pg-white.png' : '/brand/logo-pg-green.png'}
        alt="Mesa School of Business"
        width={448}
        height={128}
        style={{ height: 'var(--h-tv-logo)', width: 'auto' }}
        unoptimized
      />

      {/* The tick is what binds the lockup and the heading into one masthead
          rather than two objects that happen to be near each other. It is
          `--hairline-strong`, so it is dark on the light slide and light on the
          dark one without this file naming a colour. */}
      <span className="tv-mast-tick" aria-hidden="true" />

      {/* An empty cell when there is no heading, so the right-hand group still
          lands in the last column rather than sliding left. */}
      {label === undefined ? <span /> : <h1 className="tv-mast-title">{label}</h1>}

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
