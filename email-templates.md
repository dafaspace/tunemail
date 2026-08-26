# Supabase auth email templates

These live in the Supabase dashboard (Authentication → Emails), which means
they are the one part of the product with no version history and no review.
They are kept here so a change is visible in a diff like everything else.

Paste each **Body** into the matching template's Source view, and the
**Subject** into its Subject field.

## Rules these follow

- No em dashes and no emoji. Same house rule as the app.
- Every link is `{{ .SiteURL }}?token_hash={{ .TokenHash }}&type=<type>`.
  The app reads `token_hash` and `type` from the query string and calls
  `verifyOtp`, so the type string has to match exactly: `email`, `recovery`,
  `magiclink`, `email_change`, `invite`.
- Contrast measured against the `#0d0d1a` card, not guessed:

  | colour | ratio | used for |
  |---|---|---|
  | `#f0f0f0` | 16.9:1 | headings |
  | `#c9c7d4` | 12.0:1 | body |
  | `#9a9aa6` | 6.93:1 | secondary and the footer line |
  | `#fff` on `#7c3aed` | 5.70:1 | the button |

  The original templates used `#444` for the footer, which measures 1.98:1 and
  is effectively invisible.
- One tagline, matching the app: "Share music that opens wherever they listen".
  The old one ("Share playlists across every streaming service") was dropped
  from the app for over-promising and should not survive in email.
- The button is a real `<a>` with padding, not an image, so it works with
  images off. Every mail carries the same URL as plain text underneath,
  because a proportion of clients strip buttons entirely.

---

## 1. Confirm signup

**Subject:** `Welcome to Tunemail`

```html
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#0d0d1a;color:#f0f0f0;border-radius:12px">
  <div style="font-size:28px;font-weight:900;letter-spacing:2px;margin-bottom:8px">
    <span style="color:#7c3aed">TUNE</span>MAIL
  </div>
  <p style="color:#9a9aa6;font-size:14px;margin:0 0 24px">Share music that opens wherever they listen</p>

  <p style="font-size:16px;margin:0 0 12px">One tap and you are in.</p>
  <p style="color:#c9c7d4;font-size:14px;line-height:1.6;margin:0 0 24px">
    Confirm this address and your playlists, your tracks and your picks are yours to send.
  </p>

  <a href="{{ .SiteURL }}?token_hash={{ .TokenHash }}&type=email"
     style="display:inline-block;background:#7c3aed;color:#fff;font-weight:700;font-size:15px;padding:14px 28px;border-radius:8px;text-decoration:none;letter-spacing:1px">CONFIRM MY ACCOUNT</a>

  <p style="color:#9a9aa6;font-size:12px;line-height:1.6;margin:24px 0 0">
    Or paste this into your browser:<br>
    <span style="color:#b69bff;word-break:break-all">{{ .SiteURL }}?token_hash={{ .TokenHash }}&type=email</span>
  </p>

  <p style="color:#9a9aa6;font-size:11px;margin:32px 0 0">
    Did not sign up? Ignore this email and nothing happens.
  </p>
</div>
```

---

## 2. Reset password

**Subject:** `Reset your Tunemail password`

```html
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#0d0d1a;color:#f0f0f0;border-radius:12px">
  <div style="font-size:28px;font-weight:900;letter-spacing:2px;margin-bottom:8px">
    <span style="color:#7c3aed">TUNE</span>MAIL
  </div>
  <p style="color:#9a9aa6;font-size:14px;margin:0 0 24px">Share music that opens wherever they listen</p>

  <p style="font-size:16px;margin:0 0 12px">Set a new password</p>
  <p style="color:#c9c7d4;font-size:14px;line-height:1.6;margin:0 0 24px">
    This link opens Tunemail and takes you straight to a new password. It works
    once, and it expires in an hour.
  </p>

  <a href="{{ .SiteURL }}?token_hash={{ .TokenHash }}&type=recovery"
     style="display:inline-block;background:#7c3aed;color:#fff;font-weight:700;font-size:15px;padding:14px 28px;border-radius:8px;text-decoration:none;letter-spacing:1px">CHOOSE A NEW PASSWORD</a>

  <p style="color:#9a9aa6;font-size:12px;line-height:1.6;margin:24px 0 0">
    Or paste this into your browser:<br>
    <span style="color:#b69bff;word-break:break-all">{{ .SiteURL }}?token_hash={{ .TokenHash }}&type=recovery</span>
  </p>

  <p style="color:#9a9aa6;font-size:11px;line-height:1.6;margin:32px 0 0">
    If you did not ask for this, ignore it. Your password stays as it is, and
    nobody can use this link without your inbox.
  </p>
</div>
```

---

## 3. Magic Link

**Subject:** `Your Tunemail sign-in link`

