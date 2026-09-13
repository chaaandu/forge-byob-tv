'use client'

import { useEffect, useState } from 'react'

import { TICK_SLOW_MS } from '@/config'
import { challengeDay } from '@/lib/challenge'

/**
 * `Day 2 of 14`, in the slot `/weekly`'s band used to give the Mesa Flea.
 *
 * ── The Flea has not left the wall ──
 *
 * `/podium` carries its own full countdown (`PodiumMasthead`), and the rotation
 * still shows it. What changed is which of the two *this* board leads with.
 * `WallHeader` justified the countdown's prominence as "the only element on this
 * wall that changes what a team does today" — and on a board whose figure is now
 * a fortnight's earnings against a hard close, that argument belongs to the day
 * count. The Flea is still the horizon; this is the deadline.
 *
 * ── Computed, not published ──
 *
 * `TV_Cohort` could carry a `challenge_day` cell and this could print it. It
 * does not, because a published day number freezes when the consolidator stalls
 * — the wall would read `Day 14 of 14` for as long as the sheet stayed down,
 * confidently and with nothing to notice. Two instants and a clock cannot go
 * stale, and this wall is expected to run unattended for weeks.
 *
 * ── No timezone logic, on purpose ──
 *
 * All of it lives in `lib/challenge.ts`, which needs none: the sheet's instants
 * carry `+05:30`, so the day rolls at IST midnight on a laptop set to anywhere.
 *
 * Minute ticks rather than seconds — the figure changes once a day. It ticks at
 * all so a wall that has been up since before midnight moves on without a
 * reload.
 */
export function ChallengeDay({ start, end }: { start: Date | null; end: Date | null }) {
  const [state, setState] = useState<{ day: number; total: number } | null>(null)

  useEffect(() => {
    const update = () => setState(challengeDay(start, end, Date.now()))
    update()
    const timer = setInterval(update, TICK_SLOW_MS)
    return () => clearInterval(timer)
  }, [start, end])

  // Nothing until mounted — this figure cannot match between the server render
  // and the first client render — and nothing between challenges, which is the
  // same silence the Flea countdown keeps once its event is over.
  if (state === null) return null

  // ── One tracked line, in the masthead's own ink ──
  //
  // This used to be three parts at two scales: a 39px tangerine figure between
  // two 22px labels, sized by `--t-tv-cal-figure` which `.tv-band` redefined on
  // itself so the band could make it loud. The band is gone, and with it the
  // argument for making it loud — the old comment called the day count "the
  // second-loudest thing on the board", which on a frame whose loudest thing is
  // now a 39px heading would make a chip of apparatus compete with the
  // masthead.
  //
  // So it is one line of tracked caps at label size with the *figure* carrying
  // all of the emphasis: `--t-tv-mast-figure`, two steps up and one weight up,
  // in the surface's accent. That token's own comment has the argument for how
  // far up — the short form is that the ceiling is the heading, because a day
  // count that matches `10-DAY CHALLENGE` is a masthead with two titles in it.
  //
  // `--accent` rather than Tangerine Glow, because this component draws on both
  // surfaces now and a fixed hue would die on one of them.
  //
  // **The baseline is what holds the line together at two sizes.** The words
  // and the numeral sit on `align-items: baseline`, so the numeral grows upward
  // out of a shared baseline rather than centring itself and dragging `DAY` and
  // `OF 10` off their own. Centre these and the labels float.
  const label: React.CSSProperties = {
    font: 'var(--t-tv-mast-label)',
    letterSpacing: 'var(--track-overline)',
    textTransform: 'uppercase',
    color: 'var(--ink-muted)',
  }

  return (
    <p
      style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 'var(--s-2)',
        margin: 0,
        whiteSpace: 'nowrap',
      }}
    >
      <span style={label}>Day</span>
      <span
        className="tv-figure"
        style={{ ...label, font: 'var(--t-tv-mast-figure)', color: 'var(--accent)' }}
      >
        {state.day}
      </span>
      <span style={label}>of {state.total}</span>
    </p>
  )
}
