import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  /**
   * **Development only: let a phone on the same Wi-Fi load `next dev`.**
   *
   * `/live` is a phone page, and the only honest way to judge one is on a
   * phone. Next 16 answers every `/_next` request from any host but
   * `localhost` with a 403, so opening `http://<laptop-ip>:3000/live` on a
   * phone paints the prerendered header and then nothing — no data, no taps —
   * which looks like a broken page rather than a blocked one. Measured.
   *
   * Private address ranges rather than this laptop's IP, which changes with
   * the network and does not belong in a tracked file. Ignored by
   * `next build` and `next start`; nothing deployed reads it.
   */
  allowedDevOrigins: ['192.168.*.*', '10.*.*.*', '172.*.*.*'],

  /**
   * `/` → `/live`, and nothing else.
   *
   * There is no `app/page.tsx`, so the bare domain used to answer 404. That is
   * the correct HTTP answer and the wrong product answer: a 404 tells whoever
   * typed the domain that the deploy is broken when it is fine. It happened on
   * the first deploy.
   *
   * **It pointed at the wall's own board until 18 September 2026, and the
   * audience is why it moved.** The reasoning then was that the only person
   * typing the bare domain is standing at a TV with an HDMI cable. That stopped
   * being true when `/live` shipped: the wall is set up once, by one person,
   * who can type one more word — and the other hundred and eighteen people are
   * students opening the link on a phone, for whom the standings *are* the
   * product. So the root belongs to them, and the TV gets the explicit
   * `/daily`.
   *
   * (That board was at `/weekly` when this was written and is at `/daily` now.
   * The sentence deliberately does not name the old path, because the entry
   * below is the one place a reader should have to learn that it moved.)
   *
   * **Only the root.** Every other unknown path still 404s, loudly, which is
   * deliberate — `components/Rotator.tsx` explains that a wall pointed at a
   * misspelled URL has to *show* that rather than quietly rotate away from it.
   * A catch-all redirect would hide exactly the mistake worth seeing. This
   * redirect narrows that to the one path where there is no mistake to hide.
   *
   * `permanent: false` — a 307, not a 308. A permanent redirect is cached hard
   * by browsers and would be close to impossible to take back from a TV that
   * has been running for weeks, which is the wrong property for a routing
   * decision that could reasonably change the day this grows a landing page or
   * a third slide.
   *
   * **The TV is unaffected by this.** It is pointed at `/daily` (or
   * `/podium` — the rotation is symmetric, so the entry point only decides
   * which slide is up for the first thirty seconds), and `components/
   * Rotator.tsx` swaps the two every thirty seconds from there. `/live` is not
   * in that rotation and never navigates anywhere.
   */
  async redirects() {
    return [
      { source: '/', destination: '/live', permanent: false },
    ]
  },

  /**
   * ── The three slides are static files, and these are their real addresses ──
   *
   * The wall is drawn in `public/tv/` as plain HTML, CSS and JS rather than as
   * React routes, so the board paints from cached CSV before Next has booted
   * anything — no spinner, no empty frame on a slide change. A rewrite is what
   * lets it keep a URL somebody can type: `/podium`, not `/tv/ladder.html`.
   *
   * A rewrite and not a redirect, deliberately. A redirect would change the
   * address bar, and the TV is set up once by a person typing a URL into a
   * fullscreen browser — a URL that rewrites itself to something longer is a
   * URL that gets written down wrong next time.
   *
   * The previous React design still exists, at `/old/podium` and `/old/daily`.
   * It is not dead code: `render.test.tsx` and `board.test.ts` still hold it to
   * every rule this project has, and it is where the overtake choreography and
   * the daily-window machinery live until the static wall is ported onto them.
   */
  async rewrites() {
    return [
      { source: '/podium', destination: '/tv/ladder.html' },
      { source: '/daily', destination: '/tv/floor.html' },
      /**
       * ── `/weekly` is a board again, and it used to be a 308 ──
       *
       * It redirected permanently to `/daily` from 18 September 2026, on the
       * argument that the slide had stopped being a weekly board and a route
       * whose name contradicts what it shows is drift. It is a weekly board
       * again — `week_revenue`, Monday 00:00 IST to Sunday midnight, anchored
       * at `TV_Feed!D2` — so the redirect is gone.
       *
       * **A 308 is cached by the browser, not just by us.** Any machine that
       * loaded `/weekly` while the redirect was live may hold it indefinitely
       * and never ask the server again — including, most importantly, the
       * laptop driving the wall. It will land on `/daily` and look completely
       * healthy. Clearing site data fixes it; `/weekly?x=1` is the one-off
       * that proves it is what is happening. This is the cost of the
       * `permanent: true` chosen then, and it is the reason the root's
       * redirect above is deliberately a 307.
       *
       * **Both destinations are the bare file.** A `?board=` here would be
       * invisible to the page: a rewrite does not change the client URL, so
       * `location.search` in the browser is empty and the slide would fall
       * back to the day board — `/weekly` served a flawless DAILY leaderboard
       * that way. The slide reads `location.pathname` instead.
       */
      { source: '/weekly', destination: '/tv/floor.html' },
      { source: '/wall', destination: '/tv/wall.html' },
    ]
  },
}

export default nextConfig
