// The Tunemail mark: the shared envelope (envelope.js, identical in Cinemail) with a record laid
// into it where Cinemail has its reel. Built 10 Oct 2026 in the _HQ session.
//
// The record is Tunemail's own, from the mark authored from primitives on 3 Sep 2026
// (brand/mark-authored.svg: disc r 520.5, label 222, inner ring 167, spindle 32, six grooves
// at r 300-480 across 192-248 deg, lines 34 and grooves 17 wide), scaled to the envelope's slot
// (r 165.8, so k = 0.3185). Its lines are drawn the way the envelope draws its gaps: as holes
// through the record, not as ink on it, so the two read as one family on any ground.
//
// The record is drawn round its own centre inside <g class="spin">. The grooves sit in one
// sector, so turning that group is visibly the record turning.

import { S, MAP, f, rad, PAPER, INK, SLOT, compose, ring } from './envelope.js'
export { MAP, SLOT }

export const COL = {
  purple: '#7C3AED',    // Tunemail's accent
  paper: PAPER,
  ink: INK,
}

const k = SLOT.r / 520.5
// A real record is never quite true, and that is what makes it look like one when it turns
// (Dafa, 10 Oct 2026). It turns about its spindle, and the spindle never moves: the label,
// the hole and the grooves turn in place. What gives a slightly crooked record away is the
// hole pressed a little off the disc's centre, so the disc's EDGE swings as it turns. A first
// try did it the other way round - label off centre, turning about the disc - and the hole
// wandered, which no record does. So: everything is drawn round the spindle at (0,0), the
// disc's centre sits 4.5 master px off it, and the record turns about the spindle. The gap
// to the envelope swings with it, 10.5 to 19.5 px round the nominal 15 - that is the wobble.
// The grooves come in two sets on opposite sides, alike but not twins: different counts,
// radii and lengths.
export const RECORD = {
  r: SLOT.r,
  disc: [3.6, 2.7],                                      // the disc's centre, from the spindle: 4.5 (2.7 first, then 'a little more', Dafa)
  label: 222 * k, inner: 167 * k, line: 34 * k,          // the label's two rings, as holes 10.8 wide
  hole: 32 * k,                                          // the spindle
  groove: 17 * k,                                        // groove width
  sets: [
    { at: [0, 0],    // upper left, as on the 3 Sep mark: six grooves, ends staggered
      grooves: [[300, 194, 244], [345, 190, 248], [385, 192, 246], [420, 188, 250], [452, 191, 247], [480, 193, 243]] },
    { at: [0, 0],    // the opposite side: five, a little shorter and spaced differently
      grooves: [[310, 10, 58], [355, 6, 64], [398, 12, 55], [438, 8, 62], [472, 14, 52]] },
  ],
}

// a groove: an arc band with round ends round (cx, cy), as one closed outline
function band(cx, cy, r, h, a0, a1) {
  const p = (rr, a) => `${f((cx + rr * Math.cos(rad(a))) * S)} ${f((cy + rr * Math.sin(rad(a))) * S)}`
  const ro = (r + h) * S, ri = (r - h) * S, hc = h * S, big = a1 - a0 > 180 ? 1 : 0
  return `M${p(r + h, a0)} A${f(ro)} ${f(ro)} 0 ${big} 1 ${p(r + h, a1)} A${f(hc)} ${f(hc)} 0 0 1 ${p(r - h, a1)} ` +
    `A${f(ri)} ${f(ri)} 0 ${big} 0 ${p(r - h, a0)} A${f(hc)} ${f(hc)} 0 0 1 ${p(r + h, a0)} Z`
}

function recordGroup(col) {
  const { r, disc: [dx, dy], label, inner, line, hole, groove, sets } = RECORD, w = line / 2
  // one path, even-odd: the disc, then rings and grooves as holes through it
  const d = [ring(dx, dy, r),
    ring(0, 0, label + w), ring(0, 0, label - w),
    ring(0, 0, inner + w), ring(0, 0, inner - w),
    ring(0, 0, hole),
    ...sets.flatMap(s => s.grooves.map(([g, a0, a1]) => band(s.at[0], s.at[1], g * k, groove / 2, a0, a1)))].join(' ')
  // an invisible circle round the spindle, just clear of the disc: it makes the group's box
  // centred on the spindle, so "transform-origin: center" (with transform-box: fill-box) turns
  // the record about its hole and not about the disc's own centre
  const turnAbout = `<circle r="${f((r + Math.hypot(dx, dy)) * S)}" fill="none"/>`
  return `${turnAbout}<path d="${d}" fill="${col.purple}" fill-rule="evenodd"/>`
}

let uid = 0
export function tunemail(o = {}) {
  const id = 't' + (++uid), col = { ...COL, ...(o.colors || {}) }
  const [dx, dy] = RECORD.disc
  const body = compose({ id, o, paper: col.paper, ink: col.ink, object: { name: 'record', group: recordGroup(col), cut: { dx, dy, r: RECORD.r } } })
  if (o.bare) return body
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" role="img" aria-label="Tunemail">${body}</svg>`
}
