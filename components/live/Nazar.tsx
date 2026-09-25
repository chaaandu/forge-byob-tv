'use client'

import { useEffect, useId, useRef, useState } from 'react'

/**
 * The nazar, beside the board total — the wall's evil eye, on the phone.
 *
 * The same bead as `public/tv/nazar.js`, drawn the same way, and asked for on
 * 25 September 2026 once the wall had it. It HANGS, as it does beside the
 * total on `/weekly` and `/podium`, on a thread clipped at the hairline under
 * the tab bar — a thread from the top of the screen would cut the title. On a
 * phone it sits to the RIGHT of the total, centred on the digits; on a
 * desktop to the left, as on the wall. It drops in asleep, swings, wakes,
 * checks the room and turns to the total with ₹ for pupils, then keeps watch
 * on the wall's own fourteen-second cycle. `live.css` carries the motion.
 *
 * **A rise is a sale only on the same board.** Switching from Today to
 * All-time makes the total jump too, and winking at a tab change would be
 * celebrating a tap. So the eye is told which board it is watching and only
 * a higher figure on the *same* board makes it wink and show money eyes.
 *
 * `prefers-reduced-motion` gets an open, still eye — the rule `/live` keeps
 * and the wall does not (AGENTS.md, "the still-board rules").
 */
export function Nazar({ value, board }: { value: number; board: string }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '')
  const last = useRef<{ board: string; value: number } | null>(null)
  const [sales, setSales] = useState(0)

  useEffect(() => {
    const prev = last.current
    last.current = { board, value }
    if (prev && prev.board === board && value > prev.value) setSales((n) => n + 1)
  }, [board, value])

  const glass = `nzg${id}`
  const iris = `nzi${id}`
  const clip = `nzc${id}`
  // A new key remounts the two groups a sale animates, which is what restarts
  // a one-shot CSS animation; nothing else in the bead is touched.
  const sale = sales > 0 ? ' lv-nz-sale' : ''

  return (
    <span className="lv-nz-slot" aria-hidden="true">
    <span className="lv-nz">
      <span className="lv-nz-thread" />
      <span className="lv-nz-charm lv-nz-charm-black" />
      <span className="lv-nz-charm" />
      <span className="lv-nz-cap" />
      <span className="lv-nz-bead">
        <svg className="lv-nz-svg" viewBox="-50 -50 100 100">
          <defs>
            <radialGradient id={glass} cx="-16" cy="-20" r="74" gradientUnits="userSpaceOnUse">
              <stop offset="0" style={{ stopColor: 'var(--lv-nz-glass-hi)' }} />
              <stop offset="0.5" style={{ stopColor: 'var(--lv-nz-glass)' }} />
              <stop offset="1" style={{ stopColor: 'var(--lv-nz-glass-deep)' }} />
            </radialGradient>
            <radialGradient id={iris} cx="0" cy="0" r="20" gradientUnits="userSpaceOnUse">
              <stop offset="0.45" style={{ stopColor: 'var(--lv-nz-iris-hi)' }} />
              <stop offset="1" style={{ stopColor: 'var(--lv-nz-iris)' }} />
            </radialGradient>
            <clipPath id={clip}>
              <circle r="30" />
            </clipPath>
          </defs>
          <circle r="47" fill={`url(#${glass})`} />
          <g clipPath={`url(#${clip})`}>
            <circle className="lv-nz-white" r="30" />
            <g key={`g${sales}`} className={`lv-nz-gaze${sale}`}>
              <circle r="19" fill={`url(#${iris})`} />
              <circle className="lv-nz-iris-ring" r="18.2" />
              <circle className="lv-nz-pupil" r="9" />
              <text className="lv-nz-rupee" x="0" y="1" textAnchor="middle" dominantBaseline="central">
                ₹
              </text>
              <circle className="lv-nz-catch" cx="-5" cy="-6" r="3.4" />
              <circle className="lv-nz-catch" cx="4.5" cy="5" r="1.5" fillOpacity="0.8" />
            </g>
            <g key={`e${sales}`} className={`lv-nz-eyes${sale}`}>
              <ellipse className="lv-nz-lid-up" cx="0" cy="-66" rx="44" ry="36" fill={`url(#${glass})`} />
              <ellipse className="lv-nz-lid-dn" cx="0" cy="66" rx="44" ry="36" fill={`url(#${glass})`} />
              <path className="lv-nz-lash" d="M-24 1 Q0 14 24 1 M-15 7 l-4 7 M0 9 v8 M15 7 l4 7" />
            </g>
          </g>
          <circle className="lv-nz-socket" r="30" />
          <circle className="lv-nz-rim" r="46" />
          <path className="lv-nz-gloss" d="M-36 -12 A38 38 0 0 1 -14 -35" />
          <circle className="lv-nz-gloss-dot" cx="-30" cy="-30" r="2.6" />
          <path className="lv-nz-glint" d="M0 -10 L1.8 -1.8 10 0 1.8 1.8 0 10 -1.8 1.8 -10 0 -1.8 -1.8Z" />
        </svg>
      </span>
    </span>
    </span>
  )
}
