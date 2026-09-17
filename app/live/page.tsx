'use client'

import { MotionConfig } from 'motion/react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { Podium, Standings, splitBoard } from '@/components/live/Board'
import { BoardTabs, Dock, LiveHeader, SearchSheet } from '@/components/live/Chrome'
import { CountUp } from '@/components/live/CountUp'
import { TeamSheet } from '@/components/live/TeamSheet'
import { boardMode } from '@/lib/board'
import { openWeek } from '@/lib/feed'
import { standingsFor, type BoardKey, type Standing } from '@/lib/live'
import { sampleProducts, type Product } from '@/lib/liveSample'
import { readFollowed, writeFollowed } from '@/lib/storage'
import { useLiveData } from '@/lib/useLiveData'

/**
 * `/live` — the standings on a phone.
 *
 * Not a slide. It is not on the rotation (`Rotator` only swaps `/weekly` and
 * `/podium`), it carries no Ganesha, and it is the one page on this project
 * a person touches — so it is built the other way round from the wall: it
 * moves when you do, it tells you how fresh it is, and it honours
 * `prefers-reduced-motion`, which the wall deliberately ignores because the
 * OS setting on a TV laptop says nothing about who is walking past. On a
 * phone it says exactly who is holding it.
 *
 * What it does share with the wall is everything that decides a number: the
 * feed, the gate, the comparators and `challenge_mode`. See `lib/live.ts`.
 */

/** How long the arrival stagger and count-up run before rows only travel. */
const ARRIVAL_MS = 1_400

const noProducts = (): Product[] => []

export default function LivePage() {
  const { snapshot, fetchedAt, refreshing, refresh } = useLiveData()
  const [boardKey, setBoardKey] = useState<BoardKey>('all')
  const [openId, setOpenId] = useState<string | null>(null)
  const [searching, setSearching] = useState(false)
  const [followed, setFollowed] = useState<string | null>(null)
  const [arriving, setArriving] = useState(true)

  const hasData = snapshot !== null

  // Client-only reads: the followed team, and a `?team=` deep link.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFollowed(readFollowed())
    const linked = new URLSearchParams(window.location.search).get('team')
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
  const followedStanding = followed === null ? null : (standings.find((s) => s.team.teamId === followed) ?? null)

  const follow = useCallback((teamId: string | null) => {
    setFollowed(teamId)
    writeFollowed(teamId)
    buzz()
  }, [])

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
        <LiveHeader subtitle={subtitle} fetchedAt={fetchedAt} refreshing={refreshing} onRefresh={refresh} />
        <BoardTabs boardKey={boardKey} mode={mode} onChange={changeBoard} />

        {hasData ? (
          <main className="lv-main">
            <div className="lv-summary">
              <div>
                <span className="lv-label">Board total</span>
                <CountUp className="lv-summary-value" value={boardTotal} from={arriving ? 0 : undefined} />
              </div>
              <div>
                <span className="lv-label">On the board</span>
                <span className="lv-summary-value">
                  {trading}
                  <small>/{standings.length}</small>
                </span>
              </div>
            </div>

            <Podium podium={podium} arriving={arriving} onOpen={open} />

            <div className="lv-colheads" aria-hidden="true">
              <span>Pos</span>
              <span>Team</span>
              <span>Revenue</span>
            </div>

            <Standings rest={rest} boardKey={boardKey} followed={followed} arriving={arriving} onOpen={open} />

            <footer className="lv-foot">
              Logged, proof-backed revenue from the BYOB master
              {snapshot.cohort.as_of ? <> · sheet as of {snapshot.cohort.as_of}</> : null}
            </footer>
          </main>
        ) : null}

        <Dock followed={followedStanding} onOpen={open} onSearch={() => setSearching(true)} />

        <SearchSheet
          open={searching}
          standings={standings}
          followed={followed}
          onPick={(teamId) => {
            setSearching(false)
            open(teamId)
          }}
          onFollow={follow}
          onClose={closeSearch}
        />

        <TeamSheet
          teamId={openId}
          boards={boards}
          boardKey={boardKey}
          mode={mode}
          followed={followed}
          // Sample products in development only — see `lib/liveSample.ts`.
          products={
            process.env.NODE_ENV === 'production'
              ? noProducts
              : (teamId) => {
                  const team = snapshot?.teams.find((t) => t.teamId === teamId)
                  return team === undefined ? [] : sampleProducts(team)
                }
          }
          onBoard={changeBoard}
          onNavigate={setOpenId}
          onFollow={follow}
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
