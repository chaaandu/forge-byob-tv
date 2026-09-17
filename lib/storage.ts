import { KICK_QUEUE_CAP } from '@/config'
import type { BoardState, CsvCache, OvertakeEvent } from '@/lib/types'

/**
 * The only module in the project that touches localStorage.
 *
 * ── One key per write pattern ──
 *
 * Only the CSV cache survives the v2 pivot; it is blindly overwritten every 60
 * seconds. The rank state and the animation queue land here again in session 2
 * with their own keys, because their write patterns differ from this one and
 * from each other — merging them would rewrite the whole store 1,440 times a
 * day and multiply the window for a cross-tab clobber by sixty, for nothing.
 *
 * ── Version lives in the key name ──
 *
 * A version bump makes the old key simply *absent*, which routes into the branch
 * the code already has to support for a brand-new TV. Putting a version inside
 * the value would need a migration branch at read time — a second read path, for
 * a store whose entire contents can be rebuilt from the sheet.
 *
 * Bumped to v2 with the six-column feed. Without it, every wall already running
 * would boot holding a v1 cache, throw on it, and log a parse error on first
 * paint until the first fetch landed — noise that reads like a fault and is not.
 */

const PREFIX = 'byob-tv.v2'

/**
 * One key per write pattern, and one board state per board.
 *
 * `/podium` and `/weekly` rank on different figures, so they see different rank
 * changes and must not share a memory of "what the board looked like". A single
 * shared key would have each page overwriting the other's history and both
 * animating nonsense.
 */
export const KEYS = {
  csv: `${PREFIX}.csv`,
  board: (board: string) => `${PREFIX}.board.${board}`,
  queue: (board: string) => `${PREFIX}.queue.${board}`,
  /** `/live`'s followed team. One string, written only when a person taps a star. */
  follow: `${PREFIX}.live.follow`,
} as const

/**
 * Returns `null` for absent, unparseable **and** wrong-shaped.
 *
 * All three route into the same branch — refetch from the sheet — and no repair
 * code exists. The direction of failure is the point: a corrupt store read as
 * "empty, but replay everything" would fire every animation it could find in
 * one tick, in public. Discarding and refetching fails quiet.
 */
function readJson<T>(key: string, isValid: (value: unknown) => value is T): T | null {
  let raw: string | null
  try {
    raw = localStorage.getItem(key)
  } catch {
    // Storage disabled entirely (private mode, blocked cookies). Treat as absent.
    return null
  }
  if (raw === null) return null

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    console.error(`[tv] ${key} was not valid JSON; re-seeding from the sheet.`)
    return null
  }
  if (!isValid(parsed)) {
    console.error(`[tv] ${key} had an unexpected shape; re-seeding from the sheet.`)
    return null
  }
  return parsed
}

/** Deliberately does not catch. A failed write is a real fault and belongs in the console. */
function writeJson(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value))
}

function isCsvCache(value: unknown): value is CsvCache {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Partial<CsvCache>
  return typeof candidate.feedCsv === 'string' && typeof candidate.cohortCsv === 'string'
}

export function readCsvCache(): CsvCache | null {
  return readJson(KEYS.csv, isCsvCache)
}

export function writeCsvCache(cache: CsvCache): void {
  writeJson(KEYS.csv, cache)
}

function isBoardState(value: unknown): value is BoardState {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Partial<BoardState>
  return (
    (candidate.week === null || typeof candidate.week === 'number') &&
    typeof candidate.ranks === 'object' &&
    candidate.ranks !== null &&
    typeof candidate.earned === 'object' &&
    candidate.earned !== null
  )
}

function isEventArray(value: unknown): value is OvertakeEvent[] {
  return (
    Array.isArray(value) &&
    value.every(
      (event) =>
        typeof event === 'object' &&
        event !== null &&
        typeof (event as OvertakeEvent).id === 'string' &&
        typeof (event as OvertakeEvent).attacker === 'string',
    )
  )
}

/** `null` for absent, corrupt or wrong-shaped — all of which mean "seed and stay quiet". */
export function readBoard(board: string): BoardState | null {
  return readJson(KEYS.board(board), isBoardState)
}

