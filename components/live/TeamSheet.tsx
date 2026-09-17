'use client'

import { AnimatePresence, motion, useDragControls, type PanInfo } from 'motion/react'
import { useEffect, useState } from 'react'

import { Climb } from '@/components/live/Board'
import { CountUp } from '@/components/live/CountUp'
import { Emblem } from '@/components/live/Emblem'
import { ProductArt } from '@/components/live/ProductArt'
import { formatCount, formatRupees, ordinal } from '@/lib/format'
import {
  BOARD_KEYS,
  avgTicket,
  boardLabel,
  climbOf,
  figureLabel,
  liveryFor,
  raceFor,
  shareOf,
  type BoardKey,
  type Standing,
} from '@/lib/live'
import type { Product } from '@/lib/liveSample'
import { nameOf } from '@/lib/team'
import type { BoardMode } from '@/lib/types'

/**
 * One team, opened from any row: where it stands on every board, the gap to
 * the car ahead and behind, its numbers, and its top sellers.
 *
 * Drag the header down to close; swipe it sideways for the next team on the
 * board. Both have buttons as well — a gesture nobody discovers is not a
 * feature.
 */
export function TeamSheet({
  teamId,
  boards,
  boardKey,
  mode,
  followed,
  products,
  onBoard,
  onNavigate,
  onFollow,
  onClose,
}: {
  teamId: string | null
  boards: Record<BoardKey, Standing[]>
  boardKey: BoardKey
  mode: BoardMode
  followed: string | null
  products: (teamId: string) => Product[]
  onBoard: (key: BoardKey) => void
  onNavigate: (teamId: string) => void
  onFollow: (teamId: string | null) => void
  onClose: () => void
}) {
  const drag = useDragControls()
  // Which way the content should slide when the team changes.
  const [direction, setDirection] = useState(0)

  const open = teamId !== null
  const race = teamId === null ? null : raceFor(boards[boardKey], teamId)

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const go = (step: -1 | 1) => {
    if (race === null) return
    const target = step === -1 ? race.ahead : race.behind
    if (target === undefined) return
    setDirection(step)
    onNavigate(target.team.teamId)
  }

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 110 || info.velocity.y > 600) onClose()
  }

  const onPanEnd = (_: unknown, info: PanInfo) => {
    if (Math.abs(info.offset.x) < 70 || Math.abs(info.offset.x) < Math.abs(info.offset.y)) return
    go(info.offset.x < 0 ? 1 : -1)
  }

  return (
    <AnimatePresence>
      {open && race !== null ? (
        <>
          <motion.div
            key="scrim"
            className="lv-scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.section
            key="sheet"
            role="dialog"
            aria-modal="true"
            aria-label={nameOf(race.self.team)}
            className={`lv-sheet lv-livery-${liveryFor(race.self.team.teamId)}`}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 38 }}
            drag="y"
            dragControls={drag}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.7 }}
            onDragEnd={onDragEnd}
          >
            <motion.header
              className="lv-sheet-hero"
              onPointerDown={(event) => drag.start(event)}
              onPanEnd={onPanEnd}
            >
              <span className="lv-grabber" aria-hidden="true" />
              <div className="lv-sheet-actions">
                <button
                  type="button"
                  className="lv-icon-btn"
                  aria-pressed={followed === race.self.team.teamId}
                  aria-label={followed === race.self.team.teamId ? 'Unfollow team' : 'Follow team'}
                  onClick={() =>
                    onFollow(followed === race.self.team.teamId ? null : race.self.team.teamId)
                  }
                >
                  {followed === race.self.team.teamId ? '★' : '☆'}
                </button>
                <button type="button" className="lv-icon-btn" aria-label="Close" onClick={onClose}>
                  ✕
                </button>
              </div>

              <AnimatePresence mode="popLayout" initial={false} custom={direction}>
                <motion.div
                  key={race.self.team.teamId}
                  className="lv-sheet-id"
                  custom={direction}
                  initial={{ opacity: 0, x: direction * 60 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: direction * -60 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 36 }}
                >
                  <Emblem team={race.self.team} size={210} className="lv-sheet-ghost" />
                  <span className="lv-sheet-pos">
                    <small>P</small>
                    {race.self.rank}
                  </span>
                  <span className="lv-sheet-badge">
                    <Emblem team={race.self.team} size={44} />
                  </span>
                  <h2 className="lv-sheet-name">{nameOf(race.self.team)}</h2>
                  <p className="lv-sheet-sub">
                    {race.self.team.teamId} · {ordinal(race.self.rank)} of {race.total} ·{' '}
                    {boardLabel(boardKey, mode)}
                  </p>
                </motion.div>
              </AnimatePresence>
            </motion.header>

            <div className="lv-sheet-body">
              <div className="lv-placements" role="tablist" aria-label="Placements">
                {BOARD_KEYS.map((key) => {
                  const placed = raceFor(boards[key], race.self.team.teamId)
                  return (
                    <button
                      key={key}
                      type="button"
                      role="tab"
                      aria-selected={key === boardKey}
                      className="lv-placement"
                      onClick={() => onBoard(key)}
                    >
                      <span className="lv-placement-label">{boardLabel(key, mode)}</span>
                      <span className="lv-placement-rank">
                        {placed === null || placed.self.figure <= 0 ? '—' : `P${placed.self.rank}`}
                      </span>
                    </button>
                  )
                })}
              </div>

              <div className="lv-figure">
                <span className="lv-label">{figureLabel(boardKey, mode)}</span>
                <CountUp className="lv-figure-value" value={race.self.figure} />
                <LeaderBar race={race} />
              </div>

              <Intervals race={race} onNavigate={(id, step) => (setDirection(step), onNavigate(id))} />

              <div className="lv-stats">
                <Stat label="Units sold" value={formatCount(race.self.team.totalUnits)} />
                <Stat
                  label="Avg ticket"
                  value={avgTicket(race.self.team) === null ? '—' : formatRupees(avgTicket(race.self.team)!)}
                />
                <Stat label="Today" value={formatRupees(race.self.team.todayRevenue)} />
                <Stat label="All-time" value={formatRupees(race.self.team.totalRevenue)} />
                <Stat
                  label="Share of board"
                  value={
                    shareOf(boards[boardKey], race.self.team.teamId) === null
                      ? '—'
                      : `${(shareOf(boards[boardKey], race.self.team.teamId)! * 100).toFixed(1)}%`
                  }
                />
                <Stat
                  label="Since last week"
                  value={(() => {
                    const all = raceFor(boards.all, race.self.team.teamId)
                    const climb = all === null ? null : climbOf('all', all.self)
                    return climb === null ? '—' : <Climb climb={climb} />
                  })()}
                />
              </div>

              <Products items={products(race.self.team.teamId)} />

              <nav className="lv-sheet-nav">
                <button type="button" disabled={race.ahead === undefined} onClick={() => go(-1)}>
                  <span aria-hidden="true">‹</span>
                  {race.ahead ? (
                    <span>
                      <small>P{race.ahead.rank}</small> {nameOf(race.ahead.team)}
                    </span>
                  ) : (
                    <span>Leader</span>
                  )}
                </button>
                <button type="button" disabled={race.behind === undefined} onClick={() => go(1)}>
                  {race.behind ? (
                    <span>
                      {nameOf(race.behind.team)} <small>P{race.behind.rank}</small>
                    </span>
                  ) : (
                    <span>Last</span>
                  )}
                  <span aria-hidden="true">›</span>
                </button>
              </nav>
            </div>
          </motion.section>
        </>
      ) : null}
    </AnimatePresence>
  )
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="lv-stat">
      <span className="lv-label">{label}</span>
      <span className="lv-stat-value">{value}</span>
    </div>
  )
}

