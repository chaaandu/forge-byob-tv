'use client'

import { rankTeams } from '@/lib/ranking'
import { clearKicks, enqueueKicks } from '@/lib/storage'
import type { OvertakeEvent, Team } from '@/lib/types'

/**
 * Fire a podium overtake on demand, in development only.
 *
 * An observability affordance, not a feature. `/podium` ranks on all-time
 * revenue, so a change at the top happens a few times a *week* rather than a few
 * times a day — and the beats this animation is built from are things to judge by
 * watching, which is not possible if watching means waiting for the cohort.
 *
 * ── It is not a second code path ──
 *
 * The only thing this does that the detector does not is *construct* the event.
 * From there it goes through `enqueueKicks` — the same function, the same
 * localStorage queue, the same replace-by-id, the same cap — and is drained by
 * the same `takeKick` inside `useKick`, which remains the only reader. Nothing
 * here touches the board or the beats. What you watch is what live data
 * produces.
 *
 * ── The board snaps back at the end. That is expected ──
 *
 * The pillars in a sequence are the real pillars, and the data behind them is
 * frozen for its duration. This trigger fabricates an event without fabricating
 * the data behind it, so when the held snapshot thaws there is nothing new to
 * apply and the board returns to where it started.
 *
 * That is not a bug to chase. Giving the trigger a client-side ordering override
 * would make it lie convincingly, and a second source of board order is the exact
 * thing the ranking-is-the-single-authority design exists to remove.
 * `scripts/dev-churn.mjs` changes the published feed and therefore produces a
 * real reorder; these buttons are for watching a beat.
 */

/**
 * The cases the sequence has to be judged at.
 *
 * The first three are the event: a venture crossing *into* the top three, which
 * is the only shape that gets the close-travel-open. Entering at 1 is the
 * loudest and the one most likely to look wrong, because the departing mark
 * crosses the whole board diagonally. The last is the quiet shape — two list
 * rows trading places, which gets a slide and nothing else, and is here so the
 * two can be compared back to back.
 */
const CASES: readonly { label: string; from: number; to: number }[] = [
  { label: '4 → 1', from: 4, to: 1 },
  { label: '4 → 3', from: 4, to: 3 },
  { label: '5 → 2', from: 5, to: 2 },
  { label: '6 → 5 (list)', from: 6, to: 5 },
]

export function DevPodiumTrigger({
  teams,
  onQueued,
  onReset,
}: {
  teams: readonly Team[]
  onQueued: () => void
  onReset: () => void
}) {
  if (process.env.NODE_ENV === 'production') return null

  const ranked = rankTeams(teams)
  const fire = (from: number, to: number) => {
    const attacker = ranked[from - 1]
    const defender = ranked[to - 1]
    if (attacker === undefined || defender === undefined) return
    const event: OvertakeEvent = {
      // The same shape a real event carries, so queue behaviour under repeated
      // clicks is identical to queue behaviour under repeated detection rather
      // than merely similar. `/podium` ranks all-time, which has no week, so the
      // slot a week number occupies on the weekly board is a literal here.
      id: `all:${attacker.teamId}:${to}`,
      attacker: attacker.teamId,
      attackerName: attacker.ventureName,
      defender: defender.teamId,
      defenderName: defender.ventureName,
      fromRank: from,
      toRank: to,
    }
    enqueueKicks('podium', [event])
    onQueued()
  }

  const button: React.CSSProperties = {
    font: 'var(--t-pod-label)',
    letterSpacing: 'var(--track-overline)',
    textTransform: 'uppercase',
    padding: '6px 10px',
    borderRadius: 'var(--radius-xs)',
    border: 'var(--stroke-hair) solid var(--border)',
    background: 'var(--white)',
    color: 'var(--deep-teal)',
    cursor: 'pointer',
  }

  return (
    <div
      style={{
        position: 'fixed',
        // Bottom-right, because the Next dev overlay lives bottom-left and
        // swallows clicks aimed at anything under it.
        //
        right: 'var(--s-4)',
        // **`--s-safe-y`, not a calc over `--h-foot`.** It cleared the frame's
        // footer row, and there is no footer; with the token deleted the whole
        // `calc()` went invalid and this bar jumped to the top of the frame,
        // straight over the masthead.
        bottom: 'var(--s-safe-y)',
        display: 'flex',
        gap: 'var(--s-2)',
        zIndex: 50,
      }}
    >
      {CASES.map((c) => (
        <button key={c.label} type="button" style={button} onClick={() => fire(c.from, c.to)}>
          {c.label}
        </button>
      ))}
      <button
        type="button"
        style={button}
        onClick={() => {
          clearKicks('podium')
          onReset()
        }}
      >
        Reset
      </button>
    </div>
  )
}
