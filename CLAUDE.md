# Tunemail - project rules

Project specifics that win over the portfolio rules in `My Apps/CLAUDE.md` where they differ.
The product brief and the long history are in `MSN.md`; what blocks a release is in
`OUTSTANDING.md`; the plan is `PLAN.md`; who else does what, with sources, is `COMPETITORS.md`.

**One sentence:** send a song to anyone: one link opens it in whatever app they use, with your
note on why it is worth hearing.

## Rules learned here

- **Stage files by name, never `git add -A`.** An Apple `.p8` once reached the public repo that way
  (82cfbe1, 24 Aug 2026; the key is revoked).
- **Every new Supabase table gets an explicit grant** in its migration (`grant ... to authenticated`,
  and to `anon` where the page reads it without a session). Since 30 Oct 2026 Supabase no longer
  exposes new `public` tables to the Data API by default; the 7 existing tables are unaffected
  (checked by _HQ, 2 Nov 2026).
- **The worker is deployed by hand** (Cloudflare editor). Commit what was deployed the same day, so
  the repo and the live worker never disagree.
- **The Apple developer token expires 2027-04-25.** Renew with `tools/make-apple-token.mjs`, then
  Rotate + Deploy `APPLE_DEV_TOKEN` (reminder in Dafa's calendar for 5 Apr 2027).
- **Previews:** iTunes previews are streamed from Apple only, never cached or re-hosted; the Deezer
  API is non-commercial only. Neither may be put into our own og:audio, og:video or files.

## Money

Approved by Dafa on 3 Nov 2026. Evidence and sources: `COMPETITORS.md`.

1. **Who pays.** Nobody today. The market is free (song.link, the built-in Share buttons, Apple Music's
   own free playlist transfer) and nobody has shown they would pay. Candidates, both untested: Apple
   pays a one-off for each new Apple Music member arriving through a partner link; and a recording
   contributor (producer, composer, engineer) might pay $29 a year for a page of their released work.
2. **Fastest route to the first paying stranger.** Apply to the Apple Performance Partner Program
   (30 min). Blocks: Apple's selective admission; the payout per member is unpublished. For the
   contributor page: no conversation held yet, and Paddle's acceptance of a seller from Georgia is
   unchecked.
3. **Free, product, paid.**
   - Free tool search finds: the converter on tunemail.app, no sign-in (live since v93, 3 Nov 2026).
   - The product it leads to: the app (hear a song and keep it, playlists with a note, one link that
     opens for anyone).
   - The paid part: none yet. The experiment is the contributor page (PLAN.md, stage 3): $29 a year,
     second price $49 once if a year puts people off.
4. **Instead of money, until the experiment says otherwise:** live feedback (open to guests since
   3 Nov); Dafa's name on every shared page; traffic to his other apps; the exact-link engine (ISRC
   to Spotify, Apple Music, Deezer, Tidal, Bandcamp) for Hum and other music projects; weight in the
   portfolio (ShazamKit and MusicKit, not a wrapped website).
5. **Containers.**
   - Feedback: Telegram plus the `feedback` table, guests included. **Exists.**
   - Name: "developed by dafaspace" on every shared page links to dafaspace.com with `?ref=tunemail`.
     **Exists.**
   - Tunemail card on dafaspace.com. **Exists** (since 28 Oct 2026).
   - "From the same author" card for the other apps. **Missing**; only a text link to Cinemail.
   - "Work with me". **Missing**; needs Dafa's public line decided once.
   - Site analytics. **Missing**; Cloudflare Web Analytics approved, waiting for the token.
   - The engine: lives inside music-night-worker; extracted when a second project needs it.
6. **Number and date.** The accuracy benchmark result and stranger conversions per week, on
   1 Dec 2026. The money experiment: three of ten contributors agree to pay, reviewed on 15 Mar 2027.