/** How far this team is from the top of the board, as a bar. */
function LeaderBar({ race }: { race: NonNullable<ReturnType<typeof raceFor>> }) {
  const leader = Math.max(0, race.leader.figure)
  const share = leader > 0 ? Math.max(0, race.self.figure) / leader : 0
  return (
    <div className="lv-leaderbar" aria-hidden="true">
      <motion.span
        className="lv-leaderbar-fill"
        initial={{ scaleX: 0 }}
        animate={{ scaleX: share }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
      />
      <span className="lv-leaderbar-caption">
        {race.self.rank === 1 ? 'Leading the board' : `${Math.round(share * 100)}% of the leader`}
      </span>
    </div>
  )
}

/** F1's interval column: the gap to the team ahead and the lead over the team behind. */
function Intervals({
  race,
  onNavigate,
}: {
  race: NonNullable<ReturnType<typeof raceFor>>
  onNavigate: (teamId: string, step: -1 | 1) => void
}) {
  const { self, ahead, behind } = race
  return (
    <div className="lv-intervals">
      {ahead ? (
        <button type="button" className="lv-interval" onClick={() => onNavigate(ahead.team.teamId, -1)}>
          <span className={`lv-interval-mark lv-livery-${liveryFor(ahead.team.teamId)}`}>
            <Emblem team={ahead.team} size={20} />
          </span>
          <span className="lv-interval-text">
            <span className="lv-label">To catch P{ahead.rank}</span>
            <span className="lv-interval-name">{nameOf(ahead.team)}</span>
          </span>
          <span className="lv-interval-gap lv-gap-behind">{formatRupees(ahead.figure - self.figure)}</span>
        </button>
      ) : null}
      {behind ? (
        <button type="button" className="lv-interval" onClick={() => onNavigate(behind.team.teamId, 1)}>
          <span className={`lv-interval-mark lv-livery-${liveryFor(behind.team.teamId)}`}>
            <Emblem team={behind.team} size={20} />
          </span>
          <span className="lv-interval-text">
            <span className="lv-label">Clear of P{behind.rank}</span>
            <span className="lv-interval-name">{nameOf(behind.team)}</span>
          </span>
          <span className="lv-interval-gap lv-gap-ahead">{formatRupees(self.figure - behind.figure)}</span>
        </button>
      ) : null}
    </div>
  )
}

function Products({ items }: { items: readonly Product[] }) {
  if (items.length === 0) return null
  return (
    <section className="lv-products">
      <header className="lv-products-head">
        <span className="lv-label">Top sellers</span>
        {items.some((item) => item.sample) ? <span className="lv-sample">Sample data</span> : null}
      </header>
      <div className="lv-products-rail">
        {items.map((item, index) => (
          <motion.article
            key={item.name}
            className="lv-product"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 + index * 0.07, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="lv-product-shot">
              <span className="lv-product-rank">#{index + 1}</span>
              <ProductArt art={item.art} />
            </div>
            <div className="lv-product-name">{item.name}</div>
            <div className="lv-product-meta">
              {formatCount(item.units)} sold · {formatRupees(item.revenue)}
            </div>
          </motion.article>
        ))}
      </div>
    </section>
  )
}
