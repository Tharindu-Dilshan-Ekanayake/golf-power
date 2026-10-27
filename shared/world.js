/**
 * Lobby layout: every gameplay-relevant position and trigger area.
 *
 * Shared by the client (which renders it) and the server (which validates positions
 * against it), so the two can never disagree about where a lane or the throw area is.
 *
 * Units are roughly metres - the avatar is 1.8 tall. +X is east, -Z is north, which is
 * "forward" from spawn and the direction planes are thrown.
 *
 * Seen from spawn: the throw stage straight ahead (north), the training lanes along the
 * left (west) side, the plane hangar on the right (east), eggs and leaderboards behind.
 *
 * Rects are `{ minX, maxX, minZ, maxZ }` on the ground plane.
 */

export const SPAWN = { x: 0, z: 14 }

/** The flat, walkable plaza. Hills surround it on every side but the throw track. */
export const PLAZA = { minX: -50, maxX: 50, minZ: -40, maxZ: 36 }

// --- Throw stage --------------------------------------------------------------------

/**
 * The Hit Zone: a flat strip along the lobby's north edge that players hit from. Its
 * north edge is the end of the lobby: a low wall stops players there, and the course
 * lies far below on the other side.
 */
export const STAGE = { minX: -24, maxX: 24, minZ: -40, maxZ: -33, height: 0.05 }
/** Steps up to the Hit Zone (none: it is flat). */
export const STAGE_STEPS = 0
export const STAGE_STEP_DEPTH = 1.2

/** Track metre `m` is at world z = THROW_LINE_Z - m. */
export const THROW_LINE_Z = STAGE.minZ
export const TRACK_HALF_WIDTH = 9

/** The painted "HIT ZONE" tee area: standing in it shows the HIT! button. */
export const THROW_AREA = { minX: -11, maxX: 11, minZ: -38.8, maxZ: -33.5 }

/** Walkable ground; the controller clamps the player into it. Nothing past the stage. */
export const WALKABLE = [PLAZA]

// --- Training lanes -----------------------------------------------------------------

/**
 * Training bays line the east side of the plaza, side by side, as in the reference:
 * facing the course, they are on your right. Each runs west-east: you walk in from the
 * plaza (west end) and hit at the goal under its arch at the east end, against the wall.
 */
export const LANE_COUNT = 9
export const LANE_WIDTH = 5.4
export const LANE_PITCH = 6.8
/** Entrance edge (west) and goal edge (east) of every lane floor. */
export const LANE_NEAR_X = 28
export const LANE_FAR_X = 46
/** Where the goal stands, just past the far edge. */
export const LANE_TARGET_X = 48.4
/** +1 when lanes run east from their entrance, -1 when they run west. */
export const LANE_DIR = Math.sign(LANE_FAR_X - LANE_NEAR_X)
export const LANE_FLOOR_HEIGHT = 0.15
/** Lane 0 (the free one) is the northernmost, by the Hit Zone; the rest run south. */
const LANE0_Z = -30

export const laneCenterZ = (index) => LANE0_Z + index * LANE_PITCH

export function laneRect(index) {
  const cz = laneCenterZ(index)
  return {
    minX: Math.min(LANE_NEAR_X, LANE_FAR_X),
    maxX: Math.max(LANE_NEAR_X, LANE_FAR_X),
    minZ: cz - LANE_WIDTH / 2,
    maxZ: cz + LANE_WIDTH / 2,
  }
}

// --- Golf club shop -----------------------------------------------------------------

/**
 * The golf club shop along the west wall: two stepped stone tiers like bleachers, ten
 * display pedestals on each, the cheaper clubs on the low front tier. Both tiers are
 * low enough to walk straight onto. The GOLF CLUBS sign hangs on the wall behind.
 */
export const SHOP = { minX: -50, maxX: -24, minZ: -26, maxZ: 12 }
export const SHOP_STAGES = [
  { minX: -35, maxX: -25, minZ: -26, maxZ: 12, height: 0.6 },
  { minX: -49, maxX: -35, minZ: -26, maxZ: 12, height: 1.4 },
]
/** The sign on the wall behind the shop (west), facing the plaza. */
export const SHOP_BOARD = { x: -51.6, minZ: -21, maxZ: 7, top: 13.5 }
/** +1 when the shop faces east (it stands on the west side), -1 for west. */
export const SHOP_FACE = Math.sign((SHOP.minX + SHOP.maxX) / 2) < 0 ? 1 : -1
export const PAD_SIZE = 3.2

