'use client'

import { animate, useMotionValue, useMotionValueEvent, useReducedMotion } from 'motion/react'
import { useEffect, useRef } from 'react'

import { formatRupees } from '@/lib/format'

/**
 * A figure that rolls to its new value instead of jumping.
 *
 * Written straight into the text node from the motion value rather than
 * through React state, so thirty-nine of these counting at once re-render
 * nothing. Tabular figures in the stylesheet keep the width steady while the
 * digits turn over.
 *
 * `from` lets a first mount count up from zero — the board arriving — while
 * every later change rolls from the figure that was already there.
 */
export function CountUp({
  value,
  from,
  format = formatRupees,
  className,
}: {
  value: number
  from?: number
  format?: (value: number) => string
  className?: string
}) {
  const reduce = useReducedMotion()
  const motionValue = useMotionValue(from ?? value)
  const node = useRef<HTMLSpanElement>(null)

  useMotionValueEvent(motionValue, 'change', (latest) => {
    if (node.current) node.current.textContent = format(latest)
  })

  useEffect(() => {
    if (reduce) {
      motionValue.set(value)
      return
    }
    const controls = animate(motionValue, value, { duration: 0.9, ease: [0.16, 1, 0.3, 1] })
    return () => controls.stop()
  }, [value, reduce, motionValue])

  return (
    <span ref={node} className={className}>
      {format(from ?? value)}
    </span>
  )
}
