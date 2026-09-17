import Image from 'next/image'

import { LOGOS } from '@/config'
import { emblemFor } from '@/lib/live'
import type { Team } from '@/lib/types'

/**
 * A team's badge on `/live`: its real logo when one is committed, otherwise
 * one of twelve geometric marks **drawn here, in code.**
 *
 * ── Why generated, not "random logos" ──
 *
 * Placeholder logos were asked for until the real ones arrive. Pulling stock
 * or previous-cohort artwork would put a mark on a venture that is somebody
 * else's — the exact fault `LOGOS` in `config.ts` records, where `VBC101` wore
 * Dosa Crisps' logo. These twelve belong to nobody: a chevron, a bolt, a leaf.
 * They say "this is team N's badge" and nothing about who a team is.
 *
 * Picked by `emblemFor`, a hash of the id, so a team keeps its badge as it
 * climbs. Drawn in `currentColor`, so whatever holds it — a livery slab with
 * white ink, a pearl one with aubergine ink — decides the colour. No colour is
 * named here.
 *
 * **Adding a real logo is the wall's one commit**: the file in `public/logos/`
 * and the id in `LOGOS`. `/live` picks it up with no change.
 */
export function Emblem({ team, size, className }: { team: Team; size: number | string; className?: string }) {
  const dim = typeof size === 'number' ? `${size}px` : size

  if (LOGOS.includes(team.teamId)) {
    return (
      <span className={`lv-logo ${className ?? ''}`} style={{ width: dim, height: dim }}>
        <Image src={`/logos/${team.teamId}.png`} alt="" width={96} height={96} unoptimized />
      </span>
    )
  }

  return (
    <svg
      className={className}
      width={dim}
      height={dim}
      viewBox="0 0 48 48"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      {GLYPHS[emblemFor(team.teamId)]}
    </svg>
  )
}

const GLYPHS: readonly React.ReactNode[] = [
  // 0 · twin chevrons
  <path key="0" d="M6 9h8l14 15-14 15H6l14-15zM20 9h8l14 15-14 15h-8l14-15z" />,
  // 1 · swoosh
  <path key="1" d="M3 35C13 18 29 9 46 11 33 15 23 23 17 39c-4-4-9-5-14-4z" />,
  // 2 · ring and core
  <g key="2">
    <circle cx="24" cy="24" r="16" fill="none" stroke="currentColor" strokeWidth="5.5" />
    <circle cx="24" cy="24" r="6" />
  </g>,
  // 3 · bolt
  <path key="3" d="M29 3 9 27h13l-4 18 21-26H26z" />,
  // 4 · four-point star
  <path key="4" d="M24 3c2 14 7 19 21 21-14 2-19 7-21 21-2-14-7-19-21-21 14-2 19-7 21-21z" />,
  // 5 · stacked diamonds
  <path key="5" d="M24 3l12 12-12 12-12-12zM24 29l8 8-8 8-8-8z" />,
  // 6 · peak
  <path key="6" d="M24 5l21 38H34L24 24 14 43H3zM17 33h14l2 5H15z" />,
  // 7 · speed bars
  <path key="7" d="M15 9h31l-6 8H9zM9 21h31l-6 8H3zM15 33h31l-6 8H9z" />,
  // 8 · nested hexagon
  <path key="8" fillRule="evenodd" d="M24 3l19 11v20L24 45 5 34V14zm0 10l-10 6v10l10 6 10-6V19z" />,
  // 9 · crescent
  <path key="9" d="M31 5a20 20 0 1 0 13 30A16 16 0 0 1 31 5z" />,
  // 10 · leaf — a nod to Mesa's comma, drawn fresh
  <path key="10" fillRule="evenodd" d="M6 42C6 19 20 6 43 5c0 23-13 37-37 37zm5-4c9-6 17-14 24-25-10 8-18 16-24 25z" />,
  // 11 · half-lit disc
  <g key="11">
    <circle cx="24" cy="24" r="17" fill="none" stroke="currentColor" strokeWidth="5" />
    <path d="M24 7a17 17 0 0 1 0 34z" />
  </g>,
]
