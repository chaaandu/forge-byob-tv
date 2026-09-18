'use client'

import { useEffect, useState } from 'react'

import { TICK_MS, TICK_SLOW_MS } from '@/config'
import { computeCountdownState, mastheadCountdown } from '@/lib/countdown'

/**
 * How long until the Mesa Flea, in `/podium`'s masthead.
 *
 * This is `PodiumMasthead`'s `Countdown` lifted out of the spine before that
 * component was deleted. The brain is unchanged — `computeCountdownState` and
 * `mastheadCountdown` decide every word of it, and nothing here compares a
 * timestamp. What changed is the presentation, and it is a real reduction:
 *
 * **The figure was `--t-pod-count` at 4.2vw — 88px — in Tangerine Glow, between
 * two labels stacked above and below it.** It is one line at the masthead's own
 * apparatus size now, with the figure a weight up and in the surface's accent,
 * exactly like `/daily`'s day chip. The spine existed partly to give this
 * somewhere to be large, and the spine is gone.
 *
 * "Exactly like `/daily`'s day chip" is now enforced rather than described:
 * `--t-pod-count` is deleted and both chips read `--t-tv-mast-figure`. It was
 * only a description for one commit, during which the day numeral went to 28px
 * and this stayed at 18px.
 *
 * Stated plainly because it is the one thing the editorial pass made *quieter*
 * that arguably wanted to stay loud: the Flea is the programme's horizon, and on
 * a wall in a corridor a six-weeks-to-go figure is the sort of thing that gets
 * looked at. If it needs to be the loudest thing again, it should get a slide
 * rather than a band.
 *
 * ── Faking the clock, in development only ──
 *
 * `?now=2026-09-05T23:00:00+05:30` on the URL skews this component's clock —
 * and only this component's — so every mode can be watched on a real page. The
 * check is `NODE_ENV`, inlined at build time, so a production build carries no
 * trace of it: a wall accidentally launched with a leftover query param must
 * not spend the cohort counting down from the wrong day. Same rule, same
 * parameter name as `FleaStrip`, which is the other presentation of this
 * countdown.
 */
function devClockSkew(): number {
  if (process.env.NODE_ENV !== 'development') return 0
  const raw = new URLSearchParams(window.location.search).get('now')
  if (raw === null) return 0
  const parsed = Date.parse(raw)
  return Number.isNaN(parsed) ? 0 : parsed - Date.now()
}

export function FleaCountdown({ at }: { at: Date | null }) {
  const [text, setText] = useState<{ figure: string; label: string } | null>(null)
  const [fast, setFast] = useState(false)

  useEffect(() => {
    if (at === null) return
    const target = at.getTime()
    const skew = devClockSkew()
    const update = () => {
      const state = computeCountdownState(target, Date.now() + skew)
      setText(mastheadCountdown(state))
      setFast(state.mode === 'timer')
    }
    update()
    // The slow interval until the final day and the fast one inside it. A wall
    // that re-rendered a digit every second for six weeks would be spending the
    // main thread on a figure that changes daily.
    const timer = setInterval(update, fast ? TICK_MS : TICK_SLOW_MS)
    return () => clearInterval(timer)
  }, [at, fast])

  // Nothing until mounted — this figure cannot match between the server render
  // and the first client render — nothing until the sheet has supplied an
  // instant, and nothing ever again once the event is over. The masthead simply
  // closes up around the gap; there is no placeholder.
  if (text === null) return null

  const label: React.CSSProperties = {
    font: 'var(--t-tv-mast-label)',
    letterSpacing: 'var(--track-overline)',
    textTransform: 'uppercase',
    color: 'var(--ink-muted)',
  }

  return (
    <p style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--s-2)', margin: 0 }}>
      <span style={label}>Mesa Flea</span>
      {/* ── The same token `ChallengeDay` reads, deliberately ──

          `--t-tv-mast-figure`, not a countdown-specific size. These two chips
          are the same slot on two slides that rotate on one screen every thirty
          seconds, and they were `--fs-5` each in two separate declarations until
          the day numeral was asked up to `--fs-3` and this one stayed behind at
          18px. Sharing the token is what makes the match structural instead of
          a coincidence maintained by hand. */}
      <span
        className="tv-figure"
        style={{ ...label, font: 'var(--t-tv-mast-figure)', color: 'var(--accent)' }}
      >
        {text.figure}
      </span>
      <span style={label}>{text.label}</span>
    </p>
  )
}
