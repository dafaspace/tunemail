const SUPABASE_URL = 'https://rqruaqoecvpythbvnozf.supabase.co';

// The anon key is public by design - it is already in index.html, and RLS is
// what actually guards the data. Inlining it keeps token verification off the
// service-role key, which used to be its fallback: one missing setting and the
// most powerful secret ended up on the busiest route.
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxcnVhcW9lY3ZweXRoYnZub3pmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyOTY4OTEsImV4cCI6MjA5MTg3Mjg5MX0.3yw1LEN2mvZMg1PXA_IvE0DmNbh4TXNP2uyWRFFJNQo';

// Only the deployed app talks to this worker. Note that CORS is a browser-side
// control and stops nothing outside a browser, so every route that costs money
// or writes data checks a bearer as well.
const ALLOWED_ORIGIN = 'https://tunemail.app';

// AudD rejects anything larger, and there is no point paying to find out.
const MAX_AUDIO_BYTES = 10 * 1024 * 1024;

// A signed-in user may spend this many recognitions per hour. Sign-up is open,
// so a valid token proves only that somebody made an account - without a cap,
// one throwaway account can drain the paid quota.
const RECOGNIZE_PER_HOUR = 20;

const cors = (origin = ALLOWED_ORIGIN) => ({
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Vary": "Origin",
});

const json = (data, status, headers) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });

// Telegram escapes nothing for us. Anything a user typed has to be neutralised
// before it lands in a Markdown payload, or a stray bracket turns into a live
// link and a stray backtick makes Telegram reject the whole message.
function escapeMarkdown(value) {
  return String(value ?? "").replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, "\\$&");
}

// Returns the Supabase user for a bearer token, or null if it is not valid.
async function verifyUser(request, env) {
  const auth = request.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) return null;

  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: auth,
    },
  });
  if (!res.ok) return null;

  const user = await res.json().catch(() => null);
  return user && user.id ? user : null;
}

// Per-user hourly counter. RECOGNIZE_KV is optional: when the namespace is not
// bound the worker still works, it just cannot rate-limit.
async function overRecognizeLimit(env, userId) {
  if (!env.RECOGNIZE_KV) return false;
  const key = `recognize:${userId}`;
  const used = parseInt((await env.RECOGNIZE_KV.get(key)) || '0', 10);
  if (used >= RECOGNIZE_PER_HOUR) return true;
  await env.RECOGNIZE_KV.put(key, String(used + 1), { expirationTtl: 3600 });
  return false;
}


// ── GET /p/{slug} - the card a chat app renders ──────────────────────────────
// GitHub Pages serves one static file to every URL, and no messenger runs
// JavaScript, so a shared link unfurls as a blank card no matter what the app
// does after it loads. Everything built into the share page is invisible at the
// moment a person decides whether to tap. So the card is rendered here.
const esc = (v) => String(v ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

async function sb(path) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    cf: { cacheTtl: 300, cacheEverything: true },
  });
  return r.ok ? r.json() : null;
}


// An attempt to warm the artwork cache from here was removed after measuring:
// iTunes answers 429 to every request from a Worker. Apple limits by IP and
// Cloudflare's egress addresses are shared with an enormous amount of other
// traffic, so the budget is spent before we arrive. No header or retry fixes
// that. The cache is filled from the owner's browser instead, which has its own
// address and demonstrably works.


// ── GET /resolve?isrc=... - the exact record, by code rather than by name ────
// Search cannot find some recordings at all: "Dave Brubeck 40 Days" returns
// eight results without 40 Days among them, the same way "radiohead creep"
// misses Pablo Honey. An ISRC identifies the recording itself, so this finds
// what no amount of matching heuristics can.
//
// This lives on the Worker, unlike the iTunes calls that had to move to the
// browser: the Apple Music API authenticates with a developer token, so its
// limits count per token rather than per address. An authenticated API is safe
// to call from shared infrastructure; an anonymous one is not.
async function resolveIsrc(isrc, env, ctx) {
  const j = (data, status = 200) => new Response(JSON.stringify(data), {
    status,
    headers: { ...cors(), "Content-Type": "application/json", "Cache-Control": "public, max-age=86400" },
  });

  if (!/^[A-Z0-9]{12}$/i.test(isrc)) return j({ error: "bad isrc" }, 400);
  if (!env.APPLE_DEV_TOKEN) return j({ error: "not configured" }, 503);

  // Apple's answer for an ISRC does not change, so a repeat costs nothing.
  const cacheKey = new Request(`https://cache.tunemail/isrc/${isrc}`);
  const cache = caches.default;
  const hit = await cache.match(cacheKey);
  if (hit) return hit;

  let res;
  try {
    res = await fetch(
      `https://api.music.apple.com/v1/catalog/us/songs?filter[isrc]=${encodeURIComponent(isrc)}`,
      { headers: { Authorization: `Bearer ${env.APPLE_DEV_TOKEN}` } }
    );
  } catch (e) {
    return j({ error: "unreachable" }, 502);
  }
  if (!res.ok) {
    // 401 means the token expired - they last six months - and that should be
    // legible rather than showing up as "no match".
    return j({ error: res.status === 401 ? "token expired" : `apple ${res.status}` }, 502);
  }

  const body = await res.json().catch(() => null);
  const song = body?.data?.[0];
  if (!song) {
    const miss = j({ found: false });
    if (ctx) ctx.waitUntil(cache.put(cacheKey, miss.clone()));
    return miss;
  }

  const a = song.attributes || {};
  const out = j({
    found: true,
    isrc,
    artist: a.artistName || null,
    title: a.name || null,
    album: a.albumName || null,
    year: (a.releaseDate || "").slice(0, 4) || null,
    appleUrl: a.url || null,
    preview: a.previews?.[0]?.url || null,
    artwork: a.artwork?.url ? a.artwork.url.replace("{w}", "600").replace("{h}", "600") : null,
  });
  if (ctx) ctx.waitUntil(cache.put(cacheKey, out.clone()));
  return out;
}


