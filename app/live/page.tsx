'use client'

import { MotionConfig } from 'motion/react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { Podium, Standings, splitBoard } from '@/components/live/Board'
import { BoardTabs, LiveHeader, SearchKey, SearchSheet } from '@/components/live/Chrome'
import { CountUp } from '@/components/live/CountUp'
import { TeamSheet } from '@/components/live/TeamSheet'
import { boardMode } from '@/lib/board'
import { standingsFor, type BoardKey, type Standing } from '@/lib/live'
import { useDesktop } from '@/lib/useDesktop'
import { useLiveData } from '@/lib/useLiveData'
import type { BoardMode } from '@/lib/types'

/**
 * `/live` — the standings on a phone.
 *
 * Not a slide. It is not on the rotation (`Rotator` only swaps `/daily` and
 * `/podium`), it carries no Ganesha, and it is the one page on this project a
 * person touches — so it is built the other way round from the wall: it moves
 * when you do, and it honours `prefers-reduced-motion`, which the wall
 * deliberately ignores because the OS setting on a TV laptop says nothing
 * about who is walking past. On a phone it says exactly who is holding it.
 *
 * What it does share with the wall is everything that decides a number: the
 * feed, the gate, the comparators and `challenge_mode`. See `lib/live.ts`.
 */

/** How long the arrival stagger and count-up run before rows only travel. */
const ARRIVAL_MS = 1_400

