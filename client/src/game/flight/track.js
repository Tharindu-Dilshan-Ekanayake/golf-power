import { GREEN_RINGS, HOLES, ZONES } from '@shared/balance'
import { zoneIndexAt } from '@shared/logic'
import { mulberry32 } from '@shared/rng'
import { THROW_LINE_Z } from '@shared/world'

import { BlockSet } from '../blocks'
import { STYLE } from '../materials'
import {
  bones,
  candle,
  candyCane,
  candyCorn,
  cauldron,
  deadTree,
  blackPalm,
  lantern,
  lollipop,
  mushroom,
  pumpkin,
  tombstone,
  wisp,
} from '../world/halloween'

/**
 * The course, generated in 60 m chunks on demand. Each chunk is a BlockSet (one draw
 * call); content is seeded by chunk index, so every client builds an identical course
 * and a chunk can be thrown away and rebuilt at will.
 *
 * Metre `m` sits at world z = THROW_LINE_Z - m: the front edge of the Hit Zone, where
 * the lobby's ground ends and the course's begins.
 *
 * Laid out like the original throwing game's stages: a broad open landscape, a wide
 * fairway straight down the middle, and each biome's scenery spread out across both
 * sides in three bands - small things lining the fairway, buildings and features
 * behind them, and big landmarks far out towards the horizon. All of it Halloween.
 */

export const CHUNK = 60
/** Where the lobby's own ground plane stops and course ground takes over. */
const LOBBY_GROUND_END = 0
/** No side scenery this close to the lobby's cliff. */
const DECOR_START = 20
/** Width of the land the course runs across; beyond it is the sea. */
export const LAND_WIDTH = 360
/** Half the fairway's width, and of the fairway plus its kerbs. */
const FAIRWAY = 22
const KERB = 23.6
/** Where scenery may start, either side of the middle: just clear of the kerbs. */
const NEAR = KERB + 1.6

export const zAt = (m) => THROW_LINE_Z - m

/** Keep the fairway's lines this far from a hole: clear of its green and rim. */
const GREEN_CLEAR = GREEN_RINGS[GREEN_RINGS.length - 1].radius + 2

const fairway = (road, kerb, extra = {}) => ({ road, roadStyle: STYLE.CHECKER, kerb, roadHalf: FAIRWAY, kerbHalf: KERB, ...extra })

/** Per-zone look: ground, the fairway down the middle, its kerbs, gate and sky colours. */
export const ZONE_THEMES = {
  // Pumpkin Patch: farmland - fields of pumpkins, scarecrows and haunted farmhouses.
  neighbourhood: { ground: '#3d6e2c', ...fairway('#2f9a30', '#8c3a34'), gate: '#ff7a14', sky: ['#4f17bd', '#8a4ae0'] },
  // Haunted Bog: murky marsh, slime pools, witch huts on stilts and drowned trees.
  city: { ground: '#24405a', ...fairway('#2a6fc0', '#14306e'), gate: '#22d0ff', sky: ['#34109a', '#5a34c8'] },
  // Candy Corn Madness: a candyland of gingerbread houses and giant sweets.
  forest: { ground: '#e3913c', ...fairway('#ffc02a', '#ffffff'), gate: '#ff5cc8', sky: ['#7a22b8', '#e08ad8'] },
  // Spooky Jungle: giant toadstools, skull totems and a tangle of dead trees.
  desert: { ground: '#1b5a34', ...fairway('#2a9a52', '#3a2418'), gate: '#7dff3a', sky: ['#12306e', '#2a9a8a'] },
  // Frozen Crypt: a snowy graveyard of crypts, ice crystals and frozen trees.
  snow: { ground: '#e4ecff', ...fairway('#a8c4f0', '#6a86c8'), gate: '#7fe2ff', sky: ['#3a2ea8', '#a8a0f0'] },
  // Lava Dungeon: scorched rock, lava rivers and volcanoes on the horizon.
  volcano: { ground: '#3e2426', ...fairway('#6a3a38', '#ff6a14', { kerbStyle: STYLE.GLOW }), gate: '#ff4a1c', sky: ['#4a1040', '#c0502a'] },
  // Cursed Cemetery: row upon row of graves, mausoleums and a ruined chapel.
  cemetery: { ground: '#3c3252', ...fairway('#6e5e92', '#9a8ab4'), gate: '#b9a0ff', sky: ['#2a0f6a', '#6a3aa8'] },
  // Haunted Carnival: tents, a carousel, ferris wheels and lights everywhere.
  carnival: { ground: '#4a1c82', ...fairway('#9a3fe6', '#ffd21f', { kerbStyle: STYLE.GLOW }), gate: '#ff3b8a', sky: ['#4a1a9a', '#e05ac8'] },
  // Vampire Castle: towers and curtain walls rising either side, bats overhead.
  castle: { ground: '#30243c', ...fairway('#58587e', '#c2182b'), gate: '#c2182b', sky: ['#1a0a30', '#5a1a3a'] },
  // Moon Realm: a cosmic road floating in the dark among drifting rocks.
  space: { ground: null, ...fairway('#2a1f5c', '#b15cff', { roadStyle: STYLE.GALAXY, kerbStyle: STYLE.GLOW }), gate: '#b15cff', sky: ['#05051a', '#241544'] },
}

export const themeAt = (m) => ZONE_THEMES[ZONES[zoneIndexAt(m)].id]

/** Gate arches: a welcome arch into the Pumpkin Patch, then one at each zone start. */
export const GATES = ZONES.map((zone, i) => ({ zone, meter: i === 0 ? 60 : zone.start }))

const pick = (rand, list) => list[Math.floor(rand() * list.length)]

// --- Buildings and big features ------------------------------------------------------

const GLASS = ['#ffd21f', '#ffb02a', '#7dff3a', '#b15cff']

/** Two glowing windows (or more) on the face of a block turned towards the fairway. */
function windows(b, x, z, w, d, y, h, facing, color, count = 2) {
  const fx = x + facing * (w / 2 + 0.04)
  for (let i = 0; i < count; i += 1) {
    const dz = (i - (count - 1) / 2) * (d / count)
    b.add(fx, y, z + dz, 0.1, h, Math.min(1.4, d / count - 0.6), color, STYLE.GLOW)
  }
}

