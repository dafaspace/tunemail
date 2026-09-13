# Outstanding — what must be settled before Tunemail is submitted

Not a wish list. Everything here is a thing a store reviewer, a bill, or a user
can trip over, written down at the moment it was created so it is not
rediscovered at submission time.

Last touched 13 Sep 2026.

---

## 1. Blockers for submission

### 1.1 Who actually performs recognition, and does the app still claim it?

**State.** AudD is switched off, not removed: `AUDD_ENABLED = false` in
`index.html`. The button, its CSS and ~130 lines of JS are still in the file.
The worker still carries the `/recognize` route, its per-user rate limiter and
the `AUDD_TOKEN` secret. Nothing calls any of it.

**Why it is a blocker.** A submitted build must be honest about what it does. If
recognition ships, the listing, the screenshots and the microphone permission
string all describe it; if it does not ship, the microphone permission must not
be requested at all — an unused permission is a rejection under App Store
5.1.1, and on Android an unused `RECORD_AUDIO` is a Play Data Safety
declaration that does not match the binary.

**Progress, 13 Sep 2026.** ShazamKit is built and working in the **iOS** build:
`mobile/ios/App/App/ShazamPlugin.swift`, registered through
`MainViewController.swift`. Verified in the simulator — the bridge lists
`Shazam`, `isPluginAvailable` answers true, the page resolves
`recogniser: shazam` and the button is present with its accessible name. Web
builds resolve `recogniser: none` and the block is removed from the document.

**Android is not done**, and it is not a copy of the iOS work. Apple ships a
separate ShazamKit SDK for Android, downloaded by hand from the developer
portal rather than fetched from Maven, and it is expected to need a developer
token signed with a private key the way MusicKit does — which would mean
minting it server-side in the worker rather than shipping a key in the app.
**That expectation is unverified**: the download and its documentation sit
behind an Apple login. Confirm it before planning around it, because if a token
is needed it changes the shape of the work.

**The decision to take, and it is one decision, not three:**

- ShazamKit in the native builds only (free with the developer programme, needs
  our own Capacitor plugin, Swift + Kotlin) — then the PWA has no recognition
  and the marketing must not promise it, and the dead AudD code should go.
- Back to AudD everywhere (paid per listen) — then `AUDD_ENABLED = true` and the
  dead code becomes live code again.
- Ship without recognition at all — then remove the AudD code, the button, the
  worker route, the token, and every microphone permission string.

### 1.2 The dead code

~130 lines of AudD JavaScript plus its CSS and markup live in `index.html`
behind a flag, deliberately, so the feature could come back in one word. That
was the right call while the answer was unknown. It stops being right the moment
1.1 is decided: whichever way it goes, one of the two paths becomes dead for
good and should be deleted rather than shipped to a store.

Also check at the same time: `.select('direct_urls, audd_result')` reads a
column named for AudD. If AudD is gone for good, that column and its name
outlive it and should be dealt with deliberately rather than left as a fossil.

### 1.3 Cloudflare

The worker is deployed by hand through the dashboard, and its state is not in
this repo. Before submission, reconcile it:

- `/recognize` — alive, and paid. Keep, or delete with the AudD decision.
- `AUDD_TOKEN` — still a secret in Cloudflare. **Cloudflare does not show a
  secret back.** If it is ever deleted, the token has to come from the audd.io
  account, not from Cloudflare. Removing the secret is the hard kill switch: the
  route then answers "Recognition is not configured".
- Confirm the deployed worker matches `music-night-worker.js` in this repo.
  Deploying by hand means the two can drift silently, and the repo copy is the
  one that gets read.
- Confirm the cron trigger for `/keepalive` is still set in the dashboard. It is
  configured there, not in the code, so it does not travel with a deploy.

### 1.4 Apple key 74LFLG28G5

A `.p8` private key was committed to a public repo and removed from HEAD. The
key itself must be **revoked in the Apple Developer portal**. This has never
been confirmed done. Until it is, assume it is compromised.

---

## 2. Known defects, measured, not yet fixed

From Cinemail's audit of their own auth screens, checked against this file on
13 Sep 2026. Two of their five apply here.

### 2.1 A spent or expired link says nothing

Supabase refuses a used recovery or confirmation link by sending
`error=access_denied&error_code=otp_expired&error_description=...` — in the
fragment or the query, with no tokens and no `type`. We read neither: grep for
`error_code` in `index.html` returns nothing. The init falls through to "no
session" and shows the sign-in screen with no explanation, so someone who
pressed "reset my password" lands on a form asking for the password they do not
have.

Worth knowing, because it makes the shape less mysterious: these tokens are
single use, and mail providers and security scanners **fetch links to check
them**. The scan spends the token. "It worked once and never again" is the
normal presentation.

Fix: read `error` / `error_code` / `error_description` from both the fragment
and the query before creating the client, treat their presence as "arrived from
a link", and say the link is spent with a request-a-new-one control inline.

### 2.2 Signing up twice with one address promises a letter that never comes

With email-enumeration protection on, `signUp` for an existing address returns
HTTP 200 and a **fabricated user** — random id, `created_at` and
`confirmation_sent_at` stamped now — and sends nothing. The only tell is
`identities: []`.

We show "We sent a confirmation link to your inbox." and nothing arrives.

Worse, `index.html` then writes a `profiles` row keyed to that fabricated id, so
every duplicate signup leaves an orphan row belonging to nobody.

Fix: check `data.user.identities.length === 0`, say the account already exists,
offer Sign In and Forgot password with the address prefilled into both, and
guard the profile write.

### 2.3 A stalled password reset never comes back

`updateUser` is awaited with no timeout, so a request that hangs leaves the
button on "…" for ever and the `catch` unreached — indistinguishable from a slow
success. Cinemail hit this and now races a 20 s timeout. `onSignedIn` also needs
to move out of the `try`: a stall after a successful password change is
currently reported as a reset failure, which tells someone their password did
not change when it did.

---

## 3. Deferred by choice

- **Eight languages.** Cinemail ships EN ES FR RU DE IT UA KA through an `I18N`
  map with `data-i18n` attributes, 436 keys. Tunemail is English only. Their
  four traps are written down in their session; the load-bearing one is that
  `t()` returns the key when a translation is missing, so a missing key renders
  as `confirm_delete` on screen in every language.
- **The icon map.** Cinemail paints 27 named icons through a `const ICONS` map
  and an `icon()` helper. Tunemail has 79 inline `<svg>` at their use sites.
  The family rule says contours must be identical, which means adopting the map.
  Convert whole blocks: a half-converted block renders worse than none, because
  a `data-ic` placeholder inside a template string is never filled by a paint
  pass that runs at startup.
- **Friends.** Cinemail has search through an RPC, request/accept/decline,
  two-tap removal and a server-side block. Not obviously wanted here. If it is
  ever built, decide deliberately about their sign-up wall on shared links —
  they describe it as the worst first impression in their app.
