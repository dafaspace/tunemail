# Prompt for regenerating the Tunemail mark, flat

Written against Cinemail's `docs/icon-brief.md`, which produced artwork that
traced to **36 paths in 8 fills**. The same brief's earlier, shaded icon traced
to **318 paths in 151 colours** and could not be separated at all.

Dafa's current draft measures 678 distinct colours, a soft shadow under the
record and a gradient across the flap. It is a good composition and a bad
source. Regenerate it flat, then trace.

## The prompt

```
A flat vector-style app icon, 1024x1024, square, filling the entire frame edge
to edge with no rounded corners and no border.

Subject: an open envelope seen from the front, with a vinyl record rising out
of it from behind the front flap. The record is a full circle, most of it
visible above the envelope, its lower part hidden behind the flap. Fine
concentric groove lines across the upper left of the record. A label at the
centre of the record: a ring, an inner disc, and a small spindle hole.

Style: flat illustration with solid colours and crisp hard edges. No drop
shadows, no soft glows, no blur, no gradients that imitate depth, no
highlights, no 3D shading, no bevels, no texture, no paper grain. Every shape
is a clean silhouette with a uniform fill, separated from its neighbour by a
dark outline of even thickness.

Colours: deep near-black blue background (#0d0d1a) covering the whole square.
The envelope in off-white (#eef0f6) with a slightly darker back wall. The
record in violet (#7c3aed). Outlines, groove lines and the spindle hole in the
same near-black as the background.

Composition: the subject centred, occupying about 70 percent of the frame,
with clear empty background on all four sides. Nothing touches or crosses the
edge.

No text, no letters, no numbers, no watermark, no frame, no rounded mask.
```

## Why each constraint is there

Every one of these was paid for once already, in Cinemail's repo or in this one.

**Square, edge to edge, no rounded corners.** The system draws the mask. A
corner rounded in advance interferes with the highlights it draws over the top,
and Cinemail's old file had a rounded rectangle baked onto a black field -
81,691 pixels, 8% of the canvas, all of it wrong. Measured on Dafa's draft: the
bottom corners are 13 per channel darker than the mid-edge, which is the same
defect.

**No shadows, no glows, no blur.** Two reasons, and the second is the one that
bites. The system lights the icon, so anything baked in fights it. And soft
edges are what make the artwork impossible to separate into layers afterwards:
a drop shadow traces into hundreds of near-black shards that cannot be told
from the real outlines.

**Solid fills, hard edges, even outlines.** So the trace produces regions that
can be split by colour. This is the difference between a five-minute separation
and an afternoon of picking shards apart.

**About 70 percent of the frame, nothing near the edge.** The system mask cuts
the corners and the icon is also scaled down hard on a home screen. The exact
safe fraction is computed from the mark's own aspect ratio afterwards - see
`brand/envelope.json` - but the generator should leave room rather than fill
the frame.

**Outline in the background colour.** Cinemail's fill census: 27 of 37 paths
are #0D0D1A, and that is the same token as the background. The mark reads as
cut out of the field rather than drawn on top of it. Dafa has asked that
contours match between the siblings, so this is not optional.

## After it comes back

1. Check it is flat before doing anything else. Count distinct colours; a flat
   mark is a handful, not hundreds. If a shadow crept in, generate again rather
   than tracing it.
2. Trace. Cinemail used vtracer; vectorizer.ai is the same engine with a web
   front end.
3. Verify the trace against the raster before trusting it. Cinemail measured
   mean 2.23 of 255 with 1.07% of pixels off by more than 40, all of it edge
   antialiasing, and 0.00 for the layers restacked.
4. Watch the transform trap: vtracer writes each path's `d` relative to a
   per-path `transform`, and dropping it collapses every path onto the origin.