// ── Deezer, which a browser cannot call at all ───────────────────────────────
// api.deezer.com sends no Access-Control-Allow-Origin, so every fetch to it
// from the page fails with "TypeError: Failed to fetch" before it reaches the
// network. The app had been calling it directly since the beginning and the
// failure was invisible: the call sat inside a try/catch that returned null,
// which is indistinguishable from "this track is not on Deezer". Measured in
// the live page: 3 of 3 endpoints failed, including the one used for every
// exact Deezer link on every playlist.
//
// So it moves here. Unlike iTunes - which answers 429 to anything from a
// Worker, because Apple counts by address and Cloudflare's egress is shared -
// Deezer's behaviour from here is not something to assume. Every failure
// below returns its real status instead of an empty answer, so if Deezer does
// throttle this it says so rather than looking like an empty catalogue.

const deezerJson = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { ...cors(), "Content-Type": "application/json", "Cache-Control": "public, max-age=86400" },
});

async function deezerGet(path) {
  const r = await fetch(`https://api.deezer.com/${path}`, {
    headers: { "User-Agent": "tunemail/1.0 (+https://tunemail.app)" },
  });
  if (!r.ok) return { __status: r.status };
  const j = await r.json().catch(() => null);
  // Deezer answers 200 with {"error":{...}} for a quota breach, so the status
  // alone does not tell you whether it worked.
  if (j && j.error) return { __status: 429, __detail: j.error.type || "error" };
  return j;
}

// GET /deezer?isrc=... - the exact Deezer track for a code.
async function deezerByIsrc(isrc, ctx) {
  if (!/^[A-Z0-9]{12}$/i.test(isrc)) return deezerJson({ error: "bad isrc" }, 400);

  const cacheKey = new Request(`https://cache.tunemail/dz/${isrc}`);
  const cache = caches.default;
  const hit = await cache.match(cacheKey);
  if (hit) return hit;

  const d = await deezerGet(`track/isrc:${encodeURIComponent(isrc)}`);
  if (d?.__status) {
    // Not cached: a throttle is temporary and must not be remembered as a miss.
    return deezerJson({ error: `deezer ${d.__status}`, detail: d.__detail || null }, 502);
  }
  const out = d?.link
    ? deezerJson({
        found: true, isrc,
        deezer: d.link,
        artwork: d.album?.cover_big || d.album?.cover_medium || null,
        preview: d.preview || null,
        durationMs: d.duration ? d.duration * 1000 : null,
      })
    : deezerJson({ found: false });
  if (ctx) ctx.waitUntil(cache.put(cacheKey, out.clone()));
  return out;
}

// GET /deezer?id=... - what a Deezer track link actually points at.
// Used to check a link somebody typed in, which is the difference between
// trusting a stranger and checking their claim.
async function deezerById(id, ctx) {
  if (!/^\d{1,12}$/.test(id)) return deezerJson({ error: "bad id" }, 400);

  const cacheKey = new Request(`https://cache.tunemail/dzid/${id}`);
  const cache = caches.default;
  const hit = await cache.match(cacheKey);
  if (hit) return hit;

  const d = await deezerGet(`track/${id}`);
  if (d?.__status) return deezerJson({ error: `deezer ${d.__status}` }, 502);
  const out = d?.id
    ? deezerJson({ found: true, artist: d.artist?.name || null, title: d.title || null, isrc: d.isrc || null })
    : deezerJson({ found: false });
  if (ctx) ctx.waitUntil(cache.put(cacheKey, out.clone()));
  return out;
}

