import { STYLE } from '../materials'
import { PALETTE } from '../sceneStyle'

/**
 * Halloween dressing shared by the lobby and the course: jack-o-lanterns, dead trees,
 * gravestones, cauldrons, lamps, nets and so on. Everything is plain boxes added to a
 * BlockSet, so it rides along in whatever draw call the caller already has.
 *
 * Positions are the centre of the footprint; `base` is the height it stands on.
 */

const pick = (rand, list) => list[Math.floor(rand() * list.length)]

/**
 * Light spots: where a lantern, lit pumpkin or string of lights should throw a warm
 * pool of light on the ground (see GroundGlow). Recorded only while the lobby is being
 * built (`recordGlows`); the course's chunks are rebuilt constantly and never record.
 */
export const glowSpots = []
let recording = false
export function recordGlows(on) {
  recording = on
  if (on) glowSpots.length = 0
}
/**
 * Adds a light pool of `radius` metres at (x, y, z), `strength` 0-1. With `wall`
 * (`{ yaw, height }`) it is a wash of light up a wall instead, standing upright and
 * facing `yaw`, `height` metres tall, centred at y.
 */
export function glowSpot(x, y, z, color, radius = 4, strength = 0.6, wall = null) {
  if (recording && glowSpots.length < 220) glowSpots.push({ x, y, z, color, radius, strength, wall })
}

/**
 * A pumpkin: an orange slab with darker ribs, a green stem, and - when `lit` - a glowing
 * jack-o-lantern face on its +Z side (turned by `rotY`).
 */
export function pumpkin(b, x, base, z, s = 1, rotY = 0, lit = true, glow = PALETTE.glow) {
  const w = 2.2 * s
  const h = 1.7 * s
  b.addOn(x, base, z, w, h, w, PALETTE.pumpkin, STYLE.SMOOTH, rotY)
  // Ribs: two darker, slightly proud slabs give the lobed look.
  b.addOn(x, base + 0.05 * s, z, w * 0.34, h * 0.96, w * 1.04, PALETTE.pumpkinDark, STYLE.SMOOTH, rotY)
  b.addOn(x, base + 0.05 * s, z, w * 1.04, h * 0.96, w * 0.34, PALETTE.pumpkinDark, STYLE.SMOOTH, rotY)
  b.addOn(x, base + h, z, 0.42 * s, 0.5 * s, 0.42 * s, PALETTE.stem, STYLE.SMOOTH, rotY)
  if (!lit) return
  if (base === 0) glowSpot(x, 0, z, '#ffb02a', 3.6 * s + 1.4, 0.7)
  const c = Math.cos(rotY)
  const sn = Math.sin(rotY)
  // Local (lx, ly) on the front face -> world; the face stands a little proud of the slab.
  const face = (lx, ly, fw, fh) => {
    const fz = w / 2 + 0.04 * s
    b.add(x + lx * c + fz * sn, base + ly, z - lx * sn + fz * c, fw, fh, 0.12 * s, glow, STYLE.GLOW, rotY)
  }
  // Angry carved face: slanted eyes, a nose, a wide grin with fangs.
  const tilt = (lx, ly, fw, fh, rz) => {
    const fz = w / 2 + 0.05 * s
    b.add(x + lx * c + fz * sn, base + ly, z - lx * sn + fz * c, fw, fh, 0.12 * s, glow, STYLE.GLOW, rotY, 0, rz)
  }
  tilt(-0.5 * s, h * 0.64, 0.55 * s, 0.26 * s, -0.5)
  tilt(0.5 * s, h * 0.64, 0.55 * s, 0.26 * s, 0.5)
  tilt(0, h * 0.5, 0.2 * s, 0.2 * s, 0)
  face(0, h * 0.26, 1.5 * s, 0.3 * s)
  // Fangs: pumpkin-coloured teeth over the grin.
  for (const fx of [-0.3, 0.3]) {
    const fz = w / 2 + 0.09 * s
    b.add(x + fx * s * c + fz * sn, base + h * 0.3, z - fx * s * sn + fz * c, 0.16 * s, 0.3 * s, 0.1 * s, PALETTE.pumpkin, STYLE.SMOOTH, rotY)
  }
}

