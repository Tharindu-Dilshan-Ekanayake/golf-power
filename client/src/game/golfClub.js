import {
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  InstancedBufferAttribute,
  InstancedMesh,
  MeshLambertMaterial,
  OctahedronGeometry,
  SphereGeometry,
  TorusGeometry,
} from 'three'

import { PropBuilder } from './blocks'
import { glowTime } from './glow'

/**
 * The golf clubs: twenty of them, no two alike from the end of the grip to the sole - a
 * rusty driver, a pumpkin putter, a candy cane, a witch's broom, a crystal skull, a
 * golden scythe, a candy-corn cannon, a dragon's head... - in eighteen materials.
 *
 * Every club is drawn in its hand's frame (see CLUB_GRIP / CLUB_TILT in playerPose.js):
 * the grip at the origin, the shaft running down -Y, the head at its foot with its face
 * towards +Z and its sole on y = -CLUB_SOLE (grip offset included), whatever the shape,
 * so every club stands over the ball the same way.
 *
 * Each club is one merged geometry; its pieces carry a PART number (in the `aStyle`
 * attribute) and the material decides how each part looks from the club's own pattern
 * and colours, which are per instance. So a club - however many golfers hold it - is one
 * draw call.
 */
export const CLUB_LENGTH = 1.3
/** From the hand (the grip offset included) to the bottom of the head's sole, metres. */
export const CLUB_SOLE = 1.445
/** The bottom of the head in the club's own frame (the grip offset is -0.04). */
const SOLE_Y = -1.405

/** What each piece of a club is, for the material. */
const PART = {
  /** Its own vertex colour, matte: the grip's rubber, a stem, teeth. */
  FIXED: 0,
  /** Its own vertex colour, polished: striking faces. */
  SHINY: 1,
  SHAFT: 2,
  HEAD: 3,
  /** The head's colour, darkened and metallic: the sole plate. */
  SOLE: 4,
  /** Glowing, in the club's accent colour: eyes, stripes, bands. */
  GLOW: 5,
  /** Polished, in the accent colour: the grip cap, ferrule and hosel. */
  TRIM: 6,
}

/** Surface patterns (shared with the shader, see PATTERN_GLSL). */
const PATTERN = {
  paint: 0,
  metal: 1,
  wood: 2,
  gem: 3,
  bone: 4,
  lava: 5,
  stripes: 6,
  galaxy: 7,
  rust: 8,
  ghost: 9,
  ice: 10,
  rainbow: 11,
  slime: 12,
  pumpkin: 13,
  straw: 14,
  corn: 15,
  neon: 16,
  scales: 17,
}

/**
 * Each club's look, by id: the head's pattern and two colours, the shaft's,
 * and an accent colour for trim and anything that glows. The ids are the profile's
 * original plane ids (see PLANES in shared/balance.js).
 */
export const CLUB_LOOKS = {
  paper: { head: ['rust', '#9a8f86', '#a84a18'], shaft: ['rust', '#b8b2ac', '#a84a18'], accent: '#ff8a3c' },
  sky: { head: ['pumpkin', '#ff7a14', '#c44a00'], shaft: ['wood', '#9a6332', '#5a3418'], accent: '#ffd23a' },
  newspaper: { head: ['stripes', '#ffffff', '#e0261c'], shaft: ['stripes', '#ffffff', '#e0261c'], accent: '#ffd21f' },
  cardboard: { head: ['paint', '#2a1f3a', '#120c1c'], shaft: ['metal', '#3a3346', '#1a1520'], accent: '#b15cff' },
  racer: { head: ['metal', '#2b2733', '#111111'], shaft: ['metal', '#4a4458', '#222222'], accent: '#ff2a2a' },
  ocean: { head: ['ghost', '#e8f4ff', '#9fffe8'], shaft: ['paint', '#f4f8ff', '#cfe0ff'], accent: '#9fffe8' },
  jungle: { head: ['slime', '#2fa83a', '#b6ff3a'], shaft: ['slime', '#2fa83a', '#b6ff3a'], accent: '#d6ff3a' },
  royal: { head: ['straw', '#e8c46a', '#a8782a'], shaft: ['wood', '#6a4422', '#3a2210'], accent: '#b15cff' },
  crystal: { head: ['gem', '#9ff6ff', '#ffffff'], shaft: ['metal', '#d8e4f0', '#8a9aaa'], accent: '#ff5bd8' },
  golden: { head: ['metal', '#ffc61a', '#a87400'], shaft: ['wood', '#4a2a14', '#2a160a'], accent: '#fff3b0' },
  candy: { head: ['corn', '#ffd21f', '#ff7a14'], shaft: ['metal', '#2a2430', '#111111'], accent: '#fff8e8' },
  ice: { head: ['ice', '#9fe0ff', '#ffffff'], shaft: ['ice', '#c9f3ff', '#ffffff'], accent: '#3f9cff' },
  lava: { head: ['lava', '#2a1210', '#ff6a1e'], shaft: ['metal', '#2a2028', '#120c10'], accent: '#ffb02a' },
  thunder: { head: ['bone', '#efe6d2', '#8a7a5a'], shaft: ['bone', '#efe6d2', '#8a7a5a'], accent: '#ffe14a' },
  neon: { head: ['neon', '#16161f', '#39ff88'], shaft: ['neon', '#16161f', '#39ff88'], accent: '#39ff88' },
  galaxy: { head: ['galaxy', '#1a0a3a', '#a46bff'], shaft: ['galaxy', '#1a0a3a', '#a46bff'], accent: '#7ff6ff' },
  dragon: { head: ['scales', '#1f8a4a', '#0a3a1c'], shaft: ['scales', '#1f8a4a', '#0a3a1c'], accent: '#ffd21f' },
  rainbow: { head: ['rainbow', '#ffffff', '#ffffff'], shaft: ['rainbow', '#ffffff', '#ffffff'], accent: '#ffffff' },
  diamond: { head: ['gem', '#e8fbff', '#9fe8ff'], shaft: ['metal', '#e8eef6', '#9aa6b8'], accent: '#5fc8ff' },
  cosmic: { head: ['galaxy', '#120a2a', '#ff5bd8'], shaft: ['galaxy', '#120a2a', '#ff5bd8'], accent: '#ff5bd8' },
}

/** The shape a club is built in: its own (unknown ids get the first club's). */
export const clubShape = (id) => (SHAPES[id] ? id : 'paper')

// Parsed once, so placing clubs allocates nothing.
const LOOKS = Object.fromEntries(
  Object.entries(CLUB_LOOKS).map(([id, l]) => [
    id,
    {
      pattern: [PATTERN[l.head[0]], PATTERN[l.shaft[0]]],
      colors: [l.head[1], l.head[2], l.shaft[1], l.shaft[2], l.accent].map((c) => new Color(c)),
    },
  ]),
)
/** A club's accent colour: what glows on it, and the light it throws in the shop. */
export const clubGlow = (id) => (LOOKS[id] || LOOKS.paper).colors[4]

// --- Shapes ----------------------------------------------------------------------------