/**
 * A haunted house, front to the fairway (`facing` is +1/-1 along x): crooked walls, a
 * smaller upper floor, a steep stepped roof, a chimney, and windows lit from within.
 */
function hauntedHouse(b, x, z, rand, facing, s = 1) {
  const w = (8 + rand() * 3) * s
  const d = (9 + rand() * 4) * s
  const h = (5.5 + rand() * 2.5) * s
  const wall = pick(rand, ['#4a3a6a', '#3a4a5a', '#5a3a4a', '#3e4a3a', '#4a4458'])
  const glass = pick(rand, GLASS)
  b.addOn(x, 0, z, w, h, d, wall, STYLE.STUDS)
  b.addOn(x, 0, z, w + 0.3, 0.6, d + 0.3, '#2a2234', STYLE.SMOOTH)
  windows(b, x, z, w, d, h * 0.62, 1.4 * s, facing, glass)
  b.add(x + facing * (w / 2 + 0.05), 1.2 * s, z, 0.12, 2.4 * s, 1.4 * s, '#2a1a10', STYLE.SMOOTH)
  let top = h
  if (rand() < 0.65) {
    const uh = h * 0.6
    b.addOn(x - facing * 0.4, h, z, w * 0.7, uh, d * 0.7, wall, STYLE.STUDS)
    windows(b, x - facing * 0.4, z, w * 0.7, d * 0.7, h + uh * 0.55, 1.2 * s, facing, glass, 1)
    top += uh
  }
  const roof = pick(rand, ['#5a1620', '#1e1a2a', '#3a1a4a'])
  for (let i = 0; i < 4; i += 1) b.addOn(x, top + i * 1.1 * s, z, (w + 0.8) * (1 - i * 0.24), 1.1 * s, (d + 0.8) * (1 - i * 0.2), roof, STYLE.SMOOTH)
  b.addOn(x + facing * w * 0.2, top, z - d * 0.3, 1 * s, 4 * s, 1 * s, '#2a1c3a', STYLE.SMOOTH)
  // A jack-o-lantern on the step.
  pumpkin(b, x + facing * (w / 2 + 1.2), 0, z + d * 0.3, 0.45, facing > 0 ? Math.PI / 2 : -Math.PI / 2)
}

/** A red barn with a white-trimmed door and a stepped roof. */
function barn(b, x, z, facing) {
  b.addOn(x, 0, z, 10, 7, 14, '#8a2a22', STYLE.STUDS)
  for (let i = 0; i < 4; i += 1) b.addOn(x, 7 + i * 1.2, z, 11 - i * 2.8, 1.2, 15, '#3a1a14', STYLE.SMOOTH)
  b.add(x + facing * 5.05, 2.4, z, 0.12, 4.8, 4.4, '#f4efe9', STYLE.SMOOTH)
  b.add(x + facing * 5.1, 2.4, z, 0.12, 4.2, 3.8, '#5a1a14', STYLE.SMOOTH)
  b.add(x + facing * 5.1, 8, z, 0.12, 1.4, 1.4, '#ffb02a', STYLE.GLOW)
}

/** A scarecrow: post and crossbar, a sack shirt, a pumpkin head and a pointed hat. */
function scarecrow(b, x, z, rotY = 0) {
  b.addOn(x, 0, z, 0.3, 3.4, 0.3, '#5a3a20', STYLE.SMOOTH)
  b.addOn(x, 2.3, z, 0.3, 0.3, 2.8, '#5a3a20', STYLE.SMOOTH, rotY)
  b.addOn(x, 1.6, z, 0.9, 1.3, 1.2, '#7a5a8a', STYLE.STUDS, rotY)
  pumpkin(b, x, 3.1, z, 0.42, rotY + Math.PI / 2)
  b.addOn(x, 3.95, z, 1.2, 0.15, 1.2, '#1e1a2a', STYLE.SMOOTH)
  b.addOn(x, 4.1, z, 0.6, 0.7, 0.6, '#1e1a2a', STYLE.SMOOTH)
}

/** A field: a dark-earth plot of pumpkins in rows, a rail fence round it. */
function pumpkinField(b, x, z, w, d, rand) {
  b.addOn(x, -0.05, z, w, 0.14, d, '#3a2418', STYLE.STUDS)
  for (let px = -w / 2 + 1.6; px < w / 2 - 1; px += 3.2) {
    for (let pz = -d / 2 + 1.6; pz < d / 2 - 1; pz += 3.2) {
      if (rand() < 0.25) continue
      pumpkin(b, x + px, 0.09, z + pz, 0.4 + rand() * 0.25, rand() * 6, rand() < 0.2)
    }
  }
  for (const sx of [-1, 1]) b.addOn(x + sx * (w / 2), 0.7, z, 0.15, 0.15, d, '#6a4a2a', STYLE.SMOOTH)
  for (const sz of [-1, 1]) b.addOn(x, 0.7, z + sz * (d / 2), w, 0.15, 0.15, '#6a4a2a', STYLE.SMOOTH)
}

/** A hay bale. */
function hayBale(b, x, z, rand) {
  b.addOn(x, 0, z, 2, 1.2, 1.3, '#d8b04a', STYLE.STUDS, rand() * 3)
}

/** A witch's hut on stilts over the marsh, with a pointed roof and a green lit window. */
function witchHut(b, x, z, facing) {
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.addOn(x + sx * 2.4, 0, z + sz * 2.4, 0.4, 3, 0.4, '#3a2a1a', STYLE.SMOOTH)
  b.addOn(x, 3, z, 6.4, 0.4, 6.4, '#4a3420', STYLE.STUDS)
  b.addOn(x, 3.4, z, 5, 3.6, 5, '#4a5a3a', STYLE.STUDS)
  windows(b, x, z, 5, 5, 5.3, 1.2, facing, '#7dff3a', 1)
  for (let i = 0; i < 5; i += 1) b.addOn(x + i * 0.12, 7 + i * 1.2, z, 6.2 - i * 1.25, 1.2, 6.2 - i * 1.25, i % 2 ? '#3a1a4a' : '#2a123a', STYLE.SMOOTH)
  b.addOn(x + facing * 3.2, 0, z, 0.8, 3.2, 1.2, '#4a3420', STYLE.SMOOTH)
  cauldron(b, x + facing * 5, 0, z + 2, 0.7)
}

