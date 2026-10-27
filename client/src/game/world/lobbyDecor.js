import { CANDY_SHOP } from '@shared/world'
import { mulberry32 } from '@shared/rng'

import { STYLE } from '../materials'
import { PALETTE } from '../sceneStyle'
import { terrainHeight } from './terrain'
import { candyCorn, cauldron, glowSpot, lantern, mushroom, pumpkin, tombstone } from './halloween'

/**
 * The lobby's Halloween set dressing: the Candy Shop, the treasure chest, the quest
 * mailbox, the Event Starter altar, cauldrons, jack-o-lanterns and pumpkin lamps.
 *
 * Positions are in the open parts of the plaza between the bays, the Hit Zone, the shop
 * and the back wall. All of it is plain boxes in the world's block set, so it adds
 * no draw calls.
 */

/**
 * Where things stand, as in the reference: the Candy Shop and the quest mailbox at the
 * west end of the Hit Zone, the group-reward chest at its east end by the first bay,
 * and the Event Starter in the back wall's east corner. The Candy Shop faces south, to
 * the plaza.
 */
export { CANDY_SHOP }
export const EVENT_ALTAR = { x: -30, z: 31.5 }
export const MAILBOX = { x: -23.5, z: -31.5 }
export const CHEST = { x: 23.5, z: -36.2 }

/** A lollipop: a pale stick and a glowing candy disc on top. */
function lollipop(b, x, z, h, color) {
  b.addOn(x, 0, z, 0.14, h, 0.14, '#f4efe9', STYLE.SMOOTH)
  b.addOn(x, h, z, 0.95, 0.95, 0.22, color, STYLE.GLOW)
  b.addOn(x, h + 0.25, z + 0.12, 0.45, 0.45, 0.12, '#ffffff', STYLE.GLOW)
}

/** A jar of sweets: a glass-dark pot with a lid and a glowing heap inside. */
function candyJar(b, x, y, z, color) {
  b.addOn(x, y, z, 0.7, 0.8, 0.7, '#3a2a58', STYLE.SMOOTH)
  b.addOn(x, y + 0.1, z, 0.56, 0.6, 0.56, color, STYLE.GLOW)
  b.addOn(x, y + 0.8, z, 0.8, 0.14, 0.8, '#ffcf3a', STYLE.GLOW)
}

