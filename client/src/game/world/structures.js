import {
  LANE_COUNT,
  LANE_DIR,
  LANE_FAR_X,
  LANE_FLOOR_HEIGHT,
  LANE_NEAR_X,
  LANE_PITCH,
  LANE_TARGET_X,
  LANE_WIDTH,
  laneCenterZ,
  SHOP_BOARD,
  SHOP_FACE,
  SHOP_STAGES,
} from '@shared/world'

import { STYLE } from '../materials'
import { cauldron, glowSpot, pumpkin } from './halloween'

/**
 * Static lobby structures, added as plain boxes to the world's shared BlockSet so they
 * render in the same single draw call as the hills.
 */

/**
 * Per-lane look, in lane order (matches LANES in shared/balance.js), as in the
 * reference: dark turf with a neon trim in the bay's colour and a themed arch over the
 * goal. `light` is the bay's glow colour, `arch` its arch.
 */
export const LANE_THEMES = [
  { floor: '#16361a', edge: '#b6ff3a', style: STYLE.STUDS, text: '#ffffff', light: '#ffb02a', arch: 'pumpkin' },
  { floor: '#143a20', edge: '#7dff3a', style: STYLE.STUDS, text: '#8dff4f', light: '#9dff6a', arch: 'rip' },
  { floor: '#1a2236', edge: '#e8e8f2', style: STYLE.STUDS, text: '#dfe7f0', light: '#e8e8f2', arch: 'web' },
  { floor: '#2a1650', edge: '#ff5cc8', style: STYLE.STUDS, text: '#ff9ce0', light: '#ff9ce0', arch: 'skull' },
  { floor: '#2a0c14', edge: '#ff2b2b', style: STYLE.STUDS, text: '#ff6a6a', light: '#ff4a4a', arch: 'bat' },
  { floor: '#1a1530', edge: '#ffa646', style: STYLE.LAVA, text: '#ff9a3c', light: '#ffa646', arch: 'witch' },
  { floor: '#16101e', edge: '#ff3b3b', style: STYLE.STUDS, text: '#ff5a5a', light: '#ff5a5a', arch: 'candy' },
  { floor: '#101018', edge: '#ffffff', style: STYLE.STUDS, text: '#ffffff', light: '#ff7ad9', arch: 'rainbow' },
  { floor: '#1b2266', edge: '#8a63ff', style: STYLE.GALAXY, text: '#a98bff', light: '#b49aff', arch: 'galaxy' },
]

const DARK = '#15121f'
/** The goal's crossbar height and half-width (see targets.js). */
const GOAL_TOP = 4.9
const GOAL_HALF = 1.9
/** Height of an arch's lintel over the goal. */
const ARCH_TOP = 6.4
/** Half the inner width of an arch, a little wider than the goal it frames. */
const ARCH_HALF = 2.55

/** A string of bulbs sagging between two points across the bay (along z). */
function bulbs(b, x, y, z0, z1, colors, sag = 0.35, count = 9) {
  for (let k = 0; k < count; k += 1) {
    const f = k / (count - 1)
    const yy = y - Math.sin(f * Math.PI) * sag
    b.add(x, yy, z0 + (z1 - z0) * f, 0.2, 0.2, 0.2, colors[k % colors.length], STYLE.GLOW)
  }
}

/**
 * The gallows frame over a bay's goal, as in the reference: two tall dark posts with a
 * beam across, a lamp glowing at each end, a strand of bulbs under the beam, and two
 * square practice targets hanging from it on chains, in the bay's colour.
 */
function gallows(b, x, cz, theme) {
  const top = ARCH_TOP
  for (const side of [-1, 1]) {
    const z = cz + side * ARCH_HALF
    b.addOn(x, 0, z, 0.38, top, 0.38, DARK, STYLE.SMOOTH)
    b.addOn(x, top, z, 0.55, 0.5, 0.55, theme.light, STYLE.GLOW)
    // A diagonal brace from post to beam.
    b.add(x, top - 0.75, z - side * 0.6, 0.18, 0.18, 1.5, DARK, STYLE.SMOOTH, 0, side * -0.75, 0)
  }
  b.addOn(x, top - 0.1, cz, 0.36, 0.36, ARCH_HALF * 2 + 0.5, DARK, STYLE.SMOOTH)
  bulbs(b, x - LANE_DIR * 0.05, top - 0.3, cz - ARCH_HALF + 0.3, cz + ARCH_HALF - 0.3, ['#ffe14a', '#ffffff', theme.light], 0.4, 11)
  // The hanging targets: a square board, a ring painted on it, on two short chains.
  for (const side of [-1, 1]) {
    const z = cz + side * 1.15
    for (const dz of [-0.32, 0.32]) b.add(x, top - 0.75, z + dz, 0.05, 0.8, 0.05, '#8a8698', STYLE.SMOOTH)
    b.add(x, top - 1.55, z, 0.1, 0.95, 0.95, side < 0 ? '#ff9a3a' : '#f4efe9', STYLE.SMOOTH)
    b.add(x - LANE_DIR * 0.06, top - 1.55, z, 0.04, 0.55, 0.55, theme.edge, STYLE.GLOW)
    b.add(x - LANE_DIR * 0.08, top - 1.55, z, 0.04, 0.3, 0.3, side < 0 ? '#ff9a3a' : '#f4efe9', STYLE.SMOOTH)
  }
}

