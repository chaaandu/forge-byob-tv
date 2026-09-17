import { hashTeamId } from '@/lib/seed'
import type { Team } from '@/lib/types'

/**
 * ── SAMPLE DATA. Development builds only. ──
 *
 * The team sheet has a "Top sellers" strip and **nothing in the feed can fill
 * it**: `TV_Feed` publishes six figures per team and no product. `Daily Dump`
 * in the master does carry a product per sale, so the real source is one
 * formula tab away — a `TV_Products` tab (`team_id, product, units, revenue,
 * image_url`) published like the other two — but it does not exist yet.
 *
 * So these are invented, and they are invented *on purpose where nobody can
 * mistake them for performance*: `app/live/page.tsx` only calls this when
 * `NODE_ENV !== 'production'`, and every card it feeds wears a `Sample` badge.
 * A production build shows no strip at all rather than a made-up one — the
 * same rule as `test/fixtures.ts`, which must never reach a running page.
 *
 * Delete this file the day `TV_Products` lands.
 */

export type Product = {
  name: string
  units: number
  revenue: number
  /** 0–4: which silhouette `ProductArt` draws. */
  art: number
  sample: true
}

const NAMES = [
  'Signature Pack',
  'Gift Box',
  'Mini Jar',
  'Combo Set',
  'Travel Pouch',
  'Classic Tote',
  'Family Size',
  'Festive Hamper',
  'Starter Kit',
  'Refill Pack',
]

export function sampleProducts(team: Team): Product[] {
  if (team.totalUnits <= 0) return []
  const seed = hashTeamId(team.teamId)
  const shares = [0.46, 0.27, 0.16]
  return shares.map((share, index) => {
    const units = Math.max(1, Math.round(team.totalUnits * share))
    return {
      name: NAMES[(seed + index * 3) % NAMES.length]!,
      units,
      revenue: Math.round(team.totalRevenue * share),
      art: (seed + index) % 5,
      sample: true,
    }
  })
}