```html
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#0d0d1a;color:#f0f0f0;border-radius:12px">
  <div style="font-size:28px;font-weight:900;letter-spacing:2px;margin-bottom:8px">
    <span style="color:#7c3aed">TUNE</span>MAIL
  </div>
  <p style="color:#9a9aa6;font-size:14px;margin:0 0 24px">Share music that opens wherever they listen</p>

  <p style="font-size:16px;margin:0 0 12px">Sign in, no password needed</p>
  <p style="color:#c9c7d4;font-size:14px;line-height:1.6;margin:0 0 24px">
    This link signs you in on the device you open it with. It works once, and it
    expires in an hour.
  </p>

  <a href="{{ .SiteURL }}?token_hash={{ .TokenHash }}&type=magiclink"
     style="display:inline-block;background:#7c3aed;color:#fff;font-weight:700;font-size:15px;padding:14px 28px;border-radius:8px;text-decoration:none;letter-spacing:1px">SIGN IN</a>

  <p style="color:#9a9aa6;font-size:12px;line-height:1.6;margin:24px 0 0">
    Or paste this into your browser:<br>
    <span style="color:#b69bff;word-break:break-all">{{ .SiteURL }}?token_hash={{ .TokenHash }}&type=magiclink</span>
  </p>

  <p style="color:#9a9aa6;font-size:11px;margin:32px 0 0">
    Did not ask to sign in? Ignore this email.
  </p>
</div>
```

---

## 4. Change email address

**Subject:** `Confirm your new Tunemail address`

Note: this one is sent to the NEW address, and `{{ .Email }}` is the old one.

```html
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#0d0d1a;color:#f0f0f0;border-radius:12px">
  <div style="font-size:28px;font-weight:900;letter-spacing:2px;margin-bottom:8px">
    <span style="color:#7c3aed">TUNE</span>MAIL
  </div>
  <p style="color:#9a9aa6;font-size:14px;margin:0 0 24px">Share music that opens wherever they listen</p>

  <p style="font-size:16px;margin:0 0 12px">Confirm this address</p>
  <p style="color:#c9c7d4;font-size:14px;line-height:1.6;margin:0 0 24px">
    Your Tunemail account is moving from {{ .Email }} to this address. It only
    moves once you confirm here.
  </p>

  <a href="{{ .SiteURL }}?token_hash={{ .TokenHash }}&type=email_change"
     style="display:inline-block;background:#7c3aed;color:#fff;font-weight:700;font-size:15px;padding:14px 28px;border-radius:8px;text-decoration:none;letter-spacing:1px">CONFIRM THIS ADDRESS</a>

  <p style="color:#9a9aa6;font-size:12px;line-height:1.6;margin:24px 0 0">
    Or paste this into your browser:<br>
    <span style="color:#b69bff;word-break:break-all">{{ .SiteURL }}?token_hash={{ .TokenHash }}&type=email_change</span>
  </p>

  <p style="color:#9a9aa6;font-size:11px;margin:32px 0 0">
    Did not ask for this? Ignore it and the account stays where it is.
  </p>
</div>
```

---

## 5. Invite user

**Subject:** `You have been invited to Tunemail`

Not used by the app today. Kept correct so it cannot go out saying Music Night
if it is ever switched on.

```html
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#0d0d1a;color:#f0f0f0;border-radius:12px">
  <div style="font-size:28px;font-weight:900;letter-spacing:2px;margin-bottom:8px">
    <span style="color:#7c3aed">TUNE</span>MAIL
  </div>
  <p style="color:#9a9aa6;font-size:14px;margin:0 0 24px">Share music that opens wherever they listen</p>

  <p style="font-size:16px;margin:0 0 12px">You have been invited</p>
  <p style="color:#c9c7d4;font-size:14px;line-height:1.6;margin:0 0 24px">
    Accept below to set up your account.
  </p>

  <a href="{{ .SiteURL }}?token_hash={{ .TokenHash }}&type=invite"
     style="display:inline-block;background:#7c3aed;color:#fff;font-weight:700;font-size:15px;padding:14px 28px;border-radius:8px;text-decoration:none;letter-spacing:1px">ACCEPT THE INVITE</a>

  <p style="color:#9a9aa6;font-size:12px;line-height:1.6;margin:24px 0 0">
    Or paste this into your browser:<br>
    <span style="color:#b69bff;word-break:break-all">{{ .SiteURL }}?token_hash={{ .TokenHash }}&type=invite</span>
  </p>

  <p style="color:#9a9aa6;font-size:11px;margin:32px 0 0">
    Not expecting this? Ignore it.
  </p>
</div>
```

---

## Also check, because a template cannot fix these

- **Authentication → URL Configuration → Site URL.** Every link above is built
  from `{{ .SiteURL }}`. If it still points at the old GitHub Pages address the
  links go to a dead page, whatever the template says. It should be
  `https://tunemail.app`.
- **Redirect URLs** in the same place must include `https://tunemail.app`.
- **Sender name**, under Project Settings → Authentication → SMTP Settings. If
  "Music Night" appeared as the sender rather than in the subject, no template
  edit touches it.
