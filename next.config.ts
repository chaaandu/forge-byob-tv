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
   * `/` → `/weekly`, and nothing else.
   *
   * There is no `app/page.tsx`, so the bare domain used to answer 404. That is
   * the correct HTTP answer and the wrong product answer: the person who types
   * `forge-byob-tv.vercel.app` is standing at a TV with an HDMI cable, and a
   * 404 tells them the deploy is broken when it is fine. It happened on the
   * first deploy.
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
   * `/weekly` rather than `/podium` because the rotation is symmetric, so the
   * entry point only decides which slide is up for the first thirty seconds —
   * and `/weekly` shows the whole cohort, which is the more useful thing to be
   * looking at while you are still confirming the wall works.
   */
  async redirects() {
    return [{ source: '/', destination: '/weekly', permanent: false }]
  },
}

export default nextConfig