// Small builders, all in the club's frame.
const Y_AXIS_UP = [0, 0, 0]
function cyl(p, rTop, rBot, yTop, yBot, part, { x = 0, z = 0, seg = 10, color, rot = Y_AXIS_UP } = {}) {
  p.add(new CylinderGeometry(rTop, rBot, yTop - yBot, seg), { position: [x, (yTop + yBot) / 2, z], rotation: rot, color, style: part })
}
/** A cylinder of `length` centred on `position`, turned by `rot`. */
function rod(p, rTop, rBot, length, position, part, { rot = Y_AXIS_UP, color, seg = 10 } = {}) {
  p.add(new CylinderGeometry(rTop, rBot, length, seg), { position, rotation: rot, color, style: part })
}
function ball(p, r, position, part, { scale = 1, color, seg = 8 } = {}) {
  p.add(new SphereGeometry(r, seg, Math.max(6, seg - 2)), { position, scale, color, style: part })
}
/** A ring round the shaft at height `y`, tipped by `tilt` (a wrap's turn). */
function band(p, r, tube, y, part, { tilt = 0, color, seg = 10, z = 0 } = {}) {
  p.add(new TorusGeometry(r, tube, 4, seg), { position: [0, y, z], rotation: [Math.PI / 2 + tilt, 0, 0], color, style: part })
}
function cone(p, r, h, position, part, { rot = Y_AXIS_UP, color, seg = 8, scale = 1 } = {}) {
  p.add(new ConeGeometry(r, h, seg), { position, rotation: rot, scale, color, style: part })
}
const box = (p, x, y, z, w, h, d, part, color = '#ffffff', rot = Y_AXIS_UP) => p.box(x, y, z, w, h, d, color, part, rot)

/** The common plain shaft, from the grip down to the hosel. */
const shaft = (p, rTop = 0.03, rBot = 0.023, seg = 8) => cyl(p, rTop, rBot, -0.34, -1.22, PART.SHAFT, { seg })
/** A hosel angling the shaft into the head. */
const hosel = (p, z = 0.03) => cyl(p, 0.03, 0.038, -1.19, -1.29, PART.TRIM, { z, rot: [0.25, 0, 0], seg: 8 })
/** Grooves scored across a striking face. */
function grooves(p, y0, z, width, count = 3) {
  for (let i = 0; i < count; i += 1) box(p, 0, y0 + i * 0.03, z, width, 0.008, 0.01, PART.FIXED, '#8a8698')
}

/**
 * Twenty clubs, no two alike from the end of the grip to the sole: each its own handle,
 * shaft and head, after its name.
 */
