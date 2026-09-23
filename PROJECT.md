# PROJECT.md — BYOB Campus TV Wall

The one-read onboarding doc. Verified against the code on **23 September 2026**
(`1fe854b`). Where this and another doc disagree, check the code, then fix
whichever doc is wrong.

Other docs, and what each one is for:

| Doc | What it is | Trust it for |
| --- | --- | --- |
| `AGENTS.md` (loaded via `CLAUDE.md`) | Binding rules and the reasoning behind every design decision. ~77KB, and much of it predates the 19 Sep rebuild. Bullets marked **HISTORICAL** describe `/old/*`. | Rules and "why". Not for "what is on the TV today", which is this file. |
| `docs/SHEET_SETUP.md` | Formulas for the two published tabs in `BYOB_MASTER`, plus a verification checklist | Sheet-side work. It does not yet describe `last7_revenue`. |
| `docs/DESIGN.md` | The original August implementation plan, from before the Forge re-skin | History only. Its dates, routes and team IDs are out of date. |
| `docs/superpowers/` | Specs and plans for individual August features | History |
| `scripts/README.md` | The measurement harness and the asset scripts | Running the scripts |
| `README.md` | Setup and data wiring | Setup |

---

## 1. What this is

A live sales leaderboard for the **BYOB (Build Your Own Business) programme**
at Mesa School of Business, Forge Cohort 1. It has two audiences:

- **The TV wall.** A laptop plugged into a campus TV over HDMI shows full-screen
  slides that rotate every 30 seconds: the all-time ranking of ~37 student
  ventures by proof-backed revenue, and a rolling seven-day board. Nobody
  touches it, and it runs unattended for weeks.
- **`/live`, the phone page.** The same standings, styled like F1 broadcast
  graphics, for students to open on their phones. Each team has a detail sheet
  with its line-up (cutout photographs), product and links.

All data comes from two CSVs published out of a Google Sheet (`BYOB_MASTER`).
There is no backend.

## 2. Why it exists

Student teams sell real products during the programme, and every sale is logged,
with proof, in per-team Google workbooks. A consolidator (Apps Script in
`BYOB_MASTER`, **not in this repo**) rolls all of them up every 10 minutes. This
project turns that rollup into something the cohort sees: a public, always-on
scoreboard in the corridor and on phones. The point is momentum and
competition. When a team passes another, the wall should be where people find
out.

That goal drives the project's bar. **A bug that renders convincingly can run
for weeks on a wall nobody is watching.** Most of the rules in `AGENTS.md`
exist because a board once looked correct while showing something false.

## 3. Current state (23 Sep 2026)

**On the TV, via `/wall`:** `/podium` and `/weekly`, 30 seconds each.

| URL | Serves | Status |
| --- | --- | --- |
| `/wall` | `public/tv/wall.html`, the rotator | **Live. Point the TV here.** |
| `/podium` | `public/tv/ladder.html`, the "BYOB Ladder" (all-time) | In rotation |
| `/weekly` | `public/tv/floor.html`, **rolling last 7 days** (`last7_revenue`) | In rotation since 21 Sep |
| `/daily` | `public/tv/floor.html`, today from midnight IST (`today_revenue`) | Works, **out of rotation** since 21 Sep |
| `/daily?mode=challenge` | `floor.html`, the 10-Day Challenge board (`challenge_revenue`) | Only reachable by URL; see below |
| `/live` | `app/live/`, the React phone page | Live. `/` redirects here (307) |
| `/old/podium`, `/old/daily` | The previous React wall, rotated by `components/Rotator.tsx` | Kept and tested, but not shown |

**Working and tested:** typecheck is clean, `vitest` passes 325 tests in 19
files, and lint shows 0 errors (16 warnings, mostly in scripts).

**Intentionally incomplete or deliberately off:**
- **The 10-Day Challenge cannot appear on the wall right now.** It only ever
  replaced `/daily`, and `/daily` is out of `SLIDES` in `wall.html`. Setting
  `challenge_mode = Yes` in `TV_Cohort` changes nothing on the TV. To run a
  challenge, add `'/daily?mode=challenge'` back to `SLIDES`. The live challenge
  window in `TV_Cohort` ends on 27 Sep 2026.
