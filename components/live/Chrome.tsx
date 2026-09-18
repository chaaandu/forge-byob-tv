'use client'

import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'

import { Emblem } from '@/components/live/Emblem'
import { BOARD_KEYS, boardLabel, liveryFor, matchesQuery, type BoardKey, type Standing } from '@/lib/live'
import { nameOf } from '@/lib/team'
import type { BoardMode } from '@/lib/types'

/**
 * The page's own furniture: masthead, board tabs, the search key and the
 * search sheet.
 *
 * **No live chip, no follow button, no caption under the title.** All three
 * were here and all three were removed by decision on 18 September 2026. The
 * chip was a status light on a page that polls itself every sixty seconds;
 * following a team was a star, a pinned bar and a `localStorage` key for
 * something search does in two taps; and the caption read "Proof-backed
 * revenue · all-time" directly under a tab bar already reading *All-time*.
 * What the tabs say, the header does not repeat.
 */
export function LiveHeader() {
  return (
    <header className="lv-hero">
      <div className="lv-topline" aria-hidden="true">
        <span className="lv-stripes lv-stripes-l" />
        <span className="lv-wordmark">
          BYOB<span>Forge C1</span>
        </span>
        <span className="lv-stripes lv-stripes-r" />
      </div>
      <motion.h1
        className="lv-title"
        initial={{ opacity: 0, x: -24 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
        <span className="lv-title-line">Team</span>
        <span className="lv-title-line">Standings</span>
      </motion.h1>
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

/** The one floating control: find a team. */
export function SearchKey({ onSearch }: { onSearch: () => void }) {
  return (
    <div className="lv-dock">
      <motion.button
        type="button"
        className="lv-dock-search"
        whileTap={{ scale: 0.92 }}
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
  onPick,
  onClose,
}: {
  open: boolean
  standings: readonly Standing[]
  onPick: (teamId: string) => void
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
        <>
          {/* ── Somewhere to click that means "no" ──
           *
           * On a phone the search fills the screen, so Cancel is the only
           * outside there is. On a desktop it is a panel with the board
           * visible around it, and clicking that board did nothing at all —
           * the one gesture everybody tries on a modal. */}
          <motion.div
            key="search-scrim"
            className="lv-search-scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
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
                    {s.team.product ? <small>{s.team.product}</small> : null}
                  </span>
                </button>
              </li>
            ))}
            {results.length === 0 ? <li className="lv-search-none">No team matches “{query}”</li> : null}
          </ul>
        </motion.div>
        </>
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
