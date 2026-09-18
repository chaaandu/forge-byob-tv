import type { CountdownState } from '@/lib/countdown'

/**
 * How long until the Mesa Flea: a progress ring, and a figure beside it.
 *
 * **The ring never contains text.** It is a dial and nothing else, and the
 * figure always sits to its right — `25 days`, `9D 4H`, `04:12:33`,
 * `LIVE NOW`. Every mode therefore has identical structure, which is the whole
 * reason this shape was chosen over the prettier one that tucks short numbers
 * inside the ring: the wall crosses these thresholds at three in the morning
 * with nobody watching, and a layout that rearranges itself at a threshold is
 * a layout that can render wrongly for days before anyone notices.
 *
 * The arc measures elapsed *programme* time — anchor to Flea — rather than a
 * trailing window, so a half-full ring means the cohort is half over and says
 * something true instead of something decorative.
 *
 * Pure of the clock. `FleaStrip` owns the interval; this draws one state.
 */

/** The arc's geometry. A `viewBox` scaled uniformly keeps the ring round at
    every size, so `--h-tv-cal` stays the only dimension anyone sets. */
const R = 19.5
const CIRCUMFERENCE = 2 * Math.PI * R

function figureOf(state: CountdownState): string {
  // Days mode publishes a bare count, because the unit is presentation and
  // `lib/countdown.ts` is the escalation's brain, not its typographer. Never
  // singular: days mode only runs at 15 days and beyond.
  return state.mode === 'days' ? `${state.display} days` : state.display
}

function labelOf(state: CountdownState): string {
  if (state.mode === 'live') return 'Mesa Flea is live now'
  return `Time until Mesa Flea: ${figureOf(state)}`
}

export function FleaDial({ state, label }: { state: CountdownState; label?: React.ReactNode }) {
  // Tangerine from the final day onward: urgency arrives as a colour change on
  // a shape that never moves, rather than as a new shape.
  //
  // **Tangerine Glow, not Tangerine 600.** The 600 is the on-white value and
  // this dial now sits on a Deep Forest band, where it goes muddy at six metres
  // while looking perfectly deliberate on a laptop 60cm away. Glow is the
  // on-dark one. The track goes with it: `--soft-mint` behind a lit arc reads
  // as a second ring on white and as nothing at all on green, so the unfilled
  // part of the dial is now the band's own fill, one step lighter.
  const urgent = state.mode === 'timer' || state.mode === 'live'
  const arc = urgent ? 'var(--tangerine-glow)' : 'var(--mint-300)'

  return (
    <span
      role="img"
      aria-label={labelOf(state)}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--s-2)' }}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 46 46"
        style={{
          height: 'var(--h-tv-cal)',
          width: 'var(--h-tv-cal)',
          display: 'block',
          // The ring is the one fixed thing in the header's right-hand group.
          // Without this it would compress as the figure beside it lengthens
          // into a timer, and the "nothing moves" guarantee would be a lie.
          flex: 'none',
        }}
      >
        <circle
          cx="23"
          cy="23"
          r={R}
          fill="none"
          stroke="color-mix(in srgb, var(--white) 22%, transparent)"
          strokeWidth="var(--w-tv-cal-stroke)"
        />
        <circle
          cx="23"
          cy="23"
          r={R}
          fill="none"
          stroke={arc}
          strokeWidth="var(--w-tv-cal-stroke)"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - state.progress)}
          // Drawn from the top, clockwise — like a clock, not like a chart.
          transform="rotate(-90 23 23)"
        />
      </svg>
      {/* **The label belongs to the figure, not to the pair.** Stacked on the
          group as a whole it centred over the dial, which read as captioning the
          ring rather than the count. In this column it sits directly above the
          number, left edges aligned, whatever the mode changes the number's
          width to. */}
      <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
        {label}
        <span
          className="tv-figure"
          style={{
            font: 'var(--t-tv-cal-figure)',
            // The figure is the loud half of this pair on the daily band, so
            // it takes the warm accent whether or not the clock is urgent;
            // urgency is then carried by the arc and by the mode change.
            color: 'var(--tangerine-glow)',
          }}
        >
          {figureOf(state)}
        </span>
      </span>
    </span>
  )
}
