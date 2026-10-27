import {
  BufferAttribute,
  CanvasTexture,
  ClampToEdgeWrapping,
  LinearMipmapLinearFilter,
  NearestFilter,
  PlaneGeometry,
  SRGBColorSpace,
} from 'three'

import { hash2 } from '@shared/rng'
import {
  EGG_STANDS,
  FREE_REWARD,
  SHOP,
  LANE_COUNT,
  LANE_DIR,
  LANE_NEAR_X,
  LANE_TARGET_X,
  LANE_WIDTH,
  laneCenterZ,
  LEADERBOARDS,
  PLAZA,
  PORTAL,
  STAGE,
  THROW_LINE_Z,
} from '@shared/world'

import { PALETTE } from '../sceneStyle'

/**
 * The plaza floor: one big plane whose colours come from a tiny "ground map" texture
 * painted at one texel per world unit. Paths, aprons and pads are rectangles painted
 * into it, so their edges always fall on the stud-tile seams, and the whole floor is a
 * single draw call regardless of how many painted regions it has.
 */

const MAP = { minX: -64, maxX: 64, minZ: -44, maxZ: 48 }
const MAP_W = MAP.maxX - MAP.minX
const MAP_H = MAP.maxZ - MAP.minZ

/** Where the ground plane ends to the north: the track's own floor takes over there. */
export const GROUND_NORTH_EDGE = THROW_LINE_Z

function painter(ctx) {
  const rect = (r, color) => {
    ctx.fillStyle = color
    ctx.fillRect(
      Math.round(r.minX - MAP.minX),
      Math.round(r.minZ - MAP.minZ),
      Math.round(r.maxX - r.minX),
      Math.round(r.maxZ - r.minZ),
    )
  }
  const bordered = (r, fill, edge) => {
    rect(r, edge)
    rect({ minX: r.minX + 1, maxX: r.maxX - 1, minZ: r.minZ + 1, maxZ: r.maxZ - 1 }, fill)
  }
  const disc = (x, z, radius, color) => {
    ctx.fillStyle = color
    for (let dz = -radius; dz < radius; dz += 1) {
      for (let dx = -radius; dx < radius; dx += 1) {
        if ((dx + 0.5) ** 2 + (dz + 0.5) ** 2 <= radius * radius) {
          ctx.fillRect(Math.floor(x + dx - MAP.minX), Math.floor(z + dz - MAP.minZ), 1, 1)
        }
      }
    }
  }
  return { rect, bordered, disc }
}

/** Smooth value noise in 0..1 at `scale` world units, for the grass patches. */
function noise(x, z, scale, seed) {
  const fx = x / scale
  const fz = z / scale
  const ix = Math.floor(fx)
  const iz = Math.floor(fz)
  const tx = fx - ix
  const tz = fz - iz
  const sx = tx * tx * (3 - 2 * tx)
  const sz = tz * tz * (3 - 2 * tz)
  const a = hash2(ix, iz, seed)
  const b = hash2(ix + 1, iz, seed)
  const c = hash2(ix, iz + 1, seed)
  const d = hash2(ix + 1, iz + 1, seed)
  return a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz
}

export function createGroundMap(maxTexture) {
  const canvas = document.createElement('canvas')
  canvas.width = MAP_W
  canvas.height = MAP_H
  const ctx = canvas.getContext('2d')
  const { rect, bordered, disc } = painter(ctx)

  rect(MAP, PALETTE.plaza)

  // Grass growing through the cobbles in big ragged patches, as in the reference:
  // thickest along the walls, round the bays and in front of the shop, thinning out
  // over the open middle and the avenue to the Hit Zone. One texel is one stud, so the
  // edges come out jagged along the stud grid.
  ctx.fillStyle = PALETTE.lawn
  for (let z = Math.ceil(PLAZA.minZ); z < PLAZA.maxZ; z += 1) {
    for (let x = Math.ceil(PLAZA.minX); x < PLAZA.maxX; x += 1) {
      const edge = Math.min(x - PLAZA.minX, PLAZA.maxX - x, PLAZA.maxZ - z)
      let bias = edge < 5 ? 0.22 : edge < 10 ? 0.08 : 0
      if (Math.abs(x) < 7 && z < 20) bias -= 0.35
      if (z < STAGE.maxZ + 3) bias -= 0.5
      const n = noise(x, z, 9, 3) * 0.65 + noise(x, z, 3.5, 8) * 0.35
      if (n + bias > 0.6) ctx.fillRect(x - MAP.minX, z - MAP.minZ, 1, 1)
    }
  }

  // Turf under and around the training bays, and a lawn before the club shop.
  const lanesMinZ = laneCenterZ(0) - LANE_WIDTH / 2 - 2
  const lanesMaxZ = laneCenterZ(LANE_COUNT - 1) + LANE_WIDTH / 2 + 2
  const lanesX = [LANE_NEAR_X - LANE_DIR * 3, LANE_TARGET_X + LANE_DIR * 4]
  rect({ minX: Math.min(...lanesX), maxX: Math.max(...lanesX), minZ: lanesMinZ, maxZ: lanesMaxZ }, PALETTE.apron)
  rect({ minX: SHOP.minX, maxX: SHOP.maxX + 3, minZ: SHOP.minZ - 2, maxZ: SHOP.maxZ + 2 }, PALETTE.shopFloor)

  // Darker stone round the portal, the reward stand and the back wall's displays.
  disc(PORTAL.x, PORTAL.z - 2, 5, PALETTE.pathEdge)
  disc(FREE_REWARD.x, FREE_REWARD.z, 3, PALETTE.pathEdge)
  const eggsZ = EGG_STANDS[0].z
  bordered({ minX: -27, maxX: 25, minZ: eggsZ - 4, maxZ: LEADERBOARDS[0].z + 2 }, PALETTE.plazaAlt, PALETTE.pathEdge)

  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.magFilter = NearestFilter
  texture.minFilter = LinearMipmapLinearFilter
  texture.wrapS = ClampToEdgeWrapping
  texture.wrapT = ClampToEdgeWrapping
  texture.anisotropy = maxTexture > 512 ? 4 : 1
  return texture
}

/**
 * The ground plane, with UVs computed from world position so the map lands exactly
 * on the world grid. Outside the map, clamp-to-edge repeats the plaza colour.
 */
export function createGroundGeometry() {
  // Just the island: beyond the plaza the hills' cliffs drop straight into the sea.
  const minX = MAP.minX
  const maxX = MAP.maxX
  const minZ = GROUND_NORTH_EDGE
  const maxZ = MAP.maxZ
  const geometry = new PlaneGeometry(maxX - minX, maxZ - minZ)
  geometry.rotateX(-Math.PI / 2)
  geometry.translate((minX + maxX) / 2, 0, (minZ + maxZ) / 2)

  const position = geometry.getAttribute('position')
  const uv = geometry.getAttribute('uv')
  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i)
    const z = position.getZ(i)
    uv.setXY(i, (x - MAP.minX) / MAP_W, 1 - (z - MAP.minZ) / MAP_H)
  }
  uv.needsUpdate = true
  geometry.setAttribute('aStyle', new BufferAttribute(new Float32Array(position.count), 1))
  return geometry
}
