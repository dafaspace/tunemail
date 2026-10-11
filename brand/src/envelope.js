// Anything in this file is shared with the other -mail app. Do not edit it without first
// asking that app's session what the change does on its side. A number changed on one side
// only is worse than no shared file at all, because both sides then believe they agree.
//
// The envelope of Cinemail and Tunemail. This file is identical, byte for byte, in
// Cinemail/brand/src and Tunemail/brand/src: the family look requires the silhouette to be the
// same, and "the same" means one file, not two that were drawn carefully. Each app lays its
// own object into it - Cinemail a reel and a film strip, Tunemail a record.
//
// Geometry measured on Cinemail's master raster docs/logo-full.png (1254 px) on 10 Oct 2026:
// lines fitted by least squares to the edge pixels, then made exact and mirror-symmetric.
// Units are master pixels; T() maps them onto the 1024 canvas, so the SVG carries plain
// coordinates and no transform.
//
// The envelope is drawn COMPLETE - back wall, raised flap, three front flaps - and the object
// is laid over it. Each layer cuts a gap of width K.G out of the layers behind it, which is how
// the original separates its parts: the gaps are background, not ink.

// master -> 1024. The mark is centred on the object's axis, not on its bounding box (Dafa,
// 10 Oct 2026). The scale leaves Cinemail's strip, the widest thing in either mark, 60 px
// clear of the right edge.
export const S = 1.4, CX = 598, CY = 503
export const MAP = { S, CX, CY }
export const T = (x, y) => [(x - CX) * S + 512, (y - CY) * S + 512]
export const f = n => +n.toFixed(2)
export const P = (x, y) => T(x, y).map(f).join(' ')
export const rad = d => d * Math.PI / 180

export const PAPER = '#F0F0F0'   // ONE white for every part of the envelope. The original shades
                                 // its parts 203-238; that is lighting, not design.
export const INK = '#0D0D1A'     // the ground the marks are drawn on

export const K = { G: 15 }       // every gap between parts; measured 13.4 to 15.2

export const AX = 598            // the axis of symmetry

// Where the object sits: its centre and outer radius. Measured on Cinemail's reel (centre
// 597.2-599.0, 439.6; outer ring 165.8), then lowered 5 into the envelope by Dafa, 10 Oct 2026.
export const SLOT = { cx: AX, cy: 445, r: 165.8 }

// measured: left side 367.6, right 829.4, bottom 726.5, left-flap tip (532.4, 578.2)
export const ENV = {
  x0: 367.1, x1: 2 * AX - 367.1, top: 451.5, bottom: 727, rTop: 6, rBottom: 20,
  C: [533.4, 578.2], Cr: [2 * AX - 533.4, 578.2],     // tips of the left and right side flaps; measured 532.4
  fold: 39.0,                                          // folds C->bottom corner, deg below horizontal; measured 39.9 left, 37.7 right
  // One corner serves all: the body's top corner is where the flap is hinged and where each
  // side flap starts, so the outline never steps. With the flap's side through that corner at
  // 36.5 deg, the visible tip beside the object lands at (379.7, 442.2); measured (378.4, 442.4).
  flapSlope: 36.5,                                     // the flap's sides, deg; measured 36.5, sd 0.3
}

