'use client'

import { GANESH_FROM_ISO, GANESH_UNTIL_ISO } from '@/config'
import type { GaneshPhase } from '@/lib/schedule'

/**
 * Put the Ganesha on the wall on a day that is not Ganesh Chaturthi, in
 * development only. Click once for the idol, again for Visarjan, again for off.
 *
 * An observability affordance, not a feature — the same standing as
 * `DevFlipTrigger`, and for a sharper version of the same problem. The flip
 * fires a few times a day on live data; this fires on **twelve days of the
 * year**, and the immersion on exactly one, so without a button the only way
 * to look at either is to edit `config.ts` — and editing the dates to see the
 * thing is how the dates end up committed wrong. They were, once: a widened
 * test window sat in `main` for three days.
 *
 * ── It overrides the window. It does not move it ──
 *
 * The one thing this must not do is what it would be easiest to do: reach into
 * `config.ts`, or fake a clock, or hand `ganeshPhase` a different date. All three
 * would mean the wall you are watching is running on a schedule the real wall
 * does not have, and the dates are the part of this feature most likely to be
 * wrong — they are the reason `lib/schedule.test.ts` pins five boundary
 * instants.
 *
 * So `ganeshPhase` is left entirely alone and still answers on the real clock.
 * This sets a second, independent phase that wins over it. Everything past
 * that point — the fetch, the layer strip, the crop, the loop, the water — is
 * one code path, so what you watch is what 14 or 25 September produces.
 *
 * **The immersion starts eight seconds after it is switched on**, because its
 * cycle starts when the idol lands and the idol's rest is split across the
 * loop. That is the wall's own timing, not a preview speed-up.
 *
 * ── Why it is a toggle and not a "preview for 10 seconds" ──
 *
 * Because the thing most worth checking is that it survives the rotation. The
 * ornament is mounted in the root layout precisely so the thirty-second soft
 * navigation does not destroy and rebuild it, and a preview that expired on its
 * own would hide the failure it exists to catch. Switch it on, leave it, and
 * watch a slide change happen underneath it.
 */
export function DevGaneshaTrigger({
  forced,
  phase,
  onCycle,
}: {
  forced: GaneshPhase | null
  /** What `ganeshPhase` says about the real clock right now, so the label can
      distinguish "I am forcing this" from "it is genuinely the 15th". */
  phase: GaneshPhase | null
  onCycle: () => void
}) {
  if (process.env.NODE_ENV === 'production') return null

  // Rendered for the operator's benefit rather than parsed for logic: the
  // window's own constants, so the button can say what it is overriding without
  // a second copy of the dates living here.
  const window_ = `${GANESH_FROM_ISO.slice(0, 10)} → ${GANESH_UNTIL_ISO.slice(0, 10)}`

  /** The shape both the label and the switch share, lifted from
      `DevFlipTrigger`'s button so this bar reads as another row of the same
      thing rather than as a second style of dev control. */
  const chip: React.CSSProperties = {
    font: 'var(--t-tv-card-label)',
    letterSpacing: 'var(--track-overline)',
    textTransform: 'uppercase',
    padding: '6px 10px',
    borderRadius: 'var(--radius-xs)',
    border: 'var(--stroke-hair) solid var(--border)',
  }

  const button: React.CSSProperties = {
    ...chip,
    // Inverted when forced, so the control reads as a switch rather than as an
    // action. Reads tokens like everything else — a dev affordance is still not
    // allowed to name a colour.
    background: forced !== null ? 'var(--midnight-charcoal)' : 'var(--white)',
    color: forced !== null ? 'var(--white)' : 'var(--midnight-charcoal)',
    cursor: 'pointer',
  }

  return (
    <div
      style={{
        position: 'fixed',
        // **One row above the flip and podium bars, not beside them.** Those sit
        // at `--s-safe-y` on the right of both slides; this is in the layout and
        // therefore on screen at the same time as whichever one is showing, so
        // sharing the row would put two bars on top of each other on every
        // slide. Bottom-left is Next's dev overlay and its portal swallows
        // clicks aimed underneath it — which is also the corner the ornament
        // itself lives in.
        bottom: 'calc(var(--s-safe-y) + 40px)',
        right: 8,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        zIndex: 50,
        opacity: 0.55,
      }}
    >
      {/* **Before the button, not after it.** The row is right-anchored, so a
          label that grows puts its extra width on whichever end is furthest
          from the anchor — trailing, it ran to the frame edge, and it moved the
          button sideways every time the button's own text changed length. A
          switch that relocates when you flip it is a switch you have to aim at
          twice. */}
      <span
        // The real answer, alongside the override, so a forced wall is never
        // mistaken for a wall that is genuinely inside its window. On 15
        // September this reads "in window" and the button is doing nothing.
        // **Given the same ground as the buttons, rather than left as bare
        // text.** The row sits at 0.55 opacity like `DevFlipTrigger`'s, which
        // that bar gets away with because every one of its controls is a solid
        // white chip; unlabelled text at the same opacity lands directly on the
        // venture names in row 4 and is genuinely hard to read. Same chip, one
        // step quieter than the switch beside it.
        style={{
          ...chip,
          background: 'var(--white)',
          color: 'var(--midnight-charcoal)',
          opacity: 0.75,
        }}
      >
        {phase !== null ? `in window: ${phase}` : window_}
      </span>
      <button type="button" style={button} onClick={onCycle}>
        {forced === null
          ? 'Show Ganesha'
          : forced === 'chaturthi'
            ? 'Ganesha: forced on'
            : 'Visarjan: forced on'}
      </button>
    </div>
  )
}