function candyShop(b) {
  const { x, z } = CANDY_SHOP
  const w = 7
  const d = 4
  // Back wall and side walls in warm brick, a counter across the front.
  b.addOn(x, 0, z - d / 2, w, 4.2, 0.6, '#a8451c', STYLE.STUDS)
  for (const side of [-1, 1]) b.addOn(x + side * (w / 2 - 0.3), 0, z, 0.6, 4.2, d, '#a8451c', STYLE.STUDS)
  b.addOn(x, 0, z + d / 2 - 0.5, w, 1.5, 1, '#ff8a14', STYLE.STUDS)
  b.addOn(x, 1.5, z + d / 2 - 0.5, w + 0.4, 0.25, 1.3, '#fff3d0', STYLE.SMOOTH)
  // Striped awning, stepping up towards the back, over the whole stall.
  for (let i = 0; i < 4; i += 1) {
    b.addOn(x, 4.2 + i * 0.45, z + d / 2 - 0.2 - i * 1.3, w + 1.2, 0.45, 1.3, i % 2 ? '#ffffff' : '#ff8a14', STYLE.SMOOTH)
  }
  // Candy on the counter and on the roof.
  candyCorn(b, x - 2.2, 1.75, z + d / 2 - 0.5, 0.35, 0.3)
  candyCorn(b, x + 0.4, 1.75, z + d / 2 - 0.5, 0.35, -0.2)
  b.addOn(x + 2.3, 1.75, z + d / 2 - 0.5, 0.7, 0.7, 0.7, '#ff5cc8', STYLE.GLOW)
  candyCorn(b, x + 2.6, 6.0, z - 0.6, 1.0, 0.4)
  // A glowing sign board above the counter, painted by the label.
  b.addOn(x, 3.1, z + d / 2 - 0.4, w - 1.4, 1.0, 0.2, '#2a1650', STYLE.SMOOTH)
  b.addOn(x, 4.1, z + d / 2 - 0.4, w - 1.4, 0.1, 0.25, '#ffd21f', STYLE.GLOW)
  // A trim of lights along the counter's edge, and the front corners dressed in candy.
  for (let i = 0; i < 9; i += 1) b.addOn(x - w / 2 + 0.5 + i * ((w - 1) / 8), 1.78, z + d / 2 + 0.2, 0.18, 0.18, 0.18, ['#ffd21f', '#ff5cc8', '#7dff3a'][i % 3], STYLE.GLOW)
  for (const side of [-1, 1]) {
    candyCorn(b, x + side * (w / 2 + 0.9), 0, z + d / 2 - 0.2, 1.3, side * 0.3)
    lollipop(b, x + side * (w / 2 + 2.1), z + d / 2 + 0.4, 2.6, side < 0 ? '#ff5cc8' : '#7dff3a')
    lollipop(b, x + side * (w / 2 + 2.9), z + d / 2 - 0.1, 2.1, side < 0 ? '#ffd21f' : '#b15cff')
  }
  // Jars of sweets and pumpkin-skin samples across the counter.
  candyJar(b, x - 1.4, 1.75, z + d / 2 - 0.5, '#ff5cc8')
  candyJar(b, x + 1.4, 1.75, z + d / 2 - 0.5, '#7dff3a')
  pumpkin(b, x - 0.7, 1.75, z + d / 2 - 0.5, 0.28, 0)
  pumpkin(b, x + 0.7, 1.75, z + d / 2 - 0.5, 0.28, 0)
  // A warm pool of light on the ground where customers stand.
  glowSpot(x, 0, z + d / 2 + 2.2, '#ff9a3c', 3.4, 0.7)
}

function chest(b) {
  const { x, z } = CHEST
  b.addOn(x, 0, z, 3.2, 1.5, 2.2, '#7a3a1c', STYLE.STUDS)
  b.addOn(x, 1.5, z, 3.2, 0.7, 2.2, '#8e4624', STYLE.STUDS)
  b.addOn(x, 2.1, z, 3.0, 0.3, 2.0, '#8e4624', STYLE.STUDS)
  for (const side of [-1, 1]) {
    b.addOn(x + side * 1.2, 0, z, 0.3, 2.4, 2.3, '#ffcf3a', STYLE.GLOW)
  }
  b.addOn(x, 1.0, z + 1.12, 0.6, 0.8, 0.14, '#ffcf3a', STYLE.GLOW)
  b.addOn(x, 1.15, z + 1.2, 0.2, 0.3, 0.1, '#15121f', STYLE.SMOOTH)
}

function mailbox(b) {
  const { x, z } = MAILBOX
  b.addOn(x, 0, z, 0.35, 2.2, 0.35, '#15121f', STYLE.SMOOTH)
  b.addOn(x, 2.2, z, 2.0, 1.2, 1.2, '#7a3a24', STYLE.STUDS)
  b.addOn(x, 2.45, z + 0.62, 1.2, 0.7, 0.1, '#f4efe9', STYLE.SMOOTH)
  // The glowing "!" above it: a bar and a dot.
  b.addOn(x, 4.9, z, 0.5, 1.5, 0.3, PALETTE.glow, STYLE.GLOW)
  b.addOn(x, 4.15, z, 0.5, 0.5, 0.3, PALETTE.glow, STYLE.GLOW)
}