/** A slime pool on the marsh: a sheet of glowing green, rippling. */
function slimePool(b, x, z, w, d) {
  b.addOn(x, -0.04, z, w + 1, 0.1, d + 1, '#1a2e2a', STYLE.SMOOTH)
  b.addOn(x, 0, z, w, 0.08, d, '#2e7a5e', STYLE.SMOOTH)
  b.addOn(x, 0.02, z, w * 0.5, 0.08, d * 0.5, '#3a9a6e', STYLE.SMOOTH)
}

/** A flat lily pad with a pink bloom. */
function lilyPad(b, x, z, s, rand) {
  b.addOn(x, 0.08, z, 1.8 * s, 0.1, 1.8 * s, '#2fbf3a', STYLE.SMOOTH, rand() * 3)
  if (rand() < 0.5) b.addOn(x, 0.18, z, 0.5 * s, 0.4 * s, 0.5 * s, '#ff7ad9', STYLE.GLOW)
}

/** A bundle of reeds with brown cattail heads. */
function reeds(b, x, z, rand) {
  for (let i = 0; i < 4; i += 1) {
    const h = 2.4 + rand() * 1.6
    const dx = (rand() - 0.5) * 1.2
    b.addOn(x + dx, 0, z + (rand() - 0.5) * 1.2, 0.12, h, 0.12, '#3a7a2a', STYLE.SMOOTH)
    b.addOn(x + dx, h - 0.2, z, 0.26, 0.7, 0.26, '#6a3a1a', STYLE.SMOOTH)
  }
}

/** A gingerbread house: biscuit walls, a pink iced roof, gumdrops and a candy-cane door. */
function gingerbreadHouse(b, x, z, facing, rand) {
  b.addOn(x, 0, z, 8, 5.5, 9, '#a8642c', STYLE.STUDS)
  b.addOn(x, 5.2, z, 8.6, 0.4, 9.6, '#ffffff', STYLE.SMOOTH)
  for (let i = 0; i < 4; i += 1) b.addOn(x, 5.6 + i * 1.1, z, 8.4 - i * 2, 1.1, 9.4, i % 2 ? '#ff8ac8' : '#ff5cb0', STYLE.SMOOTH)
  windows(b, x, z, 8, 9, 3.5, 1.4, facing, '#fff3b0')
  b.add(x + facing * 4.05, 1.3, z, 0.12, 2.6, 1.6, '#ffffff', STYLE.STRIPES)
  for (let i = 0; i < 4; i += 1) b.addOn(x - 3 + i * 2, 9.6, z, 0.7, 0.6, 0.7, pick(rand, ['#7dff3a', '#5cd6ff', '#ffd21f', '#ff3b3b']), STYLE.GLOW)
}

/** A gumdrop: a small domed sweet. */
function gumdrop(b, x, z, s, color) {
  b.addOn(x, 0, z, 2.2 * s, 0.9 * s, 2.2 * s, color, STYLE.GLOW)
  b.addOn(x, 0.9 * s, z, 1.6 * s, 0.7 * s, 1.6 * s, color, STYLE.GLOW)
  b.addOn(x, 1.6 * s, z, 0.9 * s, 0.5 * s, 0.9 * s, '#ffffff', STYLE.SMOOTH)
}

/** A pink cotton-candy tree. */
function cottonCandy(b, x, z, s) {
  b.addOn(x, 0, z, 0.5 * s, 3 * s, 0.5 * s, '#f4efe9', STYLE.SMOOTH)
  b.addOn(x, 3 * s, z, 3.4 * s, 2 * s, 3.4 * s, '#ff9ad0', STYLE.GLOW)
  b.addOn(x, 4.8 * s, z, 2.4 * s, 1.4 * s, 2.4 * s, '#ffc4e6', STYLE.GLOW)
}

/** A skull totem: three stacked skulls, eyes aglow. */
function totem(b, x, z, s, glow) {
  b.addOn(x, 0, z, 1.6 * s, 0.6 * s, 1.6 * s, '#3a2a1a', STYLE.SMOOTH)
  for (let i = 0; i < 3; i += 1) {
    const y = 0.6 * s + i * 1.5 * s
    b.addOn(x, y, z, 1.3 * s, 1.4 * s, 1.3 * s, i % 2 ? '#d8cfc0' : '#efe9df', STYLE.SMOOTH)
    for (const ez of [-0.3, 0.3]) {
      b.add(x + 0.66 * s, y + 0.85 * s, z + ez * s, 0.08, 0.3 * s, 0.3 * s, glow, STYLE.GLOW)
      b.add(x - 0.66 * s, y + 0.85 * s, z + ez * s, 0.08, 0.3 * s, 0.3 * s, glow, STYLE.GLOW)
    }
  }
}

/** A rounded rock hill on the horizon, in steps, with a grass or snow cap. */
function hill(b, x, z, size, color, cap) {
  for (let i = 0; i < 5; i += 1) {
    const w = size * (1 - i * 0.18)
    b.addOn(x, i * size * 0.1, z, w, size * 0.1, w * 0.8, i === 4 ? cap : color, STYLE.STUDS)
  }
}

function rock(b, x, z, s, color) {
  b.addOn(x, -0.2, z, 2.4 * s, 1.6 * s, 2 * s, color, STYLE.STUDS, s * 0.7)
  b.addOn(x + 0.5 * s, 0.9 * s, z, 1.3 * s, 0.9 * s, 1.2 * s, color, STYLE.STUDS, s * 1.3)
}

function iceCrystal(b, x, z, s) {
  b.add(x, 1.4 * s, z, 1 * s, 3.4 * s, 1 * s, '#9fdcff', STYLE.GLOW, 0.4, 0, 0.25)
  b.add(x + 0.8 * s, 0.9 * s, z, 0.7 * s, 2.2 * s, 0.7 * s, '#c9eeff', STYLE.GLOW, 1.1, 0, -0.35)
}

/** A snowman with a jack-o-lantern for a head. */
function pumpkinSnowman(b, x, z) {
  b.addOn(x, 0, z, 2.4, 2.1, 2.4, '#ffffff')
  b.addOn(x, 2.1, z, 1.8, 1.6, 1.8, '#ffffff')
  pumpkin(b, x, 3.7, z, 0.6, Math.PI / 2)
  b.addOn(x, 2.6, z, 0.2, 0.2, 3.2, '#3a2a1a', STYLE.SMOOTH, 0.3)
}

