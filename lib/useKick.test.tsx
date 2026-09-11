// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { enqueueKicks, KEYS } from '@/lib/storage'
import type { OvertakeEvent } from '@/lib/types'
import { useKick, type Kick } from '@/lib/useKick'

/**
 * The queue across a mount — which is now a thirty-second event, not a
 * once-a-deploy one, because `Rotator` swaps the two slides by unmounting one
 * board and mounting the other.
 *
 * Both tests here are invisible on screen in the way this project keeps finding:
 * the discard failing means a confident, well-timed animation between two teams
 * that never overtook anyone, and the drain failing means a wall that simply
 * never animates. Neither shows an error.
 */

;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const BOARD = 'weekly-test'

const EVENT: OvertakeEvent = {
  id: 'challenge:1:VBC107:3',
  attacker: 'VBC107',
  attackerName: 'Wake & Wyze',
  defender: 'VBC112',
  defenderName: 'XOCO',
  fromRank: 5,
  toRank: 3,
}

/** A second event out of the same fetch — one sale routinely moves several. */
const SECOND: OvertakeEvent = {
  id: 'challenge:1:VBC120:9',
  attacker: 'VBC120',
  attackerName: 'Sortd',
  defender: 'VBC118',
  defenderName: 'Blunnt',
  fromRank: 11,
  toRank: 9,
}

let latest: Kick | null = null
let version = 0
/** What the board is showing. `null` means "play anything", as a page with no
    gate would. */
let playable: ((event: OvertakeEvent) => boolean) | null = null
let root: Root
let host: HTMLDivElement

function Probe() {
  // A test probe, not an app component: the render's one job is to expose the
  // hook's return value to the assertions.
  // eslint-disable-next-line react-hooks/globals
  latest = useKick(BOARD, version, playable ?? undefined)
  return null
}

/** Renders the probe. Called again to re-render with a bumped `version`. */
function render() {
  act(() => {
    root.render(<Probe />)
  })
}

function queued(): OvertakeEvent[] {
  return JSON.parse(localStorage.getItem(KEYS.queue(BOARD)) ?? '[]') as OvertakeEvent[]
}

beforeEach(() => {
  localStorage.clear()
  latest = null
  version = 0
  playable = null
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
})

afterEach(() => {
  act(() => root.unmount())
  host.remove()
})

describe('useKick across a slide rotation', () => {
  it('discards a kick left over from before the slide rotated away', () => {
    // The state a rotation leaves behind: an event queued but never played,
    // while the board it described re-sorted itself from the CSV cache.
    enqueueKicks(BOARD, [EVENT])

    render()

    expect(latest?.playing).toBeNull()
    // Dropped, not merely skipped — a kick still sitting in the queue would play
    // on the *next* rotation instead, which is the same lie one slide later.
    expect(queued()).toEqual([])
  })

  it('still plays a kick queued while the slide is on screen', () => {
    // The guard against fixing the above by breaking everything: the discard is
    // mount-only, so the ordinary path — detector enqueues, `queueVersion`
    // nudges, hook drains — has to be untouched by it.
    render()
    expect(latest?.playing).toBeNull()

    enqueueKicks(BOARD, [EVENT])
    version = 1
    render()

    expect(latest?.playing).toEqual(EVENT)
    expect(queued()).toEqual([])
  })
})

/**
 * Several rank changes out of one fetch, which is the ordinary case rather than
 * an edge: one team's sale moves it three places and everyone it passed moves
 * one. The whole batch describes transitions out of **the same** ordering, so
 * the page has to keep that ordering on screen until the last of them has
 * played — and `waiting` is the only thing that tells it to.
 */
describe('useKick across a batch', () => {
  it('reports more waiting behind what is playing, and stops when the queue empties', () => {
    render()
    enqueueKicks(BOARD, [EVENT, SECOND])
    version = 1
    render()

    expect(latest?.playing).toEqual(EVENT)
    // The board must not move: the second event's ranks are measured against
    // the ordering still on screen.
    expect(latest?.waiting).toBe(true)

    act(() => latest?.settled())
    expect(latest?.playing).toEqual(SECOND)
    // Nothing behind it — this is the first moment the board may re-sort.
    expect(latest?.waiting).toBe(false)

    act(() => latest?.settled())
    expect(latest?.playing).toBeNull()
    expect(latest?.waiting).toBe(false)
  })

  it('learns that the batch grew while something was playing', () => {
    render()
    enqueueKicks(BOARD, [EVENT])
    version = 1
    render()
    expect(latest?.playing).toEqual(EVENT)
    expect(latest?.waiting).toBe(false)

    // A poll landing mid-animation. The page has to know before the current
    // flip settles, or it thaws in the one commit between the two events.
    enqueueKicks(BOARD, [SECOND])
    version = 2
    render()
    expect(latest?.playing).toEqual(EVENT)
    expect(latest?.waiting).toBe(true)
  })

  it('drops an event the board no longer matches, and keeps draining', () => {
    // The failure this prevents renders perfectly: `cuesFor` picks the cards to
    // animate by position, so an event whose slots have changed hands animates
    // a confident overtake between two teams that never met.
    playable = (event) => event.id === SECOND.id
    render()
    enqueueKicks(BOARD, [EVENT, SECOND])
    version = 1
    render()

    expect(latest?.playing).toEqual(SECOND)
    expect(queued()).toEqual([])
    expect(latest?.waiting).toBe(false)
  })

  it('plays nothing at all when no queued event matches the board', () => {
    playable = () => false
    render()
    enqueueKicks(BOARD, [EVENT, SECOND])
    version = 1
    render()

    // Silence, not a wrong animation — and the queue is emptied rather than
    // left to play the same lie one slide later.
    expect(latest?.playing).toBeNull()
    expect(latest?.waiting).toBe(false)
    expect(queued()).toEqual([])
  })
})