function altar(b) {
  const { x, z } = EVENT_ALTAR
  b.addOn(x, 0, z, 6, 0.8, 6, '#15121f', STYLE.SMOOTH)
  b.addOn(x, 0.8, z, 5, 0.5, 5, '#b15cff', STYLE.GLOW)
  b.addOn(x, 1.3, z, 4.2, 3.2, 4.2, '#2a1650', STYLE.STUDS)
  b.addOn(x, 4.5, z, 4.8, 0.5, 4.8, '#3a2060', STYLE.SMOOTH)
  pumpkin(b, x, 5.0, z, 0.8, 0)
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      b.addOn(x + sx * 2.5, 0.8, z + sz * 2.5, 0.8, 0.8, 0.8, '#efe9df', STYLE.SMOOTH)
      b.addOn(x + sx * 2.5, 1.6, z + sz * 2.5, 0.5, 0.6, 0.5, '#b15cff', STYLE.GLOW)
    }
  }
  // Skulls on the front face, eyes aglow.
  for (const side of [-1, 1]) {
    b.addOn(x + side * 1.2, 1.6, z + 2.2, 0.9, 0.9, 0.3, '#f4efe9', STYLE.SMOOTH)
    b.add(x + side * 1.2, 2.2, z + 2.38, 0.5, 0.2, 0.08, '#b15cff', STYLE.GLOW)
  }
}

/**
 * @param {import('../blocks').BlockSet} blocks
 * @param {{ detail?: boolean }} options `detail` (off on LOW) adds the small trimmings
 */
export function buildLobbyDecor(blocks, { detail = true } = {}) {
  candyShop(blocks)
  chest(blocks)
  mailbox(blocks)
  altar(blocks)
  // Cauldrons flank the avenue where it meets the Hit Zone, mirrored.
  cauldron(blocks, -7, 0, -30.5, 0.9)
  cauldron(blocks, 7, 0, -30.5, 0.9)
  cauldron(blocks, -24, 0, 33, 0.9)

  // A few small jack-o-lanterns, in mirrored pairs by the avenue and the egg row.
  for (const [x, z] of [[-6, 22], [6, 22], [-9, -4], [9, -4]]) pumpkin(blocks, x, 0, z, 0.55, Math.atan2(-x, 14 - z))

  if (!detail) return

  // Pumpkin lamps round the edges of the plaza, leaving its middle open.
  for (const [x, z] of [[-19.5, 8], [-19.5, -20], [21, -14], [21, 14], [-46, 31], [44, 31], [-14, 21], [14, 21]]) lantern(blocks, x, 0, z, 3.4)

  // A scatter of toadstools and gravestones where the plaza meets the hills.
  const rand = mulberry32(17)
  for (let i = 0; i < 12; i += 1) {
    const x = -46 + rand() * 92
    const z = 31 + rand() * 4.5
    // The leaderboards stand along the back wall here.
    if (x > -38 && x < 37) continue
    if (rand() < 0.6) mushroom(blocks, x, 0, z, 0.6 + rand() * 0.5, rand() * 3)
    else tombstone(blocks, x, 0, z, 0.8 + rand() * 0.3, Math.PI + (rand() - 0.5) * 0.4)
  }
}

// --- Landmarks ------------------------------------------------------------------------

/** A square platform raised over the hill so a landmark has level ground to stand on. */
function pad(b, x, z, size) {
  let top = 0
  for (let dx = -size / 2; dx <= size / 2; dx += 4) for (let dz = -size / 2; dz <= size / 2; dz += 4) top = Math.max(top, terrainHeight(x + dx, z + dz))
  top += 0.6
  b.addOn(x, -8, z, size, top + 8, size, PALETTE.dirt, STYLE.TERRAIN)
  return top
}

