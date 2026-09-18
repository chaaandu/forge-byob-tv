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
      /**
       * `/weekly` → `/daily`, and this one *is* permanent.
       *
       * The slide was at `/weekly` until 18 September 2026, when it stopped
       * being a weekly board — it ranks a finished day now, 10:00 to 10:00 —
       * and a route whose name contradicts what it shows is the kind of drift
       * that misleads whoever reads this next.
       *
       * **The redirect exists so nobody has to walk to the TV.** The wall is
       * pointed at a URL once, by hand, and then runs fullscreen and unattended
       * for weeks; `components/Rotator.tsx` is explicit that it must never
       * reload, because a reload drops out of fullscreen for good. A laptop
       * already bookmarked on `/weekly` keeps working, lands on `/daily`, and
       * the rotation carries on from there.
       *
       * `permanent: true` — a 308, where the root's redirect above is a 307,
       * and the difference is deliberate. That one is a routing *decision* that
       * could reasonably change the day this grows a landing page, so it must
       * stay takeable-back from a browser that has cached it for weeks. This
       * one is a rename, and a rename does not get un-made: `/weekly` is not
       * coming back to mean something else, so there is nothing a hard cache
       * could trap us into.
       */
      { source: '/weekly', destination: '/daily', permanent: true },
    ]
  },
}

export default nextConfig