/** A cluster of two or three pumpkins of mixed size. */
export function pumpkinPatch(b, x, z, rand, s = 1) {
  const count = 2 + Math.floor(rand() * 2)
  for (let i = 0; i < count; i += 1) {
    pumpkin(b, x + (rand() - 0.5) * 3.2 * s, 0, z + (rand() - 0.5) * 3.2 * s, s * (0.55 + rand() * 0.55), rand() * Math.PI * 2, rand() < 0.5)
  }
}

/** A gnarled black tree: a trunk, a few bare branches and a twig crown. */
export function deadTree(b, x, base, z, s = 1, rand = Math.random) {
  const trunk = PALETTE.trunk
  const h = (5 + rand() * 2.5) * s
  b.addOn(x, base, z, 0.9 * s, h, 0.9 * s, trunk, STYLE.SMOOTH)
  b.addOn(x, base, z, 1.5 * s, 0.8 * s, 1.5 * s, trunk, STYLE.SMOOTH)
  const side = rand() < 0.5 ? -1 : 1
  // Branches reaching out and up, each with a forked tip.
  b.add(x + side * 1.5 * s, base + h * 0.62, z, 3.2 * s, 0.36 * s, 0.36 * s, trunk, STYLE.SMOOTH, 0, 0, side * 0.7)
  b.add(x + side * 2.7 * s, base + h * 0.85, z, 1.7 * s, 0.26 * s, 0.26 * s, trunk, STYLE.SMOOTH, 0, 0, -side * 0.5)
  b.add(x - side * 1.1 * s, base + h * 0.8, z + 0.2 * s, 2.4 * s, 0.32 * s, 0.32 * s, trunk, STYLE.SMOOTH, 0, 0, -side * 0.75)
  b.add(x, base + h + 0.4 * s, z, 0.34 * s, 1.6 * s, 0.34 * s, trunk, STYLE.SMOOTH, 0, 0, side * 0.25)
}

/** A black palm, like the silhouettes along the beach: a trunk and spiky fronds. */
export function blackPalm(b, x, base, z, s = 1, rand = Math.random) {
  const h = (6 + rand() * 2.5) * s
  b.addOn(x, base, z, 0.55 * s, h, 0.55 * s, '#0e0a18', STYLE.SMOOTH)
  for (let i = 0; i < 5; i += 1) {
    const a = (i / 5) * Math.PI * 2 + rand() * 0.6
    b.add(x + Math.cos(a) * 1.5 * s, base + h - 0.1, z + Math.sin(a) * 1.5 * s, 3.6 * s, 0.22 * s, 0.7 * s, '#0e0a18', STYLE.SMOOTH, -a, 0, -0.4)
  }
}

/** A gravestone with a cross carved in. */
export function tombstone(b, x, base, z, s = 1, rotY = 0, color = '#8e86a0') {
  b.addOn(x, base, z, 1.8 * s, 2.2 * s, 0.5 * s, color, STYLE.STUDS, rotY)
  b.addOn(x, base + 2.2 * s, z, 1.3 * s, 0.4 * s, 0.5 * s, color, STYLE.STUDS, rotY)
  b.addOn(x, base, z, 2.2 * s, 0.35 * s, 0.9 * s, '#6c6580', STYLE.STUDS, rotY)
  const c = Math.cos(rotY)
  const sn = Math.sin(rotY)
  const fz = 0.27 * s
  b.add(x + fz * sn, base + 1.5 * s, z + fz * c, 0.2 * s, 0.9 * s, 0.06, '#3e3850', STYLE.SMOOTH, rotY)
  b.add(x + fz * sn, base + 1.75 * s, z + fz * c, 0.6 * s, 0.18 * s, 0.06, '#3e3850', STYLE.SMOOTH, rotY)
}

