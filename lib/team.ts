import type { Team } from '@/lib/types'

/**
 * A name with its casing normalised — but **only if the team did not case it
 * themselves.**
 *
 * ── What this replaced ──
 *
 * `text-transform: uppercase` on `.tv-card-name`, `.tv-pod-name` and
 * `.tv-pod-row-name`. Three declarations, and between them they shouted every
 * venture on both slides. That made the board *look* consistent while hiding
 * that the underlying data is not: of the 41 names in the feed, **10 are
 * written ALL CAPS in the sheet and 3 are lowercase.** Deleting the three
 * declarations alone would have exposed that directly — a board where `BLUNNT`
 * shouts next to `snackerly`.
 *
 * ── The rule, and why it is per name rather than per word ──
 *
 * **A name containing both an uppercase and a lowercase letter is printed
 * exactly as the sheet has it.** Anything else — all caps, all lowercase — is
 * lowercased and its first letter raised.
 *
 * The first version of this title-cased every word independently and it was
 * worse, in a way only the real data showed:
 *
 *   The Chips n Dip Story        → The Chips N Dip Story
 *   In Between Sips by Kaappitalism → In Between Sips By Kaappitalism
 *
 * Both of those names arrive from the sheet already correct, and a per-word
 * rule *damaged* them. It also could not tell `ATC (All Things Camphor)` from
 * a stylised all-caps name and rendered it `Atc`, which needed a hand-kept
 * list of acronyms to repair.
 *
 * Asking "did a human case this?" answers all three at once. A team that typed
 * `SoleMate`, or `The Chips n Dip Story`, or `ATC (All Things Camphor)` has
 * demonstrably made casing decisions, and the wall keeps every one of them. A
 * team that typed `XOCO` or `aarambh` has pressed caps-lock or not pressed
 * shift, and that is the only case this touches. **All 41 names in the feed
 * come out right with no exception list at all.**
 *
 * ── What it still cannot do ──
 *
 * A venture whose whole name is an acronym — `SRM`, with no lowercase anywhere
 * to signal intent — comes out `Srm`, and the wall will look entirely
 * deliberate doing it. There is no such name today. The fix when there is one
 * is either a lowercase character in the sheet cell or a verbatim list here,
 * and an empty list kept against that day would be exactly the unexercised
 * machinery this project keeps deleting.
 *
 * **The decision is per name; the rewrite is per word.** Once a name is known
 * to be un-cased there is no intent left in it to preserve, so every word gets
 * its own capital — `CHAKHA NA?` has to reach `Chakha Na?` and not `Chakha
 * na?`. The two halves being at different granularities is the whole trick:
 * the name decides *whether*, the words decide *how*.
 *
 * The first *letter* of a word is raised, not its first character, so a name
 * may begin with a bracket, a quote or a digit and still come out right.
 */
export function titleCase(name: string): string {
  const cased = /\p{Ll}/u.test(name) && /\p{Lu}/u.test(name)
  if (cased) return name

  return name.toLowerCase().replace(/\S+/g, (word) => {
    const first = word.search(/\p{L}/u)
    if (first === -1) return word
    return word.slice(0, first) + word.charAt(first).toUpperCase() + word.slice(first + 1)
  })
}

/**
 * A venture's name, cased for the wall, or its team ID untouched.
 *
 * Placeholder names are already blanked at the parse layer (`lib/feed.ts`), so
 * an unnamed team arrives here with an empty string and carries its team ID
 * rather than a gap. `AGENTS.md` is explicit that such a team competes and fires
 * triggers like any other — the wall celebrates `SLE-C407` by name-or-ID rather
 * than not at all.
 *
 * **The ID deliberately does not go through `titleCase`**, and that is not a
 * detail: it is a code, not a name, and it contains no lowercase, so the rule
 * above would take `SLE-C407` to `Sle-c407` — which looks like a typo on a wall
 * nobody is close enough to query.
 *
 * **Shared, not copied.** It lived privately inside `components/Podium.tsx`
 * until `/daily`'s cards started printing names too. Two boards in one rotation
 * disagreeing about what an unnamed team is called — one showing an ID, the
 * other a blank — is exactly the kind of quiet inconsistency that runs for weeks
 * on a wall nobody is actively watching. It now owns the casing as well, so the
 * same guarantee covers that.
 */
export function nameOf(team: Team): string {
  return team.ventureName ? titleCase(team.ventureName) : team.teamId
}