const SHAPES = {
  /** Rusty Driver: a worn leather wrap, a riveted round wood. */
  paper(p) {
    cyl(p, 0.057, 0.05, 0.08, -0.34, PART.FIXED, { color: '#5a3a22' })
    for (let y = 0.05; y > -0.32; y -= 0.05) band(p, 0.056, 0.008, y, PART.FIXED, { tilt: 0.3, color: '#3a2414' })
    cyl(p, 0.064, 0.064, 0.12, 0.08, PART.TRIM)
    shaft(p)
    hosel(p)
    ball(p, 0.5, [0, -1.3, 0.14], PART.HEAD, { scale: [0.29, 0.2, 0.48], seg: 12 })
    box(p, 0, SOLE_Y + 0.02, 0.14, 0.24, 0.04, 0.4, PART.SOLE)
    box(p, 0, -1.3, 0.37, 0.2, 0.14, 0.03, PART.SHINY, '#d8d4cc')
    grooves(p, -1.33, 0.387, 0.15)
    for (const [x, z] of [[-0.09, 0.02], [0.09, 0.02], [-0.09, 0.26], [0.09, 0.26]]) ball(p, 0.014, [x, -1.215, z], PART.TRIM, { seg: 6 })
  },
  /** Pumpkin Putter: a vine-wound grip under a little pumpkin, a jack-o'-lantern head. */
  sky(p) {
    cyl(p, 0.054, 0.048, 0.06, -0.34, PART.FIXED, { color: '#2f6a1a' })
    for (let y = 0.02; y > -0.32; y -= 0.07) band(p, 0.055, 0.01, y, PART.FIXED, { tilt: -0.45, color: '#4a9a2a' })
    for (const [y, a] of [[-0.12, 0.6], [-0.26, -0.7]]) ball(p, 0.04, [Math.sin(a) * 0.07, y, Math.cos(a) * 0.07], PART.FIXED, { scale: [1, 0.35, 0.6], color: '#5ab83a' })
    ball(p, 0.06, [0, 0.11, 0], PART.FIXED, { scale: [1.2, 0.85, 1.2], color: '#ff7a14' })
    box(p, 0, 0.17, 0, 0.02, 0.05, 0.02, PART.FIXED, '#3f8a22')
    shaft(p, 0.028, 0.026)
    for (let y = -0.5; y > -1.15; y -= 0.2) band(p, 0.029, 0.007, y, PART.FIXED, { tilt: -0.5, color: '#4a9a2a' })
    const y = SOLE_Y + 0.14
    ball(p, 0.5, [0, y, 0.12], PART.HEAD, { scale: [0.36, 0.28, 0.32], seg: 12 })
    box(p, 0.01, y + 0.15, 0.12, 0.05, 0.07, 0.05, PART.FIXED, '#3f8a22')
    for (const side of [-1, 1]) box(p, side * 0.065, y + 0.03, 0.27, 0.06, 0.045, 0.03, PART.GLOW)
    box(p, 0, y - 0.05, 0.272, 0.15, 0.035, 0.03, PART.GLOW)
  },
  /** Candy Cane Club: striped top to toe, a peppermint on top and a bow, a hook for a head. */
  newspaper(p) {
    cyl(p, 0.046, 0.046, 0.08, -1.22, PART.SHAFT, { seg: 12 })
    cyl(p, 0.085, 0.085, 0.165, 0.125, PART.HEAD, { rot: [Math.PI / 2, 0, 0], seg: 12 })
    for (const side of [-1, 1]) box(p, side * 0.05, 0.03, 0.03, 0.08, 0.035, 0.02, PART.FIXED, '#2fbf4a', [0, 0, side * 0.5])
    ball(p, 0.022, [0, 0.03, 0.035], PART.FIXED, { color: '#2fbf4a', seg: 6 })
    const r = 0.12
    p.add(new TorusGeometry(r, 0.046, 8, 18, Math.PI), { position: [0, SOLE_Y + r + 0.046, r], rotation: [0, -Math.PI / 2, Math.PI], style: PART.HEAD })
    ball(p, 0.047, [0, SOLE_Y + r + 0.046, 2 * r], PART.HEAD, { seg: 8 })
  },
  /** Bat Wing Wedge: wings for a guard and a bat on top; a lofted wedge with wings at its back. */
  cardboard(p) {
    cyl(p, 0.052, 0.046, 0.06, -0.34, PART.FIXED, { color: '#2a1f3a' })
    for (let y = 0.0; y > -0.32; y -= 0.06) band(p, 0.053, 0.006, y, PART.FIXED, { color: '#120c1c' })
    ball(p, 0.055, [0, 0.11, 0], PART.FIXED, { color: '#1a1424' })
    for (const side of [-1, 1]) {
      cone(p, 0.022, 0.06, [side * 0.03, 0.17, 0], PART.FIXED, { color: '#1a1424', seg: 4 })
      box(p, side * 0.022, 0.12, 0.048, 0.016, 0.012, 0.01, PART.GLOW)
      // The guard: a wing either side, three bony fingers each.
      for (let k = 0; k < 3; k += 1) box(p, side * (0.08 + k * 0.025), -0.33 + k * 0.012, 0, 0.09 - k * 0.02, 0.014, 0.012, PART.FIXED, '#1a1424', [0, 0, side * (0.35 + k * 0.25)])
    }
    shaft(p, 0.026, 0.022)
    hosel(p, 0.02)
    // A wedge's steep loft: the blade leans back.
    box(p, 0, SOLE_Y + 0.085, 0.1, 0.32, 0.17, 0.06, PART.HEAD, '#ffffff', [-0.35, 0, 0])
    box(p, 0, SOLE_Y + 0.015, 0.11, 0.33, 0.03, 0.11, PART.SOLE)
    box(p, 0, SOLE_Y + 0.085, 0.132, 0.28, 0.13, 0.012, PART.SHINY, '#e8e6f0', [-0.35, 0, 0])
    for (const side of [-1, 1]) {
      for (let k = 0; k < 3; k += 1) box(p, side * (0.12 + k * 0.05), SOLE_Y + 0.13 + k * 0.03, 0.03, 0.1, 0.018, 0.016, PART.GLOW, '#ffffff', [0, 0, side * (0.5 + k * 0.2)])
    }
  },
  /** Spider Iron: web-wrapped, a spider for a pommel; a blade with legs and a red hourglass. */
  racer(p) {
    cyl(p, 0.05, 0.046, 0.06, -0.34, PART.FIXED, { color: '#141018' })
    for (let y = 0.02; y > -0.32; y -= 0.08) band(p, 0.051, 0.004, y, PART.FIXED, { color: '#d8d4e4' })
    for (let k = 0; k < 4; k += 1) box(p, Math.sin(k * 1.57) * 0.05, -0.14, Math.cos(k * 1.57) * 0.05, 0.004, 0.4, 0.004, PART.FIXED, '#d8d4e4')
    ball(p, 0.04, [0, 0.1, 0], PART.FIXED, { color: '#141018' })
    ball(p, 0.055, [0, 0.15, -0.05], PART.FIXED, { color: '#141018' })
    box(p, 0, 0.15, -0.106, 0.02, 0.04, 0.01, PART.GLOW)
    for (const side of [-1, 1]) for (let k = 0; k < 4; k += 1) box(p, side * 0.06, 0.08, -0.03 + k * 0.025, 0.09, 0.008, 0.008, PART.FIXED, '#141018', [0, (k - 1.5) * 0.35 * side, side * -0.6])
    shaft(p)
    cyl(p, 0.028, 0.034, -1.18, -1.32, PART.TRIM, { z: 0.02, rot: [0.3, 0, 0], seg: 8 })
    box(p, 0, SOLE_Y + 0.085, 0.1, 0.34, 0.17, 0.07, PART.HEAD)
    box(p, 0, SOLE_Y + 0.015, 0.1, 0.35, 0.03, 0.09, PART.SOLE)
    box(p, 0, SOLE_Y + 0.09, 0.137, 0.3, 0.14, 0.012, PART.SHINY, '#d8dce6')
    grooves(p, SOLE_Y + 0.05, 0.145, 0.26, 4)
    // The hourglass on its back, and legs reaching back off the blade.
    box(p, 0, SOLE_Y + 0.1, 0.062, 0.05, 0.03, 0.012, PART.GLOW, '#ffffff', [0, 0, 0.78])
    box(p, 0, SOLE_Y + 0.07, 0.062, 0.05, 0.03, 0.012, PART.GLOW, '#ffffff', [0, 0, 0.78])
    for (const side of [-1, 1]) for (let k = 0; k < 3; k += 1) box(p, side * (0.06 + k * 0.05), SOLE_Y + 0.12, 0.0, 0.012, 0.012, 0.16, PART.FIXED, '#141018', [0.7, side * (0.3 + k * 0.25), 0])
  },
  /** Ghost Driver: a wisp of a grip under a little ghost; a ghost for a head, hem and all. */
  ocean(p) {
    cyl(p, 0.05, 0.044, 0.05, -0.34, PART.FIXED, { color: '#dfe8ff' })
    for (let y = 0.0; y > -0.32; y -= 0.09) band(p, 0.05, 0.007, y, PART.GLOW, { tilt: 0.5 })
    ball(p, 0.05, [0, 0.12, 0], PART.FIXED, { color: '#f4f8ff' })
    cone(p, 0.05, 0.08, [0, 0.06, 0], PART.FIXED, { rot: [Math.PI, 0, 0], color: '#f4f8ff' })
    for (const side of [-1, 1]) box(p, side * 0.018, 0.13, 0.045, 0.012, 0.02, 0.01, PART.FIXED, '#120c1c')
    shaft(p, 0.028, 0.022)
    hosel(p)
    const y = SOLE_Y + 0.08
    ball(p, 0.5, [0, y + 0.06, 0.13], PART.HEAD, { scale: [0.3, 0.28, 0.42], seg: 12 })
    // A wavy hem round its bottom.
    for (let k = 0; k < 6; k += 1) ball(p, 0.045, [Math.cos(k * 1.05) * 0.11, SOLE_Y + 0.045, 0.13 + Math.sin(k * 1.05) * 0.16], PART.HEAD, { seg: 8 })
    for (const side of [-1, 1]) ball(p, 0.025, [side * 0.05, y + 0.1, 0.33], PART.FIXED, { scale: [0.8, 1.3, 0.5], color: '#120c1c', seg: 8 })
    ball(p, 0.02, [0, y + 0.04, 0.338], PART.FIXED, { scale: [1, 1.3, 0.5], color: '#120c1c', seg: 8 })
  },
  /** Slime Iron: goo dripping off the grip and shaft, a blade wearing a blob and hanging drips. */
  jungle(p) {
    cyl(p, 0.052, 0.048, 0.06, -0.34, PART.FIXED, { color: '#1f7a2a' })
    for (const [x, y, z, r] of [[0.04, -0.05, 0.02, 0.02], [-0.03, -0.18, 0.04, 0.024], [0.02, -0.29, -0.04, 0.02], [0, 0.07, 0, 0.055]]) ball(p, r, [x, y, z], PART.GLOW, { seg: 8 })
    ball(p, 0.03, [0, -0.38, 0.0], PART.SHAFT, { scale: [1, 1.6, 1], seg: 8 })
    shaft(p, 0.03, 0.026)
    for (const y of [-0.62, -0.9, -1.1]) ball(p, 0.034, [0.01, y, 0.0], PART.SHAFT, { scale: [1, 1.5, 1], seg: 8 })
    cyl(p, 0.03, 0.04, -1.18, -1.3, PART.SHAFT, { z: 0.02, rot: [0.3, 0, 0], seg: 8 })
    box(p, 0, SOLE_Y + 0.085, 0.1, 0.34, 0.17, 0.08, PART.HEAD)
    box(p, 0, SOLE_Y + 0.09, 0.142, 0.3, 0.14, 0.012, PART.SHINY, '#cfe8c8')
    ball(p, 0.07, [0.04, SOLE_Y + 0.17, 0.08], PART.HEAD, { scale: [1.6, 0.7, 1], seg: 10 })
    for (const [x, len] of [[-0.12, 0.05], [-0.04, 0.08], [0.06, 0.04], [0.13, 0.07]]) ball(p, 0.02, [x, SOLE_Y + 0.17 - len, 0.05], PART.GLOW, { scale: [1, len * 22, 1], seg: 6 })
  },
  /** Witch Broom: a gnarled stick with a moon charm, a bundle of straw. */
  royal(p) {
    cyl(p, 0.04, 0.036, 0.1, -1.18, PART.SHAFT, { seg: 8 })
    for (const [x, y, z] of [[0.02, -0.08, 0.02], [-0.025, -0.36, 0.01], [0.02, -0.7, -0.02], [-0.02, -0.98, 0.02]]) ball(p, 0.03, [x, y, z], PART.SHAFT, { scale: [1, 1.4, 1], seg: 8 })
    cyl(p, 0.03, 0.04, 0.17, 0.09, PART.SHAFT, { x: 0.015, rot: [0, 0, -0.35], seg: 8 })
    p.add(new TorusGeometry(0.035, 0.009, 6, 12, Math.PI * 1.3), { position: [0.05, 0.01, 0.03], rotation: [0, 0, -1.2], color: '#ffe14a', style: PART.FIXED })
    box(p, 0.045, 0.06, 0.03, 0.004, 0.04, 0.004, PART.FIXED, '#9a8a6a')
    cyl(p, 0.06, 0.17, SOLE_Y + 0.3, SOLE_Y, PART.HEAD, { z: 0.04, seg: 12 })
    cyl(p, 0.072, 0.078, SOLE_Y + 0.295, SOLE_Y + 0.245, PART.GLOW, { z: 0.035, seg: 12 })
    cyl(p, 0.098, 0.106, SOLE_Y + 0.21, SOLE_Y + 0.175, PART.GLOW, { z: 0.04, seg: 12 })
  },
  /** Crystal Skull: silver bands and a gem on top, crystal shards up the shaft, a crystal skull. */
  crystal(p) {
    cyl(p, 0.05, 0.046, 0.06, -0.34, PART.FIXED, { color: '#cfd8e4' })
    for (let y = 0.02; y > -0.32; y -= 0.1) band(p, 0.051, 0.01, y, PART.SHINY, { color: '#eef2f8' })
    p.add(new OctahedronGeometry(0.05, 0), { position: [0, 0.13, 0], scale: [1, 1.5, 1], style: PART.HEAD })
    shaft(p)
    for (const [y, a] of [[-0.55, 0.5], [-0.85, -1.4]]) p.add(new OctahedronGeometry(0.035, 0), { position: [Math.sin(a) * 0.03, y, Math.cos(a) * 0.03], scale: [0.8, 1.6, 0.8], rotation: [0.3, 0, 0.3], style: PART.HEAD })
    hosel(p)
    const y = SOLE_Y + 0.165
    ball(p, 0.5, [0, y, 0.12], PART.HEAD, { scale: [0.3, 0.27, 0.3], seg: 12 })
    box(p, 0, SOLE_Y + 0.045, 0.16, 0.17, 0.09, 0.15, PART.HEAD)
    for (const side of [-1, 1]) box(p, side * 0.06, y, 0.262, 0.065, 0.055, 0.03, PART.GLOW)
    box(p, 0, y - 0.06, 0.262, 0.03, 0.035, 0.02, PART.FIXED, '#120c1c')
    box(p, 0, SOLE_Y + 0.075, 0.238, 0.12, 0.025, 0.02, PART.FIXED, '#f4efe9')
  },
  /** Golden Scythe: a wooden snath with a gold peg to hold, a long curved golden blade. */
  golden(p) {
    cyl(p, 0.042, 0.04, 0.1, -1.22, PART.SHAFT, { seg: 10 })
    for (const y of [0.06, -0.3]) band(p, 0.043, 0.01, y, PART.TRIM)
    cyl(p, 0.02, 0.022, 0.0, -0.14, PART.TRIM, { x: 0.07, rot: [0, 0, Math.PI / 2], seg: 8 })
    ball(p, 0.022, [0.14, -0.07, 0], PART.TRIM, { seg: 8 })
    box(p, 0, -1.3, 0.04, 0.08, 0.13, 0.08, PART.TRIM)
    const point = (t) => [0.03 + 0.44 * t, 0.06 + 0.26 * t * t]
    const SEGMENTS = 6
    for (let i = 0; i < SEGMENTS; i += 1) {
      const [x0, z0] = point(i / SEGMENTS)
      const [x1, z1] = point((i + 1) / SEGMENTS)
      const len = Math.hypot(x1 - x0, z1 - z0) + 0.01
      const yaw = Math.atan2(-(z1 - z0), x1 - x0)
      const h = 0.11 * (1 - 0.55 * (i / SEGMENTS))
      box(p, (x0 + x1) / 2, SOLE_Y + h / 2, (z0 + z1) / 2, len, h, 0.03, PART.HEAD, '#ffffff', [0, yaw, 0])
      box(p, (x0 + x1) / 2, SOLE_Y + h + 0.006, (z0 + z1) / 2, len, 0.012, 0.034, PART.GLOW, '#ffffff', [0, yaw, 0])
    }
  },
  /** Candy Corn Cannon: a candy-corn grip and pommel, an iron shaft, a cannon on little wheels. */
  candy(p) {
    for (const [top, bottom, color] of [[0.06, -0.08, '#fff8e8'], [-0.08, -0.21, '#ff7a14'], [-0.21, -0.34, '#ffd21f']]) cyl(p, 0.05, 0.054, top, bottom, PART.FIXED, { color })
    cyl(p, 0.0, 0.03, 0.2, 0.15, PART.FIXED, { color: '#fff8e8' })
    cyl(p, 0.03, 0.045, 0.15, 0.1, PART.FIXED, { color: '#ff7a14' })
    cyl(p, 0.045, 0.055, 0.1, 0.06, PART.FIXED, { color: '#ffd21f' })
    shaft(p, 0.032, 0.03)
    for (const y of [-0.5, -0.8, -1.1]) band(p, 0.033, 0.009, y, PART.TRIM)
    box(p, 0, -1.19, 0.03, 0.09, 0.1, 0.09, PART.TRIM)
    const y = SOLE_Y + 0.12
    rod(p, 0.1, 0.12, 0.42, [0, y, 0.1], PART.HEAD, { rot: [Math.PI / 2, 0, 0], seg: 12 })
    p.add(new TorusGeometry(0.1, 0.022, 6, 14), { position: [0, y, 0.31], style: PART.TRIM })
    rod(p, 0.072, 0.072, 0.01, [0, y, 0.312], PART.FIXED, { rot: [Math.PI / 2, 0, 0], color: '#120c10', seg: 12 })
    for (const side of [-1, 1]) p.add(new TorusGeometry(0.06, 0.016, 6, 12), { position: [side * 0.13, SOLE_Y + 0.076, 0.02], rotation: [0, Math.PI / 2, 0], color: '#5a3418', style: PART.FIXED })
  },
  /** Frozen Fang: icicles round a frosted grip, an icicle tip; a great curved fang of ice. */
  ice(p) {
    cyl(p, 0.05, 0.046, 0.06, -0.34, PART.FIXED, { color: '#bfe8ff' })
    for (let k = 0; k < 6; k += 1) cone(p, 0.016, 0.07, [Math.cos(k * 1.05) * 0.055, -0.37, Math.sin(k * 1.05) * 0.055], PART.SHAFT, { rot: [Math.PI, 0, 0], seg: 5 })
    cone(p, 0.04, 0.14, [0, 0.13, 0], PART.SHAFT, { seg: 6 })
    shaft(p, 0.03, 0.024, 6)
    for (const y of [-0.6, -0.95]) band(p, 0.031, 0.008, y, PART.GLOW)
    cyl(p, 0.05, 0.06, -1.17, -1.26, PART.TRIM, { z: 0.03, seg: 8 })
    // The fang: three tapering sections curving forward and down to its point.
    const sections = [
      [0.075, 0.064, [0, -1.27, 0.06], -0.5],
      [0.064, 0.045, [0, -1.31, 0.16], -0.9],
      [0.045, 0.0, [0, -1.36, 0.26], -1.25],
    ]
    for (const [rTop, rBot, pos, tilt] of sections) cyl(p, rTop, rBot, pos[1] + 0.06, pos[1] - 0.06, PART.HEAD, { z: pos[2], rot: [tilt, 0, 0], seg: 8 })
    box(p, 0, SOLE_Y + 0.012, 0.15, 0.1, 0.024, 0.22, PART.SOLE)
    for (const [x, z] of [[-0.03, 0.08], [0.03, 0.16]]) cone(p, 0.012, 0.05, [x, -1.24, z], PART.GLOW, { seg: 5 })
  },
  /** Lava Lantern: chain-wrapped iron with a ring to hang it by, a lantern cage round a molten core. */
  lava(p) {
    cyl(p, 0.046, 0.046, 0.06, -0.34, PART.FIXED, { color: '#2a2028' })
    for (let k = 0; k < 7; k += 1) p.add(new TorusGeometry(0.03, 0.009, 5, 10), { position: [0, 0.03 - k * 0.055, 0.04], rotation: [0, k % 2 ? 0 : Math.PI / 2, 0], scale: [1, 1.5, 1], color: '#6a6070', style: PART.FIXED })
    p.add(new TorusGeometry(0.04, 0.012, 6, 14), { position: [0, 0.12, 0], style: PART.TRIM })
    shaft(p, 0.03, 0.028)
    cyl(p, 0.022, 0.022, -1.2, -1.24, PART.TRIM)
    const cx = 0
    const cz = 0.1
    const top = SOLE_Y + 0.27
    box(p, cx, SOLE_Y + 0.02, cz, 0.24, 0.04, 0.24, PART.HEAD)
    box(p, cx, top - 0.02, cz, 0.22, 0.04, 0.22, PART.HEAD)
    cone(p, 0.13, 0.06, [cx, top + 0.03, cz], PART.HEAD, { seg: 4, rot: [0, Math.PI / 4, 0] })
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(p, cx + x * 0.1, SOLE_Y + 0.14, cz + z * 0.1, 0.03, 0.22, 0.03, PART.TRIM)
    box(p, cx, SOLE_Y + 0.14, cz, 0.14, 0.18, 0.14, PART.GLOW)
    p.add(new TorusGeometry(0.035, 0.01, 6, 12), { position: [cx, top + 0.075, cz], style: PART.TRIM })
  },
  /** Thunder Bone: a bandaged knuckle of a grip, a bone shaft with a lightning charm, a thigh bone's end. */
  thunder(p) {
    for (const side of [-1, 1]) ball(p, 0.045, [side * 0.035, 0.1, 0], PART.SHAFT, { seg: 10 })
    cyl(p, 0.05, 0.05, 0.07, -0.34, PART.SHAFT, { seg: 10 })
    for (let y = 0.03; y > -0.32; y -= 0.045) band(p, 0.052, 0.01, y, PART.FIXED, { tilt: 0.4, color: '#cfc2a2' })
    cyl(p, 0.042, 0.036, -0.34, -1.22, PART.SHAFT, { seg: 8 })
    for (const y of [-0.4, -1.18]) ball(p, 0.058, [0, y, 0], PART.SHAFT, { seg: 8 })
    // A lightning bolt clipped to the bone.
    box(p, 0.045, -0.62, 0.0, 0.016, 0.1, 0.01, PART.GLOW, '#ffffff', [0, 0, 0.5])
    box(p, 0.05, -0.69, 0.0, 0.03, 0.012, 0.01, PART.GLOW)
    box(p, 0.055, -0.75, 0.0, 0.016, 0.1, 0.01, PART.GLOW, '#ffffff', [0, 0, 0.5])
    const y = SOLE_Y + 0.09
    for (const side of [-1, 1]) ball(p, 0.09, [side * 0.075, y, 0.1], PART.HEAD, { seg: 10 })
    cyl(p, 0.065, 0.065, y + 0.085, y - 0.065, PART.HEAD, { z: 0.1, rot: [0, 0, Math.PI / 2] })
    cyl(p, 0.05, 0.06, y + 0.16, y + 0.04, PART.HEAD, { z: 0.06, rot: [-0.5, 0, 0] })
    band(p, 0.05, 0.014, -1.1, PART.GLOW)
  },
  /** Neon Reaper: a hexagonal grip ringed in neon, a lit hex shaft, an angular double blade. */
  neon(p) {
    cyl(p, 0.05, 0.05, 0.06, -0.34, PART.FIXED, { color: '#16161f', seg: 6 })
    for (const y of [0.03, -0.12, -0.27]) band(p, 0.053, 0.009, y, PART.GLOW, { seg: 6 })
    p.add(new OctahedronGeometry(0.045, 0), { position: [0, 0.12, 0], scale: [1, 1.4, 1], style: PART.GLOW })
    cyl(p, 0.03, 0.026, -0.34, -1.22, PART.SHAFT, { seg: 6 })
    box(p, 0, -1.29, 0.04, 0.07, 0.15, 0.07, PART.TRIM, '#ffffff', [0, Math.PI / 4, 0])
    // Two straight blades in a chevron, the long one forward, the short one back.
    const blades = [
      [0.2, 0.12, 0.38, -0.55],
      [-0.12, -0.02, 0.22, 2.4],
    ]
    for (const [x, z, len, yaw] of blades) {
      box(p, x, SOLE_Y + 0.05, z, len, 0.1, 0.025, PART.HEAD, '#ffffff', [0, yaw, 0])
      box(p, x, SOLE_Y + 0.106, z, len, 0.012, 0.03, PART.GLOW, '#ffffff', [0, yaw, 0])
    }
  },
  /** Galaxy Ghoul: a ring orbiting the grip, a planet on top; a long alien ghoul's head. */
  galaxy(p) {
    cyl(p, 0.05, 0.046, 0.06, -0.34, PART.FIXED, { color: '#1a0a3a' })
    band(p, 0.085, 0.008, -0.14, PART.GLOW, { tilt: 0.45, seg: 18 })
    ball(p, 0.055, [0, 0.12, 0], PART.SHAFT, { seg: 12 })
    p.add(new TorusGeometry(0.085, 0.01, 6, 18), { position: [0, 0.12, 0], rotation: [Math.PI / 2 + 0.35, 0, 0], style: PART.GLOW })
    shaft(p)
    hosel(p)
    const y = SOLE_Y + 0.13
    // A long skull swept back, two big slanted eyes, a slit of a mouth, two feelers.
    ball(p, 0.5, [0, y, 0.12], PART.HEAD, { scale: [0.26, 0.26, 0.44], seg: 12 })
    ball(p, 0.07, [0, SOLE_Y + 0.05, 0.25], PART.HEAD, { scale: [1, 0.8, 1], seg: 10 })
    for (const side of [-1, 1]) box(p, side * 0.055, y + 0.02, 0.31, 0.07, 0.035, 0.03, PART.GLOW, '#ffffff', [0, 0, side * -0.4])
    box(p, 0, SOLE_Y + 0.04, 0.318, 0.05, 0.008, 0.01, PART.FIXED, '#05020a')
    for (const side of [-1, 1]) cyl(p, 0.006, 0.01, y + 0.24, y + 0.12, PART.SHAFT, { x: side * 0.05, z: 0.04, rot: [-0.3, 0, side * 0.3], seg: 5 })
  },
  /** Dragon Spine: vertebrae for a grip and a claw on top, a spiked spine, a dragon's head. */
  dragon(p) {
    for (let k = 0; k < 7; k += 1) {
      const y = 0.04 - k * 0.055
      cyl(p, 0.058, 0.058, y + 0.016, y - 0.016, PART.SHAFT, { seg: 10 })
      cyl(p, 0.04, 0.04, y - 0.016, y - 0.039, PART.FIXED, { color: '#0a3a1c', seg: 8 })
    }
    for (let k = 0; k < 3; k += 1) cone(p, 0.016, 0.08, [Math.cos(k * 2.09) * 0.03, 0.1, Math.sin(k * 2.09) * 0.03], PART.FIXED, { rot: [Math.sin(k * 2.09) * 0.5, 0, -Math.cos(k * 2.09) * 0.5], color: '#f4efe0', seg: 5 })
    shaft(p, 0.032, 0.028)
    for (let y = -0.45; y > -1.15; y -= 0.13) cone(p, 0.014, 0.05, [0, y, -0.035], PART.FIXED, { rot: [-1.2, 0, 0], color: '#f4efe0', seg: 4 })
    // The head: a skull, a long snout to the front, horns swept back, glowing eyes.
    const y = SOLE_Y + 0.11
    box(p, 0, y, 0.06, 0.18, 0.16, 0.18, PART.HEAD)
    box(p, 0, SOLE_Y + 0.06, 0.22, 0.13, 0.1, 0.18, PART.HEAD)
    box(p, 0, SOLE_Y + 0.02, 0.2, 0.12, 0.04, 0.2, PART.SOLE)
    for (const side of [-1, 1]) {
      cone(p, 0.025, 0.14, [side * 0.07, y + 0.1, -0.02], PART.FIXED, { rot: [-0.9, 0, side * -0.2], color: '#f4efe0', seg: 5 })
      box(p, side * 0.06, y + 0.03, 0.152, 0.04, 0.025, 0.01, PART.GLOW)
      box(p, side * 0.035, SOLE_Y + 0.08, 0.312, 0.015, 0.015, 0.01, PART.FIXED, '#05020a')
    }
  },
  /** Rainbow Wraith: a ribbon-twisted grip under a cloud, a hooded wraith with a tattered hem. */
  rainbow(p) {
    cyl(p, 0.048, 0.044, 0.06, -0.34, PART.SHAFT, { seg: 10 })
    for (let y = 0.04; y > -0.32; y -= 0.06) band(p, 0.05, 0.01, y, PART.GLOW, { tilt: 0.7 })
    for (const [x, y, r] of [[0, 0.12, 0.05], [0.045, 0.1, 0.035], [-0.045, 0.1, 0.035]]) ball(p, r, [x, y, 0], PART.FIXED, { color: '#ffffff' })
    shaft(p, 0.028, 0.022)
    hosel(p, 0.05)
    // The hood, leaning forward; the dark of its face, two eyes; rags trailing down.
    cone(p, 0.17, 0.3, [0, SOLE_Y + 0.2, 0.1], PART.HEAD, { rot: [0.25, 0, 0], seg: 12 })
    ball(p, 0.065, [0, SOLE_Y + 0.13, 0.2], PART.FIXED, { scale: [1, 1.1, 0.6], color: '#05020a' })
    for (const side of [-1, 1]) box(p, side * 0.028, SOLE_Y + 0.14, 0.236, 0.02, 0.012, 0.01, PART.GLOW)
    for (let k = 0; k < 7; k += 1) cone(p, 0.03, 0.06, [Math.cos(k * 0.9) * 0.13, SOLE_Y + 0.03, 0.1 + Math.sin(k * 0.9) * 0.13], PART.HEAD, { rot: [Math.PI, 0, 0], seg: 4 })
  },
  /** Diamond Fang: a faceted grip set with stones, a diamond on top, a brilliant-cut diamond for a head. */
  diamond(p) {
    cyl(p, 0.05, 0.048, 0.06, -0.34, PART.SHINY, { color: '#dfe7f2', seg: 8 })
    for (const y of [-0.04, -0.2]) for (let k = 0; k < 4; k += 1) p.add(new OctahedronGeometry(0.014, 0), { position: [Math.cos(k * 1.57 + 0.4) * 0.05, y, Math.sin(k * 1.57 + 0.4) * 0.05], style: PART.GLOW })
    p.add(new OctahedronGeometry(0.06, 0), { position: [0, 0.13, 0], scale: [1, 1.3, 1], style: PART.HEAD })
    shaft(p, 0.03, 0.024, 8)
    for (const y of [-0.5, -0.8, -1.1]) band(p, 0.032, 0.008, y, PART.TRIM, { seg: 8 })
    cyl(p, 0.035, 0.05, -1.16, -1.22, PART.TRIM, { z: 0.06, seg: 8 })
    // Pavilion (point down, on the sole) and crown, eight-sided.
    const girdle = SOLE_Y + 0.2
    cone(p, 0.17, 0.2, [0, SOLE_Y + 0.1, 0.1], PART.HEAD, { rot: [Math.PI, 0, 0], seg: 8 })
    cyl(p, 0.1, 0.17, girdle + 0.08, girdle, PART.HEAD, { z: 0.1, seg: 8 })
  },
  /** Cosmic Reaper: a crescent moon for a pommel, rings of light; a crescent-moon blade with a star. */
  cosmic(p) {
    cyl(p, 0.05, 0.046, 0.06, -0.34, PART.FIXED, { color: '#120a2a' })
    for (const y of [0.02, -0.1, -0.22]) band(p, 0.051, 0.007, y, PART.GLOW, { tilt: -0.3 })
    p.add(new TorusGeometry(0.06, 0.018, 6, 14, Math.PI * 1.3), { position: [0, 0.14, 0], rotation: [0, 0, -0.9], style: PART.GLOW })
    shaft(p)
    cyl(p, 0.03, 0.04, -1.16, -1.24, PART.TRIM, { z: 0.02, seg: 8 })
    // The crescent: standing up, horns raised, its belly on the sole.
    const r = 0.17
    p.add(new TorusGeometry(r, 0.05, 8, 20, Math.PI * 1.25), { position: [0, SOLE_Y + r + 0.05, 0.08], rotation: [0, 0, Math.PI * 0.875], scale: [1, 1, 0.5], style: PART.HEAD })
    p.add(new TorusGeometry(r - 0.045, 0.01, 6, 20, Math.PI * 1.25), { position: [0, SOLE_Y + r + 0.05, 0.1], rotation: [0, 0, Math.PI * 0.875], style: PART.GLOW })
    p.add(new OctahedronGeometry(0.04, 0), { position: [0, SOLE_Y + r + 0.06, 0.08], scale: [1, 1.4, 0.5], style: PART.GLOW })
  },
}