export function envelopeShapes() {
  const { x0, x1, top, bottom, rTop, rBottom, C, Cr, fold, flapSlope } = ENV
  const k = Math.tan(rad(fold))
  // left side flap: from the top-left corner down to its tip C, back along the fold to the left side
  const yFoldL = C[1] + (C[0] - x0) * k
  const slope = (C[1] - top) / (C[0] - x0)
  const left = `M${P(x0, top + rTop)} Q${P(x0, top)} ${P(x0 + rTop, top + rTop * slope)} L${P(...C)} L${P(x0, yFoldL)} Z`
  const right = `M${P(x1, top + rTop)} Q${P(x1, top)} ${P(x1 - rTop, top + rTop * slope)} L${P(...Cr)} L${P(x1, yFoldL)} Z`
  // bottom flap: under both folds. The top of the pocket is ONE straight V, from the top-left
  // corner down to the axis and up to the top-right corner; the side flaps' tips C and Cr lie
  // on it, and the bottom flap fills the middle of the V between them.
  const arm = (C[1] - top) / (C[0] - x0)               // slope of the V, measured on the left flap: 37.2 deg
  const M = [AX, top + (AX - x0) * arm]                // the bottom of the V, on the axis
  const bottomFlap = `M${P(x0, yFoldL)} L${P(...C)} L${P(...M)} L${P(...Cr)} L${P(x1, yFoldL)} L${P(x1, bottom - rBottom)} Q${P(x1, bottom)} ${P(x1 - rBottom, bottom)} L${P(x0 + rBottom, bottom)} Q${P(x0, bottom)} ${P(x0, bottom - rBottom)} Z`
  const apex = top - (AX - x0) * Math.tan(rad(flapSlope))
  const flap = `M${P(x0, top)} L${P(AX, apex)} L${P(x1, top)} Z`
  // the back wall reaches 2 px up under the flap, so the two meet without a hairline seam
  const back = `M${P(x0, top)} L${P(x0 + 2, top - 2)} L${P(x1 - 2, top - 2)} L${P(x1, top)} L${P(x1, bottom - rBottom)} Q${P(x1, bottom)} ${P(x1 - rBottom, bottom)} L${P(x0 + rBottom, bottom)} Q${P(x0, bottom)} ${P(x0, bottom - rBottom)} Z`
  // what a front piece is tucked under: everything below the left arm, carried on past C
  const armFar = 1000
  const under = `M${P(x0 - 100, top - (100 * arm))} L${P(armFar, top + (armFar - x0) * arm)} L${P(armFar, 1300)} L${P(x0 - 100, 1300)} Z`
  const body = `M${P(x0, top + rTop)} Q${P(x0, top)} ${P(x0 + rTop, top)} L${P(x1 - rTop, top)} Q${P(x1, top)} ${P(x1, top + rTop)} L${P(x1, bottom - rBottom)} Q${P(x1, bottom)} ${P(x1 - rBottom, bottom)} L${P(x0 + rBottom, bottom)} Q${P(x0, bottom)} ${P(x0, bottom - rBottom)} Z`
  return { left, right, bottomFlap, flap, back, under, body }
}

// a circle round (0,0), in canvas units, for objects drawn about their own centre
export const ring = (x, y, r) => `M${f((x - r) * S)} ${f(y * S)} a${f(r * S)} ${f(r * S)} 0 1 0 ${f(2 * r * S)} 0 a${f(r * S)} ${f(r * S)} 0 1 0 ${f(-2 * r * S)} 0 Z`

