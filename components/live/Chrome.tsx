'use client'

import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'

import { Emblem } from '@/components/live/Emblem'
import { formatRupees } from '@/lib/format'
import { BOARD_KEYS, boardLabel, liveryFor, matchesQuery, type BoardKey, type Standing } from '@/lib/live'
import { nameOf } from '@/lib/team'
import type { BoardMode } from '@/lib/types'

/** A fetch younger than this is live; older is shown as a time. Three polls' worth. */
const LIVE_FOR_MS = 3 * 60_000

export function LiveHeader({
  subtitle,
  fetchedAt,
  refreshing,
  onRefresh,
}: {
  subtitle: React.ReactNode
  fetchedAt: number | null
  refreshing: boolean
  onRefresh: () => void
}) {
  const now = useNow(15_000)
  const live = fetchedAt !== null && now - fetchedAt < LIVE_FOR_MS
  const status = refreshing
    ? 'Syncing'
    : live
      ? 'Live'
      : fetchedAt !== null
        ? `Updated ${new Date(fetchedAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}`
        : 'Offline'

  return (
    <header className="lv-hero">
      <div className="lv-topline" aria-hidden="true">
        <span className="lv-stripes lv-stripes-l" />
        <span className="lv-wordmark">
          BYOB<span>Forge C1</span>
        </span>
        <span className="lv-stripes lv-stripes-r" />
      </div>
      <button
        type="button"
        className="lv-live"
        data-live={live && !refreshing ? '' : undefined}
        onClick={onRefresh}
        aria-label={`${status}. Tap to refresh`}
      >
        <span className="lv-live-dot" aria-hidden="true" />
        {status}
      </button>
      <motion.h1
        className="lv-title"
        initial={{ opacity: 0, x: -24 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
        <span className="lv-title-skew">Team Standings</span>
      </motion.h1>
      <p className="lv-subtitle">{subtitle}</p>
    </header>
  )
}

export function BoardTabs({
  boardKey,
  mode,
  onChange,
}: {
  boardKey: BoardKey
  mode: BoardMode
  onChange: (key: BoardKey) => void
}) {
  return (
    <nav className="lv-tabs-wrap">
      <div className="lv-tabs" role="tablist" aria-label="Board">
        {BOARD_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={key === boardKey}
            className="lv-tab"
            onClick={() => onChange(key)}
          >
            {key === boardKey ? (
              <motion.span
                layoutId="lv-tab-pill"
                className="lv-tab-pill"
                transition={{ type: 'spring', stiffness: 500, damping: 40 }}
              />
            ) : null}
            <span className="lv-tab-text">{boardLabel(key, mode)}</span>
          </button>
        ))}
      </div>
    </nav>
  )
}

/** The bar pinned to the bottom: your team if you follow one, and search. */
export function Dock({
  followed,
  onOpen,
  onSearch,
}: {
  followed: Standing | null
  onOpen: (teamId: string) => void
  onSearch: () => void
}) {
  return (
    <div className="lv-dock">
      <AnimatePresence mode="popLayout" initial={false}>
        {followed ? (
          <motion.button
            key={followed.team.teamId}
            type="button"
            className={`lv-dock-team lv-livery-${liveryFor(followed.team.teamId)}`}
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 30, opacity: 0 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => onOpen(followed.team.teamId)}
          >
            <span className="lv-dock-pos">P{followed.rank}</span>
            <Emblem team={followed.team} size={22} />
            <span className="lv-dock-name">{nameOf(followed.team)}</span>
            <span className="lv-dock-fig">{formatRupees(followed.figure)}</span>
          </motion.button>
        ) : (
          <motion.button
            key="find"
            type="button"
            className="lv-dock-find"
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 30, opacity: 0 }}
            whileTap={{ scale: 0.97 }}
            onClick={onSearch}
          >
            <span aria-hidden="true">☆</span> Follow your team
          </motion.button>
        )}
      </AnimatePresence>
      <motion.button
        type="button"
        className="lv-dock-search"
        whileTap={{ scale: 0.9 }}
        aria-label="Search teams"
        onClick={onSearch}
      >
        <SearchIcon />
      </motion.button>
    </div>
  )
}

export function SearchSheet({
  open,
  standings,
  followed,
  onPick,
  onFollow,
  onClose,
}: {
  open: boolean
  standings: readonly Standing[]
  followed: string | null
  onPick: (teamId: string) => void
  onFollow: (teamId: string | null) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    // After the sheet's first frame, so iOS actually raises the keyboard.
    const timer = setTimeout(() => input.current?.focus(), 60)
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  const results = standings.filter((s) => matchesQuery(s.team, query))

  return (
    <AnimatePresence onExitComplete={() => setQuery('')}>
      {open ? (
        <motion.div
          key="search"
          className="lv-search"
          role="dialog"
          aria-modal="true"
          aria-label="Find a team"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ type: 'spring', stiffness: 420, damping: 40 }}
        >
          <div className="lv-search-bar">
            <SearchIcon />
            <input
              ref={input}
              type="search"
              inputMode="search"
              autoComplete="off"
              placeholder="Venture name or team ID"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <button type="button" className="lv-search-cancel" onClick={onClose}>
              Cancel
            </button>
          </div>
          <ul className="lv-search-list">
            {results.map((s) => (
              <li key={s.team.teamId} className="lv-search-item">
                <button type="button" className="lv-search-pick" onClick={() => onPick(s.team.teamId)}>
                  <span className="lv-search-pos">{s.rank}</span>
                  <span className={`lv-search-mark lv-livery-${liveryFor(s.team.teamId)}`}>
                    <Emblem team={s.team} size={20} />
                  </span>
                  <span className="lv-search-name">
                    {nameOf(s.team)}
                    <small>{s.team.teamId}</small>
                  </span>
                </button>
                <button
                  type="button"
                  className="lv-search-star"
                  aria-pressed={followed === s.team.teamId}
                  aria-label={followed === s.team.teamId ? 'Unfollow' : 'Follow'}
                  onClick={() => onFollow(followed === s.team.teamId ? null : s.team.teamId)}
                >
                  {followed === s.team.teamId ? '★' : '☆'}
                </button>
              </li>
            ))}
            {results.length === 0 ? <li className="lv-search-none">No team matches “{query}”</li> : null}
          </ul>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

function SearchIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M15.5 15.5 21 21" />
    </svg>
  )
}

/** A clock for the live chip. Client-only: the page prerenders with no fetch time, so nothing here runs on the server. */
function useNow(everyMs: number): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), everyMs)
    return () => clearInterval(timer)
  }, [everyMs])
  return now
}