/** Every club's id, one shape each. */
export const CLUB_SHAPES = Object.keys(SHAPES)

const baseGeometries = {}
/** One club's merged geometry, built once and shared by every mesh of it. */
function shapeGeometry(shape) {
  if (!baseGeometries[shape]) {
    const p = new PropBuilder()
    SHAPES[shape](p)
    baseGeometries[shape] = p.build()
  }
  return baseGeometries[shape]
}

// --- Material ------------------------------------------------------------------------

const vertexHead = /* glsl */ `
  attribute float aStyle;
  attribute vec2 aClub;
  attribute vec3 aHeadA;
  attribute vec3 aHeadB;
  attribute vec3 aShaftA;
  attribute vec3 aShaftB;
  attribute vec3 aAccent;
  varying vec3 vCPos;
  varying float vCPart;
  varying vec2 vCLook;
  varying vec3 vHA;
  varying vec3 vHB;
  varying vec3 vSA;
  varying vec3 vSB;
  varying vec3 vAc;
`

const vertexBody = /* glsl */ `
  vCPos = position;
  vCPart = aStyle;
  vCLook = aClub;
  vHA = aHeadA;
  vHB = aHeadB;
  vSA = aShaftA;
  vSB = aShaftB;
  vAc = aAccent;
`

const fragmentHead = /* glsl */ `
  uniform float uCTime;
  varying vec3 vCPos;
  varying float vCPart;
  varying vec2 vCLook;
  varying vec3 vHA;
  varying vec3 vHB;
  varying vec3 vSA;
  varying vec3 vSB;
  varying vec3 vAc;
  // Handed from the colour stage to the shine after lighting.
  vec3 cBase;
  float cMetal;
  float cSpec;
  float cGem;

  float cHash(vec3 p) {
    return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
  }
  float cNoise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(cHash(i), cHash(i + vec3(1, 0, 0)), f.x), mix(cHash(i + vec3(0, 1, 0)), cHash(i + vec3(1, 1, 0)), f.x), f.y),
      mix(mix(cHash(i + vec3(0, 0, 1)), cHash(i + vec3(1, 0, 1)), f.x), mix(cHash(i + vec3(0, 1, 1)), cHash(i + vec3(1, 1, 1)), f.x), f.y),
      f.z
    );
  }
  vec3 cHue(float h) {
    return clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
  }

  // A surface, from its pattern (see PATTERN in golfClub.js), two colours, the club's
  // accent and where on the club it is. Sets how it glows and shines.
  vec3 clubPattern(float pat, vec3 A, vec3 B, vec3 D, vec3 p, inout vec3 emit, inout float metal, inout float spec, inout float gem) {
    if (pat < 0.5) { spec = 0.5; return A; }
    if (pat < 1.5) { metal = 0.85; spec = 1.0; return A; }
    if (pat < 2.5) {
      // Wood: grain lines wandering along it, varnished.
      float ring = 0.5 + 0.5 * sin(p.x * 38.0 + p.z * 21.0 + cNoise(p * vec3(9.0, 2.0, 9.0)) * 3.5);
      spec = 0.35;
      return mix(B, A, smoothstep(0.15, 0.85, ring)) * (0.9 + 0.1 * cNoise(p * 60.0));
    }
    if (pat < 3.5) {
      // Gem: cut facets (see the shine), lit from within, sparkling.
      vec3 c = floor(p * 55.0);
      float twinkle = step(0.93, cHash(c)) * (0.5 + 0.5 * sin(uCTime * 4.0 + cHash(c + 3.1) * 30.0));
      emit += A * 0.3 + vec3(twinkle) * 0.8;
      gem = 1.0;
      spec = 1.6;
      return mix(A, B, 0.25) * 0.7;
    }
    if (pat < 4.5) {
      // Bone: ivory, mottled, with fine dark cracks.
      float crack = 1.0 - smoothstep(0.015, 0.045, abs(cNoise(p * 7.0 + 3.0) - 0.5));
      spec = 0.18;
      return mix(A * (0.84 + 0.16 * cNoise(p * 22.0)), B, crack * 0.7);
    }
    if (pat < 5.5) {
      // Lava: a dark crust split by glowing, creeping cracks.
      float crack = 1.0 - smoothstep(0.02, 0.08, abs(cNoise(p * 9.0 + vec3(0.0, uCTime * 0.25, 0.0)) - 0.5));
      emit += B * crack * (0.85 + 0.25 * sin(uCTime * 3.0 + p.y * 10.0)) * 1.3;
      spec = 0.25;
      return mix(A * (0.6 + 0.4 * cNoise(p * 14.0)), B, crack);
    }
    if (pat < 6.5) {
      // Candy stripes, spiralling.
      spec = 0.7;
      return mix(A, B, step(0.5, fract((p.y * 1.4 + p.x * 1.2 + p.z * 1.2) * 5.0)));
    }
    if (pat < 7.5) {
      // Galaxy: deep space, a nebula's glow and twinkling stars.
      float neb = cNoise(p * 6.0 + 1.7);
      vec3 c = floor(p * 70.0);
      float star = step(0.975, cHash(c)) * (0.55 + 0.45 * sin(uCTime * 3.0 + cHash(c + 7.0) * 40.0));
      emit += B * neb * neb * 0.6 + vec3(star);
      spec = 0.8;
      return mix(A, B, neb * 0.55);
    }
    if (pat < 8.5) {
      // Rusty metal: bright steel eaten by patches of rust.
      float rust = smoothstep(0.55, 0.85, cNoise(p * 9.0) + 0.5 * cNoise(p * 27.0));
      metal = 0.8 * (1.0 - rust);
      spec = 0.9 * (1.0 - rust) + 0.05;
      return mix(A, B, rust);
    }
    if (pat < 9.5) {
      // Ghost: pale and glowing, wisps drifting up through it.
      float wisp = cNoise(p * 7.0 + vec3(0.0, uCTime * 0.6, 0.0));
      emit += A * 0.45 + B * wisp * 0.45;
      gem = 0.4;
      spec = 0.8;
      return A;
    }
    if (pat < 10.5) {
      // Ice: frosted, glinting.
      gem = 0.6;
      spec = 1.3;
      emit += A * 0.22;
      return mix(A, B, cNoise(p * 26.0) * 0.6);
    }
    if (pat < 11.5) {
      vec3 c = cHue(fract(p.y * 1.3 + p.x * 2.0 + p.z * 1.5 + uCTime * 0.15));
      metal = 0.45;
      spec = 1.0;
      emit += c * 0.25;
      return c;
    }
    if (pat < 12.5) {
      // Slime: wet and glossy, brighter goo sliding down it.
      float wet = smoothstep(0.5, 0.75, cNoise(vec3(p.x * 14.0, p.y * 3.5 + uCTime * 0.35, p.z * 14.0)));
      emit += B * wet * 0.35;
      spec = 1.4;
      return mix(A, B, wet);
    }
    if (pat < 13.5) {
      // Pumpkin: ribbed, deeper in the grooves.
      vec3 q = p - vec3(0.0, -1.27, 0.12);
      spec = 0.35;
      return mix(B, A, 0.62 + 0.38 * cos(atan(q.x, q.z) * 8.0));
    }
    if (pat < 14.5) {
      // Straw: strands of two tones running down the bundle.
      vec3 q = p - vec3(0.0, -1.25, 0.04);
      float strand = cHash(vec3(floor(atan(q.x, q.z) * 9.0), 0.0, 0.0));
      spec = 0.15;
      return mix(A, B, strand * 0.7) * (0.85 + 0.15 * sin(p.y * 90.0 + strand * 6.0));
    }
    if (pat < 15.5) {
      // Candy corn, along the barrel: yellow, orange, a white tip.
      spec = 0.6;
      return p.z < 0.04 ? A : (p.z < 0.19 ? B : D);
    }
    if (pat < 16.5) {
      // Neon: black, wired with glowing lines.
      vec3 g = abs(fract(p * 9.0) - 0.5);
      float line = 1.0 - smoothstep(0.02, 0.06, min(min(g.x, g.y), g.z));
      emit += B * line * 1.4;
      spec = 0.9;
      return mix(A, B, line);
    }
    // Dragon scales.
    vec2 s = vec2(p.x * 26.0 + floor(p.y * 26.0) * 0.5, p.y * 26.0);
    metal = 0.3;
    spec = 0.8;
    return mix(A, B, smoothstep(0.3, 0.5, length(fract(s) - 0.5)));
  }
`

