import Image from 'next/image'

import { PEOPLE_PHOTOS } from '@/config'
import { initialsOf, membersOf, photoSlug } from '@/lib/live'
import type { Team } from '@/lib/types'

/**
 * The team's line-up: the students behind the venture, the way a race graphic
 * shows a driver.
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
export function Lineup({ team }: { team: Team }) {
  const members = membersOf(team)
  if (members.length === 0) return null

  return (
    <section className="lv-lineup">
      <span className="lv-label">The team</span>
      <div className="lv-lineup-rail">
        {members.map((name) => (
          <Person key={name} teamId={team.teamId} name={name} />
        ))}
      </div>
    </section>
  )
}

function Person({ teamId, name }: { teamId: string; name: string }) {
  const path = `${teamId}/${photoSlug(name)}`
  const hasPhoto = PEOPLE_PHOTOS.includes(path)

  return (
    <figure className="lv-person">
      <span className="lv-person-frame">
        {hasPhoto ? (
          <Image src={`/people/${path}.webp`} alt="" width={200} height={200} unoptimized />
        ) : (
          <PlaceholderPortrait initials={initialsOf(name)} />
        )}
      </span>
      {/* The first name only. Four full names in a 358px rail is four
          ellipses; the whole name is one tap away in the sheet's own header
          and nowhere else it would fit. */}
      <figcaption className="lv-person-name">{name.split(/\s+/)[0]}</figcaption>
    </figure>
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
