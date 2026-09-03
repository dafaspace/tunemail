import io, math

# Every number below was fitted to the cleaned raster, not chosen. Sources:
#   disc            circle fit, 33 rays, median error 2.0px of a 520 radius
#   label rings     radial scan from the disc centre
#   envelope        paper extent and its top edge sampled at 13 x positions,
#                   which came back symmetric with the apex exactly at 50%
#   stroke          the outline runs measured 17 everywhere: median == minimum
S = 1600
CX = 800.0

DISC_CY, DISC_R = 720.5, 520.5
SPINDLE_R  = 32
RING_IN     = (149, 167)
RING_OUT    = (189, 222)

ENV_L, ENV_R, ENV_B = 200.0, 1399.0, 1399.0
ENV_T   = 550.0
ENV_H   = ENV_B - ENV_T
PEAK    = (260.0, 569.0)          # back wall corner, 5% across, 0.022 down
APEX    = (CX, ENV_T + 0.589 * ENV_H)
# The flap edge extrapolated to the side: sampled at 10% it sits 0.207 down and
# at 50% 0.589, a slope of 0.675 in absolute units, giving 645 at x=200.
SHOULDER_Y = 645.0
# The back wall is a BAND running parallel just above the flap edge, not two
# corner triangles. Modelling it as triangles lost the fold diagonals that read
# across the white panel, which is most of what says "envelope".
BAND = SHOULDER_Y - PEAK[1]

SW = 34.0                          # one width everywhere - 17 either side
FIELD, PAPER, ACCENT = '#0d0d1a', '#edeff5', '#7c3aed'

def arc(r, a0, a1):
    """Concentric groove arc, angles in degrees clockwise from twelve o'clock."""
    p = lambda a: (CX + r*math.sin(math.radians(a)), DISC_CY - r*math.cos(math.radians(a)))
    x0,y0 = p(a0); x1,y1 = p(a1)
    large = 1 if abs(a1-a0) > 180 else 0
    sweep = 1 if a1 > a0 else 0
    return f'M{x0:.1f} {y0:.1f} A{r:.1f} {r:.1f} 0 {large} {sweep} {x1:.1f} {y1:.1f}'

grooves = ''.join(
    f'<path d="{arc(r, -78, -22)}"/>' for r in (300, 345, 385, 420, 452, 480)
)

svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {S} {S}" width="{S}" height="{S}">
  <!-- Authored from primitives, not traced. A traced boundary wobbles and a
       stroke on it doubles the wobble, which is why the outline kept coming out
       uneven and broken. Circles are circles here and the stroke is one width
       by construction. -->
  <g stroke="{FIELD}" stroke-width="{SW}" stroke-linejoin="round" stroke-linecap="round" fill="none">

    <!-- Record, behind the envelope -->
    <circle cx="{CX}" cy="{DISC_CY}" r="{DISC_R}" fill="{ACCENT}"/>
    <g stroke-width="{SW*0.5:.1f}">{grooves}</g>
    <circle cx="{CX}" cy="{DISC_CY}" r="{RING_OUT[1]}" fill="{ACCENT}"/>
    <circle cx="{CX}" cy="{DISC_CY}" r="{RING_IN[1]}" fill="{ACCENT}"/>
    <circle cx="{CX}" cy="{DISC_CY}" r="{SPINDLE_R}" fill="{FIELD}"/>

    <!-- Back wall: a band parallel to and above the flap edge. Its top corners
         are the peaks that show either side of the record. -->
    <path d="M{ENV_L} {SHOULDER_Y-BAND:.1f} L{APEX[0]} {APEX[1]-BAND:.1f} L{ENV_R} {SHOULDER_Y-BAND:.1f} L{ENV_R} {SHOULDER_Y:.1f} L{APEX[0]} {APEX[1]:.1f} L{ENV_L} {SHOULDER_Y:.1f} Z" fill="{PAPER}"/>

    <!-- Front panel: the V the record sits behind -->
    <path d="M{ENV_L} {SHOULDER_Y:.1f} L{APEX[0]} {APEX[1]:.1f} L{ENV_R} {SHOULDER_Y:.1f} L{ENV_R} {ENV_B} L{ENV_L} {ENV_B} Z" fill="{PAPER}"/>
  </g>
</svg>'''
io.open('mark-authored.svg','w',encoding='utf-8').write(svg)
print(f'authored: stroke {SW} everywhere, disc r{DISC_R}, envelope {ENV_R-ENV_L:.0f}x{ENV_B-ENV_T:.0f}')