/** A bubbling cauldron on a little fire. */
export function cauldron(b, x, base, z, s = 1) {
  b.addOn(x, base, z, 2.2 * s, 0.4 * s, 2.2 * s, '#ff5a14', STYLE.LAVA)
  b.addOn(x, base + 0.4 * s, z, 1.9 * s, 1.1 * s, 1.9 * s, '#17131f', STYLE.SMOOTH)
  b.addOn(x, base + 1.5 * s, z, 2.2 * s, 0.25 * s, 2.2 * s, '#2a2434', STYLE.SMOOTH)
  b.addOn(x, base + 1.62 * s, z, 1.7 * s, 0.2 * s, 1.7 * s, PALETTE.slime, STYLE.GLOW)
}

/**
 * A pumpkin lamp: a jack-o-lantern with a lit face on a stone plinth (`height` is the
 * overall height, plinth included), throwing a pool of warm light. `color` is the glow.
 */
export function lantern(b, x, base, z, height = 4.5, color = PALETTE.glow, rotY = Math.atan2(-x, 14 - z)) {
  const plinth = Math.max(0.5, height * 0.3)
  b.addOn(x, base, z, 1.0, plinth, 1.0, '#3a2d55', STYLE.STUDS)
  b.addOn(x, base + plinth, z, 1.3, 0.16, 1.3, '#2a1f44', STYLE.SMOOTH)
  pumpkin(b, x, base + plinth + 0.16, z, 0.5, rotY, true, color)
  if (base === 0) glowSpot(x, 0, z, color, 7, 0.75)
}

/** A glowing candle post, for lining paths. */
export function candle(b, x, base, z, color = '#ff9a1f') {
  b.addOn(x, base, z, 0.5, 1.3, 0.5, '#f4efe9', STYLE.SMOOTH)
  b.addOn(x, base + 1.3, z, 0.34, 0.45, 0.34, color, STYLE.GLOW)
  if (base === 0) glowSpot(x, 0, z, color, 2.6, 0.4)
}

/** A red-capped, white-stemmed toadstool. */
export function mushroom(b, x, base, z, s = 1, rotY = 0) {
  b.addOn(x, base, z, 0.6 * s, 1.2 * s, 0.6 * s, '#e9def0', STYLE.SMOOTH, rotY)
  b.addOn(x, base + 1.2 * s, z, 2.1 * s, 0.7 * s, 2.1 * s, '#e0261c', STYLE.STUDS, rotY)
  b.addOn(x, base + 1.9 * s, z, 1.3 * s, 0.3 * s, 1.3 * s, '#ff4a2a', STYLE.STUDS, rotY)
}

/** Navy net fence along a straight run: posts with gold caps and a dark net between. */
export function netFence(b, x, z0, z1, height = 7) {
  const lo = Math.min(z0, z1)
  const hi = Math.max(z0, z1)
  const len = hi - lo
  const zc = (lo + hi) / 2
  for (let z = lo; z <= hi + 0.01; z += 9) {
    b.addOn(x, 0, z, 0.4, height, 0.4, '#1b2a66', STYLE.SMOOTH)
    b.addOn(x, height, z, 0.55, 0.3, 0.55, '#ffcf3a', STYLE.GLOW)
  }
  b.addOn(x, 1.2, zc, 0.08, height - 1.2, len, '#3a3470', STYLE.PLATE)
  b.addOn(x, height - 0.2, zc, 0.14, 0.14, len, '#cfc4f0', STYLE.SMOOTH)
}

/** A maroon park bench, for the beach side of the nets. */
export function bench(b, x, base, z) {
  b.addOn(x, base + 0.5, z, 1.2, 0.3, 5, '#7a3a24', STYLE.STUDS)
  b.addOn(x, base + 1, z, 0.25, 0.9, 5, '#7a3a24', STYLE.STUDS)
  for (const side of [-1, 1]) b.addOn(x, base, z + side * 2.2, 1.1, 0.55, 0.35, '#3c2418', STYLE.SMOOTH)
}

/** A blue-and-white beach umbrella on a pole. */
export function umbrella(b, x, base, z, rand) {
  b.addOn(x, base, z, 0.18, 3.2, 0.18, '#d9d9e6', STYLE.SMOOTH)
  b.addOn(x, base + 3.1, z, 3.2, 0.3, 3.2, pick(rand, ['#2f7fe6', '#e8e8f2']), STYLE.SMOOTH)
  b.addOn(x, base + 3.4, z, 1.6, 0.25, 1.6, '#e8e8f2', STYLE.SMOOTH)
}