/** The two rows of pedestals, front (low tier) first. */
const PAD_ROWS_X = [-30, -42]
const PADS_PER_ROW = 10
const PAD_SPACING = 3.6

/**
 * Twenty pedestals, ten to a row. `row` (0 front, 1 back) lets the labels above them
 * step up so nearer ones don't hide farther ones.
 */
export const PLANE_PADS = Array.from({ length: 20 }, (_, i) => {
  const row = Math.floor(i / PADS_PER_ROW)
  return {
    index: i,
    row,
    x: PAD_ROWS_X[row],
    z: (SHOP.minZ + SHOP.maxZ) / 2 - ((PADS_PER_ROW - 1) / 2) * PAD_SPACING + (i % PADS_PER_ROW) * PAD_SPACING,
    y: SHOP_STAGES[row].height,
  }
})

export const padRect = (pad) => ({
  minX: pad.x - PAD_SIZE / 2,
  maxX: pad.x + PAD_SIZE / 2,
  minZ: pad.z - PAD_SIZE / 2,
  maxZ: pad.z + PAD_SIZE / 2,
})

// --- Eggs, showcases, boards --------------------------------------------------------

/** Eggs in a row before the leaderboards on the back (south) wall; the big one in the middle. */
export const EGG_STANDS = [
  { eggId: 'basic', x: -22, z: 27 },
  { eggId: 'meadow', x: -11, z: 27 },
  { eggId: 'demon', x: 0, z: 27, big: true },
  { eggId: 'sunset', x: 11, z: 27 },
  { eggId: 'unicorn', x: 20, z: 27 },
]
export const EGG_TRIGGER_RADIUS = 4.2

/** Limited premium pet on display, in the south-west corner. */
export const SPHINX_STAND = { x: -42, z: 25 }

export const LEADERBOARDS = [
  { id: 'rebirths', x: -11, z: 33.5 },
  { id: 'playtime', x: 0, z: 33.5 },
  { id: 'power', x: 11, z: 33.5 },
]

/** The World 2 portal, a gothic doorway at the east end of the back wall. */
export const PORTAL = { x: 31, z: 32.5, radius: 3.4 }
/** The 1v1 duel rings at the Hit Zone's east end: blue, then red. */
export const DUEL_PADS = [
  { x: 12.5, z: -36.4, color: '#2f7fe6' },
  { x: 17, z: -36.4, color: '#e0261c' },
]
/** How close to a ring's centre counts as standing on it. */
export const DUEL_PAD_RADIUS = 1.6
export const FREE_REWARD = { x: 12, z: 8, radius: 3 }
export const WATERFALL = { x: 38, z: -40 }
/** The Candy Shop's stall, on the Hit Zone's west end (it faces south, to the plaza). */
export const CANDY_SHOP = { x: -30, z: -34.5 }
/** Customers stand in front of the counter, inside this radius of (CANDY_SHOP.x, z + 4.5). */
export const CANDY_SHOP_RADIUS = 4.2
export const candyShopNear = (x, z, margin = 0) => Math.hypot(x - CANDY_SHOP.x, z - (CANDY_SHOP.z + 4.5)) <= CANDY_SHOP_RADIUS + margin

// --- Collision ----------------------------------------------------------------------

const box = (x, z, halfX, halfZ) => ({
  minX: x - halfX,
  maxX: x + halfX,
  minZ: z - halfZ,
  maxZ: z + halfZ,
})

