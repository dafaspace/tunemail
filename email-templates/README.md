# Paste-ready email bodies

Each file holds one template body and nothing else - no code fence, no
heading, nothing to trim.

## Copying one

Do NOT open these in a browser. A .html file double-clicked renders as a page,
and Cmd+A there selects the rendered text rather than the source. Copy straight
to the clipboard instead - nothing to open, nothing to select, nothing to miss:

```bash
cd "/Users/dafa/Documents/My Apps/Tunemail/email-templates"
```

then one of:

```bash
pbcopy < confirm-signup.html     # Confirm signup
pbcopy < reset-password.html     # Reset password
pbcopy < magic-link.html     # Magic Link
pbcopy < change-email-address.html     # Change email address
pbcopy < invite-user.html     # Invite user
```

The clipboard then holds exactly what goes in the Body field.

## Subjects

| Supabase template | Subject |
|---|---|
| Confirm signup | `Welcome to Tunemail` |
| Reset password | `Reset your Tunemail password` |
| Magic Link | `Your Tunemail sign-in link` |
| Change email address | `Confirm your new Tunemail address` |
| Invite user | `You have been invited to Tunemail` |

## Regenerating

../email-templates.md is the source of truth - it carries the reasoning, the
measured contrast table and the link-type rules. These files come from it:

```bash
python3 tools/split-emails.py
```

so an edit made here alone is lost on the next run.
