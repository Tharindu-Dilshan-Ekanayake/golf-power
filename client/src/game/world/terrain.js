import { hash2, mulberry32 } from '@shared/rng'
import { PLAZA, THROW_LINE_Z } from '@shared/world'

import { STYLE } from '../materials'
import { COURSE_DROP, PALETTE } from '../sceneStyle'
import { blackPalm, deadTree, pumpkin, tombstone } from './halloween'

/**
 * Terraced voxel hills ringing the plaza, plus black dead trees, palms, pumpkin patches
 * and gravestones on top.
 *
 * Heights come from a smooth value-noise field quantised into terraces, sampled on a
 * coarse grid and greedy-merged into as few boxes as possible: a few hundred instances
 * for the whole ring rather than thousands of columns.
 */

const CELL = 4
// Ends at the throw line: past it the lobby is a cliff, and the course lies far below.
const BOUNDS = { minX: -176, maxX: 156, minZ: THROW_LINE_Z, maxZ: 136 }
/** How deep the cliffs go: down to below the sea. */
const CLIFF_BASE = -(COURSE_DROP + 6)
/** The throw track leaves the plaza northwards through this gap in the hills. */
const CORRIDOR_HALF_WIDTH = 34
const STEP = 3

function smooth(t) {
  return t * t * (3 - 2 * t)
}

function valueNoise(x, z, scale, seed) {
  const fx = x / scale
  const fz = z / scale
  const ix = Math.floor(fx)
  const iz = Math.floor(fz)
  const tx = smooth(fx - ix)
  const tz = smooth(fz - iz)
  const a = hash2(ix, iz, seed)
  const b = hash2(ix + 1, iz, seed)
  const c = hash2(ix, iz + 1, seed)
  const d = hash2(ix + 1, iz + 1, seed)
  return a + (b - a) * tx + (c - a) * tz + (a - b - c + d) * tx * tz
}

function distanceOutside(rect, x, z) {
  const dx = Math.max(rect.minX - x, 0, x - rect.maxX)
  const dz = Math.max(rect.minZ - z, 0, z - rect.maxZ)
  return Math.hypot(dx, dz)
}

const CORRIDOR = { minX: -CORRIDOR_HALF_WIDTH, maxX: CORRIDOR_HALF_WIDTH, minZ: -10000, maxZ: PLAZA.minZ }

/** Terrain height at a cell centre, or 0 where the ground is open. */
export function terrainHeight(x, z) {
  if (distanceOutside(PLAZA, x, z) === 0) return 0
  if (distanceOutside(CORRIDOR, x, z) === 0) return 0
  const d = Math.min(distanceOutside(PLAZA, x, z), distanceOutside(CORRIDOR, x, z))
  // A low first terrace right at the plaza edge, rising in big steps further out.
  // A tall first wall right at the plaza's edge (the lobby is a walled courtyard, as
  // in the reference), then terraces stepping up behind it.
  const base = d < 6 ? 11 : 13 + Math.floor(d / 14) * 4
  // Long, gentle swells only: the hills read as clean terraces, not noise.
  const n = valueNoise(x, z, 44, 11) * 6 + valueNoise(x, z, 16, 23) * 1.2
  const h = Math.round((base + n) / STEP) * STEP
  return Math.min(34, Math.max(9, h))
}

/**
 * Adds a blocky tiered tree standing on `base`.
 *
 * @param {import('../blocks').BlockSet} blocks
 * @param {() => number} rand
 */
/** Half the widest canopy tier of a scale-1 tree. */
const TREE_HALF_WIDTH = 2.4

export function addTree(blocks, x, base, z, scale = 1, rand = Math.random) {
  if (rand() < 0.35) blackPalm(blocks, x, base, z, scale, rand)
  else deadTree(blocks, x, base, z, scale, rand)
}

/** Pumpkins on a terrace: pumpkinPatch only works at ground level, so stand them on `base`. */
function pumpkinPatchOn(blocks, x, base, z, rand, s) {
  const count = 2 + Math.floor(rand() * 2)
  for (let i = 0; i < count; i += 1) {
    pumpkin(blocks, x + (rand() - 0.5) * 3.2, base, z + (rand() - 0.5) * 3.2, s * (0.55 + rand() * 0.55), rand() * Math.PI * 2, rand() < 0.5)
  }
}

