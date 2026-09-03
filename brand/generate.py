import math, io
# All measured off Dafa's draft, not eyed:
#   record diameter / envelope width  0.715
#   envelope aspect w/h               1.443
#   ink aspect w/h                    1.011
#   record centre, down the ink       0.362
#   envelope top, down the ink        0.299
# Flap angle and shoulder are Cinemail's contour details where they fit.
X0, X1 = 14.0, 186.0
W = X1 - X0
INK_H = W / 1.011
ENV_H = W / 1.443
ENV_T = INK_H * 0.299
ENV_B = ENV_T + ENV_H
RR    = 0.715 * W / 2
RCY   = INK_H * 0.362
SHOULDER = 0.080          # measured on the draft by column scan, not Cinemail's
                          # 0.395 - theirs sits much lower and gave a fat band
APEX_FRAC = 0.640         # measured: the flap edge runs 0.202 at x=10% and
                          # 0.368 at x=25%, extrapolating to 0.64 at centre
STROKE = round(0.0171 * W, 2)

sh   = ENV_T + SHOULDER * ENV_H
apex = ENV_T + APEX_FRAC * ENV_H
band = sh - ENV_T
ax   = 100.0

svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="{X0} 0 {W} {INK_H:.1f}" width="{W}" height="{INK_H:.1f}">
  <g stroke="#0d0d1a" stroke-width="{STROKE}" stroke-linejoin="round" stroke-linecap="round">
    <circle cx="{ax}" cy="{RCY:.1f}" r="{RR:.1f}" fill="#7c3aed"/>
    <g fill="none" stroke="#0d0d1a" stroke-width="{STROKE*0.42:.2f}" stroke-linecap="round">
      <path d="M{ax-51:.1f} {RCY-18:.1f} A54 54 0 0 1 {ax-18:.1f} {RCY-51:.1f}"/>
      <path d="M{ax-43:.1f} {RCY-15:.1f} A45.5 45.5 0 0 1 {ax-15:.1f} {RCY-43:.1f}"/>
      <path d="M{ax-35:.1f} {RCY-12:.1f} A37 37 0 0 1 {ax-12:.1f} {RCY-35:.1f}"/>
    </g>
    <circle cx="{ax}" cy="{RCY:.1f}" r="{RR*0.235:.1f}" fill="#eef0f6"/>
    <circle cx="{ax}" cy="{RCY:.1f}" r="{RR*0.125:.1f}" fill="#7c3aed" stroke-width="{STROKE*0.6:.2f}"/>
    <circle cx="{ax}" cy="{RCY:.1f}" r="{RR*0.042:.1f}" fill="#0d0d1a" stroke="none"/>
    <path d="M{X0} {sh:.1f} L{X0} {ENV_T:.1f} L{ax} {apex-band:.1f} L{X1} {ENV_T:.1f} L{X1} {sh:.1f} L{ax} {apex:.1f} Z" fill="#dfe3ec"/>
    <path d="M{X0} {sh:.1f} L{ax} {apex:.1f} L{X1} {sh:.1f} L{X1} {ENV_B:.1f} L{X0} {ENV_B:.1f} Z" fill="#eef0f6"/>
  </g>
</svg>'''
io.open('mark.svg','w').write(svg)
d = math.hypot(W/2, INK_H/2)
print(f"ink {W:.0f}x{INK_H:.0f}  aspect {W/INK_H:.3f}  stroke {STROKE}")
print(f"record r {RR:.1f}  cy {RCY:.1f}   envelope y {ENV_T:.1f}..{ENV_B:.1f}  apex {apex:.1f}")
print(f"max width of canvas {(33/108)*W/d:.4f}   ship at {(33/108)*W/d*0.97:.3f}")
