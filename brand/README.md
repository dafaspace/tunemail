# Tunemail mark

The logo as exact geometry, built 10-11 Oct 2026 in the _HQ session, alongside Cinemail's.
The envelope is Cinemail's, from one shared file; the record is Tunemail's own, from the mark
authored from primitives on 3 Sep 2026 (`mark-authored.svg`), scaled into the envelope's slot.
The older files in this folder (traces, drafts, `icon-1024.png`) are superseded by this kit.

**Never edit a file in `svg/`, `png/` or `web/` by hand.** The sources are `src/envelope.js`
(shared with Cinemail) and `src/tunemail.js`. Change them, then:

```
node brand/src/build.mjs
"/Users/dafa/Documents/My Apps/ScoreWeaver/.venv-allinone/bin/python" brand/src/render.py
```

`render.py` needs macOS (Quick Look draws the SVGs) and Pillow + numpy. It renders every
transparent PNG twice, on black and on white, and recovers the alpha from the difference.

## Files

| file | use |
|---|---|
| `svg/tunemail-mark.svg` | the mark, transparent; the gaps between parts are real gaps. For dark grounds |
| `svg/tunemail-mark-ink.svg` | the same with the gaps filled in ink, so it also works on light grounds |
| `svg/tunemail-mark-spin.svg` | the mark with the record turning (CSS inside the file), as a reference |
| `svg/tunemail-icon.svg` | the app icon: the mark at 92.1 % on the ink ground, square, opaque - the same size and place as Cinemail's |
| `svg/layers/1-3` | the icon as three layers for Icon Composer: background, envelope, record |
| `web/logo-tap.html` | the logo inline, with a pop and a full turn of the record on show and on tap - CSS and JS included |
| `png/tunemail-mark-1024.png`, `-512` | transparent mark |
| `png/tunemail-mark-ink-1024.png`, `-512` | ink version |
| `png/tunemail-icon-1024.png` | App Store icon: 1024, RGB, no alpha |
| `png/tunemail-icon-512/180/48/32/16.png` | PWA icon, apple-touch-icon (180), favicons |
| `png/android/icon-foreground-1024.png` + `icon-background-1024.png` | Android adaptive icon: the mark fits the 66/108 safe circle |
| `png/layers/` | the Icon Composer layers as PNG |

The icon layers are each cut free of everything in front of them, so they never overlap:
stacked in any order they rebuild `tunemail-icon-1024.png` to within 1/255.

## Colours

| | |
|---|---|
| record | `#7C3AED` - Tunemail's `--primary` |
| envelope, every part | `#F0F0F0` - `--text`, the same white as Cinemail's |
| ink, icon ground | `#0D0D1A` - `--bg` |

## The record

From `mark-authored.svg` (disc 520.5, label 222, inner ring 167, spindle 32, lines 34, grooves
17) scaled by 165.8 / 520.5 into the slot Cinemail's reel occupies. Its lines are holes through
the record, as the envelope's gaps are, so both marks read as one family on any ground.

Two departures make it look like a real record when it turns (Dafa, 10 Oct 2026):

- **It is a little crooked.** The record turns about its spindle, which never moves; the hole is
  pressed 4.5 master px off the disc's centre, so the disc's edge swings as it turns. The gap
  behind it and its ink edge turn with it, so the outline keeps one width all the way round.
  (A first try turned it about the disc with the label off centre; the hole wandered, which no
  record does.)
- **Grooves on both sides**, alike but not twins: six upper left, five opposite, with different
  radii, lengths and staggered ends.

## Animating

Everything that turns is in elements with class `spin`, drawn round the spindle: the record,
and in the masks the gap and the ink edge that follow it. One rule turns them all together:

```css
.spin { animation: spin 8s linear infinite; transform-box: fill-box; transform-origin: center; }
@keyframes spin { to { transform: rotate(360deg); } }
```

An invisible circle round the spindle in each group makes "center" the spindle and not the
disc's own centre.

## Shared with Cinemail

`src/envelope.js` is byte for byte the same file as `Cinemail/brand/src/envelope.js`. The rule at
its top applies:

> Anything in this file is shared with the other -mail app. Do not edit it without first
> asking that app's session what the change does on its side. A number changed on one side
> only is worse than no shared file at all, because both sides then believe they agree.

Check that the two copies still agree:

```
md5 -q "/Users/dafa/Documents/My Apps/Tunemail/brand/src/envelope.js" "/Users/dafa/Documents/My Apps/Cinemail/brand/src/envelope.js"
```
