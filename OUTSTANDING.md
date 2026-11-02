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
   a list that can be sent. iOS only. **Runs on a real iPhone (iOS 16.2) since
   11 Oct**: recognised, saved to Heard, answer shown in a card with the links.
3. **Bring your music in with its identifiers intact.** CSV with ISRC, round
   trip without loss; the import says whether the file carried ISRCs.
4. **Put it in the library you actually listen with.** Add to Apple Music via
   MusicKit. iOS only, and offered only to someone whose service is Apple Music
   (learned from the icons they open). **Built, never run on a subscriber.**

Anything not on this list is support, and it should be visible that it is.

---

## 1. Blockers for a first TestFlight build

### 1.1 What has met reality, and what has not

Signing works and the app runs on Dafa's iPhone SE (iOS 16.2) from Xcode.
Checked there, 11-13 Oct:
- recognition hears real songs (two of five missed before the 15 s,
  keep-listening fix; James Blake - I Keep Calling, one of the two, was found
  after it);
- a match lands in Heard with no second tap, shown in the Heard card with the
  links visible without scrolling;
- Spotify, Tidal and Deezer exact by ISRC; Bandcamp exact when the track is on
  the artist's own page (Bolly Beat opened its track page), a search otherwise.

Not yet checked on the device:
- "Add to Apple Music": needs someone with an Apple Music subscription;
- account deletion: email confirmation, and it completes;
- a shared track link opened by someone else, in a messenger.

Paste a link works again since 13 Oct (it called a proxy that answered 404
and 405): Spotify, Deezer and Tidal through music-night-worker's /link with
their ISRC, Apple Music read by the page, YouTube and SoundCloud by title only.
Short links (spotify.link, link.deezer.com, on.soundcloud.com) are handled but
were never tried with a real one.

### 1.2 Apple key 74LFLG28G5 - closed 24 Oct 2026

The `.p8` committed to the public repo (82cfbe1, 24 Aug) is revoked. Checked by
_HQ: a token signed with that file now gets HTTP 401 from Apple. It stays in the
git history, but it is dead, so no history rewrite is needed.

Its replacement is MusicKit key 3GZQ88225M ("Tunemail MusicKit Oct 2026"), bound
to 3T7QAQD48Q.media.app.tunemail. The `.p8` lives at ~/Keys/AuthKey_3GZQ88225M.p8,
outside every repo, with a copy in Dafa's Bitwarden.

**Renewal date: the developer token expires 2027-04-25.** It is the worker
secret APPLE_DEV_TOKEN; when it lapses, /resolve stops finding Apple links.
Renew with `tools/make-apple-token.mjs` and the same key, then Rotate + Deploy
the secret in Cloudflare.

### 1.3 Cloudflare: DEBUG_KEY - closed 24 Oct 2026

Deleted. Dafa's screenshot of music-night-worker's Production variables on
24 Oct shows no DEBUG_KEY; the secrets left are APPLE_DEV_TOKEN,
SPOTIFY_CLIENT_ID/SECRET, SUPABASE_KEY, TELEGRAM_CHAT_ID/TOKEN/WEBHOOK_SECRET and
TIDAL_CLIENT_ID/SECRET. The Spotify/Tidal diagnostic now answers nobody, which is
its safe resting state. The token renewal (1.2) has a reminder in Dafa's Google
Calendar for 5 Apr 2027.

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
