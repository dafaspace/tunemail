# Outstanding — what stands between Tunemail and a store listing

Not a wish list. Everything here is a thing a store reviewer, a bill, or a user
can trip over. Rewritten 11 Oct 2026: the version before this listed as open
three defects that had been fixed on 13 Sep, which is worse than no list.

---

## 0. The order of work

The house rule is: name the few functions that matter, get number one working
on real material, then ship. So the blockers below are ordered by what stops a
build reaching a stranger, not by size.

**Proposed core functions, ranked - awaiting Dafa's confirmation:**

1. **Send a song or playlist that opens on the exact recording, for anyone.**
   A link that works with no app and no account, and lands on the recording
   rather than a search. Measured 15 Sep: 147 of 164 platform links exact on
   the shared JAZZ playlist.
2. **Hear a song and keep it in one tap.** ShazamKit recognition straight into
   a list that can be sent. iOS only. **Built, never run on a real device.**
3. **Bring your music in with its identifiers intact.** CSV with ISRC, round
   trip without loss; the import says whether the file carried ISRCs.
4. **Put it in the library you actually listen with.** Add to Apple Music via
   MusicKit. iOS only, Apple Music subscribers only. **Built, never run.**

Anything not on this list is support, and it should be visible that it is.

---

## 1. Blockers for a first TestFlight build

### 1.1 Xcode cannot sign - only Dafa can fix this

`xcodebuild` for a device fails with `No Account for Team "BMTR6JW8NW"`. The
team id is already in the project (taken from the one code-signing identity on
this machine). What is missing is the Apple ID itself in Xcode, which needs a
password, so it is his to do:

1. Xcode -> Settings -> Accounts -> + -> Apple ID.
2. Target App -> Signing & Capabilities -> + Capability -> **ShazamKit**.
3. developer.apple.com -> Identifiers -> `app.tunemail.mobile` -> **MusicKit**.

### 1.2 Functions 2 and 4 have never met reality

Recognition and Apple Music both compile, register with the bridge and answer
their status calls in the simulator. Neither has heard a real song or added a
real track, because a simulator has no audio and no subscription. Until they
run on a real iPhone they are hypotheses, not features, and the listing must
not mention them.

What to run, in this order:
- the listen button under real music: does it recognise, and does the track
  land in Heard with no second tap?
- "Also to Apple Music": permission prompt, found by ISRC, in the library?
- a recognised track's Spotify and Tidal buttons: the recording, not a search?
- account deletion: email confirmation, and it completes rather than failing.

### 1.3 Apple key 74LFLG28G5

A `.p8` private key was committed to a public repo on 3 Sep and removed from
HEAD. The key itself must be **revoked in the Apple Developer portal**. Never
confirmed done. Assume it is compromised until it is.

### 1.4 Cloudflare: delete DEBUG_KEY

Added 16 Sep only to read why the Spotify token was refused. It gates a
diagnostic and has no other use. Delete it in Workers -> music-night-worker ->
Settings -> Variables and Secrets. Without it the diagnostic answers nobody.

---

## 2. Before the App Store listing, after TestFlight works

The checklist from the portfolio's "Ship it, and do not regret it":

- **Every function on the list above works on real material, checked by
  somebody who is not the author.**
- **A private build to 10-20 people with one instruction: find a link that
  opens the wrong recording.** The whole claim of function 1 is exactness, so
  a wrong link is a refutation rather than a bug, and this is where to find
  them cheaply.
- **Guideline 4.2** (more than a repackaged website): ShazamKit and MusicKit
  are the native behaviour that answers it. This is another reason 1.2 matters
  - without them working, the app is exactly the shape 4.2 names.
- **Guideline 2.3**: the listing describes only what the build does.
- **Privacy**: the policy now covers the microphone (added 15 Sep). App Store
  Connect's privacy labels must match it: account email, playlists, optional
  feedback screenshots, no tracking.

---

## 3. Decided, so not open

- **Recognition is ShazamKit on iOS.** AudD stays switched off
  (`AUDD_ENABLED = false`), worker route and token untouched, so it can return
  in one word. The ~130 lines behind the flag stay until Android is decided.
- **Spotify import is a tool, not a feature.** Development mode serves five
  authorised users and lifting it needs a company with 250,000 monthly users.
  The store builds offer a CSV instead. Catalogue lookups by ISRC use client
  credentials and are NOT subject to that cap - that is how Spotify links are
  exact.
- **Mail** goes through Resend on `mail.tunemail.app`; DKIM, SPF and DMARC pass.

---

## 4. Open, but not blocking a first build

- **Android recognition.** Apple ships a ShazamKit SDK for Android, downloaded
  by hand behind an Apple login and expected to need a developer token minted
  server-side. Unverified. There is also no Java on this machine, so no Android
  build can be made here at all yet.
- **YouTube links are searches.** No credential, and the free quota (10,000
  units a day, 100 per search) is about a hundred tracks a day for the whole
  app. Left as a search on purpose.

---

## 5. Deferred by choice

- **Eight languages**, the way Cinemail does them. Its four traps are written
  down there; the load-bearing one is that `t()` returns the key when a
  translation is missing.
- **The icon map.** Cinemail paints 27 icons through `const ICONS`; Tunemail has
  inline `<svg>`. The family rule means adopting the map, in whole blocks.

---

## Closed since 13 Sep, so the history is not lost

Fixed, each verified by behaviour rather than by reading: spent auth links now
explain themselves; duplicate sign-up no longer promises a letter or writes an
orphan profile; password reset has a timeout and no longer reports success as
failure; a recovery link no longer opens the app on reload; stored XSS through
`public_slug` (client fix plus a database constraint); the shipping app could
not reach the worker at all (CORS); sign-out left the Spotify token on disk;
lookup failures were written to the shared cache as "does not exist"; exact
links were resolved and then discarded; account deletion was blocked by a
foreign key; the Telegram webhook could fail silently; the service worker lost
the whole offline cache to a CDN hiccup and reloaded the page mid-typing.