- **`TV_Feed` does not yet publish `product`, `instagram`, `website` or
  `members`.** They are optional columns (all four already exist in the master's
  `Team Links`). Until they are published, `/live` builds line-ups from the
  photograph manifest, and a student with no photo is invisible. Venture links
  come from the hand-maintained `TEAM_LINKS` in `config.ts`.
- **`LOGOS` is empty**, so every venture mark is a monogram. The 39 PNGs in
  `public/logos/` are the *previous cohort's* logos under renamed filenames. They
  are unread, and must not be added to `LOGOS`.
- **No staleness or error indicator anywhere, by decision.** A dead feed looks
  exactly like a quiet one. Diagnose it in the master's `Sync Status`, not on
  the wall.

**The open piece of work:** port `public/tv/` onto `lib/`. The static wall is a
second implementation of the ranking logic, held in line only by
`lib/tvWall.test.ts`. See §10.

**Known stale docs:**
- `AGENTS.md`'s header table and team-ID line were corrected with this file.
  Deeper bullets still describe the rotation as `/podium` + `/daily` and
  `/weekly` as Monday-to-Sunday.
- The comments in `next.config.ts` still describe the TV as pointed at
  `/daily`.
- `docs/SHEET_SETUP.md` has no section for `last7_revenue`.

## 4. Architecture

```
 team workbooks (×~41) ──consolidator, every 10 min──▶ BYOB_MASTER
                                                         │  TV_Feed, TV_Cohort tabs
                                                         ▼  "Publish to web" as CSV (~5 min cache)
                     ┌───────────────── browser fetch, cache: 'no-store' ─────────────────┐
                     ▼                                                                     ▼
  public/tv/*  (static HTML/JS, the TV)                              app/  (Next.js + React)
   wall.html  → two iframes, swap every 30s                           /live      phone page
   ladder.html, floor.html + tv.js + tv.css                           /old/*     previous wall
   own parser, own comparators, own cache                             lib/       parse, gate, rank
```

Key decisions and why:

- **No backend, ever.** The data is two public published-CSV URLs, fetched
  from the browser with no credentials. No API routes, database or auth, and no
  writes to `BYOB_MASTER`. The Sheets API was costed and rejected: it saves
  about 5 minutes of Google cache, and the 10-minute consolidator stays the
  floor. It would also require sharing the whole master, which holds student
  names and every workbook URL.
- **The TV wall is static files in `public/tv/`, not React.** It paints from
  the `localStorage` cache (`byob-tv.feed`) before anything boots, so a slide
  change never opens on an empty frame. The cost is that `tv.js` duplicates the
  parsing and ranking in `lib/`. That is paid deliberately, and
  `lib/tvWall.test.ts` pins the copies together: comparators, spare-team list,
  programme anchor, people manifest and liveries.
- **The rotation is two iframes, never a page reload.** The TV runs fullscreen
  with nobody at the laptop, and a reload drops out of fullscreen for good.
  `wall.html` loads the next slide 15s early while it is hidden. Slides hold
  their entrance animation (the `holding` class) until `wall.html` posts
  `byob:show`. Each slide is a fresh document every 30s, which is also how a
  deploy reaches the TV (§10).
- **Slides are chosen by `location.pathname`, not a query string.** A Next
  rewrite doesn't change the client URL, so `?board=` in a rewrite destination
  is invisible to the page. That once made `/weekly` serve a flawless *daily*
  board.
- **Ranking is client-side, and the sort is the only authority on order.**
  All-time: revenue desc → units desc → id asc. Period boards (today, week,
  challenge): period revenue desc → *all-time* revenue desc → id asc. Owned by
  `lib/ranking.ts` and mirrored in `tv.js`.
- **Revenue means logged (proof-backed) revenue only.** It is `Daily Dump`
  column N, which is gated upstream on proof = Yes and units ≥ 1. Summing any
  other column would disagree with every other rollup in the programme.
- **Colour is owned by one file per surface.** It is `app/forge-tokens.css`
  for the React app and `public/tv/tv.css` for the static wall. Nothing else
  names a hex. Each venture has a locked livery (`TEAM_LIVERY` in `tv.js`), so
  its colour never changes when it climbs or when a team leaves.
