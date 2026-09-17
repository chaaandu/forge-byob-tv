'use client'

import { AnimatePresence, motion } from 'motion/react'

import { CountUp } from '@/components/live/CountUp'
import { Emblem } from '@/components/live/Emblem'
import { formatRupees } from '@/lib/format'
import { climbOf, liveryFor, type BoardKey, type Standing } from '@/lib/live'
import { nameOf } from '@/lib/team'

/**
 * The podium and the standings list.
 *
 * ── Motion `layout` is used here, and the wall's ban on it does not apply ──
 *
 * `render.test.tsx` forbids `layout` in the wall's board tree because a figure
 * ticking up by ₹200 would nudge a card on a display where movement must mean
 * a rank changed. On `/live` the rows are keyed by team and `layout="position"`
 * animates *only* a change of slot — a figure changing inside a row does not
 * move it — and the slot changes when a person switches board or a rank
 * changes hands between polls. Both are things that happened.
 *
 * Rows are `<li>` in an `<ol>`, not table rows: `AGENTS.md` records that a
 * `<tr>` ignores the layout transform.
 */

const ROW_SPRING = { type: 'spring', stiffness: 520, damping: 42, mass: 0.9 } as const

/** The podium holds only teams with something on the board. */
export function splitBoard(standings: readonly Standing[]): { podium: Standing[]; rest: Standing[] } {
  const podium = standings.slice(0, 3).filter((s) => s.figure > 0)
  return { podium, rest: standings.slice(podium.length) }
}

export function Podium({
  podium,
  arriving,
  onOpen,
}: {
  podium: readonly Standing[]
  arriving: boolean
  onOpen: (teamId: string) => void
}) {
  // Visual order 2 · 1 · 3, the way every podium stands.
  return (
    <section className="lv-podium" aria-label="Top three">
      {[1, 0, 2].map((slot) => {
        const standing = podium[slot]
        return (
          <div key={slot} className={`lv-pod-slot lv-pod-slot-${slot + 1}`}>
            <div className="lv-pod-stage">
              <AnimatePresence mode="popLayout" initial={false}>
                {standing ? (
                  <motion.button
                    key={standing.team.teamId}
                    type="button"
                    className={`lv-pod lv-livery-${liveryFor(standing.team.teamId)}`}
                    initial={{ rotateY: 80, opacity: 0 }}
                    animate={{ rotateY: 0, opacity: 1 }}
                    exit={{ rotateY: -80, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 26 }}
                    whileTap={{ scale: 0.96 }}
                    onClick={() => onOpen(standing.team.teamId)}
                    aria-label={`${slot + 1}. ${nameOf(standing.team)}, ${formatRupees(standing.figure)}`}
                  >
                    <Emblem team={standing.team} size="130%" className="lv-pod-ghost" />
                    <span className="lv-pod-num" aria-hidden="true">
                      {slot + 1}
                    </span>
                    <Emblem team={standing.team} size={slot === 0 ? 52 : 42} className="lv-pod-mark" />
                    <span className="lv-pod-foot">
                      <span className="lv-pod-name">{nameOf(standing.team)}</span>
                      <CountUp className="lv-pod-fig" value={standing.figure} from={arriving ? 0 : undefined} />
                    </span>
                  </motion.button>
                ) : (
                  <motion.div
                    key="empty"
                    className="lv-pod lv-pod-empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <span className="lv-pod-num" aria-hidden="true">
                      {slot + 1}
                    </span>
                    <span className="lv-pod-empty-text">Open</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <div className="lv-pod-step" aria-hidden="true">
              <span>{['1st', '2nd', '3rd'][slot]}</span>
            </div>
          </div>
        )
      })}
    </section>
  )
}

export function Standings({
  rest,
  boardKey,
  followed,
  arriving,
  onOpen,
}: {
  rest: readonly Standing[]
  boardKey: BoardKey
  followed: string | null
  arriving: boolean
  onOpen: (teamId: string) => void
}) {
  return (
    <ol className="lv-list">
      <AnimatePresence initial={false} mode="popLayout">
        {rest.map((standing, index) => (
          <Row
            key={standing.team.teamId}
            standing={standing}
            boardKey={boardKey}
            followed={standing.team.teamId === followed}
            // The board arriving staggers in; after that, rows only travel.
            delay={arriving ? Math.min(index, 12) * 0.04 : 0}
            arriving={arriving}
            onOpen={onOpen}
          />
        ))}
      </AnimatePresence>
    </ol>
  )
}

function Row({
  standing,
  boardKey,
  followed,
  delay,
  arriving,
  onOpen,
}: {
  standing: Standing
  boardKey: BoardKey
  followed: boolean
  delay: number
  arriving: boolean
  onOpen: (teamId: string) => void
}) {
  const { team, rank, figure } = standing
  const climb = climbOf(boardKey, standing)
  const quiet = figure <= 0

  return (
    <motion.li
      layout="position"
      initial={arriving ? { opacity: 0, x: -28 } : { opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ layout: ROW_SPRING, default: { duration: 0.42, delay, ease: [0.16, 1, 0.3, 1] } }}
      className="lv-row-item"
    >
      <motion.button
        type="button"
        whileTap={{ scale: 0.975 }}
        className={`lv-row lv-livery-${liveryFor(team.teamId)}`}
        data-followed={followed ? '' : undefined}
        data-quiet={quiet ? '' : undefined}
        onClick={() => onOpen(team.teamId)}
      >
        <span className="lv-pos">{rank}</span>
        <span className="lv-slab">
          <Emblem team={team} size={30} className="lv-slab-mark" />
          <span className="lv-slab-text">
            <span className="lv-name">{nameOf(team)}</span>
            <span className="lv-meta">
              {climb !== null ? <Climb climb={climb} /> : null}
              {boardKey !== 'today' && team.todayRevenue > 0 ? (
                <span className="lv-meta-today">+{formatRupees(team.todayRevenue)} today</span>
              ) : (
                <span className="lv-meta-id">{team.ventureName ? team.teamId : 'Unnamed venture'}</span>
              )}
            </span>
          </span>
          <Emblem team={team} size={96} className="lv-slab-ghost" />
          {followed ? (
            <span className="lv-follow-flag" aria-label="Following">
              ★
            </span>
          ) : null}
        </span>
        <span className="lv-score">
          <CountUp value={figure} from={arriving ? 0 : undefined} />
        </span>
      </motion.button>
    </motion.li>
  )
}

export function Climb({ climb }: { climb: number }) {
  if (climb === 0) return <span className="lv-climb lv-climb-flat">–</span>
  return climb > 0 ? (
    <span className="lv-climb lv-climb-up" aria-label={`Up ${climb}`}>
      ▲{climb}
    </span>
  ) : (
    <span className="lv-climb lv-climb-down" aria-label={`Down ${-climb}`}>
      ▼{-climb}
    </span>
  )
}
