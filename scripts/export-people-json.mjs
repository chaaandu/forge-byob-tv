/**
 * Write `public/tv/people.json` from `PEOPLE_PHOTOS` in `config.ts`.
 *
 * ── Why this exists ──
 *
 * The static wall is served out of `public/` so it paints before Next has
 * booted, which means it cannot import `config.ts`. It reads this JSON
 * instead — a second copy of the one manifest, with all the drift that implies.
 *
 * It drifted. Hand-maintained from 19 September, it was two photographs behind
 * and two ahead by the 22nd: the wall was asking for `VBC110/diya-harish`,
 * which was *deleted* for being the wrong student's face, and for
 * `VBC107/aditi` after that file moved teams — two 404s and two broken images
 * on a wall nobody is watching closely enough to notice. Meanwhile four real
 * photographs, including a whole team's first face, never appeared on the TV
 * at all.
 *
 * So the file is generated and never edited. `scripts/register-people.py`
 * owns `config.ts`; this owns the wall's copy; `lib/tvWall.test.ts` fails the
 * build if they disagree.
 *
 *     node scripts/export-people-json.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'

const OUT = 'public/tv/people.json'

const src = readFileSync('config.ts', 'utf8')
const block = src.match(/PEOPLE_PHOTOS: readonly string\[\] = \[(.*?)\n\]/s)
if (!block) throw new Error('PEOPLE_PHOTOS not found in config.ts')

const photos = [...block[1].matchAll(/'([^']+)'/g)].map((m) => m[1])
if (photos.length === 0) throw new Error('PEOPLE_PHOTOS parsed as empty — refusing to blank the wall')

writeFileSync(OUT, JSON.stringify(photos))
console.log(`${photos.length} photographs -> ${OUT}`)