// Lays an object into the envelope and cuts every gap.
//   id        prefix for this drawing's masks; unique per copy on a page
//   object    { name, group }: the object's SVG, drawn round (0,0); it sits at SLOT and
//             rotating its .spin group turns it in place. If its outline is not a circle round
//             (0,0) - Tunemail's record is a little eccentric - it passes cut: { dx, dy, r }, and
//             the gap behind it is cut by that circle inside a .spin group of its own, so the
//             gap turns with the object and keeps its width all the way round.
//   front     optional { name, outline, d, fill }: a piece in front of the pocket, tucked
//             under its left arm (Cinemail's strip)
//   o         variant 'ink' (gaps filled with ink, for light grounds), envelopeOnly,
//             only: [layer names] (one file per layer, for Icon Composer)
export function compose({ id, object, front, o = {}, paper = PAPER, ink = INK, extra = '' }) {
  const e = envelopeShapes()
  const [rx, ry] = T(SLOT.cx, SLOT.cy)
  const G = K.G, g2 = f(2 * G * S)
  const cut = (d, more = '') => `<path d="${d}" fill="#000" stroke="#000" stroke-width="${g2}" stroke-linejoin="round" ${more}/>`
  const solo = o.envelopeOnly                            // the envelope alone, nothing laid over it
  const c = object.cut
  const objCut = solo ? '' : !c ? `<circle cx="${f(rx)}" cy="${f(ry)}" r="${f((SLOT.r + G) * S)}" fill="#000"/>`
    // the invisible circle centres the group's box on (0,0), so it turns about the same point as the object
    : `<g transform="translate(${f(rx)} ${f(ry)})"><g class="spin"><circle r="${f((Math.hypot(c.dx, c.dy) + c.r + G) * S)}" fill="none"/>` +
      `<circle cx="${f(c.dx * S)}" cy="${f(c.dy * S)}" r="${f((c.r + G) * S)}" fill="#000"/></g></g>`
  // the front piece as it is SEEN: its tucked-in end does not cut anything
  const frontSeen = solo || !front ? '' : `<g clip-path="url(#${id}-open)">${cut(front.outline)}</g>`
  const mask = (name, body) => `<mask id="${id}-${name}" maskUnits="userSpaceOnUse" x="-200" y="-200" width="1424" height="1424"><rect x="-200" y="-200" width="1424" height="1424" fill="#fff"/>${body}</mask>`
  const openPath = `M-200 -200 H1224 V1224 H-200 Z ${e.under}`     // everything above the left arm
  const on = name => !(o.only && !o.only.includes(name))
  const defs = `<defs>
    <clipPath id="${id}-open"><path d="${openPath}" clip-rule="evenodd"/></clipPath>
    ${mask('back', objCut + cut(e.left) + cut(e.right) + cut(e.bottomFlap) + frontSeen)}
    ${mask('flap', objCut + cut(e.left) + cut(e.right) + frontSeen)}
    ${mask(object.name, cut(e.left) + cut(e.right) + cut(e.bottomFlap) + frontSeen)}
    ${mask('bottom', cut(e.left) + cut(e.right) + frontSeen)}
    ${mask('right', frontSeen)}
    ${front ? mask(front.name, cut(e.left) + cut(e.under)) : ''}
  </defs>`
  const inkLayer = o.variant === 'ink' ? `<g data-layer="ink" fill="${ink}" stroke="${ink}" stroke-width="${g2}" stroke-linejoin="round">
      <path d="${e.flap}"/>${!c ? `<circle cx="${f(rx)}" cy="${f(ry)}" r="${f(SLOT.r * S)}"/>`
        // an eccentric object's ink edge turns with it too, or the outline would swell and thin
        : `<g transform="translate(${f(rx)} ${f(ry)})"><g class="spin"><circle r="${f((Math.hypot(c.dx, c.dy) + c.r + G) * S)}" fill="none" stroke="none"/>` +
          `<circle cx="${f(c.dx * S)}" cy="${f(c.dy * S)}" r="${f(c.r * S)}"/></g></g>`}<path d="${e.back}"/><path d="${e.body}"/>
      ${front ? `<g clip-path="url(#${id}-open)"><path d="${front.outline}"/></g>` : ''}</g>` : ''
  const L = (name, g) => on(name) ? g : ''
  // Layers are named with data-layer, not id: two copies of a mark on one page (the app has
  // two) would repeat an id, and nothing needs to reach a layer by id.
  return `${defs}${inkLayer}
  ${L('back', `<g data-layer="back" mask="url(#${id}-back)"><path d="${e.back}" fill="${paper}"/></g>`)}
  ${L('flap', `<g data-layer="flap" mask="url(#${id}-flap)"><path d="${e.flap}" fill="${paper}"/></g>`)}
  ${solo || !on(object.name) ? '' : `<g data-layer="${object.name}" mask="url(#${id}-${object.name})"><g transform="translate(${f(rx)} ${f(ry)})"><g class="spin">${object.group}</g></g></g>`}
  ${L('bottom', `<g data-layer="bottom" mask="url(#${id}-bottom)"><path d="${e.bottomFlap}" fill="${paper}"/></g>`)}
  ${L('right', `<g data-layer="right" mask="url(#${id}-right)"><path d="${e.right}" fill="${paper}"/></g>`)}
  ${solo || !front || !on(front.name) ? '' : `<g data-layer="${front.name}" mask="url(#${id}-${front.name})"><path d="${front.d}" fill="${front.fill}" fill-rule="evenodd"/></g>`}
  ${L('left', `<g data-layer="left"><path d="${e.left}" fill="${paper}"/></g>`)}
  ${extra}`
}
