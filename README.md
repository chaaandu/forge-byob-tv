# BYOB Campus TV Wall

Two pages that run on TVs across Mesa campus during BYOB Cohort 2026: a live
leaderboard and a Mesa Flea countdown with achievement notifications.

- `/podium` — top three across the frame, ranks 4–10 below, and the overtake
  sequence when rank 1 changes hands.
- `/countdown` — the Mesa Flea countdown, milestone takeovers, ambient sub-cards
  and the microsecond ticker.

**This is a display system, not a dashboard.** Nobody interacts with it. It runs
unattended for weeks, refreshes itself, survives network blips, and never asks
for a login. There is no backend, no auth and no database — just a static site
fetching two public CSVs.

The design and the reasoning behind every decision are in
[`docs/DESIGN.md`](docs/DESIGN.md). Read that before changing behaviour.

## Setup

```bash
npm install
npm run dev        # http://localhost:3000/podium
```

The wall will render an empty structure and log a fetch error until the two CSV
URLs are set — see below. Empty is a valid state; it never shows a spinner.

```bash
npm run typecheck  # tsc --noEmit
npm run test       # vitest run
npm run lint
npm run build
```

## Connecting the data

The wall reads two tabs published out of the `BYOB_MASTER` Google Sheet as CSV.
[`docs/SHEET_SETUP.md`](docs/SHEET_SETUP.md) has the formulas to paste and a
verification checklist.

Once both tabs are published, paste their URLs into `config.ts` as the defaults:

```ts
export const FEED_CSV_URL: string = feedUrl(
  process.env.NEXT_PUBLIC_FEED_CSV_URL,
  'https://docs.google.com/.../pub?gid=...&output=csv',
)
```

The published URLs stay in committed config on purpose: they carry no secret,
and a fresh clone or a new Vercel project then just works instead of deploying a
wall that renders perfectly and fetches nothing.

Either can be **overridden** by an environment variable, which is how you point
the wall at local fixtures without editing a tracked file:

| Variable | Overrides |
|---|---|
| `NEXT_PUBLIC_FEED_CSV_URL` | `TV_Feed` |
| `NEXT_PUBLIC_COHORT_CSV_URL` | `TV_Cohort` |

Unset, blank or whitespace all mean "use the published default". The
`NEXT_PUBLIC_` prefix is required — both fetches run in the browser — and it
makes them **build-time** values: changing one on Vercel needs a redeploy, and
changing one in `.env.local` needs `next dev` restarting.

### Running against local fixtures

`scripts/dev-feed.mjs` writes CSVs the dev server happens to serve at `/mock/…`.
Point the wall at them from `.env.local`, which the `.env*` rule already keeps
out of git:

```bash
# .env.local
NEXT_PUBLIC_FEED_CSV_URL=/mock/feed.csv
NEXT_PUBLIC_COHORT_CSV_URL=/mock/cohort.csv
```

Delete the file (and restart `next dev`) to go back to the live sheet. Nothing
in the repository ever records that you did this — which is the point. Editing
the literals in `config.ts` instead is how a fixture path gets committed and
deployed, and it has happened once already.

Three clocks sit between a sale and the screen, and **only the last one is ours**:

| Stage | Cadence |
|---|---|
| Rep logs a sale in their own team workbook → consolidator pulls all 42 into `Daily Dump` | every 10 min |
| Google re-publishes the cached CSV | ~5 min |
| The wall polls | 60 s |