export default function LivePage() {
  // `fetchedAt` is deliberately not read. The footer that printed it went on
  // 18 September 2026, which puts this page where the wall already is: **it
  // shows no staleness and no error state.** A revoked sheet or a stalled
  // consolidator keeps the last good figures and renders a perfectly healthy
  // board. `AGENTS.md` carries the full cost of that on the wall; the hook
  // still tracks the time, so a line or a chip is one element to put back.
  const { snapshot } = useLiveData()
  const [boardKey, setBoardKey] = useState<BoardKey>('all')
  const [openId, setOpenId] = useState<string | null>(null)
  const [searching, setSearching] = useState(false)
  const [arriving, setArriving] = useState(true)

  const hasData = snapshot !== null
  const desktop = useDesktop()

  // A `?team=` deep link, read on the client only: the route is prerendered,
  // so the URL's query is not knowable during render.
  useEffect(() => {
    const linked = new URLSearchParams(window.location.search).get('team')
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (linked) setOpenId(linked)
  }, [])

  useEffect(() => {
    if (!hasData) return
    const timer = setTimeout(() => setArriving(false), ARRIVAL_MS)
    return () => clearTimeout(timer)
  }, [hasData])

  // The browser chrome takes the page's colour. Read from the token rather
  // than written here, because this file may not name a colour.
  useEffect(() => {
    const colour = getComputedStyle(document.documentElement).getPropertyValue('--lv-page').trim()
    if (colour === '') return
    let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
    if (meta === null) {
      meta = document.createElement('meta')
      meta.name = 'theme-color'
      document.head.appendChild(meta)
    }
    meta.content = colour
  }, [])

  /**
   * Keep the open team in the URL, so a sheet can be shared as a link.
   *
   * **Only when the URL would actually change.** Next patches
   * `history.replaceState` to keep its router in step, so calling it on mount
   * — which this did, to delete a `team` parameter that was not there —
   * dispatches a router action before the router has initialised. That logs
   * `Internal Next.js error: Router action dispatched before initialization`
   * and puts an issue badge on the page in development. Nothing broke, which
   * is exactly why it sat there unnoticed until the badge was photographed.
   */
  useEffect(() => {
    const url = new URL(window.location.href)
    if (openId === null) url.searchParams.delete('team')
    else url.searchParams.set('team', openId)
    if (url.href === window.location.href) return
    window.history.replaceState(window.history.state, '', url)
  }, [openId])

  // **`daily` before the first fetch, matching `boardMode`'s own fallback.** On
  // this page the two non-challenge modes are the same board — `figureOf` and
  // `standingsFor` both read `week_revenue` for anything that is not a
  // challenge — so the only thing this decides is which label the middle tab
  // wears for the moment before data lands, and it should be the one the sheet
  // is about to confirm.
  const mode: BoardMode = snapshot === null ? 'daily' : boardMode(snapshot.cohort)

  const boards = useMemo<Record<BoardKey, Standing[]>>(() => {
    const teams = snapshot?.teams ?? []
    return {
      all: standingsFor('all', mode, teams),
      period: standingsFor('period', mode, teams),
      today: standingsFor('today', mode, teams),
    }
  }, [snapshot, mode])

  const standings = boards[boardKey]
  const { podium, rest } = splitBoard(standings)
  const boardTotal = standings.reduce((sum, s) => sum + s.figure, 0)
  const trading = standings.filter((s) => s.figure > 0).length

  const open = useCallback((teamId: string) => {
    setOpenId(teamId)
    buzz()
  }, [])

  const close = useCallback(() => setOpenId(null), [])
  const closeSearch = useCallback(() => setSearching(false), [])

  const changeBoard = useCallback((key: BoardKey) => {
    setBoardKey(key)
    buzz()
  }, [])

  return (
    <MotionConfig reducedMotion="user">
      <div
        className="lv-app"
        /**
         * **The page stops scrolling only when something covers it.**
         *
         * A drawer on a phone does — it is the screen. A docked panel does
         * not: the board is right there beside it, and locking the page
         * because a team is open left the standings frozen on a desktop with
         * two thirds of the window still showing them. Search is a modal at
         * every width, so it always locks.
         */
        data-locked={searching || (openId !== null && !desktop) ? '' : undefined}
        data-panel={openId !== null ? '' : undefined}
      >
        {/* ── The board is its own element so it can move ──
         *
         * On a wide screen the team panel docks to the right, and a panel
         * that simply covered the board would hide the money band at the end
         * of every row — the column the whole page is about. So the board
         * slides sideways to clear it. **Sideways, not narrower**: resizing
         * re-wraps names, re-truncates them and reflows the podium, which
         * makes every click feel like a page rebuild. A transform moves the
         * whole thing as one piece and changes no layout at all.
         *
         * It also has to be a separate element from `.lv-app`, because a
         * transformed ancestor becomes the containing block for `position:
         * fixed` descendants — transform `.lv-app` and the docked panel
         * would slide along with the board it is supposed to be revealing. */}
        <div className="lv-board">
          <LiveHeader />

          {/* ── Tabs and the board's own figures are one strip ──
           *
           * `display: contents` on a phone, so these two behave exactly as
           * they did when they were separate: the tabs stick to the top of
           * the screen and the figures scroll away underneath. On a desktop
           * the wrapper becomes the row it looks like — tabs at the left,
           * board total and trading count at the right — which takes a band
           * off the page and stops the tabs sitting alone in a strip of
           * their own. */}
          <div className="lv-toolbar">
            <BoardTabs boardKey={boardKey} mode={mode} onChange={changeBoard} />
            {hasData ? (
              <div className="lv-summary">
                <div>
                  <span className="lv-label">Board total</span>
                  <CountUp className="lv-summary-value" value={boardTotal} from={arriving ? 0 : undefined} />
                </div>
                <div>
                  <span className="lv-label">Trading</span>
                  <span className="lv-summary-value">
                    {trading}
                    <small>/{standings.length}</small>
                  </span>
                </div>
              </div>
            ) : null}
          </div>

        {hasData ? (
          <main className="lv-main">
            <Podium podium={podium} arriving={arriving} onOpen={open} />

            {/* **Not "Pos".** On a board about takings that reads as
                point-of-sale, which is a different system entirely. */}
            <div className="lv-colheads" aria-hidden="true">
              <span>Rank</span>
              <span>Team</span>
              <span>Revenue</span>
            </div>

            <Standings rest={rest} boardKey={boardKey} arriving={arriving} onOpen={open} />

          </main>
        ) : null}
        </div>

        <SearchKey onSearch={() => setSearching(true)} />

        <SearchSheet
          open={searching}
          standings={standings}
          onPick={(teamId) => {
            setSearching(false)
            open(teamId)
          }}
          onClose={closeSearch}
        />

        <TeamSheet
          teamId={openId}
          boards={boards}
          boardKey={boardKey}
          mode={mode}
          onNavigate={setOpenId}
          onClose={close}
        />
      </div>
    </MotionConfig>
  )
}

/** A tick under the thumb, where the platform allows it (Android; iOS Safari ignores it). */
function buzz() {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate?.(8)
}