/** A snow-capped dead tree. */
function snowyDeadTree(b, x, z, s, rand) {
  deadTree(b, x, 0, z, s, rand)
  b.addOn(x, 5.2 * s, z, 1.3 * s, 0.35 * s, 1.3 * s, '#ffffff', STYLE.SMOOTH)
}

/** A stone mausoleum with a glowing door facing the fairway, optionally snow-capped. */
function mausoleum(b, x, z, facing, snow = false) {
  b.addOn(x, 0, z, 8, 5, 7, '#8e86a0', STYLE.STUDS)
  b.addOn(x, 5, z, 9, 0.7, 8, '#6c6580', STYLE.SMOOTH)
  b.addOn(x, 5.7, z, 6, 0.8, 6, snow ? '#ffffff' : '#8e86a0', STYLE.STUDS)
  b.addOn(x, 6.5, z, 3.4, 0.8, 4, snow ? '#ffffff' : '#6c6580', STYLE.SMOOTH)
  b.addOn(x + facing * 4.02, 0, z, 0.2, 3, 2.4, '#b15cff', STYLE.GLOW)
  for (const dz of [-3.2, 3.2]) b.addOn(x + facing * 4.2, 0, z + dz, 0.8, 4.6, 0.8, '#6c6580', STYLE.SMOOTH)
}

/** A ruined chapel with a tall steeple and a glowing rose window. */
function chapel(b, x, z, facing) {
  b.addOn(x, 0, z, 12, 9, 18, '#6c6580', STYLE.STUDS)
  for (let i = 0; i < 4; i += 1) b.addOn(x, 9 + i * 1.4, z, 13 - i * 3.2, 1.4, 19, '#2a2238', STYLE.SMOOTH)
  b.addOn(x, 0, z - 10, 5, 18, 5, '#7a7290', STYLE.STUDS)
  for (let i = 0; i < 5; i += 1) b.addOn(x, 18 + i * 1.6, z - 10, 5.4 - i * 1.1, 1.6, 5.4 - i * 1.1, '#2a2238', STYLE.SMOOTH)
  b.addOn(x, 26, z - 10, 0.3, 2.4, 0.3, '#d8cfc0', STYLE.SMOOTH)
  b.addOn(x, 27, z - 10, 1.4, 0.3, 0.3, '#d8cfc0', STYLE.SMOOTH)
  b.add(x + facing * 6.05, 6, z, 0.12, 2.6, 2.6, '#b15cff', STYLE.GLOW)
  b.add(x + facing * 6.05, 13, z - 10, 0.12, 2, 1.4, '#ffd21f', STYLE.GLOW)
}

/** A section of black wrought-iron fence running along the course, spiked on top. */
function ironFence(b, x, zc, len) {
  b.addOn(x, 0.4, zc, 0.1, 0.12, len, '#15121f', STYLE.SMOOTH)
  b.addOn(x, 1.5, zc, 0.1, 0.12, len, '#15121f', STYLE.SMOOTH)
  for (let d = -len / 2; d <= len / 2; d += 0.9) {
    b.addOn(x, 0, zc + d, 0.12, 2, 0.12, '#15121f', STYLE.SMOOTH)
    b.addOn(x, 2, zc + d, 0.2, 0.3, 0.2, '#15121f', STYLE.SMOOTH)
  }
}

/** A crow perched on something. */
function crow(b, x, y, z) {
  b.add(x, y, z, 0.5, 0.45, 0.8, '#0a0810', STYLE.SMOOTH)
  b.add(x, y + 0.3, z + 0.45, 0.3, 0.3, 0.3, '#0a0810', STYLE.SMOOTH)
  b.add(x, y + 0.28, z + 0.68, 0.1, 0.1, 0.25, '#ff9a1f', STYLE.SMOOTH)
}

function volcano(b, x, z, size) {
  for (let i = 0; i < 6; i += 1) {
    const w = size * (1 - i / 7.5)
    b.addOn(x, i * size * 0.12, z, w, size * 0.12, w, i % 2 ? '#2f2a2d' : '#3a3337')
  }
  b.addOn(x, size * 0.72, z, size * 0.22, 0.4, size * 0.22, '#ff6a14', STYLE.LAVA)
}

/** A striped circus tent with a stepped roof and a flag. */
function tent(b, x, z, color, s = 1) {
  b.addOn(x, 0, z, 8 * s, 3.4 * s, 8 * s, color, STYLE.STRIPES)
  for (let i = 0; i < 4; i += 1) b.addOn(x, (3.4 + i * 1.1) * s, z, (9 - i * 2.2) * s, 1.1 * s, (9 - i * 2.2) * s, i % 2 ? '#ffffff' : color, STYLE.SMOOTH)
  b.addOn(x, 7.8 * s, z, 0.2, 1.8 * s, 0.2, '#f4efe9', STYLE.SMOOTH)
  b.addOn(x + 0.7, 9.1 * s, z, 1.4, 0.8, 0.1, '#ffd21f', STYLE.GLOW)
}

/** A ferris wheel turned to face the fairway: gondolas on spokes round a lit hub. */
function ferrisWheel(b, x, z, radius) {
  const cy = radius + 2.5
  b.addOn(x, 0, z - 2, 0.8, cy, 0.8, '#2a2234', STYLE.SMOOTH)
  b.addOn(x, 0, z + 2, 0.8, cy, 0.8, '#2a2234', STYLE.SMOOTH)
  const hues = ['#ff3b8a', '#ffd21f', '#5cd6ff', '#7dff3a', '#ff7a14', '#b15cff']
  const n = 12
  for (let i = 0; i < n; i += 1) {
    const a = (i / n) * Math.PI * 2
    b.add(x, cy + Math.sin(a) * radius * 0.5, z + Math.cos(a) * radius * 0.5, 0.22, radius, 0.22, '#d9d4e6', STYLE.SMOOTH, 0, a - Math.PI / 2, 0)
    b.add(x, cy + Math.sin(a) * radius - 0.9, z + Math.cos(a) * radius, 1.2, 1.4, 1.6, hues[i % hues.length], STYLE.GLOW)
  }
  b.add(x, cy, z, 1.4, 1.4, 1.4, '#ffd21f', STYLE.GLOW)
}