const colorBody = /* glsl */ `
  {
    float part = floor(vCPart + 0.5);
    vec3 col = diffuseColor.rgb;
    vec3 emit = vec3(0.0);
    float metal = 0.0;
    float spec = 0.12;
    float gem = 0.0;
    if (part == 2.0) col = clubPattern(vCLook.y, vSA, vSB, vAc, vCPos, emit, metal, spec, gem);
    else if (part == 3.0) col = clubPattern(vCLook.x, vHA, vHB, vAc, vCPos, emit, metal, spec, gem);
    else if (part == 1.0) { metal = 0.8; spec = 1.0; }
    else if (part == 4.0) { col = vHA * 0.35; metal = 0.5; spec = 0.6; }
    else if (part == 5.0) { col = vAc; emit = vAc * 0.9; spec = 0.4; }
    else if (part == 6.0) { col = vAc; metal = 0.75; spec = 1.0; }
    diffuseColor.rgb = col;
    totalEmissiveRadiance += emit;
    cBase = col;
    cMetal = metal;
    cSpec = spec;
    cGem = gem;
  }
`

/**
 * The shine, after lighting: metals mirror a night sky (purple below, lamplight above),
 * gems turn their facets to the light (flat normals from the screen-space derivatives),
 * and everything gets a highlight and a rim.
 */