/**
 * The training bays, as in the reference: dark turf floors edged in a thick neon line of
 * the bay's colour and open at the sides, a net goal with square jack-o-lanterns on its
 * posts and bulbs along its crossbar, a gallows frame with hanging targets behind it,
 * and glowing cauldrons between the entrances.
 * Plus the TRAINING sign on the wall above them (its lettering is in throwArea.js).
 */
export function buildLanes(blocks) {
  const length = Math.abs(LANE_FAR_X - LANE_NEAR_X)
  const midX = (LANE_NEAR_X + LANE_FAR_X) / 2
  const h = LANE_FLOOR_HEIGHT
  // A pumpkin at the goal end looks back down the bay towards the plaza.
  const face = LANE_DIR > 0 ? -Math.PI / 2 : Math.PI / 2

  for (let i = 0; i < LANE_COUNT; i += 1) {
    const theme = LANE_THEMES[i]
    const cz = laneCenterZ(i)

    blocks.addOn(midX, -0.1, cz, length, h + 0.1, LANE_WIDTH, theme.floor, theme.style)
    // A thick neon border down both sides and across the far end, as in the reference;
    // the entrance end stays open.
    for (const side of [-1, 1]) {
      blocks.addOn(midX, h, cz + side * (LANE_WIDTH / 2 - 0.2), length, 0.06, 0.34, theme.edge, STYLE.GLOW)
    }
    blocks.addOn(LANE_FAR_X - LANE_DIR * 0.2, h, cz, 0.34, 0.06, LANE_WIDTH - 0.06, theme.edge, STYLE.GLOW)
    // A short white tee line near the entrance, where the golfer stands.
    blocks.addOn(LANE_NEAR_X + LANE_DIR * 2.2, h, cz, 0.12, 0.03, 1.2, '#f4efe9', STYLE.SMOOTH)

    // The goal's trimmings (the goal itself is a prop, see targets.js): a square
    // jack-o-lantern on each post and a strand of bulbs along the crossbar.
    for (const side of [-1, 1]) pumpkin(blocks, LANE_TARGET_X, GOAL_TOP + 0.14, cz + side * GOAL_HALF, 0.38, face)
    bulbs(blocks, LANE_TARGET_X - LANE_DIR * 0.18, GOAL_TOP - 0.18, cz - GOAL_HALF + 0.25, cz + GOAL_HALF - 0.25, ['#ffe14a', '#ffffff'], 0.22, 9)

    gallows(blocks, LANE_TARGET_X + LANE_DIR * 0.9, cz, theme)

    // A cauldron bubbling green between this bay's entrance and the next one's.
    if (i < LANE_COUNT - 1) {
      const bz = cz + LANE_PITCH / 2
      cauldron(blocks, LANE_NEAR_X - LANE_DIR * 0.4, 0, bz, 0.5)
      glowSpot(LANE_NEAR_X - LANE_DIR * 0.4, 0, bz, '#7dff3a', 2.4, 0.6)
    }

    glowSpot(midX, h, cz, theme.light, 6.5, 0.45)
    glowSpot(LANE_TARGET_X, h, cz, theme.light, 4.2, 0.6)
    // The bay's colour washing up the wall behind its arch.
    glowSpot(LANE_TARGET_X + LANE_DIR * 3.55, 5, cz, theme.light, 3.3, 0.5, { yaw: (-LANE_DIR * Math.PI) / 2, height: 5.5 })
  }

  // The TRAINING sign on the wall behind the goals: a brown panel in a white frame.
  const signX = LANE_TARGET_X + LANE_DIR * 3.2
  const signZ = (laneCenterZ(0) + laneCenterZ(LANE_COUNT - 1)) / 2
  blocks.addOn(signX, 9, signZ, 0.5, 5.6, 24, '#f4efe9', STYLE.SMOOTH)
  blocks.addOn(signX - LANE_DIR * 0.12, 9.3, signZ, 0.5, 5, 23.4, '#8a3a24', STYLE.STUDS)
  // A little golf flag either side of the lettering.
  for (const end of [-1, 1]) {
    const z = signZ + end * 9.6
    blocks.addOn(signX - LANE_DIR * 0.42, 10.4, z, 0.1, 2.6, 0.12, '#f4efe9', STYLE.SMOOTH)
    blocks.add(signX - LANE_DIR * 0.42, 12.5, z + 0.5, 0.1, 0.6, 0.9, '#e0261c', STYLE.SMOOTH)
    blocks.add(signX - LANE_DIR * 0.42, 10.6, z, 0.1, 0.5, 1.8, '#3fa52f', STYLE.SMOOTH)
  }
}

