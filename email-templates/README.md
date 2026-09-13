# Paste-ready email bodies

One file per template, containing the body and NOTHING else - no code
fence, no heading, no trailing newline to hunt for. Open the file, Cmd+A,
Cmd+C, and paste into the Body field. That is the whole procedure.

This exists because the markdown version made it easy to select the ```html
fence along with the HTML, and Supabase then rendered the word "html" at the
top of the email. Handing over a file you have to trim is handing over half
the job.

| file | Supabase template | Subject |
|---|---|---|
| `confirm-signup.html` | Confirm signup | `Welcome to Tunemail` |
| `reset-password.html` | Reset password | `Reset your Tunemail password` |
| `magic-link.html` | Magic Link | `Your Tunemail sign-in link` |
| `change-email-address.html` | Change email address | `Confirm your new Tunemail address` |
| `invite-user.html` | Invite user | `You have been invited to Tunemail` |

Source of truth is still ../email-templates.md - these are generated from it
by tools/split-emails.py, so a change made here alone would be lost.
