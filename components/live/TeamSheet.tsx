'use client'

import { AnimatePresence, motion, useDragControls, type PanInfo } from 'motion/react'
import { useEffect, useState } from 'react'

import { Climb } from '@/components/live/Board'
import { CountUp } from '@/components/live/CountUp'
import { Emblem } from '@/components/live/Emblem'
import { Squad } from '@/components/live/Lineup'
import { SellsIcon } from '@/components/live/SellsIcon'
import { formatCount, formatRupees } from '@/lib/format'
import {
  BOARD_KEYS,
  avgTicket,
  boardLabel,
  climbOf,
  figureLabel,
  instagramUrl,
  linkLabel,
  liveryFor,
  raceFor,
  shareOf,
  websiteUrl,
  type BoardKey,
  type Standing,
} from '@/lib/live'
import { nameOf } from '@/lib/team'
import type { BoardMode, Team } from '@/lib/types'

/**
 * One team, opened from any row: where it stands on every board, the gap to
 * the team ahead and behind, its numbers, and what it sells.
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
  onBoard,
  onNavigate,
  onClose,
}: {
  teamId: string | null
  boards: Record<BoardKey, Standing[]>
  boardKey: BoardKey
  mode: BoardMode
  onBoard: (key: BoardKey) => void
  onNavigate: (teamId: string) => void
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

  /**
   * A sideways swipe moves to the next team; a vertical one is a scroll and
   * must not.
   *
   * **Twice the horizontal distance, and 64px of it.** A thumb flicking down a
   * list travels a little sideways too, and a 1:1 comparison turned some of
   * those into a team change. The OS owns the screen *edges* — both iOS and
   * Android read an edge-swipe as "go back" — which is the other reason the
   * chevrons exist: the gesture is a shortcut for people who find it, and the
   * buttons are what everyone else uses.
   */
  const onPanEnd = (_: unknown, info: PanInfo) => {
    const { x, y } = info.offset
    if (Math.abs(x) < 64 || Math.abs(x) < Math.abs(y) * 2) return
    go(x < 0 ? 1 : -1)
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
            // **The sideways swipe is on the whole sheet, not just the hero.**
            // It was on the header alone, which is the one part of a phone
            // screen a thumb does not rest on. `.lv-sheet-body` carries
            // `touch-action: pan-y`, so the browser still scrolls it
            // vertically and horizontal movement reaches this instead.
            onPanEnd={onPanEnd}
          >
            <motion.header
              className="lv-sheet-hero"
              onPointerDown={(event) => drag.start(event)}
            >
              {/* ── The colour is a layer, so the faces can leave the header ──
               *
               * The header used to carry the gradient itself and clip its own
               * overflow, which is what a rounded top corner needs — and that
               * clip is exactly what kept the squad inside. So the paint moves
               * into this layer, which clips, and the header stops clipping,
               * which lets the heads hang into the content below. The
               * watermark lives in here for the same reason. */}
              <div className="lv-hero-bg" aria-hidden="true">
                <Emblem team={race.self.team} size={190} className="lv-sheet-ghost" />
              </div>
              <span className="lv-grabber" aria-hidden="true" />
              <div className="lv-sheet-actions">
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
                  <h2 className="lv-sheet-name">{nameOf(race.self.team)}</h2>
                  {/* **No caption under the name.** It read "1st of 39 ·
                      All-time", and every part of that is already on screen:
                      the rank is the numeral behind the faces and again on the
                      placements row below, and which board you are looking at
                      is the tab you pressed to get here. The team id went the
                      same way and for the same reason — a code for a
                      spreadsheet, not a fact about a venture. */}
                  {/* ── The stage: the rank behind, the faces in front ──
                   *
                   * The numeral used to be the biggest thing in the header,
                   * top left, with the faces small in the opposite corner.
                   * The faces are what this page has that no leaderboard
                   * does, so they take the middle at the size they deserve
                   * and the rank goes behind them — the way a broadcast card
                   * sets a driver against their own number. It is still
                   * crisp two lines down, on the placements row. */}
                  <div className="lv-sheet-stage">
                    <span className="lv-sheet-pos" aria-hidden="true">
                      {race.self.rank}
                    </span>
                    <Squad team={race.self.team} />
                  </div>
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

              <Sells product={race.self.team.product} />

              <Links team={race.self.team} />
            </div>

            {/* ── Two keys, and no names on them ──
             *
             * This was a pair of full-width buttons carrying the next team's
             * rank and name. They read as more content at the foot of a sheet
             * that already has plenty, and on any team with a line-up they sat
             * below the fold — a control you have to scroll to is not a
             * control. Chevrons say the same thing in the space of a thumb,
             * stay put while the body scrolls, and keep the names for a screen
             * reader. */}
            <nav className="lv-sheet-nav" aria-label="Other teams on this board">
              <button
                type="button"
                className="lv-nav-key"
                disabled={race.ahead === undefined}
                aria-label={
                  race.ahead ? `Up to ${nameOf(race.ahead.team)}, P${race.ahead.rank}` : 'Top of the board'
                }
                onClick={() => go(-1)}
              >
                <Chevron direction="left" />
              </button>
              <button
                type="button"
                className="lv-nav-key"
                disabled={race.behind === undefined}
                aria-label={
                  race.behind
                    ? `Down to ${nameOf(race.behind.team)}, P${race.behind.rank}`
                    : 'Bottom of the board'
                }
                onClick={() => go(1)}
              >
                <Chevron direction="right" />
              </button>
            </nav>
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
      {/* ── A rupee figure, not a percentage ──
       *
       * This said "88% of the leader", then "77% of Dosa Crisps, who leads",
       * and both had to be asked about. A share of somebody else's total is a
       * second thing to work out before the sentence means anything. The gap
       * itself needs no working out, and it is the number a team would act
       * on. The bar still shows the proportion, which is what a bar is for. */}
      <span className="lv-leaderbar-caption">
        {race.self.rank === 1
          ? 'Top of this board'
          : `${formatRupees(race.leader.figure - race.self.figure)} behind ${nameOf(race.leader.team)}`}
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

/**
 * What the venture sells, in its own words.
 *
 * **Real or absent — there is no sample.** A strip of invented products with
 * invented unit counts stood here for a day; it rendered beautifully and said
 * false things about a team, which is the one failure this project is built
 * around. `TV_Feed` has no product column yet, so this shows nothing at all
 * until the sheet grows one, and then shows exactly what the team typed.
 *
 * Two lines, clamped, because a team writes a sentence and the sheet is the
 * place to shorten it. The icon is read off the same words by
 * `sellsCategory`, so nothing here has to be maintained per team.
 */
function Sells({ product }: { product?: string }) {
  if (!product) return null
  return (
    <section className="lv-sells">
      <span className="lv-sells-icon">
        <SellsIcon product={product} size={24} />
      </span>
      <span className="lv-sells-text">
        <span className="lv-label">Sells</span>
        <span className="lv-sells-line">{product}</span>
      </span>
    </section>
  )
}

/**
 * The venture's own links, at the foot of the sheet.
 *
 * **Absent until the sheet publishes them.** `instagram` and `website` are
 * optional `TV_Feed` columns, like `product`; a team with neither gets no
 * block at all rather than a dead button. Anything that is not plainly
 * `https` is refused by `instagramUrl` / `websiteUrl` — these cells are typed
 * by forty teams into a workbook, which makes them untrusted input.
 *
 * `rel="noreferrer"` with `target="_blank"`: without `noopener` (which
 * `noreferrer` implies) the opened page gets a handle on this one.
 */
function Links({ team }: { team: Team }) {
  const links = [
    { kind: 'instagram' as const, href: instagramUrl(team.instagram) },
    { kind: 'website' as const, href: websiteUrl(team.website) },
  ].filter((link): link is { kind: 'instagram' | 'website'; href: string } => link.href !== null)

  if (links.length === 0) return null

  return (
    <section className="lv-links">
      {links.map(({ kind, href }) => (
        <a
          key={kind}
          className="lv-link"
          href={href}
          target="_blank"
          rel="noreferrer"
        >
          <span className="lv-link-icon">{kind === 'instagram' ? <InstagramIcon /> : <GlobeIcon />}</span>
          <span className="lv-link-text">
            <span className="lv-label">{kind === 'instagram' ? 'Instagram' : 'Website'}</span>
            <span className="lv-link-handle">{linkLabel(href)}</span>
          </span>
          <span className="lv-link-go" aria-hidden="true">
            ↗
          </span>
        </a>
      ))}
    </section>
  )
}

function InstagramIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5.4" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  )
}

function GlobeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M3.5 9.5h17M3.5 14.5h17" />
      <path d="M12 3a15 15 0 0 1 0 18a15 15 0 0 1 0-18z" />
    </svg>
  )
}

/** A drawn chevron: `‹` and `›` carry uneven side bearings and sit off-centre. */
function Chevron({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={direction === 'left' ? { transform: 'scaleX(-1)' } : undefined}
    >
      <path d="m9 5 7 7-7 7" />
    </svg>
  )
}