/** A carousel: a round base, poles with horses, a striped roof and a light on top. */
function carousel(b, x, z) {
  b.addOn(x, 0, z, 9, 0.6, 9, '#ffd21f', STYLE.GLOW)
  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * Math.PI * 2
    const px = x + Math.cos(a) * 3.4
    const pz = z + Math.sin(a) * 3.4
    b.addOn(px, 0.6, pz, 0.15, 4.4, 0.15, '#f4efe9', STYLE.SMOOTH)
    b.addOn(px, 1.6 + (i % 2) * 0.6, pz, 0.6, 0.8, 1.4, ['#ffffff', '#5a3a20', '#15121f', '#ff8ac8'][i % 4], STYLE.SMOOTH, a)
  }
  b.addOn(x, 0.6, z, 2, 4.4, 2, '#b15cff', STYLE.SMOOTH)
  for (let i = 0; i < 3; i += 1) b.addOn(x, 5 + i * 0.8, z, 10 - i * 3, 0.8, 10 - i * 3, i % 2 ? '#ffffff' : '#ff3b8a', STYLE.SMOOTH)
  b.addOn(x, 7.4, z, 0.8, 0.8, 0.8, '#ffd21f', STYLE.GLOW)
}

/** A balloon on a string. */
function balloon(b, x, y, z, color) {
  b.addOn(x, 0, z, 0.05, y, 0.05, '#d9d4e6', STYLE.SMOOTH)
  b.addOn(x, y, z, 1.1, 1.3, 1.1, color, STYLE.GLOW)
}

/** A red-striped popcorn cart with a glowing sign. */
function popcornCart(b, x, z) {
  b.addOn(x, 0.4, z, 1.8, 1.5, 2.4, '#e0261c', STYLE.STRIPES)
  b.addOn(x, 1.9, z, 2.2, 0.2, 2.8, '#ffffff', STYLE.SMOOTH)
  b.addOn(x, 2.1, z, 1.4, 0.9, 2.0, '#fff3b0', STYLE.GLOW)
  b.addOn(x, 3.0, z, 2.0, 0.3, 2.6, '#ff7a14', STYLE.SMOOTH)
  for (const dz of [-0.9, 0.9]) b.addOn(x, 0, z + dz, 0.2, 0.7, 0.7, '#15121f', STYLE.SMOOTH)
}

/** A string of bulbs hung across the fairway between two posts: a sagging zigzag. */
function stringLights(b, z, half, colorA, colorB) {
  for (const side of [-1, 1]) {
    b.addOn(side * half, 0, z, 0.4, 9, 0.4, '#15121f', STYLE.SMOOTH)
    b.addOn(side * half, 9, z, 0.7, 0.4, 0.7, colorA, STYLE.GLOW)
  }
  const n = 22
  for (let i = 0; i <= n; i += 1) {
    const k = i / n
    const x = -half + k * half * 2
    const y = 8.7 - Math.sin(k * Math.PI) * 2.4
    b.addOn(x, y, z, half * 2 / n + 0.1, 0.07, 0.07, '#2a2434', STYLE.SMOOTH)
    b.add(x, y - 0.25, z, 0.34, 0.34, 0.34, i % 2 ? colorA : colorB, STYLE.GLOW)
  }
}

/** A castle tower: stone shaft, battlements, a pointed roof and lit windows. */
function tower(b, x, z, h, s = 1) {
  const w = 6 * s
  b.addOn(x, 0, z, w, h, w, '#4a3a60', STYLE.STUDS)
  b.addOn(x, h, z, w * 1.2, 0.8, w * 1.2, '#3a2c50', STYLE.SMOOTH)
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.addOn(x + sx * w * 0.52, h + 0.8, z + sz * w * 0.52, 1.1, 1.1, 1.1, '#3a2c50', STYLE.SMOOTH)
  for (let i = 0; i < 5; i += 1) b.addOn(x, h + 0.8 + i * 1.5 * s, z, w * (0.85 - i * 0.17), 1.5 * s, w * (0.85 - i * 0.17), '#a8162a', STYLE.SMOOTH)
  for (const y of [h * 0.3, h * 0.55, h * 0.8]) {
    b.add(x, y, z + w / 2 + 0.02, 0.9, 1.5, 0.1, '#ffd21f', STYLE.GLOW)
    b.add(x + w / 2 + 0.02, y, z, 0.1, 1.5, 0.9, '#ffd21f', STYLE.GLOW)
    b.add(x - w / 2 - 0.02, y, z, 0.1, 1.5, 0.9, '#ffd21f', STYLE.GLOW)
  }
}

/** A run of castle curtain wall along the course, battlemented, `len` long. */
function curtainWall(b, x, zc, len, h) {
  b.addOn(x, 0, zc, 4, h, len, '#463a5a', STYLE.STUDS)
  for (let d = -len / 2 + 1; d < len / 2; d += 2.4) b.addOn(x, h, zc + d, 4.4, 1.2, 1.2, '#3a2c50', STYLE.SMOOTH)
}

/** A bat hanging in the air. */
function bat(b, x, y, z, s) {
  b.add(x, y, z, 0.7 * s, 0.7 * s, 0.9 * s, '#15121f', STYLE.SMOOTH)
  for (const side of [-1, 1]) b.add(x + side * 1.2 * s, y + 0.2 * s, z, 1.8 * s, 0.14 * s, 0.9 * s, '#c2182b', STYLE.SMOOTH, 0, 0, side * 0.4)
}

/** A flag pennant on a pole. */
function banner(b, x, z, color, trim) {
  b.addOn(x, 0, z, 0.2, 6.5, 0.2, '#15121f', STYLE.SMOOTH)
  b.addOn(x, 3.2, z + 0.7, 0.08, 3, 1.3, color, STYLE.SMOOTH)
  b.addOn(x, 3, z + 0.7, 0.1, 0.2, 1.3, trim, STYLE.GLOW)
  b.addOn(x, 6, z + 0.7, 0.1, 0.2, 1.3, trim, STYLE.GLOW)
}

function asteroid(b, x, y, z, s, rand) {
  b.add(x, y, z, 2.4 * s, 2 * s, 2.2 * s, pick(rand, ['#8a8a99', '#6f6f80', '#9a8f86']), STYLE.STUDS, rand() * 3, rand() * 3, rand() * 3)
}