/** Builds the hill ring into `blocks` and returns tree spots used (for tests/debug). */
export function buildTerrain(blocks, { treeDensity = 1 } = {}) {
  const cols = Math.ceil((BOUNDS.maxX - BOUNDS.minX) / CELL)
  const rows = Math.ceil((BOUNDS.maxZ - BOUNDS.minZ) / CELL)
  const heights = new Int16Array(cols * rows)

  for (let j = 0; j < rows; j += 1) {
    for (let i = 0; i < cols; i += 1) {
      const x = BOUNDS.minX + (i + 0.5) * CELL
      const z = BOUNDS.minZ + (j + 0.5) * CELL
      heights[j * cols + i] = terrainHeight(x, z)
    }
  }

  // Greedy merge: runs along X, then stack identical runs along Z.
  const open = new Map()
  const emit = (run) => {
    const width = (run.i1 - run.i0 + 1) * CELL
    const depth = (run.j1 - run.j0 + 1) * CELL
    const x = BOUNDS.minX + run.i0 * CELL + width / 2
    const z = BOUNDS.minZ + run.j0 * CELL + depth / 2
    // Sunk well below the sea, so the plateau's cliffs plunge into the water.
    blocks.addOn(x, CLIFF_BASE, z, width, run.h - CLIFF_BASE, depth, PALETTE.dirt, STYLE.TERRAIN)
  }

  for (let j = 0; j < rows; j += 1) {
    const runs = []
    let i = 0
    while (i < cols) {
      const h = heights[j * cols + i]
      if (h === 0) {
        i += 1
        continue
      }
      let i1 = i
      while (i1 + 1 < cols && heights[j * cols + i1 + 1] === h) i1 += 1
      runs.push({ i0: i, i1, h })
      i = i1 + 1
    }

    const nextOpen = new Map()
    for (const run of runs) {
      const key = `${run.i0}:${run.i1}:${run.h}`
      const prev = open.get(key)
      if (prev) {
        prev.j1 = j
        nextOpen.set(key, prev)
        open.delete(key)
      } else {
        nextOpen.set(key, { ...run, j0: j, j1: j })
      }
    }
    for (const run of open.values()) emit(run)
    open.clear()
    for (const [key, run] of nextOpen) open.set(key, run)
  }
  for (const run of open.values()) emit(run)

  // Trees on the terraces, kept off the cliff edges so they don't overhang the plaza,
  // and clear of each other: overlapping canopies of near-equal height flicker.
  const rand = mulberry32(5)
  const placed = []
  let trees = 0
  for (let j = 1; j < rows - 1; j += 1) {
    for (let i = 1; i < cols - 1; i += 1) {
      const h = heights[j * cols + i]
      if (h === 0) continue
      if (hash2(i, j, 77) > 0.075 * treeDensity) continue
      const flat =
        heights[j * cols + i - 1] === h &&
        heights[j * cols + i + 1] === h &&
        heights[(j - 1) * cols + i] === h &&
        heights[(j + 1) * cols + i] === h
      if (!flat) continue
      const x = BOUNDS.minX + (i + 0.5) * CELL
      const z = BOUNDS.minZ + (j + 0.5) * CELL
      const scale = 0.9 + rand() * 0.5
      const reach = TREE_HALF_WIDTH * scale
      if (placed.some((t) => Math.max(Math.abs(t.x - x), Math.abs(t.z - z)) < t.reach + reach)) continue
      placed.push({ x, z, reach })
      const roll = rand()
      if (roll < 0.45) addTree(blocks, x, h, z, scale, rand)
      else if (roll < 0.75) pumpkinPatchOn(blocks, x, h, z, rand, 1.1)
      else if (roll < 0.9) tombstone(blocks, x, h, z, 1 + rand() * 0.4, rand() * Math.PI * 2)
      trees += 1
    }
  }

  // The cliff under the Hit Zone: the plateau's north face, dropping to the course.
  blocks.addOn(0, CLIFF_BASE, THROW_LINE_Z - 0.75, 128, -CLIFF_BASE, 1.5, PALETTE.dirt, STYLE.TERRAIN)

  return { trees }
}