**So a sale reaches the screen in about 9 minutes typically and up to 16 at worst.**
This line used to say "roughly six minutes" in a sentence that named the ten-minute
consolidator immediately before it — six is cache plus poll, measured from the
consolidator *writing*, and it silently dropped the consolidator's own wheel.
(`docs/SHEET_SETUP.md` says six too and is correct: it scopes it to "of the
consolidator writing.")

**Polling faster does not help and neither does the Sheets API.** At 10s the browser
would fetch a byte-identical cached body 29 times out of 30. Reading the master live
through the Sheets API with a key was costed on 13 September 2026 and rejected: it
removes only Google's 5-minute cache, leaving the consolidator's 10-minute floor
untouched, and it requires sharing the *entire* master — `Team Links` column B holds
direct URLs to all 42 team workbooks and column D holds student names. Roughly five
minutes that nobody in a corridor can perceive, against a permanent exposure. **The
consolidator's interval is the only lever that matters**, and it belongs to the master.

## Adding a venture logo

Two steps, in one commit:

1. Drop a **256×256 PNG with a transparent background** at
   `public/logos/<TEAM_ID>.png` — for example `public/logos/SLE-C407.png`.
2. Add that team ID to `LOGOS` in `config.ts`.

```ts
export const LOGOS: readonly TeamId[] = ['SLE-C407', 'SLE-C412']
```

The list is what tells the wall a logo exists, so a broken image is never
requested and there is no error-handler flash. A team not in the list gets a
coloured square with its venture's initial — **currently every team**, since no
logos exist yet, so that treatment is carrying the whole wall.

The client renders whatever it is given. A logo that is the wrong shape or has a
white box behind it will look worse than one that follows the spec.

## Changing the Mesa Flea date

One line in `config.ts`:

```ts
export const FLEA_DATE = new Date('2026-09-06T10:00:00+05:30')
```

Every countdown state — Calm, Aware, Urgent, Final hour, Past — derives from it,
as does the "Doors open at…" copy. Keep the `+05:30` offset: storing an absolute
instant is why the countdown is correct on a laptop set to any timezone.

**The 10:00 opening time is assumed, not confirmed.** That is recorded as a
comment in `config.ts` and deliberately never shown on screen.

## How the two slides rotate

`components/Rotator.tsx` swaps `/daily` and `/podium` every **30 seconds**. It is
mounted once in the root layout and renders nothing.

The swap is a **client-side navigation, never a reload** — the document is never
replaced, so the wall stays fullscreen. That is the whole reason it works this
way: the TV runs fullscreen with nobody at the laptop, and a reload would drop it
to a windowed browser and leave it there for weeks.

Add **`?still`** to either URL to stop the rotation and hold that slide —
`localhost:3000/podium?still`. That is what makes a slide measurable, since
`scripts/measure-fit.mjs` walks four viewport sizes on one URL and would
otherwise be measuring whichever board happened to be up.

If this wall also sits inside a wider campus slideshow, that outer rotation is
someone else's and this project knows nothing about it. **Do not point it at
these two URLs** — two rotators produce a slide that changes early, at irregular
intervals, for no visible reason. Point it at `/daily` alone and let this handle
the rest.

Each page is self-sufficient. On becoming visible it fetches immediately,
reconciles against localStorage to work out what has happened since it was last
on screen, plays anything queued, and settles into its 60-second loop.

**Only a visible page fetches or reconciles.** That one rule makes the wall
correct whether the rotation reloads each URL or keeps both open as tabs — in
the tab case, a hidden page cannot double-fire triggers or clobber the store.

A page shown for the first time, or one whose localStorage has been cleared,
**records everything as already seen and animates nothing.** A TV plugged in
during week five behaves exactly like one that has been running since day one.

## Deployment

A static Vercel site. No environment variables, no serverless functions, no
build secrets. Point a Vercel project at the repo and deploy; the two routes
prerender as static content.

To reset a wall, clear its browser localStorage and reload — it will re-seed from
the sheet and go quiet until something new happens.

## Verifying a change

Unit tests cover the trigger engine and the playback machine, which are pure
functions and where the correctness actually lives. They do not cover layout.

**Layout and colour are verified by measuring the running app at 1920×1080**, not
by reading the source. Three of the bugs found during this build rendered
convincingly and passed typecheck, lint and tests — including a leaderboard row
that overflowed the frame and put rank 10 entirely off-screen with `overflow:
hidden` hiding any sign of it.

A useful check, run in the browser console on either page:

```js
[...document.querySelectorAll('main *')]
  .map(el => ({ el, r: el.getBoundingClientRect() }))
  .filter(({ r }) => r.width > 0 && (r.right > innerWidth + 0.5 || r.left < -0.5))
  .map(({ el }) => el.textContent.trim().slice(0, 30))
```

Anything it returns has escaped the frame and is invisible on the wall.

When fixing a bug with a test, reintroduce the bug first and confirm the test
fails. Every load-bearing test in this repo was verified that way.
