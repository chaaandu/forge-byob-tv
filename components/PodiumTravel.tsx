'use client'

import Image from 'next/image'
import { motion, type Easing } from 'motion/react'

import { VentureLogo } from '@/components/VentureLogo'
import { BEATS, TOTAL, at } from '@/lib/podiumFlip'
import type { Team } from '@/lib/types'

/**
 * The mark that leaves the podium: closed, carried down to the list, opened.
 *
 * Rendered as a single overlay over the whole board rather than inside either
 * the pillar or the row, because it belongs to neither for most of its life — it
 * starts in one, ends in the other, and spends the middle crossing the space
 * between. Positioning it absolutely against the board is what lets it travel
 * without either container having to clip or grow.
 *
 * ── Why there is a back face ──
 *
 * `backface-visibility: hidden` needs two faces to work against. Without a back,
 * a disc turned past 90° shows its own front mirrored — measured on `/daily`
 * before that disc had one.
 *
 * **The shadow is a `box-shadow` on the faces, never a `filter` on the disc.** A
 * filter of any kind forces the used value of `transform-style` to `flat`, which
 * silently destroys the 3D context and turns the flip into a horizontal squash.
 * That one cost an afternoon on the daily board.
 */

/** The lockup's share of the disc's width on the back face. */
const MARK_SCALE = 0.74

/**
 * Out to face-down, hold there through the travel, back to face-up.
 *
 * One continuous direction — 0° → 180° → 360° — rather than turning back the way
 * it came. A disc that unwinds reads as the move being undone; one that keeps
 * going reads as having arrived.
 */
const TURN_EASE: Easing[] = ['linear', 'easeInOut', 'linear', 'easeInOut', 'linear']

export type TravelPath = {
  team: Team
  /** Centre of the mark on its pillar, relative to the board. */
  from: { x: number; y: number; d: number }
  /** Centre of the row's mark, relative to the board. */
  to: { x: number; y: number; d: number }
}

export function PodiumTravel({ path }: { path: TravelPath }) {
  const { from, to, team } = path
  // The overlay is laid out at the *destination* size and scaled up to the
  // starting size, so the arrival is pixel-exact and any rounding error lands at
  // the start of the move rather than at its end — where it would show as the
  // disc settling a fraction off the row's own mark.
  const scale = from.d / to.d

  return (
    <motion.div
      aria-hidden
      style={{
        position: 'absolute',
        left: to.x - to.d / 2,
        top: to.y - to.d / 2,
        width: to.d,
        height: to.d,
        // `perspective` on the travelling wrapper, and `preserve-3d` below it, or
        // the turn renders as a flat squash.
        perspective: '900px',
        pointerEvents: 'none',
        zIndex: 3,
      }}
      initial={false}
      animate={{
        x: [from.x - to.x, from.x - to.x, 0, 0],
        y: [from.y - to.y, from.y - to.y, 0, 0],
        scale: [scale, scale, 1, 1],
      }}
      transition={{
        duration: TOTAL,
        times: [0, ...at(BEATS.travel), 1],
        ease: ['linear', 'easeInOut', 'linear'],
      }}
    >
      <motion.div
        style={{ width: '100%', height: '100%', position: 'relative', transformStyle: 'preserve-3d' }}
        initial={false}
        animate={{ rotateY: [0, 0, 180, 180, 360, 360] }}
        transition={{
          duration: TOTAL,
          times: [0, ...at(BEATS.close), ...at(BEATS.open), 1],
          ease: TURN_EASE,
        }}
      >
        <span className="tv-pod-travel-face">
          {/* The token, not `100%`: `VentureLogo` derives its initial's font size
              with `calc(size * k)`, and a percentage there resolves against the
              parent's font size rather than the disc's width — measured on the
              weekly board, every team without artwork rendered a flat ellipse
              with a letter a few pixels tall. */}
          <VentureLogo team={team} size={`${to.d}px`} />
        </span>
        <span className="tv-pod-travel-face tv-pod-travel-back">
          {/* Decorative: the venture's identity is on the front, and the alt text
              there already names it. */}
          <Image
            src="/brand/logo-pg-white.png"
            alt=""
            width={448}
            height={128}
            style={{ width: `${MARK_SCALE * 100}%`, height: 'auto' }}
            unoptimized
          />
        </span>
      </motion.div>
    </motion.div>
  )
}
