'use client'

import { MotionConfig } from 'motion/react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { Podium, Standings, splitBoard } from '@/components/live/Board'
import { BoardTabs, LiveHeader, SearchKey, SearchSheet } from '@/components/live/Chrome'
import { CountUp } from '@/components/live/CountUp'
import { TeamSheet } from '@/components/live/TeamSheet'
import { boardMode } from '@/lib/board'
import { openWeek } from '@/lib/feed'
import { standingsFor, type BoardKey, type Standing } from '@/lib/live'
import { useLiveData } from '@/lib/useLiveData'

/**
 * `/live` — the standings on a phone.
 *
 * Not a slide. It is not on the rotation (`Rotator` only swaps `/weekly` and
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
  const { snapshot, fetchedAt } = useLiveData()
  const [boardKey, setBoardKey] = useState<BoardKey>('all')
  const [openId, setOpenId] = useState<string | null>(null)
  const [searching, setSearching] = useState(false)
  const [arriving, setArriving] = useState(true)

  const hasData = snapshot !== null

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

  // Keep the open team in the URL, so a sheet can be shared as a link.
  useEffect(() => {
    const url = new URL(window.location.href)
    if (openId === null) url.searchParams.delete('team')
    else url.searchParams.set('team', openId)
    window.history.replaceState(window.history.state, '', url)
  }, [openId])

  const mode = snapshot === null ? 'week' : boardMode(snapshot.cohort)

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

  const week = snapshot === null ? null : openWeek(snapshot.cohort)
  const subtitle =
    boardKey === 'all' ? (
      <>
        Proof-backed revenue · <b>all-time</b>
      </>
    ) : boardKey === 'today' ? (
      <>
        Revenue logged <b>today</b>
      </>
    ) : mode === 'challenge' ? (
      <>
        Revenue in the <b>10-Day Challenge</b>
      </>
    ) : (
      <>
        Revenue in <b>{week === null ? 'this week' : `Week ${week}`}</b>
      </>
    )

  return (
    <MotionConfig reducedMotion="user">
      <div className="lv-app" data-locked={openId !== null || searching ? '' : undefined}>
        <LiveHeader subtitle={subtitle} />
        <BoardTabs boardKey={boardKey} mode={mode} onChange={changeBoard} />

        {hasData ? (
          <main className="lv-main">
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

            <Podium podium={podium} arriving={arriving} onOpen={open} />

            {/* **Not "Pos".** On a board about takings that reads as
                point-of-sale, which is a different system entirely. */}
            <div className="lv-colheads" aria-hidden="true">
              <span>Rank</span>
              <span>Team</span>
              <span>Revenue</span>
            </div>

            <Standings rest={rest} boardKey={boardKey} arriving={arriving} onOpen={open} />

            {/* The only provenance on the page, and it is a line rather than a
                status light. The wall carries none at all — `AGENTS.md` has
                what that costs there; a phone is held by somebody who can act
                on a stale figure, so it says so. */}
            <footer className="lv-foot">
              Logged, proof-backed revenue from the BYOB master
              {fetchedAt === null ? null : (
                <>
                  {' · checked '}
                  {new Date(fetchedAt).toLocaleTimeString('en-IN', {
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </>
              )}
              {snapshot.cohort.as_of ? <> · sheet as of {snapshot.cohort.as_of}</> : null}
            </footer>
          </main>
        ) : null}

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
          onBoard={changeBoard}
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
