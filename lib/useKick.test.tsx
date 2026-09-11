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

let latest: Kick | null = null
let version = 0
let root: Root
let host: HTMLDivElement

function Probe() {
  // A test probe, not an app component: the render's one job is to expose the
  // hook's return value to the assertions.
  // eslint-disable-next-line react-hooks/globals
  latest = useKick(BOARD, version)
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