function planet(b, x, y, z, r, color, ring) {
  b.add(x, y, z, r * 2, r * 1.4, r * 1.4, color, STYLE.GLOW)
  b.add(x, y, z, r * 1.4, r * 2, r * 1.4, color, STYLE.GLOW)
  b.add(x, y, z, r * 1.4, r * 1.4, r * 2, color, STYLE.GLOW)
  if (ring) b.add(x, y, z, r * 3.6, 0.3, r * 3.6, ring, STYLE.GLOW, 0.3, 0.2, 0)
}

// --- Gate ----------------------------------------------------------------------------

/** Height of a gate's beam: tall enough to frame the wide fairway. */
export const GATE_TOP = 20

function gate(b, meter, color, half) {
  const z = zAt(meter)
  const w = half * 2
  const top = GATE_TOP
  for (const x of [-half, half]) {
    b.addOn(x, 0, z, 3, 1.4, 3, '#15121f', STYLE.SMOOTH)
    b.addOn(x, 1.4, z, 2.2, top - 1.4, 2.2, color, STYLE.STRIPES)
    b.addOn(x, top + 1, z, 3, 3, 3, color, STYLE.GLOW)
    pumpkin(b, x, top + 4, z, 1.0, 0)
  }
  b.addOn(0, top - 0.4, z, w, 2.2, 2.2, '#15121f', STYLE.SMOOTH)
  b.addOn(0, top - 0.1, z + 1.2, w, 0.5, 0.3, color, STYLE.GLOW)
  b.addOn(0, top - 2.4, z, w, 0.5, 0.6, '#ffffff', STYLE.GLOW)
  for (let x = -half + 2; x <= half - 2; x += 2.5) b.add(x, top - 3.2, z + 0.2, 0.4, 0.4, 0.4, Math.round(x) % 2 ? color : '#ffffff', STYLE.GLOW)
}

// --- Chunk builder -------------------------------------------------------------------

/**
 * Calls `place(m, x, facing)` down both sides of the fairway, about every `spacing`
 * metres, at a random distance out between `near` and `far`. `facing` (+1/-1 along x)
 * turns a building's front to the fairway.
 */
function scatter(m0, m1, rand, density, spacing, near, far, place, chance = 0.85) {
  for (let m = m0 + spacing * rand(); m < m1; m += spacing * (0.7 + rand() * 0.6)) {
    if (m < DECOR_START) continue
    if (rand() > density) continue
    for (const side of [-1, 1]) {
      if (rand() < chance) place(m, side * (near + rand() * (far - near)), -side)
    }
  }
}

/** Like scatter, at a fixed distance out: a row lining the fairway. */
function line(m0, m1, rand, spacing, x, place) {
  for (let m = Math.ceil(Math.max(m0, DECOR_START) / spacing) * spacing; m < m1; m += spacing) {
    for (const side of [-1, 1]) place(m, side * x, -side)
  }
}

const NEAR_BAND = [NEAR, NEAR + 7]
const FAR_BAND = [80, 165]

