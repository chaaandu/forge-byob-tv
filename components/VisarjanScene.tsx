import { useId } from 'react'

/**
 * Visarjan — the water the idol goes into on 25 September, the ripples it
 * leaves, and the sprout that comes up where it went.
 *
 * Drawn by this project, in the Ganesha's own composition units: the SVG takes
 * the same `viewBox` as the player's crop, so every coordinate below is a point
 * in the artist's 1920x1080 frame and the plant lands on the idol's centre line
 * at every viewport without a second opinion about where that is.
 *
 * **Everything here is still until `mesa-tv.css` moves it.** The timeline —
 * sink, ripples, stem, leaves, hold, and back — is one `--d-visarjan-cycle`
 * shared by every element, so nothing in this file knows a duration and
 * nothing can fall out of step with the idol. At rest, and under reduced
 * motion, what is drawn is the idol standing in calm water with no plant.
 *
 * **The leaves are green, and that is not Mesa's green arriving.** AGENTS.md
 * rules green out as a *surface* on this wall because Mesa's parent brand is
 * green. A sprout is a sprout. It is also measurably not the brand's colour:
 * `--visarjan-leaf` sits at h132° against `--bright-green`'s h153°, yellower,
 * and it is on the wall for one day.
 */

/** The water's surface, in composition units. The idol's base is at y 990, so
    at rest it stands a little way into the water rather than on top of it. */
export const WATER_Y = 920

/** The idol's centre line, `(476 + 1392) / 2` from the crop measurement in
    `Ganesha.tsx`. The ripples and the stem both start here. */
const CENTRE_X = 934

export function VisarjanScene({ viewBox }: { viewBox: string }) {
  const id = useId()
  const [x, y, w, h] = viewBox.split(' ').map(Number)
  const fade = `${id}-fade`
  const shore = `${id}-shore`
  const water = `${id}-water`
  const leaf = `${id}-leaf`

  return (
    <svg className="tv-visarjan" viewBox={viewBox} preserveAspectRatio="xMidYMid meet">
      <defs>
        {/* The water's right-hand end, faded rather than cut. The box's right
            edge sits 9px from card 31, and a hard vertical edge of water there
            reads as a panel; the left end runs off the television instead. */}
        <linearGradient id={fade} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0.7" style={{ stopColor: 'var(--white)' }} />
          <stop offset="1" style={{ stopColor: 'var(--white)', stopOpacity: 0 }} />
        </linearGradient>
        <mask id={shore} maskUnits="userSpaceOnUse" x={x} y={y} width={w} height={h}>
          <rect x={x} y={y} width={w} height={h} fill={`url(#${fade})`} />
        </mask>
        {/* Deepening, then gone. Water that stops at the box's bottom edge is a
            slab with a lid on it; water that fades out downward is a pool. */}
        <linearGradient id={water} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" style={{ stopColor: 'var(--visarjan-water)' }} />
          <stop offset="0.45" style={{ stopColor: 'var(--visarjan-water-deep)' }} />
          <stop offset="1" style={{ stopColor: 'var(--visarjan-water-deep)', stopOpacity: 0 }} />
        </linearGradient>
        <linearGradient id={leaf} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" style={{ stopColor: 'var(--visarjan-leaf-lit)' }} />
          <stop offset="1" style={{ stopColor: 'var(--visarjan-leaf)' }} />
        </linearGradient>
      </defs>

      {/* Behind the water, so the stem's foot is seen through it. */}
      <g className="tv-visarjan-plant">
        <path
          className="tv-visarjan-stem"
          d={`M${CENTRE_X} ${WATER_Y + 90} C ${CENTRE_X - 14} ${WATER_Y - 140}, ${CENTRE_X + 26} ${WATER_Y - 280}, ${CENTRE_X + 6} ${WATER_Y - 420}`}
          pathLength={1}
          fill="none"
          strokeWidth={30}
          strokeLinecap="round"
        />
        {/* Each leaf is drawn with its base at the origin and placed by the
            group, so the stylesheet's `scale()` unfurls it from the stem
            rather than from the corner of the SVG. At 1.2 the right leaf's
            highest point is y 305, inside the crop's top at 276. */}
        <g transform={`translate(${CENTRE_X + 6} ${WATER_Y - 410}) scale(1.2)`}>
          <path
            className="tv-visarjan-leaf tv-visarjan-leaf-left"
            d="M0 0 C-30 -90 -170 -150 -270 -110 C-220 -10 -100 30 0 0 Z"
            fill={`url(#${leaf})`}
          />
          <path
            className="tv-visarjan-leaf tv-visarjan-leaf-right"
            d="M0 0 C40 -110 200 -180 300 -140 C250 -30 110 25 0 0 Z"
            fill={`url(#${leaf})`}
          />
        </g>
      </g>

      <g mask={`url(#${shore})`}>
        <rect x={x} y={WATER_Y} width={w} height={y + h - WATER_Y} fill={`url(#${water})`} />
        <path
          className="tv-visarjan-surface"
          d={`M${x} ${WATER_Y} Q ${x + 175} ${WATER_Y - 10} ${x + 350} ${WATER_Y} T ${x + 700} ${WATER_Y} T ${x + 1050} ${WATER_Y} T ${x + 1400} ${WATER_Y}`}
          fill="none"
          strokeWidth={10}
        />
        {[1, 2, 3].map((ring) => (
          <ellipse
            key={ring}
            className={`tv-visarjan-ripple tv-visarjan-ripple-${ring}`}
            cx={CENTRE_X}
            cy={WATER_Y}
            rx={40}
            ry={5}
            fill="none"
            strokeWidth={10}
          />
        ))}
      </g>
    </svg>
  )
}