/** The haunted house on the east hill, front to the plaza (west, -X). */
function hauntedHouse(b) {
  const x = 78
  const z = -16
  const base = pad(b, x, z, 34)
  const wall = '#3a2a52'
  // Main hall, an upper floor, and a steep stepped roof.
  b.addOn(x, base, z, 16, 9, 22, wall, STYLE.STUDS)
  b.addOn(x + 1, base + 9, z, 13, 6, 18, '#46335f', STYLE.STUDS)
  for (let i = 0; i < 5; i += 1) b.addOn(x + 1, base + 15 + i * 1.3, z, 14 - i * 2.6, 1.3, 19 - i * 2.8, i % 2 ? '#7a1f2a' : '#5a1620')
  // The tower, with a pointed hat.
  b.addOn(x - 1, base, z - 13, 7, 17, 7, '#4a3668', STYLE.STUDS)
  for (let i = 0; i < 6; i += 1) b.addOn(x - 1, base + 17 + i * 1.5, z - 13, 8.4 - i * 1.3, 1.5, 8.4 - i * 1.3, i % 2 ? '#7a1f2a' : '#5a1620')
  // Chimney, a glowing front door and lit windows facing the plaza.
  b.addOn(x + 3, base + 17, z + 6, 2, 5, 2, '#2a1c3a')
  b.addOn(x - 8.1, base, z, 0.3, 4.6, 3, '#ffb02a', STYLE.GLOW)
  b.addOn(x - 8.3, base, z, 0.3, 5, 3.6, '#1a1224', STYLE.SMOOTH)
  for (const dz of [-8, -4, 4, 8]) {
    b.add(x - 8.1, base + 6.4, z + dz, 0.25, 2.2, 1.6, '#ffd21f', STYLE.GLOW)
    b.add(x - 6.6, base + 12.2, z + dz * 0.7, 0.25, 2, 1.5, '#b15cff', STYLE.GLOW)
  }
  b.add(x - 2.4, base + 25.5, z - 13 - 3.55, 1.6, 2.2, 0.25, '#7dff3a', STYLE.GLOW)
  b.add(x - 4.52, base + 22, z - 13, 0.25, 2.2, 1.6, '#7dff3a', STYLE.GLOW)
  // A crooked fence and a few graves out front.
  for (let dz = -11; dz <= 11; dz += 2) b.addOn(x - 11, base, z + dz, 0.3, 1.6 + (dz % 4 ? 0 : 0.6), 0.3, '#15121f', STYLE.SMOOTH)
  b.addOn(x - 11, base + 1, z, 0.2, 0.2, 22, '#15121f', STYLE.SMOOTH)
  for (const dz of [-9, -3, 6, 10]) tombstone(b, x - 13.5, base, z + dz, 0.9, Math.PI / 2)
}

/** The witch's tower on the west hill: a crooked spire with a green glow. */
function witchTower(b) {
  const x = -80
  const z = -16
  const base = pad(b, x, z, 20)
  b.addOn(x, base, z, 9, 8, 9, '#3a2a52', STYLE.STUDS)
  b.addOn(x, base + 8, z, 7, 8, 7, '#46335f', STYLE.STUDS)
  b.addOn(x, base + 16, z, 5, 6, 5, '#523a72', STYLE.STUDS)
  b.addOn(x, base + 22, z, 8, 0.8, 8, '#2a1c3a')
  for (let i = 0; i < 6; i += 1) b.addOn(x, base + 22.8 + i * 1.6, z, 6.4 - i * 1.0, 1.6, 6.4 - i * 1.0, i % 2 ? '#5a1fa8' : '#46177e')
  b.addOn(x, base + 32.5, z, 0.6, 2, 0.6, '#b15cff', STYLE.GLOW)
  for (const [y, w] of [[base + 4, 1.6], [base + 11, 1.4], [base + 18.5, 1.2]]) {
    b.add(x + 4.6, y, z, 0.25, 2, w, '#7dff3a', STYLE.GLOW)
    b.add(x, y, z + 4.6, w, 2, 0.25, '#ffd21f', STYLE.GLOW)
  }
}

/**
 * Coloured light washing up the courtyard walls, as in the reference: pink along the
 * back wall behind the leaderboards and eggs, violet round the portal and the Event
 * Starter, warm orange behind the club shop.
 */
function wallLight() {
  const back = { yaw: Math.PI, height: 6.5 }
  for (const x of [-22, -11, 0, 11, 20]) glowSpot(x, 6, 35.95, '#ff4fc8', 5.5, 0.42, back)
  glowSpot(31, 6, 35.95, '#5c8aff', 6, 0.55, back)
  glowSpot(-30, 6, 35.95, '#b15cff', 6, 0.55, back)
  const west = { yaw: Math.PI / 2, height: 6.5 }
  for (const z of [-21, -7, 7]) glowSpot(-51.95, 6, z, '#ff8a2a', 6.5, 0.45, west)
}

export function buildLandmarks(blocks) {
  wallLight()
  hauntedHouse(blocks)
  witchTower(blocks)
}
