'use client'

import { devQueueClimb } from '@/lib/devOvertake'
import { rankForMode } from '@/lib/board'
import { clearKicks, enqueueKicks } from '@/lib/storage'
import type { BoardMode, OvertakeEvent, Team } from '@/lib/types'

/**
 * Fire an overtake flip on demand, in development only.
 *
 * An observability affordance, not a feature. The flip fires when a rank changes
 * hands, which on live data happens a few times a day, and the stagger and the
 * travel are both things the spec says to tune *by watching* — which is not
 * possible if watching means waiting.
 *
 * ── It is not a second code path ──
 *
 * The only thing this does that the detector does not is *construct* the event.
 * From there it goes through `enqueueKicks` — the same function, the same
 * localStorage queue, the same replace-by-id, the same cap — and is drained by
 * the same `takeKick` inside `useKick`, which remains the only reader. Nothing
 * here touches `WeeklyGrid` or the cues. What you watch is what live data
 * produces.
 *
 * ── The board snaps back at the end. That is expected ──
 *
 * The cards in a flip are the real cards, and they end the sequence in their new
 * positions. What puts them there permanently is the *data* re-sorting, and this
 * trigger fabricates an event without fabricating the data behind it — so when
 * the held snapshot thaws there is nothing new to apply, and the two cards
 * return to where they started.
 *
 * That is not a bug to chase. Giving the trigger a client-side ordering override
 * would make it lie convincingly, and a second source of card order is the exact
 * thing the grid-is-the-brain design exists to remove. End-to-end verification
 * runs on `scripts/dev-churn.mjs`, which changes the published feed and
 * therefore produces a real reorder; these buttons are for watching a beat.
 */

/**
 * The cases the flip has to be judged at, all of them deliberate.
 *
 * `Δ1` inside a row is the pure exchange the design describes. `Δ1 across rows`
 * is rank 11 taking rank 10 — the two cards are in rows of different heights, so
 * this is the only button that exercises the mid-travel resize, and it is the
 * one most likely to look wrong. `Δ4` moves three uninvolved cards, which is
 * where the sliding cue earns its place.
 */
const CASES: readonly { label: string; from: number; to: number }[] = [
  { label: 'Δ1 in row', from: 6, to: 5 },
  { label: 'Δ1 across rows', from: 11, to: 10 },
  { label: 'Δ4', from: 9, to: 5 },
  { label: 'Δ1 row 2→3', from: 21, to: 20 },
]

export function DevFlipTrigger({
  teams,
  mode = 'challenge',
  week,
  onQueued,
  onReset,
}: {
  teams: readonly Team[]
  /** Ranked the way the board is ranked, so "rank 4 overtakes rank 2" picks the
      two cards actually sitting in those slots. */
  mode?: BoardMode
  week: number | null
  onQueued: () => void
  onReset: () => void
}) {
  if (process.env.NODE_ENV === 'production') return null

  const ranked = rankForMode(mode, teams)
  const fire = (from: number, to: number) => {
    const attacker = ranked[from - 1]
    const defender = ranked[to - 1]
    if (attacker === undefined || defender === undefined) return
    const event: OvertakeEvent = {
      // The same `week:attacker:toRank` shape a real event carries, so queue
      // behaviour under repeated clicks is identical to queue behaviour under
      // repeated detection rather than merely similar.
      id: `${week ?? 'x'}:${attacker.teamId}:${to}`,
      attacker: attacker.teamId,
      attackerName: attacker.ventureName,
      defender: defender.teamId,
      defenderName: defender.ventureName,
      fromRank: from,
      toRank: to,
    }
    // **The data has to move too.** An event on its own animates a climb and
    // then settles onto the board it started from; this records what the climb
    // is worth so the settle has somewhere to arrive. Applied on settle, not
    // here — see lib/devOvertake.ts.
    devQueueClimb(attacker, defender, ranked[to - 2])
    enqueueKicks('weekly', [event])
    onQueued()
  }

  const button: React.CSSProperties = {
    font: 'var(--t-tv-card-label)',
    letterSpacing: 'var(--track-overline)',
    textTransform: 'uppercase',
    padding: '6px 10px',
    borderRadius: 'var(--radius-xs)',
    border: 'var(--stroke-hair) solid var(--border)',
    background: 'var(--white)',
    color: 'var(--midnight-charcoal)',
    cursor: 'pointer',
  }

  return (
    <div
      style={{
        position: 'fixed',
        // Bottom-*right*: Next's dev overlay indicator owns the bottom-left
        // corner and its portal swallows clicks aimed at anything underneath it.
        //
        // **`--s-safe-y`, not a calc over `--h-foot`.** It cleared the frame's
        // footer row, and there is no footer; with the token deleted the whole
        // `calc()` went invalid and this bar jumped to the top of the frame,
        // straight over the masthead.
        bottom: 'var(--s-safe-y)',
        right: 8,
        display: 'flex',
        gap: 6,
        zIndex: 50,
        opacity: 0.55,
      }}
    >
      {CASES.map((c) => (
        <button key={c.label} type="button" style={button} onClick={() => fire(c.from, c.to)}>
          {c.label}
        </button>
      ))}
      {/* Not a recovery path for the wall: it renders only in development,
          nothing schedules it, and no production code calls what it calls. A
          wedged flip in production is a bug to fix, not a state to recover
          from. This exists so one can be cleared without a reload while the
          cause is being found. */}
      <button
        type="button"
        style={button}
        onClick={() => {
          clearKicks('weekly')
          onReset()
        }}
      >
        Reset
      </button>
    </div>
  )
}