const DECOR = {
  neighbourhood(b, m0, m1, rand, d) {
    line(m0, m1, rand, 24, NEAR, (m, x, f) => lantern(b, x, 0, zAt(m), 3.6, '#ffb02a', f > 0 ? Math.PI / 2 : -Math.PI / 2))
    scatter(m0, m1, rand, d, 11, ...NEAR_BAND, (m, x) => pumpkin(b, x, 0, zAt(m), 0.5 + rand() * 0.4, rand() * 6, rand() < 0.5))
    scatter(m0, m1, rand, d, 30, NEAR + 9, 40, (m, x) => pumpkinField(b, x, zAt(m), 12 + rand() * 6, 14 + rand() * 6, rand))
    scatter(m0, m1, rand, d, 24, NEAR + 6, 50, (m, x, f) => scarecrow(b, x, zAt(m), f > 0 ? 0 : Math.PI), 0.6)
    scatter(m0, m1, rand, d, 18, NEAR + 6, 60, (m, x) => hayBale(b, x, zAt(m), rand), 0.6)
    scatter(m0, m1, rand, d, 30, 52, 78, (m, x, f) => hauntedHouse(b, x, zAt(m), rand, f))
    scatter(m0, m1, rand, d, 70, 60, 90, (m, x, f) => barn(b, x, zAt(m), f), 0.5)
    scatter(m0, m1, rand, d, 8, ...FAR_BAND, (m, x) => deadTree(b, x, 0, zAt(m), 1.4 + rand() * 1.2, rand))
    scatter(m0, m1, rand, d, 60, 120, 170, (m, x) => hill(b, x, zAt(m), 40 + rand() * 30, '#2e4a2a', '#3d6e2c'), 0.6)
  },
  city(b, m0, m1, rand, d) {
    scatter(m0, m1, rand, d, 26, NEAR + 4, 60, (m, x) => slimePool(b, x, zAt(m), 10 + rand() * 12, 10 + rand() * 14))
    scatter(m0, m1, rand, d, 6, ...NEAR_BAND, (m, x) => (rand() < 0.5 ? reeds(b, x, zAt(m), rand) : lilyPad(b, x, zAt(m), 0.8 + rand() * 0.6, rand)))
    scatter(m0, m1, rand, d, 9, NEAR, 70, (m, x) => wisp(b, x, 1 + rand() * 3, zAt(m), 1.3))
    scatter(m0, m1, rand, d, 34, 40, 80, (m, x, f) => witchHut(b, x, zAt(m), f))
    scatter(m0, m1, rand, d, 7, NEAR + 4, 165, (m, x) => deadTree(b, x, 0, zAt(m), 1.2 + rand() * 1.6, rand))
    scatter(m0, m1, rand, d, 20, ...NEAR_BAND, (m, x, f) => tombstone(b, x, 0, zAt(m), 0.9, f > 0 ? Math.PI / 2 : -Math.PI / 2, '#5a5a8a'), 0.6)
    line(m0, m1, rand, 30, NEAR, (m, x) => lantern(b, x, 0, zAt(m), 3.6, '#22d0ff'))
  },
  forest(b, m0, m1, rand, d) {
    line(m0, m1, rand, 12, NEAR, (m, x) => candyCane(b, x, 0, zAt(m), 1.1))
    scatter(m0, m1, rand, d, 9, ...NEAR_BAND, (m, x) => gumdrop(b, x, zAt(m), 0.8 + rand() * 0.9, pick(rand, ['#ff5cc8', '#5cd6ff', '#7dff3a', '#ffd21f', '#b15cff'])))
    scatter(m0, m1, rand, d, 26, 30, 70, (m, x, f) => gingerbreadHouse(b, x, zAt(m), f, rand))
    scatter(m0, m1, rand, d, 12, 26, 90, (m, x) => lollipop(b, x, 0, zAt(m), 1.6 + rand() * 1.4, pick(rand, ['#ff5cc8', '#5cd6ff', '#7dff3a', '#ffd21f'])))
    scatter(m0, m1, rand, d, 14, 30, 110, (m, x) => candyCorn(b, x, 0, zAt(m), 1.4 + rand() * 2.2, rand() * 3))
    scatter(m0, m1, rand, d, 10, ...FAR_BAND, (m, x) => cottonCandy(b, x, zAt(m), 1.6 + rand() * 1.6))
  },
  desert(b, m0, m1, rand, d) {
    scatter(m0, m1, rand, d, 9, ...NEAR_BAND, (m, x) => mushroom(b, x, 0, zAt(m), 0.8 + rand() * 0.6, rand() * 3))
    scatter(m0, m1, rand, d, 14, 30, 80, (m, x) => mushroom(b, x, 0, zAt(m), 2.4 + rand() * 2.4, rand() * 3))
    scatter(m0, m1, rand, d, 26, NEAR + 3, 50, (m, x) => totem(b, x, zAt(m), 1 + rand() * 0.6, '#7dff3a'), 0.7)
    scatter(m0, m1, rand, d, 6, 26, 165, (m, x) => (rand() < 0.45 ? blackPalm(b, x, 0, zAt(m), 1.3 + rand() * 0.8, rand) : deadTree(b, x, 0, zAt(m), 1.4 + rand() * 1.4, rand)))
    scatter(m0, m1, rand, d, 11, NEAR, 60, (m, x) => wisp(b, x, 1 + rand() * 3, zAt(m), 1.2))
  },
  snow(b, m0, m1, rand, d) {
    scatter(m0, m1, rand, d, 6, ...NEAR_BAND, (m, x, f) => tombstone(b, x, 0, zAt(m), 1 + rand() * 0.4, f > 0 ? Math.PI / 2 : -Math.PI / 2, '#c9d6f0'))
    scatter(m0, m1, rand, d, 30, 34, 70, (m, x, f) => mausoleum(b, x, zAt(m), f, true))
    scatter(m0, m1, rand, d, 22, NEAR + 4, 45, (m, x) => pumpkinSnowman(b, x, zAt(m)), 0.6)
    scatter(m0, m1, rand, d, 12, 26, 90, (m, x) => iceCrystal(b, x, zAt(m), 1 + rand() * 1.4))
    scatter(m0, m1, rand, d, 7, 30, 165, (m, x) => snowyDeadTree(b, x, zAt(m), 1.2 + rand() * 1.2, rand))
    scatter(m0, m1, rand, d, 60, 120, 170, (m, x) => hill(b, x, zAt(m), 40 + rand() * 30, '#a8b8d8', '#ffffff'), 0.6)
    line(m0, m1, rand, 30, NEAR, (m, x) => candle(b, x, 0, zAt(m), '#7fe2ff'))
  },
  volcano(b, m0, m1, rand, d) {
    const zc = zAt((m0 + m1) / 2)
    for (const side of [-1, 1]) b.addOn(side * 34, -0.05, zc, 9, 0.12, m1 - m0, '#ff6a14', STYLE.LAVA)
    scatter(m0, m1, rand, d, 9, ...NEAR_BAND, (m, x) => rock(b, x, zAt(m), 0.8 + rand() * 0.8, '#2a2427'))
    scatter(m0, m1, rand, d, 16, NEAR, 30, (m, x) => (rand() < 0.5 ? cauldron(b, x, 0, zAt(m), 1) : bones(b, x, 0, zAt(m), rand() * 3)))
    scatter(m0, m1, rand, d, 20, 42, 80, (m, x) => totem(b, x, zAt(m), 1.4, '#ff6a14'), 0.6)
    scatter(m0, m1, rand, d, 10, 40, 120, (m, x) => rock(b, x, zAt(m), 1.6 + rand() * 2, '#3a2a2c'))
    scatter(m0, m1, rand, d, 45, 90, 160, (m, x) => volcano(b, x, zAt(m), 34 + rand() * 24))
  },
  cemetery(b, m0, m1, rand, d) {
    // Rows of graves in the fields either side.
    for (let m = Math.max(m0, DECOR_START) + 2; m < m1; m += 4.5) {
      if (rand() > d) continue
      for (const side of [-1, 1]) {
        for (let x = NEAR + 2; x < 52; x += 4.5) {
          if (rand() < 0.35) continue
          tombstone(b, side * x, 0, zAt(m + (rand() - 0.5)), 0.9 + rand() * 0.4, side > 0 ? -Math.PI / 2 : Math.PI / 2, pick(rand, ['#8e86a0', '#a79fb8', '#6c6580']))
        }
      }
    }
    line(m0, m1, rand, 20, NEAR - 0.6, (m, x) => ironFence(b, x, zAt(m), 18))
    scatter(m0, m1, rand, d, 34, 58, 85, (m, x, f) => mausoleum(b, x, zAt(m), f))
    scatter(m0, m1, rand, d, 120, 90, 120, (m, x, f) => chapel(b, x, zAt(m), f), 0.6)
    scatter(m0, m1, rand, d, 8, 55, 165, (m, x) => deadTree(b, x, 0, zAt(m), 1.3 + rand() * 1.2, rand))
    scatter(m0, m1, rand, d, 14, NEAR, 50, (m, x) => crow(b, x, 2.4, zAt(m)), 0.5)
    scatter(m0, m1, rand, d, 12, NEAR, 60, (m, x) => wisp(b, x, 1 + rand() * 2.5, zAt(m), 1.1))
  },
  carnival(b, m0, m1, rand, d) {
    scatter(m0, m1, rand, d, 9, ...NEAR_BAND, (m, x) => balloon(b, x, 4 + rand() * 5, zAt(m), pick(rand, ['#ff3b8a', '#ffd21f', '#5cd6ff', '#7dff3a'])))
    scatter(m0, m1, rand, d, 30, NEAR + 3, 32, (m, x) => popcornCart(b, x, zAt(m)), 0.6)
    scatter(m0, m1, rand, d, 20, 30, 70, (m, x) => tent(b, x, zAt(m), pick(rand, ['#ff3b8a', '#ff7a14', '#5cd6ff', '#7dff3a']), 1 + rand() * 0.6))
    scatter(m0, m1, rand, d, 50, 40, 70, (m, x) => carousel(b, x, zAt(m)), 0.6)
    scatter(m0, m1, rand, d, 55, 80, 120, (m, x) => ferrisWheel(b, x, zAt(m), 12 + rand() * 6))
    scatter(m0, m1, rand, d, 9, 120, 165, (m, x) => deadTree(b, x, 0, zAt(m), 1.6 + rand(), rand))
    // Strings of lights across the fairway.
    for (let m = Math.ceil(Math.max(m0, DECOR_START) / 40) * 40; m < m1; m += 40) stringLights(b, zAt(m), KERB + 1.4, '#ff3b8a', '#ffd21f')
  },
  castle(b, m0, m1, rand, d) {
    const zc = zAt((m0 + m1) / 2)
    for (const side of [-1, 1]) curtainWall(b, side * 62, zc, m1 - m0, 14)
    scatter(m0, m1, rand, d, 40, 54, 70, (m, x) => tower(b, x, zAt(m), 22 + rand() * 12, 1.3))
    scatter(m0, m1, rand, d, 26, 30, 48, (m, x) => tower(b, x, zAt(m), 12 + rand() * 6, 0.9), 0.6)
    line(m0, m1, rand, 16, NEAR, (m, x) => banner(b, x, zAt(m), pick(rand, ['#c2182b', '#5a1fa8']), '#ffd21f'))
    line(m0, m1, rand, 24, NEAR + 2.5, (m, x) => lantern(b, x, 0, zAt(m), 3.6, '#ff4a3a'))
    scatter(m0, m1, rand, d, 7, NEAR, 70, (m, x) => bat(b, x, 8 + rand() * 12, zAt(m), 0.9 + rand() * 0.8))
    scatter(m0, m1, rand, d, 8, 75, 165, (m, x) => deadTree(b, x, 0, zAt(m), 1.6 + rand() * 1.2, rand))
  },
  space(b, m0, m1, rand, d) {
    scatter(m0, m1, rand, d, 7, NEAR, 120, (m, x) => asteroid(b, x, -6 + rand() * 24, zAt(m), 0.6 + rand() * 1.6, rand))
    scatter(m0, m1, rand, d, 24, NEAR + 4, 90, (m, x) => pumpkin(b, x, 4 + rand() * 18, zAt(m), 1.4 + rand(), rand() * 3))
    if (rand() < 0.6 * d) {
      planet(b, (rand() < 0.5 ? -1 : 1) * (70 + rand() * 50), 20 + rand() * 30, zAt(m0 + rand() * CHUNK), 7 + rand() * 7, pick(rand, ['#ff7ad9', '#7fe2ff', '#ffb14a', '#9b6bff']), rand() < 0.5 ? '#ffe45c' : null)
    }
  },
}