// GET /isrc-find?artist=&title=&ms= - the code for a recording that has none.
//
// Name matching alone is not enough. A standard exists in many takes, and a
// wrong ISRC is worse than no ISRC: it produces a link that carries the
// exact-match tick and opens a different record. Duration is the separator.
// Measured across 35 tracks: name matching alone accepted 5 wrong recordings,
// among them a My Favorite Things fifteen minutes from the one asked for; the
// 12s gate rejected all 5 and kept 33.
async function isrcFind(params, ctx) {
  const artist = (params.get("artist") || "").slice(0, 200).trim();
  const title = (params.get("title") || "").slice(0, 200).trim();
  const ms = parseInt(params.get("ms") || "0", 10) || 0;
  if (!artist || !title) return deezerJson({ error: "artist and title required" }, 400);

  const cacheKey = new Request(
    `https://cache.tunemail/find/${encodeURIComponent(artist)}/${encodeURIComponent(title)}/${ms}`
  );
  const cache = caches.default;
  const hit = await cache.match(cacheKey);
  if (hit) return hit;

  // A trailing "- Take 8" or "- Remastered" qualifies the same tune; Deezer
  // files it under the bare title. Artists arrive semicolon-separated from
  // Spotify and comma-separated from CSV; the first is the filing name.
  const bare = (s) => s.split(/\s+-\s+/)[0].trim();
  const lead = artist.split(/[;,]/)[0].trim();
  const short = bare(title);

  const norm = (s) => String(s || "").toLowerCase().normalize("NFKD")
    .replace(/[̀-ͯ]/g, "").replace(/[’'`´]/g, "'")
    .replace(/\s*[\(\[].*?[\)\]]\s*/g, " ")
    .replace(/[^a-z0-9' ]/g, " ").replace(/\s+/g, " ").trim();

  let best = null, bestDrift = Infinity, throttled = null;
  for (const q of [`artist:"${lead}" track:"${short}"`, `${lead} ${short}`]) {
    const s = await deezerGet(`search?q=${encodeURIComponent(q)}&limit=25`);
    if (s?.__status) { throttled = s.__status; continue; }
    for (const c of (s?.data || [])) {
      const ct = norm(c.title), want = norm(short);
      if (ct !== want && !ct.startsWith(want)) continue;
      const ca = norm(c.artist?.name), wa = norm(lead);
      if (!ca.includes(wa) && !wa.includes(ca)) continue;
      const drift = ms ? Math.abs(ms - c.duration * 1000) : 0;
      if (drift < bestDrift) { bestDrift = drift; best = c; }
    }
    if (best && bestDrift <= 4000) break;
  }

  // Nothing was actually asked, so nothing may be concluded - and nothing cached.
  if (!best && throttled) return deezerJson({ error: `deezer ${throttled}` }, 502);

  if (!best || bestDrift > 12000) {
    const miss = deezerJson({ found: false, reason: best ? "duration" : "name" });
    if (ctx) ctx.waitUntil(cache.put(cacheKey, miss.clone()));
    return miss;
  }

  const full = await deezerGet(`track/${best.id}`);
  if (full?.__status) return deezerJson({ error: `deezer ${full.__status}` }, 502);
  const out = full?.isrc
    ? deezerJson({
        found: true, isrc: full.isrc, deezer: full.link || null,
        driftMs: bestDrift,
        artwork: full.album?.cover_big || null, preview: full.preview || null,
      })
    : deezerJson({ found: false, reason: "no-isrc" });
  if (ctx) ctx.waitUntil(cache.put(cacheKey, out.clone()));
  return out;
}


// A signed URL for one screenshot, long enough to still open when the report is
// read days later. Thirty days rather than an hour: this lands in the owner's
// own Telegram, and a bug report whose picture has expired by the time anyone
// looks at it is a bug report without a picture.
async function signScreenshot(path, env) {
  if (!env.SUPABASE_KEY) return null;
  try {
    const r = await fetch(
      `${SUPABASE_URL}/storage/v1/object/sign/feedback-screenshots/${path.split("/").map(encodeURIComponent).join("/")}`,
      {
        method: "POST",
        headers: {
          apikey: env.SUPABASE_KEY,
          Authorization: `Bearer ${env.SUPABASE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ expiresIn: 60 * 60 * 24 * 30 }),
      }
    );
    if (!r.ok) return null;
    const j = await r.json().catch(() => null);
    // The API returns a path beginning with /object/sign/...
    return j?.signedURL ? `${SUPABASE_URL}/storage/v1${j.signedURL}` : null;
  } catch {
    return null;
  }
}


// ── POST /delete-account - required by App Store rule 5.1.1(v) ───────────────
// Deleting an auth user needs the service key, which cannot live in the page, so
// it happens here. The id is never taken from the request: whoever holds a valid
// token deletes themselves and nobody else. Accepting an id from the body would
// turn one leaked token into a way to erase any account.
// Removes every file this account uploaded to the feedback bucket. The upload
// path is `${uid}/${timestamp}.${ext}`, so one prefix covers all of them - which
// is the reason the path was shaped that way rather than being flat.
//
// Done through the Storage API rather than a SQL delete on storage.objects: the
// row and the stored object are two different things, and removing the row can
// leave the file behind.
async function deleteUserScreenshots(uid, env) {
  const h = {
    apikey: env.SUPABASE_KEY,
    Authorization: `Bearer ${env.SUPABASE_KEY}`,
    "Content-Type": "application/json",
  };
  const names = [];

  // A person can send a lot of feedback over a lifetime, so this pages rather
  // than assuming one listing covers it.
  for (let offset = 0; offset < 1000; offset += 100) {
    let page;
    try {
      const r = await fetch(`${SUPABASE_URL}/storage/v1/object/list/feedback-screenshots`, {
        method: "POST",
        headers: h,
        body: JSON.stringify({ prefix: `${uid}/`, limit: 100, offset }),
      });
      if (!r.ok) return { error: `list ${r.status}` };
      page = await r.json();
    } catch {
      return { error: "list unreachable" };
    }
    if (!Array.isArray(page) || !page.length) break;
    for (const o of page) if (o?.name) names.push(`${uid}/${o.name}`);
    if (page.length < 100) break;
  }

  if (!names.length) return { removed: 0 };

  try {
    const r = await fetch(`${SUPABASE_URL}/storage/v1/object/feedback-screenshots`, {
      method: "DELETE",
      headers: h,
      body: JSON.stringify({ prefixes: names }),
    });
    if (!r.ok) return { error: `remove ${r.status}` };
  } catch {
    return { error: "remove unreachable" };
  }
  return { removed: names.length };
}

async function deleteAccount(request, env) {
  const j = (data, status) => json(data, status, cors());

  const user = await verifyUser(request, env);
  if (!user) return j({ error: "Sign in first" }, 401);
  if (!env.SUPABASE_KEY) return j({ error: "Not configured" }, 503);

  // Uploaded files first. storage.objects has no foreign key to auth.users, so
  // no cascade reaches them: deleting the account would leave every screenshot
  // sitting in a public bucket, still served, with the row that pointed at it
  // gone. The privacy policy says everything goes, so everything has to go.
  //
  // This runs BEFORE the auth delete on purpose. If it fails, the account still
  // exists and the whole thing can be retried; the other order would leave
  // orphans nobody can find the owner of.
  const shots = await deleteUserScreenshots(user.id, env);
  if (shots.error) {
    return j({ error: "Could not delete your uploaded files", detail: shots.error }, 502);
  }

  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${user.id}`, {
    method: "DELETE",
    headers: {
      apikey: env.SUPABASE_KEY,
      Authorization: `Bearer ${env.SUPABASE_KEY}`,
    },
  });

  if (!res.ok) {
    const detail = (await res.text()).slice(0, 160);
    // A foreign key still pointing at auth.users shows up here rather than as a
    // half-deleted account, which is why the cascades are a migration and not a
    // sequence of deletes from the client.
    return j({ error: "Could not delete the account", status: res.status, detail }, 502);
  }

  return j({ deleted: true }, 200);
}

async function sharePage(slug, url) {
  const pls = await sb(`music_playlists?public_slug=eq.${encodeURIComponent(slug)}&is_public=eq.true&select=id,name,description,user_id&limit=1`);
  const pl = pls && pls[0];
  if (!pl) return new Response("Not found", { status: 404 });

  const [profiles, tracks] = await Promise.all([
    sb(`profiles?id=eq.${pl.user_id}&select=display_name,username&limit=1`),
    sb(`playlist_tracks?playlist_id=eq.${pl.id}&select=artist,track_name&order=position&limit=4`),
  ]);

  // The sender's name comes from their id, never from the URL. Taking it from a
  // query parameter would let anyone mint "<trusted name> recommends this",
  // which turns a share link into a phishing tool.
  const who = profiles && profiles[0];
  const fromName = who?.display_name || "";
  const list = tracks || [];

  // Cover art for the card: the first track that has one in the shared cache.
  let art = "";
  if (list.length) {
    const key = (v) => String(v || "").toLowerCase().trim();
    const rows = await sb(
      `track_links?artist=eq.${encodeURIComponent(key(list[0].artist))}` +
      `&track_name=eq.${encodeURIComponent(key(list[0].track_name))}` +
      `&select=artwork_url&limit=1`
    );
    art = (rows && rows[0] && rows[0].artwork_url) || "";
  }

  const appUrl = `https://tunemail.app/?p=${encodeURIComponent(slug)}`;
  const title = pl.name || "A playlist";
  const summary = list.length
    ? list.map((t) => `${t.artist} - ${t.track_name}`).join(" · ")
    : "Open it in whatever you already listen with.";
  const desc = summary.length > 200 ? summary.slice(0, 200).replace(/\s+\S*$/, "") + "…" : summary;

  const html = `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} · Tunemail</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:type" content="music.playlist">
<meta property="og:site_name" content="Tunemail">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(url.href)}">
${art ? `<meta property="og:image" content="${esc(art)}"><meta property="og:image:width" content="600"><meta property="og:image:height" content="600">` : ""}
<meta name="twitter:card" content="${art ? "summary_large_image" : "summary"}">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
${art ? `<meta name="twitter:image" content="${esc(art)}">` : ""}
<style>
*{box-sizing:border-box}
body{margin:0;background:#0d0d1a;color:#f0f0f0;line-height:1.6;padding:24px;
     font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
     display:flex;min-height:100vh;align-items:center;justify-content:center}
.card{max-width:420px;width:100%}
.brand{font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:#7c3aed;font-weight:700;margin-bottom:14px}
.from{font-size:15px;margin:0 0 14px}.from b{color:#a78bfa}
.row{display:flex;gap:16px;align-items:center}
img{width:104px;height:104px;border-radius:10px;flex-shrink:0;object-fit:cover;background:#1a1a2e}
h1{font-size:24px;line-height:1.2;letter-spacing:-.01em;margin:0 0 6px;text-wrap:balance}
.meta{color:#9a9aa6;font-size:14px;margin:0}
ul{margin:18px 0 0;padding:0;list-style:none;color:#b6b6c2;font-size:14px}
li{padding:3px 0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cta{display:block;margin-top:22px;background:#7c3aed;color:#fff;text-align:center;
     text-decoration:none;font-weight:600;padding:15px;border-radius:12px;font-size:16.5px}
.sub{color:#9a9aa6;font-size:13px;text-align:center;margin-top:12px}
</style></head><body><div class="card">
<div class="brand">Tunemail</div>
${fromName ? `<p class="from"><b>${esc(fromName)}</b> sent you this</p>` : ""}
<div class="row">
  ${art ? `<img src="${esc(art)}" alt="">` : ""}
  <div>
    <h1>${esc(title)}</h1>
    <p class="meta">${list.length ? `${list.length}${list.length === 4 ? "+" : ""} track${list.length === 1 ? "" : "s"}` : "Playlist"}</p>
  </div>
</div>
${list.length ? `<ul>${list.map((t) => `<li>${esc(t.artist)} - ${esc(t.track_name)}</li>`).join("")}</ul>` : ""}
<a class="cta" href="${esc(appUrl)}">Listen &rarr;</a>
<p class="sub">Opens in whatever you already use. No app, no account.</p>
</div></body></html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

// ── Telegram webhook: check it, and put it back ─────────────────────────────
// Feedback replies stopped arriving. Cloudflare's log shows POST
// /telegram-webhook on 27 August and nothing since, so the code that handles a
// reply was never reached - Telegram had stopped delivering.
//
// A webhook registration is a piece of state living on Telegram's servers,
// which nothing in this repo deploys and nothing here can see. It can be
// cleared by deleting and recreating the bot, by another setWebhook call, or by
// Telegram itself after enough consecutive failures. Whatever removed it, the
// symptom is silence, and silence looks exactly like "nobody replied".
//
// So the cron checks it. Registration is idempotent, the check costs one API
// call every ten minutes, and the worst case is that the webhook can now only
// be missing for ten minutes rather than for a week nobody noticed.
const WEBHOOK_URL = "https://music-night-worker.dafa4me.workers.dev/telegram-webhook";

async function telegramWebhookInfo(env) {
  if (!env.TELEGRAM_TOKEN) return { ok: false, detail: "no bot token" };
  try {
    const r = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_TOKEN}/getWebhookInfo`);
    const j = await r.json().catch(() => null);
    if (!r.ok || !j?.ok) return { ok: false, detail: j?.description || `telegram ${r.status}` };
    return { ok: true, info: j.result };
  } catch {
    return { ok: false, detail: "unreachable" };
  }
}

async function setTelegramWebhook(env) {
  if (!env.TELEGRAM_TOKEN || !env.TELEGRAM_WEBHOOK_SECRET) {
    return { ok: false, detail: "not configured" };
  }
  try {
    const r = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_TOKEN}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: WEBHOOK_URL,
        secret_token: env.TELEGRAM_WEBHOOK_SECRET,
        // Only what this bot actually acts on. Asking for everything means
        // Telegram queues updates nobody reads.
        allowed_updates: ["message"],
      }),
    });
    const j = await r.json().catch(() => null);
    if (!r.ok || !j?.ok) return { ok: false, detail: j?.description || `telegram ${r.status}` };
    return { ok: true };
  } catch {
    return { ok: false, detail: "unreachable" };
  }
}

