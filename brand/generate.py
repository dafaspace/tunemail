import math, io, json
G = json.load(open('/Users/dafa/Documents/My Apps/_brand/envelope.json'))
E = G['envelope']; O = G['outline']

# Envelope, from the shared family geometry.
X0, X1 = 14.0, 186.0
W  = X1 - X0
EH = W / E['aspect']
# Record, from Dafa's draft: diameter 0.715 of the envelope width, centre such
# that 41.3% of the disc shows above the envelope.
RR   = 0.715 * W / 2
INK_H = W / 1.011
ENV_T = INK_H * 0.299
ENV_B = ENV_T + EH
RCY  = INK_H * 0.362
CX   = (X0 + X1) / 2

peakX  = X0 + E['backWallPeakX'] * W
peakY  = ENV_T + E['backWallPeakY'] * EH
sideY  = ENV_T + E['flapEdgeAtSide'] * EH
apexY  = ENV_T + E['flapApexY'] * EH
STROKE = round(O['strokeFractionOfInkWidth'] * W, 2)

# Back wall: peaks near the sides, dipping to the middle. Its lower edge is the
# flap's top edge, so the band is what shows between them.
band = sideY - peakY

svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="{X0} 0 {W} {INK_H:.1f}" width="{W}" height="{INK_H:.1f}">
  <g stroke="#0d0d1a" stroke-width="{STROKE}" stroke-linejoin="round" stroke-linecap="round">
    <circle cx="{CX}" cy="{RCY:.1f}" r="{RR:.1f}" fill="#7c3aed"/>
    <g fill="none" stroke="#0d0d1a" stroke-width="{STROKE*0.40:.2f}" stroke-linecap="round">
      <path d="M{CX-52:.1f} {RCY-19:.1f} A55.5 55.5 0 0 1 {CX-19:.1f} {RCY-52:.1f}"/>
      <path d="M{CX-45:.1f} {RCY-16:.1f} A48 48 0 0 1 {CX-16:.1f} {RCY-45:.1f}"/>
      <path d="M{CX-38:.1f} {RCY-14:.1f} A40.5 40.5 0 0 1 {CX-14:.1f} {RCY-38:.1f}"/>
      <path d="M{CX-31:.1f} {RCY-11:.1f} A33 33 0 0 1 {CX-11:.1f} {RCY-31:.1f}"/>
    </g>
    <circle cx="{CX}" cy="{RCY:.1f}" r="{RR*0.30:.1f}" fill="#eef0f6"/>
    <circle cx="{CX}" cy="{RCY:.1f}" r="{RR*0.155:.1f}" fill="#7c3aed" stroke-width="{STROKE*0.62:.2f}"/>
    <circle cx="{CX}" cy="{RCY:.1f}" r="{RR*0.050:.1f}" fill="#0d0d1a" stroke="none"/>
    <path d="M{X0} {sideY:.1f} L{peakX:.1f} {peakY:.1f} L{CX} {apexY-band:.1f} L{X1-(peakX-X0):.1f} {peakY:.1f} L{X1} {sideY:.1f} L{CX} {apexY:.1f} Z" fill="#dfe3ec"/>
    <path d="M{X0} {sideY:.1f} L{CX} {apexY:.1f} L{X1} {sideY:.1f} L{X1} {ENV_B:.1f} L{X0} {ENV_B:.1f} Z" fill="#eef0f6"/>
  </g>
</svg>'''
io.open('mark.svg','w').write(svg)
d = math.hypot(W/2, INK_H/2)
print(f"ink {W:.0f}x{INK_H:.0f}  aspect {W/INK_H:.3f}  stroke {STROKE}")
print(f"envelope {ENV_T:.1f}..{ENV_B:.1f} (h {EH:.1f})  apex {apexY:.1f}  side {sideY:.1f}  peak {peakX:.0f},{peakY:.1f}")
print(f"max of canvas {(33/108)*W/d:.4f}  ship {(33/108)*W/d*0.97:.3f}")