- **Stillness is a feature.** Nothing moves at rest. Motion means something
  happened: a slide arriving, a rank changing, or a sale landing. The one
  looping exception is the crown's glint on rank 1.

## 5. Tech stack

- **Next.js 16.3** (App Router) and **React 19.2**, TypeScript strict. This
  Next has breaking changes versus most training data, so read
  `node_modules/next/dist/docs/` before writing Next code (see `AGENTS.md`).
- **Tailwind v4** via `@tailwindcss/postcss`. It is barely used. Most styling
  is CSS custom properties in `app/*.css`, and see the layering traps in
  `AGENTS.md`.
- **`motion`** (Framer Motion's successor) for row reordering and the overtake
  flip in the React pages. **`papaparse`** for CSV. **`lottie-web`** for the
  festival ornament.
- **Vitest 4** plus jsdom (node environment by default, jsdom per file).
- **Fonts are self-hosted, one per surface.** The static TV wall and `/live`
  use **Archivo** (`public/tv/Archivo-Variable.woff2`,
  `app/live/fonts/`). The old React wall uses **Figtree** (`app/fonts/`).
  `AGENTS.md`'s "the wall ships one face, Figtree" describes `/old/*`. Any face
  must contain the rupee sign **U+20B9**, or `₹` silently renders in a
  fallback font.
- **Hosting:** a static Vercel deploy (`.vercel` is gitignored). No serverless
  functions and no build secrets. The production URL is not recorded in the
  repo.
- **Python 3 asset scripts** (not runtime): Pillow, OpenCV and numpy, `rembg`
  for background removal, and a YuNet face model fetched to `/tmp` on first run.

## 6. Folder / file map

```
public/tv/            THE TV WALL. Static; no build step touches it.
  wall.html             rotator: SLIDES array, 30s period, 15s prefetch
  ladder.html           /podium — all-time Ladder, podium, QR block (copy rotates by IST hour)
  floor.html            /daily, /weekly, ?mode=challenge — one file, board picked by path
  tv.js                 shared: feed URL, parse, SPARES, liveries, comparators, cache, 30s poll
  tv.css                the static wall's colour tokens (only hex file on this surface)
  people.json           GENERATED from config.ts PEOPLE_PHOTOS — never hand-edit
  real-feed.csv         committed feed snapshot (19 Sep) — the fallback when the live fetch fails (!)
  feed.csv, cohort.csv  fixtures
app/
  layout.tsx            root: Figtree, <Rotator/> (only acts on /old/*), <Ganesha/>
  live/                 /live phone page (page.tsx, live.css, Archivo font)
  old/podium, old/daily previous React wall (+ tests)
  forge-tokens.css      the React surface's only hex file; imported LAST, unlayered
  mesa-tv.css, globals.css
components/           React components for /old/* and /live (components/live/)
lib/                  pure logic + hooks, most with *.test.ts beside them
  feed.ts               CSV → Snapshot; required headers; passesRowGate
  ranking.ts            the comparators (single source of truth)
  board.ts              which contest /old/daily shows (challenge_mode)
  live.ts, useLiveData.ts   /live's data + URL sanitising for untrusted links
  overtake.ts, useKick.ts   overtake detection + flip choreography (/old/*)
  daily.ts, schedule.ts     10:00→10:00 locked-day machinery (/old/daily only)
  tvWall.test.ts        holds public/tv/ to lib/ — read this before touching tv.js
  podiumBlocks.ts       GENERATED by scripts/render-podium.mjs
config.ts             every constant: CSV URLs, MIN_TEAM_ROWS, SPARE_TEAM_IDS, LOGOS,
                      TEAM_LINKS, PEOPLE_PHOTOS, programme anchor, festival window
public/people/<TEAM>/<name-slug>.webp   student cutouts (107)
public/podium/blocks.png                rendered podium (scripts/render-podium.mjs)
public/logos/         previous cohort's logos — unread, do not use
scripts/              asset pipeline (python) + measurement harness (measure-*);
                      scripts/dev-* are GITIGNORED — local-only, absent from a fresh clone
mesa_forge_design_system/   Forge C1 brand (purple re-skin of Mesa green)
.claude/skills/mesa-design/ Mesa parent design system (type, spacing)
*.xlsx at root        local exports of the master — gitignored working files
```

## 7. How to run it locally

```bash
git clone https://github.com/chaaandu/FORGE-BYOB-Leaderboard.git
cd FORGE-BYOB-Leaderboard
npm install
npm run dev                 # http://localhost:3000
```

Then open:
- `http://localhost:3000/wall` to see the TV exactly as it runs. Size the
  window to 1920×1080. It scales to fit, but layout is only verified there.
- `http://localhost:3000/podium`, `/weekly` or `/daily` for one slide, held
  still.
- `http://localhost:3000/live` for the phone page. From a phone on the same
  Wi-Fi, use `http://<laptop-ip>:3000/live` (allowed by `allowedDevOrigins`).

It works against the live sheet out of the box, with no env vars needed. Checks
before committing:

```bash
npm run typecheck && npm run test && npm run lint && npm run build
```

Measurement scripts need `npm i -D playwright-core` and a running dev server.
See `scripts/README.md`.

## 8. Environment / config

**No secrets exist in this project.** The published CSV URLs are public by
construction and are committed as defaults in `config.ts` and `public/tv/tv.js`.

| Variable | Effect |
| --- | --- |
| `NEXT_PUBLIC_FEED_CSV_URL` | Overrides `TV_Feed` for the **React pages only** (`/live`, `/old/*`) |
| `NEXT_PUBLIC_COHORT_CSV_URL` | Overrides `TV_Cohort` for the React pages only |

These are build-time values (inlined), so restart `next dev` or redeploy after
changing one. Put them in `.env.local`, which is gitignored. **The static wall
ignores both.** Its feed URL is hard-coded in `public/tv/tv.js`, and it does not
read `TV_Cohort` at all.

Values that live in the **sheet**, not code, so changing them needs no deploy:
the Mesa Flea date, `current_open_week`, the challenge window, and
`challenge_mode`.

Values that must be changed **in code when the cohort changes**:
- `MIN_TEAM_ROWS` (`config.ts`, currently 37). Set it above the real row count
  and every poll is silently rejected forever.
- `SPARE_TEAM_IDS` in `config.ts` **and** `SPARES` in `tv.js`, which must match
  (the test enforces it). This is how a team that left (VBC104 Trigo, VBC138
  SAAJ) or a test workbook (VBC140, VBC141) is hidden.

## 9. Conventions

- **Commit style:** `area: what changed, in a sentence`. Areas include `tv`,
  `wall`, `ladder`, `weekly`, `live`, `people`, `qr`, `perf` and `docs`. The body
  explains why and what was measured. One slice per commit; git is the
  rollback path. Commits by Claude end with a `Co-Authored-By` line.
- **Comments argue.** Code comments record the decision, what it costs, and the
  failure that prompted it, often with dates. Match that density when editing
  nearby code. Don't strip history out of comments.
- **Tests:** pure logic in `lib/` sits beside `*.test.ts`. Load-bearing tests
  are mutation-checked: reintroduce the bug and confirm the test fails. Some
  tests scan *source* (for example, no `Date` in `overtake.ts`, `ranking.ts` or
  `daily.ts`; no hex or `rgba(` under `app/live/`).
- **Layout and colour are verified in a real browser at 1920×1080** by reading
  `getComputedStyle` / `getBoundingClientRect`, not by reading source. Tests do
  not cover layout.
- **Colour:** never hardcode a hex outside `app/forge-tokens.css` or
  `public/tv/tv.css`. Components read surface tokens (`--surface`, `--ink`,
  `--accent` …).
- **Names from the sheet are cased in code** (`titleCase`, per name rather than
  per word), and never with CSS `text-transform`.
- **Money** always goes through `Intl.NumberFormat('en-IN')`, which gives
  `₹1,04,500`.
- **Generated files are never hand-edited:** `public/tv/people.json`
  (`node scripts/export-people-json.mjs`), `lib/podiumBlocks.ts` and
  `public/podium/blocks.png` (`scripts/render-podium.mjs`).
- **Adding or removing a student photo:** write or delete the file under
  `public/people/`, run `python3 scripts/register-people.py` (which updates
  `PEOPLE_PHOTOS`), then `node scripts/export-people-json.mjs`, then
  `npm run test`. Tests fail on a ghost entry, an unlisted file, or one person
  on two teams.
- **The user is non-technical, builds automations, and wants honest pushback.**
  Work detective-style: form a theory, gather evidence, then fix.

## 10. Known gotchas

- **The static wall can silently show 19 September's figures.** In
  `fetchTeams` (`tv.js`), if the live fetch fails or returns a body without
  `team_id` (network error, Google 5xx, or a revoked sheet returning an HTML
  login page), it falls back to the committed `/tv/real-feed.csv` and **writes
  that snapshot into the cache**. The board then renders a perfectly healthy
  week-old standings with nothing to say so. The React side instead keeps the
  last good data and applies `passesRowGate`; the static wall has **no
  row-count gate**. This is the first thing to fix when porting `tv.js` onto
  `lib/`.
- **Two implementations of one ranking.** Any change to parsing, tie-breaks,
  spare teams or the weekly-figure fallback must land in both `lib/` and
  `public/tv/tv.js`. Run `lib/tvWall.test.ts`.
- **`tv.js` and `tv.css` must not be given long cache headers.** The TV never
  reloads its top page, so the slide iframes reloading every 30s is the only way
  a deploy reaches it. Photos and the font *are* cached for a day in
  `next.config.ts`.
- **`/weekly` used to be a 308 redirect to `/daily`.** Browsers cache a 308
  indefinitely, so a machine that saw it may still bounce. Try
  `/weekly?x=1`, and clear site data if that works.
- **`components/Rotator.tsx` only rotates `/old/*`.** Pointing it at the bare
  paths would strand the old wall inside the static slides.
- **Weekly figure fallback:** `last7_revenue` if the cell is present and
  non-blank, otherwise `week_revenue`. The fallback is per field. The latter is
  Monday-anchored and reads ₹0 for most teams on a Monday morning.
- **The programme week anchor is 31 Aug 2026 and must be a Monday.** It is
  written in three places that move together: `TV_Feed!D2`, `current_open_week`
  in `TV_Cohort`, and `PROGRAMME_START_ISO`. There is a fourth copy,
  `PROGRAMME_START` in `ladder.html`, which **no test pins**.
- **CSS traps** (full list in `AGENTS.md`, "Traps that report nothing"):
  - Tailwind utilities lose to unlayered CSS.
  - `.overline` is also a Tailwind utility.
  - A non-existent Tailwind step emits nothing.
  - `corner-shape: squircle` needs about 1.85× the radius.
  - Motion `layout` doesn't work on `<tr>`.
  - A variable-font weight outside its axis gets synthesised.
  - `forge-tokens.css` must stay imported **last** in `globals.css`.
- **`cache: 'no-store'` is required on every fetch**, or the browser serves one
  frozen body for the life of the page.
- **The QR on `/podium` is a static `public/tv/qr.svg`.** Its target URL is not
  recorded in the repo, so decode it before changing domains.
- **Consent and identity:** photographs are named students on a public URL. Never
  substitute a stock face or a borrowed logo. A name that doesn't confidently
  match a photo is left out rather than guessed.

## 11. Open questions / next steps

- **Port `public/tv/` onto `lib/`** so the wall and the phone share one
  implementation. This retires the drift risk, and should bring the row gate and
  last-good-data behaviour to the TV (and drop the `real-feed.csv` fallback).
- **Publish the four optional `TV_Feed` columns** (`product`, `instagram`,
  `website`, `members`). Each is one `INDEX`/`MATCH` from `Team Links`. Then
  `TEAM_LINKS` in `config.ts` can go.
- **Is `/daily` coming back into rotation?** It would need to return for any
  future 10-Day Challenge (as `/daily?mode=challenge`).
- **Staleness is invisible by decision.** If the wall freezing unnoticed
  becomes a real problem, the stamp's history is in `AGENTS.md` (`b01eb5d`).
- **Retire or keep `/old/*`.** It still carries the overtake choreography,
  which the static wall does not have.
- **Tidy the stale docs:** the rotation and `/weekly` bullets in `AGENTS.md`,
  the `next.config.ts` comments, and a `last7_revenue` section for
  `docs/SHEET_SETUP.md`. Update the cohort count if more teams leave.
- **Mesa Flea is 25 Oct 2026** (10:00 IST assumed, set in `TV_Cohort`). Nothing
  on the static wall currently counts down to it.