/** Where the TRAINING sign's lettering goes: its centre, and the way it faces. */
export const TRAINING_SIGN = {
  x: LANE_TARGET_X + LANE_DIR * 3.2 - LANE_DIR * 0.42,
  y: 11.8,
  z: (laneCenterZ(0) + laneCenterZ(LANE_COUNT - 1)) / 2,
  width: 16,
  rotY: LANE_DIR > 0 ? -Math.PI / 2 : Math.PI / 2,
}

const STONE = '#b8aa9c'
const STONE_EDGE = '#8e8072'
const BRICK = '#8a3a24'
const GOLD = '#ffd21f'

/**
 * The golf club shop, as in the reference: two stepped stone tiers along the west wall
 * (the pedestals on them are PlaneShop's) and the GOLF CLUBS sign on the wall behind -
 * a brown panel in a white frame with gold lightning bolts. `detail` (off on LOW) adds
 * the sign's bulbs.
 *
 * No two faces here share a plane: every layer stands a clear step proud of what it
 * sits on.
 */
export function buildShop(blocks, { detail = true } = {}) {
  for (const s of SHOP_STAGES) {
    const w = s.maxX - s.minX
    const d = s.maxZ - s.minZ
    const cx = (s.minX + s.maxX) / 2
    const cz = (s.minZ + s.maxZ) / 2
    blocks.addOn(cx, -0.1, cz, w, s.height + 0.1, d, STONE, STYLE.STUDS)
    // A darker lip along the tier's front edge.
    blocks.addOn(cx + SHOP_FACE * (w / 2 - 0.2), s.height, cz, 0.4, 0.06, d, STONE_EDGE, STYLE.SMOOTH)
  }

  const { x, minZ, maxZ, top } = SHOP_BOARD
  const length = maxZ - minZ
  const midZ = (minZ + maxZ) / 2
  const bottom = top - 6
  blocks.addOn(x, bottom, midZ, 0.5, top - bottom, length, '#f4efe9', STYLE.SMOOTH)
  blocks.addOn(x + SHOP_FACE * 0.12, bottom + 0.3, midZ, 0.5, top - bottom - 0.6, length - 0.6, BRICK, STYLE.STUDS)
  // Lightning bolts either side of the lettering: a zigzag of two bars each.
  for (const end of [-1, 1]) {
    const z = midZ + end * (length / 2 - 2.6)
    blocks.add(x + SHOP_FACE * 0.42, bottom + 3.6, z + 0.3, 0.12, 2.0, 0.5, GOLD, STYLE.GLOW, 0, 0, -0.5)
    blocks.add(x + SHOP_FACE * 0.42, bottom + 2.4, z - 0.25, 0.12, 1.8, 0.5, GOLD, STYLE.GLOW, 0, 0, -0.5)
  }
  if (detail) {
    for (let z = minZ + 0.6; z <= maxZ - 0.59; z += 1.4) {
      blocks.add(x + SHOP_FACE * 0.3, bottom + 0.15, z, 0.16, 0.24, 0.24, Math.round(z) % 2 ? '#ffffff' : GOLD, STYLE.GLOW)
      blocks.add(x + SHOP_FACE * 0.3, top - 0.15, z + 0.7, 0.16, 0.24, 0.24, Math.round(z) % 2 ? GOLD : '#ffffff', STYLE.GLOW)
    }
  }
}
