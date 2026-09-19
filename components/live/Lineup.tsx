import Image from 'next/image'

import { PEOPLE_PHOTOS } from '@/config'
import { membersOf, photoSlug } from '@/lib/live'
import type { Team } from '@/lib/types'

/**
 * The team's squad, overlapping in the sheet's header — the way an esports
 * line-up card stacks its players rather than listing them.
 *
 * **No names, and the photographs bleed off the bottom of the header.** The
 * heads are the information; a caption under each 58px crop would be four
 * ellipsised first names. Whose face is whose is answered by the roster the
 * cohort already knows, and by the sheet's own header saying which venture
 * this is.
 *
 * ── A photograph is never requested unless it exists ──
 *
 * Presence is read from `PEOPLE_PHOTOS` in `config.ts`, never from the
 * filesystem — the same rule `LOGOS` follows, and for the same reason: an id
 * in the list with no file behind it is a broken image on somebody's phone,
 * and a file on disk missing from the list is simply invisible. The file and
 * its manifest entry arrive in one commit, written together by
 * `scripts/prepare-people.py`.
 *
 * ── No photograph, no figure ──
 *
 * A student without one used to get a drawn silhouette carrying their
 * initials. Removed on request: the line-up is a photograph of a team, and a
 * drawn stand-in beside real cutouts reads as a gap rather than as a person.
 *
 * **Nothing is invented in its place.** No stock face, no borrowed one — that
 * would be the `LOGOS` mistake with a person's face in it, and this file's
 * whole reason for reading `PEOPLE_PHOTOS` rather than the filesystem is that
 * it will only ever show a photograph that exists.
 *
 * What it costs: a student who missed the shoot is now absent from their
 * team's line-up rather than present as a silhouette, and a team where nobody
 * has a photograph renders no squad at all. In production today that changes
 * nothing — `TV_Feed` publishes no `members` column, so `membersOf` falls back
 * to the photographs themselves and everyone listed has one by construction.
 * It starts to matter the day that column is published.
 */
export function Squad({ team }: { team: Team }) {
  const members = membersOf(team)
  if (members.length === 0) return null

  /**
   * Only the people there is a photograph of, in the roster's own order.
   *
   * This used to sort faces first and stand the silhouettes at the right-hand
   * end, so a missing photograph read as the end of the row rather than as a
   * gap in the middle of it. With no silhouettes left there is nothing to
   * sort: the ones without a photograph simply are not here, and everybody
   * else keeps the order the sheet listed them in.
   */
  const shown = members.filter((name) =>
    PEOPLE_PHOTOS.includes(`${team.teamId}/${photoSlug(name)}`),
  )
  if (shown.length === 0) return null

  return (
    /* ── One frame, and the fade belongs to it ──
     *
     * `.lv-squad` is the frame the whole line-up is drawn into, and
     * `live.css` puts the bottom gradient THERE rather than on each figure.
     * Per figure it made every body translucent in its last fifth, and the
     * figures overlap by nearly half their width, so the person behind showed
     * through the person in front. One frame flattens the group first, so an
     * overlap is opaque and only the outside edge softens. */
    <div className="lv-squad" aria-label={`Team: ${shown.join(', ')}`} role="img">
      {shown.map((name, index) => (
        <Person
          key={name}
          teamId={team.teamId}
          name={name}
          // The left-most sits on top and each one behind the last, so the
          // stack reads front-to-back rather than as a row of half-faces.
          style={{ zIndex: shown.length - index }}
        />
      ))}
    </div>
  )
}

function Person({
  teamId,
  name,
  style,
}: {
  teamId: string
  name: string
  style: React.CSSProperties
}) {
  return (
    <span className="lv-person" style={style} title={name}>
      <Image
        src={`/people/${teamId}/${photoSlug(name)}.webp`}
        alt=""
        width={256}
        height={256}
        unoptimized
      />
    </span>
  )
}