const shineBody = /* glsl */ `
  {
    vec3 cV = normalize(vViewPosition);
    vec3 cN = normalize(normal);
    if (cGem > 0.0) {
      vec3 fN = normalize(cross(dFdx(vViewPosition), dFdy(vViewPosition)));
      if (dot(fN, cV) < 0.0) fN = -fN;
      cN = normalize(mix(cN, fN, cGem));
    }
    float cSky = reflect(-cV, cN).y * 0.5 + 0.5;
    vec3 cEnv = mix(vec3(0.10, 0.05, 0.18), vec3(1.0, 0.82, 0.58), smoothstep(0.45, 0.95, cSky));
    cEnv += vec3(0.55, 0.35, 1.0) * smoothstep(0.2, 0.45, cSky) * (1.0 - smoothstep(0.45, 0.7, cSky)) * 0.35;
    outgoingLight = mix(outgoingLight, cEnv * cBase * 1.4 + totalEmissiveRadiance, cMetal);
    vec3 cH = normalize(normalize(vec3(0.4, 0.85, 0.35)) + cV);
    float cS = pow(max(dot(cN, cH), 0.0), mix(24.0, 90.0, cGem));
    float cF = pow(1.0 - max(dot(cN, cV), 0.0), 3.0);
    outgoingLight += vec3(cS * cSpec) + cBase * cF * (0.2 + cGem * 0.9);
  }
`

