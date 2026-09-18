import Image from 'next/image'

import { PEOPLE_PHOTOS } from '@/config'
import { initialsOf, membersOf, photoSlug } from '@/lib/live'
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
 * ── Until then, everyone gets a drawn portrait ──
 *
 * Not a grey box and not a stock face: a silhouette in the team's own livery
 * with the person's initials. **A photograph of somebody who is not that
 * student would be the `LOGOS` mistake with a person's face in it** — the rule
 * there is that borrowed artwork says something false about who a team is, and
 * a borrowed face says it about who a person is. So the placeholder is
 * obviously a placeholder, and it is the same shape and size as the real
 * thing, so the layout is already the finished one.
 */
export function Squad({ team }: { team: Team }) {
  const members = membersOf(team)
  if (members.length === 0) return null

  return (
    <div className="lv-squad" aria-label={`Team: ${members.join(', ')}`} role="img">
      {members.map((name, index) => (
        <Person
          key={name}
          teamId={team.teamId}
          name={name}
          // The left-most sits on top and each one behind the last, so the
          // stack reads front-to-back rather than as a row of half-faces.
          style={{ zIndex: members.length - index }}
        />
      ))}
    </div>
  )
}

function Person({ teamId, name, style }: { teamId: string; name: string; style: React.CSSProperties }) {
  const path = `${teamId}/${photoSlug(name)}`
  const hasPhoto = PEOPLE_PHOTOS.includes(path)

  return (
    <span className="lv-person" style={style} title={name}>
      {hasPhoto ? (
        <Image src={`/people/${path}.webp`} alt="" width={256} height={256} unoptimized />
      ) : (
        <PlaceholderPortrait initials={initialsOf(name)} />
      )}
    </span>
  )
}

/**
 * Initials in the livery, and **no silhouette behind them.**
 *
 * The first version drew a head and shoulders with the initials over the top;
 * at 68px the two competed and the letters sat in a muddy patch. The disc is
 * already person-shaped by being where a face goes, so the drawing was
 * carrying no information the frame did not — and it cost the one thing the
 * placeholder has to do, which is be legible enough to tell four teammates
 * apart. This is the venture monogram's treatment, at the size a photograph
 * will replace.
 */
function PlaceholderPortrait({ initials }: { initials: string }) {
  return (
    <svg viewBox="0 0 100 100" className="lv-person-placeholder" aria-hidden="true">
      <text x="50" y="50" className="lv-person-initials">
        {initials}
      </text>
    </svg>
  )
}