export function writeBoard(board: string, state: BoardState): void {
  writeJson(KEYS.board(board), state)
}

/**
 * Append, replacing any event with the same id, then keep the newest
 * `KICK_QUEUE_CAP`.
 *
 * Dropping from the *front* is the whole policy: when more overtakes arrive than
 * the wall can show, the ones worth showing are the recent ones. An animation of
 * a rank change that has since been superseded is a lie told slowly.
 *
 * **A single batch is trimmed from its tail instead, and that is not the same
 * rule.** `detect` sorts one fetch's events biggest climb first precisely so the
 * cap keeps the ones most worth watching — and then the front-drop threw those
 * away, because within one batch the front *is* the best of it. Six events with
 * a cap of four left the wall showing the four smallest moves on the board. The
 * two rules do not conflict once they are applied to the right thing: staleness
 * is about older polls, and importance is about this one.
 */
export function enqueueKicks(board: string, events: readonly OvertakeEvent[]): void {
  if (events.length === 0) return
  const queued = readJson(KEYS.queue(board), isEventArray) ?? []
  const fresh = [...queued]
  for (const event of events.slice(0, KICK_QUEUE_CAP)) {
    const at = fresh.findIndex((existing) => existing.id === event.id)
    if (at === -1) fresh.push(event)
    else fresh[at] = event
  }
  writeJson(KEYS.queue(board), fresh.slice(-KICK_QUEUE_CAP))
}

/**
 * Drop everything waiting.
 *
 * Called on every board mount by `useKick`, which is how a kick left behind by a
 * slide rotation is prevented from playing against a board that re-sorted while
 * it was away, and by the dev triggers' reset. Nothing else in the wall's path
 * calls it — the ordinary drain is `takeKick`.
 */
export function clearKicks(board: string): void {
  writeJson(KEYS.queue(board), [])
}

/**
 * Is anything still waiting behind what is playing?
 *
 * Read by `useKick` and nowhere else, which keeps the one-reader rule intact —
 * this does not consume, so it is not a second drain. It exists because the
 * freeze has to span a whole *batch*: every event in one poll describes a
 * transition out of the board that is currently on screen, so applying the
 * re-sorted snapshot after the first of three would leave the other two
 * describing a board that no longer exists. See the note on `waiting` in
 * `lib/useKick.ts`.
 */
export function hasKicks(board: string): boolean {
  return (readJson(KEYS.queue(board), isEventArray) ?? []).length > 0
}

/**
 * Take the next event, removing it.
 *
 * **Consumed on play-start, not on completion.** If the rotation moves on one
 * second into a three-second kick, that event is gone. The alternative livelocks:
 * a slide given less time than one animation would replay the same kick every
 * rotation forever and everything behind it would starve.
 */
export function takeKick(board: string): OvertakeEvent | null {
  const queued = readJson(KEYS.queue(board), isEventArray) ?? []
  const next = queued[0]
  if (next === undefined) return null
  writeJson(KEYS.queue(board), queued.slice(1))
  return next
}

/**
 * The team a phone follows on `/live`, or `null`.
 *
 * A bare id rather than JSON, and it is only ever *read as a hint*: an id the
 * feed no longer carries simply matches nothing, so there is no shape to
 * validate and nothing to repair.
 */
export function readFollowed(): string | null {
  try {
    const value = localStorage.getItem(KEYS.follow)
    return value === null || value.trim() === '' ? null : value
  } catch {
    return null
  }
}

/**
 * Swallowed, unlike `writeJson`, and the difference is who is holding the
 * device. A wall's failed write is a fault in an unattended system; a phone in
 * private mode refusing a star is a person who still gets their star for the
 * rest of the visit.
 */
export function writeFollowed(teamId: string | null): void {
  try {
    if (teamId === null) localStorage.removeItem(KEYS.follow)
    else localStorage.setItem(KEYS.follow, teamId)
  } catch {
    // Private mode. The in-memory state still holds for this visit.
  }
}