let sharedMaterial = null

/** The one material every club uses, in every shape. */
export function clubMaterial() {
  if (!sharedMaterial) {
    sharedMaterial = new MeshLambertMaterial({ color: 0xffffff, vertexColors: true })
    sharedMaterial.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>\n${vertexHead}`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>\n${vertexBody}`)
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>\n${fragmentHead}`)
        .replace('#include <color_fragment>', `#include <color_fragment>\n${colorBody}`)
        .replace('#include <opaque_fragment>', `${shineBody}\n#include <opaque_fragment>`)
      shader.uniforms.uCTime = glowTime
    }
    sharedMaterial.customProgramCacheKey = () => 'club-v1'
  }
  return sharedMaterial
}

/**
 * Up to `max` clubs of one shape in one draw call. Place them with setMatrixAt, dress
 * each with `setClub(index, clubId)` (cheap to call every frame) and set `.count`.
 */
export function createClubMesh(shape, max) {
  const base = shapeGeometry(shape)
  // Its own geometry object (for its own per-instance looks), sharing the shape's buffers.
  const geometry = new BufferGeometry()
  for (const name of ['position', 'normal', 'color', 'aStyle']) geometry.setAttribute(name, base.getAttribute(name))
  const look = new InstancedBufferAttribute(new Float32Array(max * 2), 2)
  const colors = ['aHeadA', 'aHeadB', 'aShaftA', 'aShaftB', 'aAccent'].map((name) => {
    const attr = new InstancedBufferAttribute(new Float32Array(max * 3), 3)
    geometry.setAttribute(name, attr)
    return attr
  })
  geometry.setAttribute('aClub', look)

  const mesh = new InstancedMesh(geometry, clubMaterial(), max)
  mesh.count = 0
  mesh.frustumCulled = false
  mesh.castShadow = true
  mesh.userData.shape = shape
  const dressed = new Array(max).fill(null)
  mesh.setClub = (i, id) => {
    if (dressed[i] === id) return
    dressed[i] = id
    const l = LOOKS[id] || LOOKS.paper
    look.setXY(i, l.pattern[0], l.pattern[1])
    l.colors.forEach((c, k) => colors[k].setXYZ(i, c.r, c.g, c.b))
    look.needsUpdate = true
    for (const attr of colors) attr.needsUpdate = true
  }
  return mesh
}

/** Frees a mesh made by createClubMesh (the shape's shared geometry and the material stay). */
export function disposeClubMesh(mesh) {
  mesh.geometry.dispose()
  mesh.dispose()
}

/**
 * One mesh per shape, `max` clubs each, in a group: for drawing clubs of any shape (a
 * golfer's hand, the shop, everyone else's). `meshFor(clubId)` finds the mesh a club is
 * drawn by; meshes nobody uses stay hidden and cost no draw call.
 */
export function createClubSet(max) {
  const meshes = {}
  for (const shape of CLUB_SHAPES) {
    const mesh = createClubMesh(shape, max)
    mesh.visible = false
    meshes[shape] = mesh
  }
  return {
    meshes,
    list: Object.values(meshes),
    meshFor: (id) => meshes[clubShape(id)],
  }
}