/**
 * Builds chunk `index` (metres [index*CHUNK, (index+1)*CHUNK)).
 * @param {{ density?: number }} options 0-1 scenery density (quality and speed)
 */
export function buildChunk(index, { density = 1 } = {}) {
  const b = new BlockSet()
  const rand = mulberry32(index * 7919 + 13)
  const m0 = index * CHUNK
  const m1 = m0 + CHUNK

  // Split the chunk at zone boundaries so each part gets its own floor and scenery.
  const cuts = [m0]
  for (const zone of ZONES) if (zone.start > m0 && zone.start < m1) cuts.push(zone.start)
  cuts.push(m1)

  for (let i = 0; i < cuts.length - 1; i += 1) {
    const a = cuts[i]
    const c = cuts[i + 1]
    const theme = themeAt(a)
    const zone = ZONES[zoneIndexAt(a)]
    const groundFrom = Math.max(a, LOBBY_GROUND_END)
    const mid = (groundFrom + c) / 2
    const len = c - groundFrom
    if (len > 0) {
      if (theme.ground) b.addOn(0, -1, zAt(mid), LAND_WIDTH, 1, len, theme.ground)
      // The fairway, with a raised kerb strip either side of it.
      b.addOn(0, -0.2, zAt(mid), theme.roadHalf * 2, 0.25, len, theme.road, theme.roadStyle)
      const kerbWidth = theme.kerbHalf - theme.roadHalf
      for (const side of [-1, 1]) {
        const x = side * (theme.roadHalf + kerbWidth / 2)
        b.addOn(x, -0.2, zAt(mid), kerbWidth, 0.32, len, theme.kerb, theme.kerbStyle ?? STYLE.STUDS)
      }
      // A pale line across the fairway every 20 m, as on a driving range - but not under
      // a green (a separate mesh, whose rings would flicker against it).
      for (let m = Math.ceil(groundFrom / 20) * 20; m < c; m += 20) {
        if (HOLES.some((hole) => Math.abs(m - hole) < GREEN_CLEAR)) continue
        b.addOn(0, 0.05, zAt(m), theme.roadHalf * 2, 0.04, 0.5, '#ffffff', STYLE.SMOOTH)
      }
      // Space has no ground, so give the road a visible underside.
      if (!theme.ground) b.addOn(0, -3, zAt(mid), theme.kerbHalf * 2, 2.8, len, '#1a1448')
    }
    DECOR[zone.id](b, a, c, rand, density)
  }

  for (const g of GATES) {
    if (g.meter >= m0 && g.meter < m1) gate(b, g.meter, ZONE_THEMES[g.zone.id].gate, ZONE_THEMES[g.zone.id].kerbHalf + 1.4)
  }
  // The orange-brown carpet laid across the fairway where each new zone begins.
  for (const zone of ZONES) {
    if (zone.start <= 0 || zone.start < m0 || zone.start >= m1) continue
    const t = ZONE_THEMES[zone.id]
    b.addOn(0, 0.05, zAt(zone.start + 9), t.kerbHalf * 2, 0.04, 18, '#a8543a', STYLE.STUDS)
  }
  // No see-through netting on these open stages; the renderer still looks for the set.
  b.nets = new BlockSet()
  return b
}