/** Solid, never-changing obstacles. Locked lanes add their own walls at runtime. */
export const STATIC_COLLIDERS = [
  // Egg pedestals.
  ...EGG_STANDS.map((s) => box(s.x, s.z, s.big ? 2.1 : 1.6, s.big ? 2.1 : 1.6)),
  box(SPHINX_STAND.x, SPHINX_STAND.z, 3, 3),
  ...LEADERBOARDS.map((b) => box(b.x, b.z, 4.6, 0.5)),
  box(FREE_REWARD.x, FREE_REWARD.z, 1.4, 1.4),
  // The portal doorway's posts; the swirl itself is walk-through.
  box(PORTAL.x - PORTAL.radius, PORTAL.z, 0.6, 0.8),
  box(PORTAL.x + PORTAL.radius, PORTAL.z, 0.6, 0.8),
  // The edge of the Hit Zone: the drop to the course.
  { minX: STAGE.minX - 30, maxX: STAGE.maxX + 30, minZ: STAGE.minZ - 1, maxZ: STAGE.minZ + 0.4 },
  // Goals at the far end of each lane.
  ...Array.from({ length: LANE_COUNT }, (_, i) => box(LANE_TARGET_X + LANE_DIR * 0.6, laneCenterZ(i), 1.4, 2.2)),
]

/** Raised floors the player stands on, as rects with a height. */
export const PLATFORMS = [
  ...SHOP_STAGES.map((s) => ({ ...s })),
  { ...STAGE },
  // Steps up the stage's south side, lowest first.
  ...Array.from({ length: STAGE_STEPS }, (_, i) => ({
    minX: STAGE.minX + 2,
    maxX: STAGE.maxX - 2,
    minZ: STAGE.maxZ,
    maxZ: STAGE.maxZ + (STAGE_STEPS - i) * STAGE_STEP_DEPTH,
    height: (STAGE.height * (i + 1)) / (STAGE_STEPS + 1),
  })),
  ...Array.from({ length: LANE_COUNT }, (_, i) => ({ ...laneRect(i), height: LANE_FLOOR_HEIGHT })),
]

// --- Helpers ------------------------------------------------------------------------

export const inRect = (r, x, z, margin = 0) =>
  x >= r.minX - margin && x <= r.maxX + margin && z >= r.minZ - margin && z <= r.maxZ + margin

/** Index of the lane whose floor contains (x, z), or -1. */
export function laneAt(x, z, margin = 0) {
  for (let i = 0; i < LANE_COUNT; i += 1) {
    if (inRect(laneRect(i), x, z, margin)) return i
  }
  return -1
}

export const inThrowArea = (x, z, margin = 0) => inRect(THROW_AREA, x, z, margin)

/** Index of the plane pad under (x, z), or -1. */
export function padAt(x, z) {
  for (const pad of PLANE_PADS) {
    if (inRect(padRect(pad), x, z)) return pad.index
  }
  return -1
}

/** The egg stand within reach of (x, z), or null. */
/** Which duel ring (0 blue, 1 red) the point stands on, or -1. */
export function duelPadAt(x, z, margin = 0) {
  return DUEL_PADS.findIndex((pad) => Math.hypot(x - pad.x, z - pad.z) <= DUEL_PAD_RADIUS + margin)
}

export function eggStandNear(x, z) {
  for (const stand of EGG_STANDS) {
    const reach = EGG_TRIGGER_RADIUS + (stand.big ? 1 : 0)
    if (Math.hypot(stand.x - x, stand.z - z) <= reach) return stand
  }
  return null
}

/** Height of the floor at (x, z): raised platforms, else the ground at 0. */
export function groundHeightAt(x, z) {
  let h = 0
  for (const p of PLATFORMS) {
    if (p.height > h && inRect(p, x, z)) h = p.height
  }
  return h
}

/** Clamps (x, z) into the walkable union, returning the nearest walkable point. */
export function clampToWalkable(x, z, out = { x: 0, z: 0 }) {
  let best = Infinity
  for (const r of WALKABLE) {
    const cx = Math.min(r.maxX, Math.max(r.minX, x))
    const cz = Math.min(r.maxZ, Math.max(r.minZ, z))
    const d = (cx - x) ** 2 + (cz - z) ** 2
    if (d < best) {
      best = d
      out.x = cx
      out.z = cz
      if (d === 0) break
    }
  }
  return out
}

/** Fastest a player can legitimately move, for the server's anti-teleport check. */
export const MAX_MOVE_SPEED = 14