// Returns what it found and whether it had to act, so the caller can report it.
async function ensureTelegramWebhook(env) {
  const cur = await telegramWebhookInfo(env);
  if (!cur.ok) return { checked: false, detail: cur.detail };

  const url = cur.info?.url || "";
  const healthy = url === WEBHOOK_URL;
  if (healthy) {
    return {
      checked: true,
      repaired: false,
      pending: cur.info?.pending_update_count ?? 0,
      lastError: cur.info?.last_error_message || null,
    };
  }

  const fix = await setTelegramWebhook(env);
  return {
    checked: true,
    repaired: fix.ok,
    was: url || "(none)",
    detail: fix.detail || null,
  };
}


// A WRITE, not a read.
//
// The previous version read one row and the project was threatened with a
// pause anyway, with the cron demonstrably firing: Cloudflare's logs show four
// scheduled runs across the 7 days before the warning, all successful. So the
// trigger was never the problem and neither was the request failing. The only
// assumption left was that Supabase counts a read as activity, and that is not
// something observable from out here.
//
// A row update is a transaction in the database. There is no definition of
// "activity" that excludes one, so this stops depending on their definition.
//
// It needs the service key: the table has RLS on and no policies, because
// nothing else has any business touching it.
async function pingSupabase(env, opts = {}) {
  if (!env.SUPABASE_KEY) return { ok: false, detail: "no service key" };

  // Read the existing value before overwriting it. Checking by hand used to
  // destroy the very evidence it was checking: the call writes, so lastPing
  // always came back as the timestamp of the call itself, and "did the cron
  // run" was unanswerable from the one endpoint built to answer it.
  let previous = null;
  if (opts.reportPrevious) {
    try {
      const g = await fetch(`${SUPABASE_URL}/rest/v1/keepalive?id=eq.1&select=last_ping,source`, {
        headers: {
          apikey: env.SUPABASE_KEY,
          Authorization: `Bearer ${env.SUPABASE_KEY}`,
        },
      });
      if (g.ok) {
        const rows = await g.json().catch(() => null);
        if (Array.isArray(rows) && rows.length) previous = rows[0];
      }
    } catch { /* the write below is what matters; this is only for the report */ }
  }

  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/keepalive?id=eq.1`, {
      method: "PATCH",
      headers: {
        apikey: env.SUPABASE_KEY,
        Authorization: `Bearer ${env.SUPABASE_KEY}`,
        "Content-Type": "application/json",
        // Ask for the row back, so a PATCH that matched nothing is visible.
        // PostgREST answers 204 either way, which reads as success.
        Prefer: "return=representation",
      },
      // The caller says who it is. This stamped "cron" unconditionally, so a
      // manual check wrote a row indistinguishable from a scheduled one - and
      // then the next manual check read that row back and reported the cron as
      // alive. The field built to tell the two apart was recording neither.
      body: JSON.stringify({
        last_ping: new Date().toISOString(),
        source: opts.source || "manual",
      }),
    });
    if (!r.ok) return { ok: false, detail: `supabase ${r.status}` };
    const rows = await r.json().catch(() => null);
    if (!Array.isArray(rows) || !rows.length) {
      return { ok: false, detail: "keepalive row missing - run migration 010" };
    }
    return { ok: true, lastPing: rows[0].last_ping, previous };
  } catch (e) {
    return { ok: false, detail: "unreachable" };
  }
}

export default {
  // Supabase pauses a free project after a week without API activity and drops
  // its DNS record with it - the whole app dies until someone restores it by
  // hand. A cron trigger here keeps the counter at zero whether or not anybody
  // opened the app.
  //
  // IMPORTANT: this handler existing is not the same as it running. The
  // schedule is a separate setting in the Cloudflare dashboard - Settings,
  // Trigger Events, Cron Triggers - and pasting new code into the editor does
  // NOT create or preserve it. Deploy the worker and the handler is there;
  // forget the trigger and it is never called, silently, for as long as it
  // takes somebody to notice the project being threatened with a pause.
  //
  // Check it is armed with: GET /keepalive?check=1
  async scheduled(event, env, ctx) {
    ctx.waitUntil((async () => {
      const res = await pingSupabase(env, { source: "cron" });
      if (!res.ok) {
        // Better to be told the alarm is broken than to find out from Supabase.
        await notifyOwner(env, `Keep-alive failed: ${res.detail}. The project may pause.`);
      }
      // No KV binding needed: the write records its own timestamp, so the
      // question "when did this last run" is answered by the thing it does
      // rather than by a second system that also has to be set up.

      // And while we are here anyway, make sure Telegram still knows where to
      // deliver. Only says anything when it had to act - a message every ten
      // minutes saying "still fine" is a message nobody reads.
      const tg = await ensureTelegramWebhook(env);
      if (tg.repaired) {
        await notifyOwner(env, `Telegram webhook was missing (was: ${tg.was}) and has been re-registered.`);
      } else if (tg.checked === false) {
        await notifyOwner(env, `Could not check the Telegram webhook: ${tg.detail}`);
      }
    })());
  },

  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === "POST" && url.pathname === "/delete-account") {
      return deleteAccount(request, env);
    }

    // GET /keepalive - the same ping the cron does, callable by hand, so
    // "is the trigger actually set" is a question with an answer rather than
    // something to be inferred from Supabase's warning emails.
    // GET /telegram-status - what Telegram thinks the webhook is, and a repair
    // if it disagrees. No token passes through the caller's hands; the worker
    // already holds it. Nothing secret is returned: the URL is our own, and the
    // rest is delivery health.
    if (request.method === "GET" && url.pathname === "/telegram-status") {
      const info = await telegramWebhookInfo(env);
      if (!info.ok) return json({ error: info.detail }, 502, cors());
      const i = info.info || {};
      const healthy = i.url === WEBHOOK_URL;
      let repaired = null;
      if (!healthy && url.searchParams.get("fix") === "1") {
        const fix = await setTelegramWebhook(env);
        repaired = fix.ok ? true : fix.detail;
      }
      return json(
        {
          registered: !!i.url,
          pointsHere: healthy,
          url: i.url || null,
          pendingUpdates: i.pending_update_count ?? 0,
          // The reason Telegram gives up, when it does. A run of these is what
          // turns a working webhook into a missing one.
          lastError: i.last_error_message || null,
          lastErrorAt: i.last_error_date
            ? new Date(i.last_error_date * 1000).toISOString()
            : null,
          hasSecret: !!i.has_custom_certificate || undefined,
          repaired,
        },
        200,
        cors()
      );
    }

    if (request.method === "GET" && url.pathname === "/keepalive") {
      const res = await pingSupabase(env, { reportPrevious: true });
      const prev = res.previous;
      const ageSec = prev?.last_ping
        ? Math.round((Date.now() - new Date(prev.last_ping).getTime()) / 1000)
        : null;
      return json(
        {
          wrote: res.ok,
          detail: res.detail || null,
          // What this call just wrote. Calling by hand is itself a keep-alive.
          lastPing: res.lastPing || null,
          // What was there BEFORE this call, which is the part that answers
          // whether anything other than you is writing.
          previousPing: prev?.last_ping || null,
          previousSource: prev?.source || null,
          previousAgeSeconds: ageSec,
          // With a 10-minute schedule, a previous write by "cron" less than
          // ~700s old means the schedule is running. Said in words so the
          // answer does not depend on doing the arithmetic.
          cronLooksAlive:
            prev?.source === "cron" && ageSec !== null && ageSec < 700,
        },
        res.ok ? 200 : 502,
        cors()
      );
    }

    if (request.method === "GET" && url.pathname === "/resolve") {
      return resolveIsrc(url.searchParams.get("isrc") || "", env, ctx);
    }

    if (request.method === "GET" && url.pathname === "/deezer") {
      const byId = url.searchParams.get("id");
      return byId
        ? deezerById(byId, ctx)
        : deezerByIsrc(url.searchParams.get("isrc") || "", ctx);
    }

    if (request.method === "GET" && url.pathname === "/isrc-find") {
      return isrcFind(url.searchParams, ctx);
    }

    if (request.method === "GET" && url.pathname.startsWith("/p/")) {
      return sharePage(url.pathname.slice(3), url);
    }

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: cors() });
    }

    // POST /recognize - proxies to AudD with the token from the secrets, so the
    // paid token never reaches the client. index.html is public; a token in it
    // is a token anyone can spend.
    if (request.method === "POST" && url.pathname === "/recognize") {
      const fail = (status, error) => json({ status: "error", error }, status, cors());

      if (!env.AUDD_TOKEN) return fail(500, "Recognition is not configured");

      const user = await verifyUser(request, env);
      if (!user) return fail(401, "Sign in to identify songs");

      if (await overRecognizeLimit(env, user.id)) {
        return fail(429, "Too many songs identified in the last hour");
      }

      let file;
      try {
        file = (await request.formData()).get("file");
      } catch {
        return fail(400, "Could not read the recording");
      }
      if (!file || typeof file === "string") return fail(400, "No recording sent");
      if (file.size === 0) return fail(400, "The recording is empty");
      if (file.size > MAX_AUDIO_BYTES) return fail(413, "The recording is too long");

      const outgoing = new FormData();
      outgoing.append("file", file, "recording.webm");
      outgoing.append("api_token", env.AUDD_TOKEN);
      outgoing.append("return", "apple_music,spotify,deezer");

      let auddRes;
      try {
        auddRes = await fetch("https://api.audd.io/", { method: "POST", body: outgoing });
      } catch {
        return fail(502, "Could not reach the recognition service");
      }

      const body = await auddRes.text();
      return new Response(body, {
        status: auddRes.ok ? 200 : 502,
        headers: { ...cors(), "Content-Type": "application/json" },
      });
    }

    // POST /feedback-notify - sends the Telegram notification.
    // The client already sends a bearer; before, this route ignored it, so
    // anyone could push arbitrary text into the owner's chat.
    if (request.method === "POST" && url.pathname === "/feedback-notify") {
      const user = await verifyUser(request, env);
      if (!user) return json({ error: "Unauthorized" }, 401, cors());

      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: "Bad request" }, 400, cors());
      }

      const { feedback_id, type, message, user_name, app, screenshot_url } = body;
      if (app !== "music-night") return json({ error: "Bad request" }, 400, cors());
      if (!/^[a-f0-9-]{36}$/.test(String(feedback_id || ""))) {
        return json({ error: "Bad request" }, 400, cors());
      }

      const typeEmoji = { bug: "🔧", idea: "💡", other: "💬" }[type] || "💬";
      // The id goes FIRST: the regex on the way back takes the first match, and
      // everything below this line is text the user controls.
      // The bucket is private, so what arrives is a storage PATH, not a URL, and
      // it has to be signed before the owner can open it. Signing here also
      // settles the injection question the old public-URL check was for: the
      // link put into Telegram is one this worker minted, so the client cannot
      // choose the destination at all - only which of its own files is shown.
      //
      // The path is pinned to the caller's own id. Without that, one valid
      // token could ask for a signed URL to anybody's screenshot.
      let shot = null;
      const rawPath = String(screenshot_url || "");
      if (rawPath && rawPath.startsWith(`${user.id}/`) && !rawPath.includes("..")) {
        shot = await signScreenshot(rawPath, env);
      } else if (/^https:\/\/rqruaqoecvpythbvnozf\.supabase\.co\/storage\/v1\/object\/public\//.test(rawPath)) {
        // Written while the bucket was still public. Kept working rather than
        // broken, but nothing new takes this path.
        shot = rawPath;
      }

      const text =
        `\`id:${feedback_id}\`\n${typeEmoji} *Tunemail Feedback*\n\n` +
        `👤 ${escapeMarkdown(user_name)}\n📝 ${escapeMarkdown(message)}` +
        // Inside a MarkdownV2 link target only ")" and "\\" need escaping. Running
        // the URL through escapeMarkdown instead would litter it with backslashes
        // and Telegram would refuse the whole message.
        (shot ? `\n\n[\u{1F4CE} Screenshot](${shot.replace(/[)\\]/g, "\\$&")})` : "");

      try {
        const tg = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: env.TELEGRAM_CHAT_ID,
            text,
            parse_mode: "MarkdownV2",
          }),
        });
        // A rejected send used to pass silently and the feedback vanished.
        if (!tg.ok) return json({ error: "Notification failed" }, 502, cors());
      } catch {
        return json({ error: "Notification failed" }, 502, cors());
      }

      return new Response("OK", { status: 200, headers: cors() });
    }

    // POST /telegram-webhook - takes replies from Telegram back into Supabase.
    // This route writes with the service-role key, so it must be certain the
    // request really came from Telegram: the secret token is set when the
    // webhook is registered, and Telegram sends it on every update.
    if (request.method === "POST" && url.pathname === "/telegram-webhook") {
      if (!env.TELEGRAM_WEBHOOK_SECRET) return new Response("Not configured", { status: 500 });
      if (request.headers.get("X-Telegram-Bot-Api-Secret-Token") !== env.TELEGRAM_WEBHOOK_SECRET) {
        return new Response("Forbidden", { status: 403 });
      }

      let update;
      try {
        update = await request.json();
      } catch {
        return new Response("OK", { status: 200 });
      }

      const message = update.message;
      if (!message || !message.reply_to_message) return new Response("OK", { status: 200 });

      // Second gate: only the owner's own chat may answer.
      if (String(message.chat?.id) !== String(env.TELEGRAM_CHAT_ID)) {
        return new Response("Forbidden", { status: 403 });
      }

      const originalText = message.reply_to_message.text || "";
      const match = originalText.match(/^`?id:([a-f0-9-]{36})/m);
      if (!match) return new Response("OK", { status: 200 });

      const feedbackId = match[1];
      // Photo, voice and sticker replies carry no .text - the caption is the
      // next best thing, and with neither there is nothing to deliver.
      const replyText = message.text || message.caption;
      if (!replyText) {
        await notifyOwner(env, "That reply had no text, so nothing was sent. Reply in words.");
        return new Response("OK", { status: 200 });
      }

      let updated = [];
      try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/feedback?id=eq.${feedbackId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "apikey": env.SUPABASE_KEY,
            "Authorization": `Bearer ${env.SUPABASE_KEY}`,
            // return=representation so a PATCH that matched nothing is visible:
            // PostgREST answers 204 either way, which used to read as success.
            "Prefer": "return=representation",
          },
          body: JSON.stringify({
            reply: replyText,
            replied_at: new Date().toISOString(),
            read_by_user: false,
          }),
        });
        if (res.ok) updated = await res.json().catch(() => []);
      } catch {
        updated = [];
      }

      await notifyOwner(
        env,
        updated.length ? "Reply sent to user" : "That feedback no longer exists, nothing was sent."
      );
      return new Response("OK", { status: 200 });
    }

    return new Response("Not found", { status: 404, headers: cors() });
  },
};

async function notifyOwner(env, text) {
  try {
    await fetch(`https://api.telegram.org/bot${env.TELEGRAM_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text }),
    });
  } catch {
    /* the confirmation is a convenience; losing it must not fail the request */
  }
}
