import os, subprocess, io, json, shutil
CH = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
HERE = os.path.abspath('.')
OUT = os.path.join(HERE, 'out'); shutil.rmtree(OUT, ignore_errors=True)
FIELD = '#0d0d1a'

def page(size, frac, bg, mono=False, circle=False):
    px = round(size * frac)
    filt = 'filter:brightness(0) invert(1);' if mono else ''
    rad  = 'border-radius:50%;' if circle else ''
    return f'''<!doctype html><meta charset="utf-8"><style>
html,body{{margin:0;background:transparent}}
.f{{width:{size}px;height:{size}px;display:flex;align-items:center;justify-content:center;
    background:{bg};{rad}}}
img{{display:block;width:{px}px;{filt}}}</style>
<div class="f"><img src="mark-fg.svg"></div>'''

def shot(name, size, frac, bg='transparent', mono=False, circle=False):
    tmp = os.path.join(HERE, '_t.html')
    io.open(tmp,'w').write(page(size, frac, bg, mono, circle))
    dst = os.path.join(OUT, name)
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    subprocess.run([CH,'--headless','--disable-gpu','--hide-scrollbars',
        '--default-background-color=00000000', f'--screenshot={dst}',
        f'--window-size={size},{size}','--force-device-scale-factor=1',
        '--virtual-time-budget=3000', f'file://{tmp}'],
        capture_output=True)
    return dst

made = []
# ---- PWA ----------------------------------------------------------------
# Two fractions, not one file with purpose "any maskable". Maskable crops to a
# circle of 80% of the width, so a near-square mark may be at most
# 0.80/sqrt(2) = 0.566; unmasked, that reads as a stamp lost in a field.
for s_ in (192, 512):
    made.append(shot(f'pwa/icon-{s_}.png', s_, 0.66, FIELD))
    made.append(shot(f'pwa/icon-{s_}-maskable.png', s_, 0.54, FIELD))
made.append(shot('pwa/apple-touch-icon.png', 180, 0.66, FIELD))
# Favicons carry the dark field with them, which is the whole reason a browser
# tab in light mode never touches the mark. At 32 and 16 the mark is a shape
# rather than a drawing, so it gets a little more room than 0.66.
made.append(shot('pwa/favicon-48.png', 48, 0.72, FIELD))
made.append(shot('pwa/favicon-32.png', 32, 0.72, FIELD))
made.append(shot('pwa/favicon-16.png', 16, 0.76, FIELD))
made.append(shot('store/icon-1024.png', 1024, 0.66, FIELD))

# ---- Android adaptive ---------------------------------------------------
DENS = {'ldpi':0.75,'mdpi':1,'hdpi':1.5,'xhdpi':2,'xxhdpi':3,'xxxhdpi':4}
for d, m in DENS.items():
    fg = round(108*m); lg = round(48*m)
    made.append(shot(f'android/mipmap-{d}/ic_launcher_foreground.png', fg, 0.419))
    made.append(shot(f'android/mipmap-{d}/ic_launcher_monochrome.png', fg, 0.419, mono=True))
    made.append(shot(f'android/mipmap-{d}/ic_launcher.png', lg, 0.66, FIELD))
    made.append(shot(f'android/mipmap-{d}/ic_launcher_round.png', lg, 0.60, FIELD, circle=True))

os.makedirs(os.path.join(OUT,'android/values'), exist_ok=True)
io.open(os.path.join(OUT,'android/values/ic_launcher_background.xml'),'w').write(
'''<?xml version="1.0" encoding="utf-8"?>
<!-- A colour resource, not a drawable. Capacitor ships #FFFFFF here, which puts
     a mark drawn for a dark ground on a white card. -->
<resources>
    <color name="ic_launcher_background">#0d0d1a</color>
</resources>
''')
os.makedirs(os.path.join(OUT,'android/mipmap-anydpi-v26'), exist_ok=True)
xml = '''<?xml version="1.0" encoding="utf-8"?>
<!-- Capacitor ships this WITHOUT the monochrome line. Without it, on Android 13+
     themed icons this app is the one full-colour tile in a monochrome grid. -->
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
    <monochrome android:drawable="@mipmap/ic_launcher_monochrome"/>
</adaptive-icon>
'''
for n in ('ic_launcher.xml','ic_launcher_round.xml'):
    io.open(os.path.join(OUT,'android/mipmap-anydpi-v26',n),'w').write(xml)

os.remove(os.path.join(HERE,'_t.html'))
tot = sum(os.path.getsize(f) for f in made)
print(f'{len(made)} PNG + 3 XML, {tot/1024:.0f} KB')
for f in sorted(made):
    import struct
    d = open(f,'rb').read(); w,h = struct.unpack('>II', d[16:24])
    print(f'  {os.path.relpath(f,OUT):48s} {w}x{h}')
