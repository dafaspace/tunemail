#!/usr/bin/env python3
"""Renders the PNGs from brand/svg. Run after build.mjs (Tunemail).

Needs macOS (Quick Look draws the SVG with WebKit, masks included) and a Python with Pillow
and numpy - ScoreWeaver's venv has both:
    "/Users/dafa/Documents/My Apps/ScoreWeaver/.venv-allinone/bin/python" brand/src/render.py

Quick Look always paints a white ground. So every transparent PNG is drawn twice, once on
black and once on white, and its alpha recovered from the difference: exact for every
antialiased edge, which a colour key never is.
"""
import os, re, subprocess, tempfile
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
SVG = os.path.join(HERE, '..', 'svg')
PNG = os.path.join(HERE, '..', 'png')
INK = (13, 13, 26)


def draw(svg_text, ground, size=1024):
    """svg_text drawn on a solid ground, as an RGB array"""
    body = re.sub(r'^<svg[^>]*>', '', svg_text.strip())[:-len('</svg>')]
    full = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="{size}" height="{size}">'
            f'<rect width="1024" height="1024" fill="rgb{ground}"/>{body}</svg>')
    with tempfile.TemporaryDirectory() as tmp:
        src = os.path.join(tmp, 'x.svg')
        open(src, 'w').write(full)
        subprocess.run(['qlmanage', '-t', '-s', str(size), '-o', tmp, src], capture_output=True, check=True)
        return np.asarray(Image.open(src + '.png').convert('RGB')).astype(float)


def transparent(name, size=1024):
    text = open(os.path.join(SVG, name)).read()
    b, w = draw(text, (0, 0, 0), size), draw(text, (255, 255, 255), size)
    a = 1 - (w - b).mean(axis=2) / 255                       # 1 where opaque, 0 where clear
    rgb = np.where(a[..., None] > 0, b / np.maximum(a[..., None], 1e-6), 0)
    return Image.fromarray(np.dstack([rgb.clip(0, 255), a * 255]).round().astype(np.uint8), 'RGBA')


def opaque(name, size=1024):
    return Image.fromarray(draw(open(os.path.join(SVG, name)).read(), INK, size).round().astype(np.uint8), 'RGB')


def save(img, rel):
    path = os.path.join(PNG, rel)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save(path, optimize=True)
    print(f'{rel:38s} {img.size[0]}x{img.size[1]} {img.mode}')


mark = transparent('tunemail-mark.svg')
save(mark, 'tunemail-mark-1024.png')
save(mark.resize((512, 512), Image.LANCZOS), 'tunemail-mark-512.png')
ink = transparent('tunemail-mark-ink.svg')
save(ink, 'tunemail-mark-ink-1024.png')
save(ink.resize((512, 512), Image.LANCZOS), 'tunemail-mark-ink-512.png')

icon = opaque('tunemail-icon.svg')                            # App Store: 1024, square, no alpha
save(icon, 'tunemail-icon-1024.png')
for s in (512, 180, 48, 32, 16):                              # 180: apple-touch-icon
    save(icon.resize((s, s), Image.LANCZOS), f'tunemail-icon-{s}.png')

# Android adaptive icon: the system crops the foreground to a shape inside a 66/108 circle,
# so the mark is scaled to fit that circle; the ground is a plain ink layer.
fg = Image.new('RGBA', (1024, 1024), (0, 0, 0, 0))
k = 0.68
m = mark.resize((round(1024 * k), round(1024 * k)), Image.LANCZOS)
fg.alpha_composite(m, (round(512 - 512 * k), round(512 - 512 * k)))
save(fg, 'android/icon-foreground-1024.png')
save(Image.new('RGB', (1024, 1024), INK), 'android/icon-background-1024.png')

save(opaque('layers/1-background.svg'), 'layers/1-background.png')
for n in ('2-envelope', '3-record'):
    save(transparent(f'layers/{n}.svg'), f'layers/{n}.png')