/** A candy cane: a tall striped stem with a hooked top. */
export function candyCane(b, x, base, z, s = 1) {
  const h = 5 * s
  b.addOn(x, base, z, 0.7 * s, h, 0.7 * s, '#ffffff', STYLE.STRIPES)
  b.addOn(x + 0.7 * s, base + h, z, 1.5 * s, 0.7 * s, 0.7 * s, '#ff3b3b', STYLE.SMOOTH)
  b.addOn(x + 1.4 * s, base + h - 0.9 * s, z, 0.7 * s, 0.9 * s, 0.7 * s, '#ffffff', STYLE.SMOOTH)
}

/** A swirly lollipop on a stick. */
export function lollipop(b, x, base, z, s = 1, color = '#ff5cc8') {
  b.addOn(x, base, z, 0.28 * s, 3.4 * s, 0.28 * s, '#f4efe9', STYLE.SMOOTH)
  b.addOn(x, base + 3.4 * s, z, 2 * s, 2 * s, 0.5 * s, color, STYLE.GLOW)
  b.addOn(x, base + 3.8 * s, z, 1.2 * s, 1.2 * s, 0.56 * s, '#ffffff', STYLE.SMOOTH)
}

/** A big candy corn: three stacked bands, yellow base, orange middle, white tip. */
export function candyCorn(b, x, base, z, s = 1, rotY = 0) {
  b.addOn(x, base, z, 2.6 * s, 1.1 * s, 2.6 * s, '#ffd21f', STYLE.SMOOTH, rotY)
  b.addOn(x, base + 1.1 * s, z, 2.0 * s, 1.1 * s, 2.0 * s, '#ff8a1e', STYLE.SMOOTH, rotY)
  b.addOn(x, base + 2.2 * s, z, 1.4 * s, 1.0 * s, 1.4 * s, '#ffffff', STYLE.SMOOTH, rotY)
  b.addOn(x, base + 3.2 * s, z, 0.8 * s, 0.7 * s, 0.8 * s, '#ffffff', STYLE.SMOOTH, rotY)
}

/** A wisp: a small floating cyan orb with a couple of sparks, as in the bog. */
export function wisp(b, x, base, z, s = 1) {
  b.addOn(x, base, z, 0.5 * s, 0.5 * s, 0.5 * s, '#7ffcff', STYLE.GLOW)
  b.addOn(x + 0.6 * s, base + 0.4 * s, z + 0.2 * s, 0.3 * s, 0.3 * s, 0.3 * s, '#c9ffff', STYLE.GLOW)
  b.addOn(x - 0.4 * s, base + 0.8 * s, z - 0.3 * s, 0.25 * s, 0.25 * s, 0.25 * s, '#7ffcff', STYLE.GLOW)
}

/** A bone cross sticking out of the ground. */
export function bones(b, x, base, z, rotY = 0) {
  b.addOn(x, base, z, 0.35, 2.2, 0.35, '#efe9df', STYLE.SMOOTH, rotY)
  b.addOn(x, base + 1.4, z, 1.5, 0.3, 0.3, '#efe9df', STYLE.SMOOTH, rotY)
}

/** A spooky arch: two posts, a beam, and an `accent`-glowing trim. */
export function spookyArch(b, x, base, z, width, height, color, accent) {
  for (const side of [-1, 1]) {
    b.addOn(x + side * (width / 2 - 0.8), base, z, 1.6, height, 1.6, color, STYLE.SMOOTH)
    b.addOn(x + side * (width / 2 - 0.8), base + height, z, 2, 0.5, 2, accent, STYLE.GLOW)
  }
  b.addOn(x, base + height - 0.5, z, width, 1.2, 1.4, color, STYLE.SMOOTH)
  b.addOn(x, base + height - 0.62, z + 0.2, width - 2, 0.2, 1.5, accent, STYLE.GLOW)
}
