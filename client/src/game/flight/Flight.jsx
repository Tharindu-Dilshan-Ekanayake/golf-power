import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import {
  AdditiveBlending,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CircleGeometry,
  Color,
  CylinderGeometry,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  Points,
  PointsMaterial,
  Quaternion,
  TorusGeometry,
  Vector3,
} from 'three'

import { GREEN_RINGS, HOLES, TROPHY_FIRST, TROPHY_SPACING, ZONES } from '@shared/balance'
import { ballStyleId } from '@shared/logic'
import { formatNumber } from '@shared/format'
import { trophyValue, winsMultiplier, zoneIndexAt } from '@shared/logic'
import { mulberry32 } from '@shared/rng'
import { THROW_LINE_Z } from '@shared/world'

import { sfx } from '../../audio/sfx'
import { getGame } from '../../store/game'
import { getQuality, useQuality } from '../../store/quality'
import { iconUrl } from '../../ui/icons'
import { BlockSet, createBoxInstances, createToyInstances, disposeBlocks, PropBuilder } from '../blocks'
import { burst } from '../fx/fxQueue'
import { spawnPopup } from '../fx/popups'
import { BALL_HALF_HEIGHT, FLIGHT_BALL_SCALE, TEE_BALL_SCALE, createFrisbeeModel, frisbeeOrientation } from '../frisbee'
import { createGlowInstances, createGroundGlow, disposeGlow } from '../glow'
import { LabelBatch } from '../labels/LabelBatch'
import { sharedMaterials, STYLE } from '../materials'
import { FULL_RELEASE_DELAY as RELEASE_DELAY } from '../playerPose'
import { runtime } from '../runtime'
import { COURSE_DROP, FOG, SKY } from '../sceneStyle'
import { skyUniforms } from '../skyState'
import { flight, followBall, landFlight, strikeFlight } from './flightControl'
import { writeDistance } from './hudLink'
import { buildChunk, CHUNK, GATE_TOP, GATES, LAND_WIDTH, ZONE_THEMES, zAt } from './track'

/**
 * Above this speed (m/s) the flight goes to "warp": no new scenery is built, a plain
 * zone-coloured floor rushes past under the speed lines, and only the chunks around the
 * landing point are prepared. Streaming real chunks at thousands of m/s would cost
 * more CPU than a phone has, for scenery nobody could see.
 */
const WARP_ON = 220
const WARP_OFF = 160
/** Length of the warp floor, centred a little ahead of the plane. */
const WARP_LENGTH = 1400
/** Builder passes between prefetch builds while in warp (~1 chunk per 120 ms). */
const PREFETCH_EVERY = 4

/** Warp-floor colours and styles per zone, parsed once. */
const WARP_THEMES = ZONES.map((z) => {
  const t = ZONE_THEMES[z.id]
  return {
    ground: t.ground ? new Color(t.ground) : null,
    road: new Color(t.road),
    kerb: new Color(t.kerb),
    roadStyle: t.roadStyle,
    kerbStyle: t.kerbStyle ?? STYLE.STUDS,
    roadHalf: t.roadHalf,
    kerbHalf: t.kerbHalf,
  }
})

/** Chunks kept behind the focus point, and how many may be built per builder pass. */
const BEHIND = 60
const MAX_BUILDS_PER_FRAME = 2
/** How often the chunk builder runs (between frames, not inside them). */
const BUILD_INTERVAL_MS = 30
/** Chunks never thrown away: the stretch visible from the lobby. */
const PINNED_CHUNKS = 3
const CACHE_LIMIT = 14
/** World height of the course's ground: far below the lobby. */
const COURSE_Y = -COURSE_DROP
const MAX_TROPHIES = 16
const STREAKS = 36

const _m = new Matrix4()
const _q = new Quaternion()
const _p = new Vector3()
const _s = new Vector3()
const _v = new Vector3()
const _want = new Vector3()
const _tA = new Vector3()
const _tB = new Vector3()
const _tC = new Vector3()
const _zAxis = new Vector3(0, 0, 1)
const _wantLook = new Vector3()
const _prevPlane = new Vector3()
/** Stable vector for runtime.flightFocus (the scratch ones are reused mid-frame). */
const planeFocus = new Vector3()
const _skyTop = new Color()
const _skyHorizon = new Color()

/** At most one trophy popup this often; the trophies in between are summed into it. */
const TROPHY_POPUP_MS = 180
const TROPHY_ICON = iconUrl('trophy')

/** Frees a built chunk and its netting child. */
function disposeChunk(mesh) {
  for (const child of mesh.children) disposeBlocks(child)
  disposeBlocks(mesh)
}

/** Built chunks by index. Module-level: one track exists at a time. */
const chunkCache = new Map()
/** The chunk window the frame loop wants; the builder makes it so. */
const trackWindow = { first: 0, last: 0, density: 1, shadows: false, warp: false, prefetchFirst: 0, prefetchLast: -1 }

/** Speed-line streaks, made once. */
const streakState = (() => {
  const r = mulberry32(5)
  return Array.from({ length: STREAKS }, () => ({ a: r() * Math.PI * 2, r: 1.6 + r() * 3.2, z: -r() * 30 }))
})()

const ZONE_SKIES = ZONES.map((z) => ZONE_THEMES[z.id].sky.map((c) => new Color(c)))
const DEFAULT_TOP = new Color(SKY.top)
const DEFAULT_HORIZON = new Color(SKY.horizon)

/** Slow motion at the strike: how slow, for how long, and how long time takes to catch up. */
const SLOWMO = 0.14
const SLOWMO_MS = 340
const SLOWMO_EASE_MS = 300
/** How fast the camera circles the ball once it has come to rest, radians a second. */
const ORBIT_SPEED = 0.45

const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

function createTrophyGeometry() {
  const p = new PropBuilder()
  const gold = '#ffcc1f'
  p.add(new CylinderGeometry(0.42, 0.24, 0.62, 12), { position: [0, 0.55, 0], color: gold, style: STYLE.GLOW })
  p.add(new TorusGeometry(0.2, 0.06, 6, 10, Math.PI), { position: [-0.42, 0.62, 0], rotation: [0, 0, Math.PI / 2], color: gold })
  p.add(new TorusGeometry(0.2, 0.06, 6, 10, Math.PI), { position: [0.42, 0.62, 0], rotation: [0, 0, -Math.PI / 2], color: gold })
  p.add(new CylinderGeometry(0.08, 0.08, 0.3, 6), { position: [0, 0.12, 0], color: gold })
  p.box(0, -0.05, 0, 0.5, 0.14, 0.5, '#ffb01e', STYLE.SMOOTH)
  return p.build()
}

/** Each green ring's colour, innermost (the hole) first; radii come from GREEN_RINGS. */
const RING_COLORS = ['#05030a', '#ffd21f', '#ff9a1f', '#e0261c', '#2057c4', '#2f9a24']

/**
 * The bullseye green that ends each biome: rings sized from GREEN_RINGS (the same radii
 * the rules pay out on) with thin white lines between, round a black hole with a small
 * flag in it, edged with a low purple rim set into the ground. One merged prop, one
 * instance per hole.
 */
function createGreenGeometry() {
  const p = new PropBuilder()
  const outer = GREEN_RINGS[GREEN_RINGS.length - 1].radius
  for (let i = 0; i < 32; i += 1) {
    const a = (i / 32) * Math.PI * 2
    p.box(Math.cos(a) * (outer + 0.7), 0.05, Math.sin(a) * (outer + 0.7), 1.3, 0.14, 3.6, i % 2 ? '#5a4ab0' : '#4a3a9a', STYLE.SMOOTH, [0, -a, 0])
  }
  // Flat discs, face up, each a step above the last: only their tops are ever seen, so
  // no sides or undersides (that was most of the green's triangles).
  const disc = new CircleGeometry(1, 40)
  const flat = [-Math.PI / 2, 0, 0]
  let layer = 0
  for (let i = GREEN_RINGS.length - 1; i >= 0; i -= 1) {
    const r = GREEN_RINGS[i].radius
    p.add(disc, { position: [0, 0.07 + layer * 0.02, 0], rotation: flat, scale: [r + 0.25, r + 0.25, 1], color: '#ece8f4', style: STYLE.SMOOTH })
    layer += 1
    p.add(disc, { position: [0, 0.07 + layer * 0.02, 0], rotation: flat, scale: [r, r, 1], color: RING_COLORS[i], style: i === RING_COLORS.length - 1 ? STYLE.CHECKER : STYLE.SMOOTH })
    layer += 1
  }
  // The flag: a slim pole and a small red pennant.
  p.box(0, 1.8, 0, 0.1, 3.6, 0.1, '#f4efe9', STYLE.SMOOTH)
  p.box(0.55, 3.25, 0, 1.0, 0.6, 0.06, '#e0261c', STYLE.SMOOTH)
  return p.build()
}

/** Segments in the shot tracer behind the ball. */
const TRACER = 56

let warpZone = -1

/** Moves the warp floor under the plane and restyles it when the zone changes. */
function updateWarpFloor(floor, meter) {
  const zi = zoneIndexAt(meter)
  const theme = WARP_THEMES[zi]
  const centerZ = zAt(meter + WARP_LENGTH * 0.35)
  const parts = [
    // [width, height, top, colour, style]
    [theme.ground ? LAND_WIDTH : 0, 1, -0.06, theme.ground, STYLE.STUDS],
    [theme.roadHalf * 2, 0.25, 0.0, theme.road, theme.roadStyle],
    [theme.kerbHalf - theme.roadHalf, 0.3, 0.08, theme.kerb, theme.kerbStyle],
    [theme.kerbHalf - theme.roadHalf, 0.3, 0.08, theme.kerb, theme.kerbStyle],
  ]
  const kerbX = (theme.roadHalf + theme.kerbHalf) / 2
  parts.forEach(([w, h, top, color, style], i) => {
    const x = i === 2 ? -kerbX : i === 3 ? kerbX : 0
    _p.set(x, top - h / 2, centerZ)
    _s.set(Math.max(w, 0.0001), h, WARP_LENGTH)
    _q.identity()
    floor.setMatrixAt(i, _m.compose(_p, _q, _s))
    if (zi !== warpZone && color) floor.setColorAt(i, color)
    if (zi !== warpZone) floor.geometry.getAttribute('aStyle').array[i] = style
  })
  floor.instanceMatrix.needsUpdate = true
  if (zi !== warpZone) {
    warpZone = zi
    if (floor.instanceColor) floor.instanceColor.needsUpdate = true
    floor.geometry.getAttribute('aStyle').needsUpdate = true
  }
  // Instance bounds changed; keep the whole floor in view.
  floor.frustumCulled = false
}

/** Share of the flight's time spent on the first, big arc, and of the distance it covers. */
const CARRY_TIME = 0.74
const CARRY_SHARE = 0.86
/** Highest the ball goes, for the biggest hits. */
const MAX_APEX = 42

/**
 * Height of the carry over the course, `d` metres into a carry of `carry` metres that
 * tops out at `apex`: it climbs at about 45 degrees (rising its own height in about as
 * many metres, easing over the top), sails along at the top on a long hit, and drops
 * back down at about 45 degrees.
 */
function carryHeight(d, carry, apex) {
  const ramp = Math.min(carry / 2, apex * 1.6)
  if (d < ramp) return apex * Math.sin((d / ramp) * (Math.PI / 2))
  if (d > carry - ramp) return apex * Math.sin(((carry - d) / ramp) * (Math.PI / 2))
  return apex
}

/**
 * Where the ball is at normalised time `t` (0-1) of the current flight. A golf shot:
 * it leaves the club at about 45 degrees and climbs, sails along high, drops back at
 * about 45 degrees, lands, takes two short hops that die away and rolls to a stop at
 * the final distance. It is quickest in the middle of the carry and slower round the
 * launch and the landing, so both read clearly on screen.
 */
function planePosition(t, start, out) {
  const distance = flight.distance
  const ground = COURSE_Y + BALL_HALF_HEIGHT * FLIGHT_BALL_SCALE + 0.01
  const carry = distance * CARRY_SHARE
  const apex = Math.min(MAX_APEX, Math.max(5, carry * 0.32))
  let metres
  let y
  if (t <= CARRY_TIME) {
    const u = t / CARRY_TIME
    metres = carry * (0.4 * u + 0.6 * (u - Math.sin(2 * Math.PI * u) / (2 * Math.PI)))
    // From the tee's height down to the course's, under the arc.
    y = start.y + (ground - start.y) * smoothstep(0, carry, metres) + carryHeight(metres, carry, apex)
  } else {
    const v = (t - CARRY_TIME) / (1 - CARRY_TIME)
    // Slowing to a stop over what's left.
    metres = carry + (distance - carry) * (1 - (1 - v) * (1 - v))
    // Two hops, each a third the height of the last, then rolling on the grass.
    const hop = Math.min(1, v / 0.6) * 2
    const i = Math.min(1, Math.floor(hop))
    const w = hop - i
    const height = Math.min(5, apex * 0.14) / (i === 0 ? 1 : 3)
    y = ground + (v < 0.6 ? 4 * height * w * (1 - w) : 0)
    // In the hole: it rolls up to it and drops in.
    if (flight.green?.ring === 0) y -= smoothstep(0.9, 1, v) * 0.9
  }
  const x = start.x * (1 - smoothstep(0, 0.3, t))
  return out.set(x, y, start.z - metres)
}

/**
 * Lazily loaded: the course, the flying ball and its chase camera. While nobody is
 * flying it still streams the first stretch of track, which is the street you see
 * leading out of the lobby.
 */
export default function Flight() {
  const camera = useThree((s) => s.camera)
  const scene = useThree((s) => s.scene)
  const gl = useThree((s) => s.gl)
  const rootRef = useRef(null)
  const groupRef = useRef(null)
  const warpRef = useRef(null)
  const planeRef = useRef(null)
  const tracerRef = useRef(null)
  const underRef = useRef(null)
  const launched = useRef(false)
  const landQueued = useRef(false)
  const touched = useRef(false)
  const flashRef = useRef(null)
  const flashAt = useRef(-1e9)
  const flashPos = useRef(new Vector3())
  const trophyRef = useRef(null)
  const streakRef = useRef(null)
  const starsRef = useRef(null)
  const flightStart = useRef(new Vector3())
  /** The chase camera's glide in from the golfer's shoulder: for which flight, from where, since when. */
  const camFor = useRef(0)
  const camFrom = useRef(new Vector3())
  const camAt = useRef(0)
  const lookAt = useRef(new Vector3())
  const startedFor = useRef(0)
  /** Trophies popped so far this flight: index of the next, Wins not yet shown. */
  const trophyTally = useRef({ next: 0, pending: 0, shownAt: 0 })
  const wasActive = useRef(false)
  const gatesRef = useRef(null)
  const speedLines = useQuality((s) => s.settings.speedLines)
  const particles = useQuality((s) => s.settings.particles)

  const assets = useMemo(() => {
    const trophies = createToyInstances(createTrophyGeometry(), sharedMaterials().toy, MAX_TROPHIES)

    // The greens: one at the end of every zone but the last, ahead of the next gate.
    const greens = createToyInstances(createGreenGeometry(), sharedMaterials().toy, HOLES.length)
    HOLES.forEach((hole, i) => greens.setMatrixAt(i, _m.compose(_p.set(0, 0, zAt(hole)), _q.identity(), _s.setScalar(1))))
    greens.count = HOLES.length
    greens.instanceMatrix.needsUpdate = true

    // A faint halo only: a strong additive one washes the pumpkin out to pale yellow.
    const planeModel = createFrisbeeModel({ glowSize: 1.4, glowIntensity: 0.06 })
    planeModel.scale.setScalar(FLIGHT_BALL_SCALE)
    planeModel.visible = false
    // The shot tracer, as on golf broadcasts: a glowing line along the path the ball has
    // flown, from the tee to the ball, orange warming to gold at the ball.
    const tracer = createBoxInstances(TRACER, sharedMaterials().toy, STYLE.GLOW)
    const hot = new Color('#ffe14a')
    const cool = new Color('#ff5a14')
    const tint = new Color()
    for (let i = 0; i < TRACER; i += 1) tracer.setColorAt(i, tint.copy(cool).lerp(hot, i / (TRACER - 1)))
    tracer.instanceColor.needsUpdate = true

    const streakMaterial = new MeshBasicMaterial({
      color: '#ffffff',
      transparent: true,
      opacity: 0.55,
      blending: AdditiveBlending,
      depthWrite: false,
      fog: false,
    })
    const streakMesh = new InstancedMesh(new BoxGeometry(0.035, 0.035, 1), streakMaterial, STREAKS)
    streakMesh.frustumCulled = false
    streakMesh.count = 0

    const rand = mulberry32(99)
    const starPositions = new Float32Array(500 * 3)
    for (let i = 0; i < 500; i += 1) {
      _v.set(rand() * 2 - 1, rand() * 1.2 - 0.2, rand() * 2 - 1).normalize().multiplyScalar(140)
      starPositions.set([_v.x, _v.y, _v.z], i * 3)
    }
    const starGeometry = new BufferGeometry()
    starGeometry.setAttribute('position', new BufferAttribute(starPositions, 3))
    const stars = new Points(starGeometry, new PointsMaterial({ color: '#ffffff', size: 2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }))
    stars.frustumCulled = false
    stars.visible = false

    // Warp floor: ground, road and two kerbs, sitting a hair below real chunks so any
    // built chunk shows through on top of it.
    const warpSet = new BlockSet()
    for (let i = 0; i < 4; i += 1) warpSet.add(0, -0.5, 0, 1, 1, 1, '#ffffff', STYLE.STUDS)
    const warpFloor = warpSet.build(sharedMaterials().blocks)
    warpFloor.visible = false
    warpFloor.matrixAutoUpdate = false

    // The flash at the moment of impact: a big soft star that swells and fades.
    const flash = createGlowInstances(1, 2.2)
    flash.setMatrixAt(0, new Matrix4())
    flash.setColorAt(0, new Color('#ffd27a'))
    flash.count = 1
    flash.visible = false

    // The light pool under the ball.
    const under = createGroundGlow([{ x: 0, y: -0.06, z: 0, color: '#ffe14a', radius: 1.7, strength: 0.95 }])
    under.visible = false

    return { trophies, greens, flash, under, planeModel, tracer, streakMesh, streakMaterial, stars, warpFloor }
  }, [])

  // This module loads after the lobby is on screen; compile its shaders in the
  // background before showing it, so the first throw doesn't stall on them.
  useEffect(() => {
    const root = rootRef.current
    // Skipped in dev, where StrictMode's remount disposes materials mid-compile (see
    // ShaderWarmup).
    if (!root || import.meta.env.DEV) return undefined
    let cancelled = false
    root.visible = false
    gl.compileAsync(root, camera, scene)
      .catch(() => null)
      .finally(() => {
        if (!cancelled) root.visible = true
      })
    return () => {
      cancelled = true
    }
  }, [gl, camera, scene])

  // Zone names over the gate arches: their own small label batch.
  useEffect(() => {
    const batch = new LabelBatch({ pageSize: Math.min(512, getQuality().maxTexture) })
    for (const g of GATES) {
      // The zone's name, and how much better its Wins pay than the first zone's.
      const bonus = Math.round((g.zone.winsPerMeter / ZONES[0].winsPerMeter - 1) * 100)
      // As in the reference: the name in the zone's colour, and the bonus in a medal.
      const color = ZONE_THEMES[g.zone.id].gate
      const lines = [{ text: g.zone.name.toUpperCase(), size: 66, gradient: ['#ffffff', '#ffffff', color] }]
      if (bonus > 0) lines.push({ text: `+${bonus}%`, size: 60, icon: 'trophy', badge: color })
      // Only the next gate or so: further ones would show through this one's arch.
      batch.add(`gate-${g.zone.id}`, [0, GATE_TOP + (bonus > 0 ? 8.5 : 4), zAt(g.meter)], { lines, pxPerUnit: 18 }, { fade: 200 })
    }
    let cancelled = false
    batch.build().then((meshes) => {
      if (cancelled || !gatesRef.current) return
      for (const mesh of meshes) gatesRef.current.add(mesh)
    })
    return () => {
      cancelled = true
      batch.dispose()
    }
  }, [])

  // Streams track chunks in and out between frames: at most two builds per pass.
  useEffect(() => {
    const group = groupRef.current
    let pass = 0
    const build = (i, density) => {
      const set = buildChunk(i, { density })
      const mesh = set.build(sharedMaterials().blocks)
      // The see-through netting rides along as a child, in its own material.
      if (set.nets.count > 0) mesh.add(set.nets.build(sharedMaterials().net))
      mesh.receiveShadow = trackWindow.shadows
      chunkCache.set(i, mesh)
      group.add(mesh)
    }
    const id = setInterval(() => {
      if (!group) return
      const want = trackWindow
      pass += 1
      if (want.warp) {
        // Only get the landing site ready, one chunk at a time.
        if (pass % PREFETCH_EVERY === 0) {
          for (let i = want.prefetchFirst; i <= want.prefetchLast; i += 1) {
            if (chunkCache.has(i)) continue
            build(i, want.density)
            break
          }
        }
      } else {
        let built = 0
        for (let i = want.first; i <= want.last && built < MAX_BUILDS_PER_FRAME; i += 1) {
          if (chunkCache.has(i)) continue
          build(i, want.density)
          built += 1
        }
      }
      if (chunkCache.size <= CACHE_LIMIT) return
      for (const [i, mesh] of chunkCache) {
        const wanted = (i >= want.first && i <= want.last) || (i >= want.prefetchFirst && i <= want.prefetchLast)
        if (!wanted && i >= PINNED_CHUNKS) {
          group.remove(mesh)
          disposeChunk(mesh)
          chunkCache.delete(i)
        }
      }
    }, BUILD_INTERVAL_MS)
    return () => {
      clearInterval(id)
      for (const mesh of chunkCache.values()) disposeChunk(mesh)
      chunkCache.clear()
      disposeGlow(assets.flash)
      disposeGlow(assets.under)
      assets.greens.geometry.dispose()
      assets.greens.dispose()
      assets.trophies.geometry.dispose()
      assets.trophies.dispose()
      assets.planeModel.dispose()
      disposeBlocks(assets.tracer)
      assets.streakMesh.geometry.dispose()
      assets.streakMaterial.dispose()
      assets.streakMesh.dispose()
      assets.stars.geometry.dispose()
      assets.stars.material.dispose()
      disposeBlocks(assets.warpFloor)
      skyUniforms.topColor.value.copy(DEFAULT_TOP)
      skyUniforms.horizonColor.value.copy(DEFAULT_HORIZON)
    }
  }, [assets])

  useFrame((state, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05)
    const group = groupRef.current
    if (!group) return
    const settings = getQuality()
    const now = performance.now()

    // --- Plane --------------------------------------------------------------------
    let focus = Math.max(0, THROW_LINE_Z - runtime.player.position.z)
    let speed = 0
    const plane = planeRef.current
    if (flight.active) {
      if (startedFor.current !== flight.startedAt) {
        startedFor.current = flight.startedAt
        flightStart.current.copy(runtime.player.frisbeeAt)
        trophyTally.current = { next: 0, pending: 0, shownAt: 0 }
        _prevPlane.copy(flightStart.current)
      }
      // The shot's own clock: frame time scaled by the slow motion.
      flight.clock += delta * runtime.timeScale
      // Rides in the hand through the wind-up and leaves it at the release.
      const elapsed = flight.clock
      if (elapsed < RELEASE_DELAY) flightStart.current.copy(runtime.player.frisbeeAt)
      const t = Math.min(1, Math.max(0, elapsed - RELEASE_DELAY) / flight.duration)
      planePosition(t, flightStart.current, _p)
      flight.meter = Math.max(0, Math.min(flight.distance, THROW_LINE_Z - _p.z))
      focus = flight.meter
      speed = _prevPlane.distanceTo(_p) / Math.max(delta, 1e-3)
      // Climbing or dropping tips the disc a little; it banks gently side to side.
      const climb = Math.max(-0.4, Math.min(0.4, (_p.y - _prevPlane.y) * 6))
      _prevPlane.copy(_p)
      if (plane) {
        // The one in the hand is shown until the release.
        plane.visible = elapsed >= RELEASE_DELAY
        // The rush of air while it flies, swelling with its speed, gone as it lands.
        if (elapsed >= RELEASE_DELAY && t < 1) {
          sfx.windStart()
          sfx.windSet(speed / 90)
        } else if (t >= 1) {
          sfx.windStop()
        }
        plane.position.copy(_p)
        // Off the tee at its own size, growing to its flight size in the first few metres
        // (so the camera, pulling away, still reads it).
        plane.scale.setScalar(TEE_BALL_SCALE + (FLIGHT_BALL_SCALE - TEE_BALL_SCALE) * smoothstep(0, 0.05, t))
        frisbeeOrientation(plane.quaternion, now * 0.05, 0.12 + climb, Math.sin(now * 0.0025) * 0.22 * (1 - t))
        plane.setFrisbee(ballStyleId(getGame().profile))
        plane.setGlowSize(1.5 * settings.frisbeeGlow)
      }
      // The strike: the crack, a burst of embers and a flash off the club, and time
      // drops into slow motion while the camera is still on the golfer.
      if (elapsed >= RELEASE_DELAY && t < 1) {
        if (!launched.current) {
          launched.current = true
          strikeFlight(now)
          burst({ x: _p.x, y: _p.y + 0.2, z: _p.z, count: 44, palette: 'ember', speed: 11 })
          flashAt.current = now
          flashPos.current.copy(_p)
        }
        // Touchdown at the end of the carry: a thump, a puff of embers and a flash of light
        // on the grass, then the hops.
        if (!touched.current && t > CARRY_TIME) {
          touched.current = true
          burst({ x: _p.x, y: COURSE_Y + 0.4, z: _p.z - 1.5, count: 16, palette: 'ember', speed: 3.5 })
          sfx.jumpLand()
          runtime.fx.punch = Math.max(runtime.fx.punch, 0.4)
          flashAt.current = now
          flashPos.current.set(_p.x, COURSE_Y + 0.6, _p.z)
        }
      } else if (elapsed < RELEASE_DELAY) {
        launched.current = false
        touched.current = false
      }
      // Time: slow motion just after the strike, easing back up to speed as the camera
      // whips away after the ball; slow again as a hole in one rolls into the cup.
      if (flight.struck && !flight.landed) {
        const since = now - flight.impactAt
        let scale = since < SLOWMO_MS ? SLOWMO : SLOWMO + (1 - SLOWMO) * smoothstep(SLOWMO_MS, SLOWMO_MS + SLOWMO_EASE_MS, since)
        if (flight.green?.ring === 0) scale = Math.min(scale, 1 - 0.7 * smoothstep(0.93, 0.97, t))
        runtime.timeScale = scale
        if (since >= SLOWMO_MS * 0.85 && runtime.camera.mode !== 'flight') followBall()
      }
      // At rest: land it (outside the frame loop, since it updates the HUD's store).
      if (t >= 1 && !flight.landed && !landQueued.current) {
        landQueued.current = true
        setTimeout(landFlight, 0)
      } else if (t < 1) {
        landQueued.current = false
      }
      // The pool of light under the ball, on the ground beneath it.
      const disc = underRef.current
      if (disc) {
        disc.visible = elapsed >= RELEASE_DELAY
        disc.position.set(_p.x, COURSE_Y + 0.02, _p.z)
        disc.scale.setScalar(1 - Math.min(0.6, Math.max(0, _p.y - COURSE_Y - 0.4) * 0.12))
      }
      // The tracer: segments along the path flown so far, re-sampled from the same curve
      // the ball follows, so it is exact and needs no history.
      const tracer = tracerRef.current
      if (tracer) {
        const flying = elapsed >= RELEASE_DELAY && t > 0.001
        // Only the flight through the air; the roll along the grass leaves no line.
        const tracerFade = 1 - smoothstep(CARRY_TIME, CARRY_TIME + 0.12, t)
        tracer.count = flying && tracerFade > 0.01 ? TRACER : 0
        if (tracer.count) {
          const drawTo = Math.min(t, CARRY_TIME)
          planePosition(0, flightStart.current, _tA)
          for (let i = 0; i < TRACER; i += 1) {
            planePosition((drawTo * (i + 1)) / TRACER, flightStart.current, _tB)
            _v.subVectors(_tB, _tA)
            const len = _v.length()
            // Thin, swelling a little towards the ball, then tapering off just behind it
            // (so it never reads as a bar poking at the camera), and fading away once the
            // ball is down.
            const k = (i + 1) / TRACER
            // It tapers in from nothing at the tee too, where it passes close to the camera.
            const thick = (0.035 + 0.07 * k) * (1 - smoothstep(0.88, 1, k) * 0.85) * smoothstep(0, 0.2, k) * tracerFade
            _q.setFromUnitVectors(_zAxis, len > 1e-4 ? _v.multiplyScalar(1 / len) : _zAxis)
            tracer.setMatrixAt(i, _m.compose(_tC.addVectors(_tA, _tB).multiplyScalar(0.5), _q, _s.set(thick, thick, len + thick)))
            _tA.copy(_tB)
          }
          tracer.instanceMatrix.needsUpdate = true
        }
      }
      runtime.flightFocus = planeFocus.copy(_p)
      writeDistance(flight.meter)

      // Chase camera: behind and above, looking down the track. Locked to the plane
      // along the track (at warp speed any lag leaves it hundreds of metres behind);
      // eased sideways and vertically so the bobbing stays smooth.
      if (runtime.camera.mode === 'flight' && flight.landed) {
        // At rest: circle slowly round the ball while the result shows, closing in.
        const k = 1 - Math.exp(-2.5 * delta)
        const a = ((now - flight.landedAt) / 1000) * ORBIT_SPEED
        const r = 9 - Math.min(2.5, ((now - flight.landedAt) / 1000) * 1.2)
        _want.set(_p.x + Math.sin(a) * r, _p.y + 3.2, _p.z + Math.cos(a) * r)
        camera.position.lerp(_want, k)
        lookAt.current.lerp(_wantLook.set(_p.x, _p.y + 0.6, _p.z), k * 1.5)
        camera.lookAt(lookAt.current)
      } else if (runtime.camera.mode === 'flight') {
        const k = 1 - Math.exp(-5 * delta)
        // A golf broadcast's follow camera: behind the ball and below it while it climbs,
        // looking out level towards the horizon, so the ball soars up the sky with the
        // course spread out beneath it, then drops back to the fairway. It falls back as
        // the ball climbs, to keep the whole arc in the picture.
        const aloft = Math.max(0, _p.y - COURSE_Y)
        _want.set(_p.x * 0.6, COURSE_Y + 3.5 + aloft * 0.75, _p.z + 9 + aloft * 0.35)
        // Over the lobby (before the cliff) it stays clear of the plaza's floor.
        if (_want.z > THROW_LINE_Z - 3) _want.y = Math.max(_want.y, 2.5)
        _wantLook.set(_p.x * 0.8, COURSE_Y + 1.2 + aloft * 0.86, _p.z - 12)
        // At the strike the camera is still over the golfer's shoulder: glide from there
        // to the chase over the first moment of the flight, then lock on (at warp speed
        // any lag would leave it hundreds of metres behind).
        if (camFor.current !== flight.startedAt) {
          camFor.current = flight.startedAt
          camFrom.current.copy(camera.position)
          camera.getWorldDirection(_v)
          lookAt.current.copy(camera.position).addScaledVector(_v, 10)
          camAt.current = now
        }
        // A skip jumps the ball to its rest: cut the camera there too (the screen is dark).
        if (flight.cut) {
          flight.cut = false
          camAt.current = now - 1e6
          camera.position.copy(_want)
          lookAt.current.copy(_wantLook)
        }
        const glide = Math.min(1, (now - camAt.current) / 900)
        const g = glide * glide * (3 - 2 * glide)
        if (glide < 1) {
          camera.position.lerpVectors(camFrom.current, _want, g)
          lookAt.current.lerp(_wantLook, Math.max(k, g))
        } else {
          camera.position.set(
            camera.position.x + (_want.x - camera.position.x) * k,
            camera.position.y + (_want.y - camera.position.y) * Math.min(1, k * 0.8),
            _want.z,
          )
          lookAt.current.set(
            lookAt.current.x + (_wantLook.x - lookAt.current.x) * k,
            lookAt.current.y + (_wantLook.y - lookAt.current.y) * Math.min(1, k * 2),
            _wantLook.z,
          )
        }
        camera.lookAt(lookAt.current)
        // A touch wider the faster it goes, for a sense of speed.
        const wantFov = 60 + Math.min(10, speed * 0.02)
        if (Math.abs(state.camera.fov - wantFov) > 0.02) {
          state.camera.fov += (wantFov - state.camera.fov) * k
          state.camera.updateProjectionMatrix()
        }
      }
    } else if (plane) {
      runtime.timeScale = 1
      plane.visible = false
      if (tracerRef.current) tracerRef.current.count = 0
      if (underRef.current) underRef.current.visible = false
    }
    if (wasActive.current && !flight.active) {
      state.camera.fov = 60
      state.camera.updateProjectionMatrix()
      sfx.windStop()
      skyUniforms.topColor.value.copy(DEFAULT_TOP)
      skyUniforms.horizonColor.value.copy(DEFAULT_HORIZON)
      if (scene.fog) scene.fog.color.set(FOG.color)
    }
    wasActive.current = flight.active

    // --- Impact flash -------------------------------------------------------------
    const flash = flashRef.current
    if (flash) {
      const age = (now - flashAt.current) / 1000
      flash.visible = age >= 0 && age < 0.4
      if (flash.visible) {
        flash.position.copy(flashPos.current)
        flash.scale.setScalar((0.6 + age * 14) * 1.6)
        flash.material.uniforms.uIntensity.value = 2.2 * (1 - age / 0.4)
      }
    }

    // --- Track chunks -------------------------------------------------------------
    // Only decide what should exist; the builder below does the allocating, outside
    // the frame loop.
    const ahead = settings.viewDistance
    const want = trackWindow
    want.first = Math.max(0, Math.floor((focus - BEHIND) / CHUNK))
    want.last = Math.floor((focus + ahead) / CHUNK)
    // Fewer props when screaming past at hundreds of metres a second.
    want.density = settings.decorDensity * (speed > 300 ? 0.35 : speed > 120 ? 0.65 : 1)
    want.shadows = settings.shadows === 'realtime'
    for (const [i, mesh] of chunkCache) mesh.visible = i >= want.first && i <= want.last

    if (!flight.active) want.warp = false
    else if (!want.warp && speed > WARP_ON) want.warp = true
    else if (want.warp && speed < WARP_OFF) want.warp = false
    if (flight.active) {
      // The landing site, built ahead of time while warping towards it.
      want.prefetchFirst = Math.max(0, Math.floor((flight.distance - 150) / CHUNK))
      want.prefetchLast = Math.floor((flight.distance + Math.min(ahead, 240)) / CHUNK)
    } else {
      want.prefetchLast = -1
    }
    const floor = warpRef.current
    if (floor) {
      floor.visible = want.warp
      if (want.warp) updateWarpFloor(floor, focus)
    }

    // --- Trophies -----------------------------------------------------------------
    if (flight.active) {
      // Tally the ones just flown through. The Wins were granted with the throw; this
      // is the visual receipt. At speed the plane passes dozens a second, so they're
      // summed into one popup at most every TROPHY_POPUP_MS.
      const tally = trophyTally.current
      if (tally.next < 0) tally.next = 0
      const trophies = flight.trophies
      while (tally.next < trophies.length && trophies[tally.next] <= flight.meter) {
        tally.pending += trophyValue(trophies[tally.next])
        tally.next += 1
      }
      if (tally.pending > 0 && now - tally.shownAt >= TROPHY_POPUP_MS) {
        const multiplier = winsMultiplier(getGame().profile, Date.now())
        spawnPopup(`+${formatNumber(Math.round(tally.pending * multiplier))}`, { x: _prevPlane.x, y: _prevPlane.y + 1, z: _prevPlane.z - 2 }, { iconUrl: TROPHY_ICON, scale: 1.2 })
        sfx.trophy()
        tally.pending = 0
        tally.shownAt = now
      }
    }
    const trophies = trophyRef.current
    if (trophies) {
      const spin = now * 0.003
      let count = 0
      const k0 = Math.max(0, Math.ceil((focus - 10 - TROPHY_FIRST) / TROPHY_SPACING))
      for (let m = TROPHY_FIRST + k0 * TROPHY_SPACING; m < focus + ahead * 0.8 && count < MAX_TROPHIES; m += TROPHY_SPACING) {
        if (flight.active && m <= flight.meter) continue
        const height = 0.55
        _p.set(Math.sin(m * 0.5) * 2.5, height + Math.sin(spin + m) * 0.25, zAt(m))
        _q.setFromAxisAngle(_v.set(0, 1, 0), spin + m)
        _s.setScalar(1.5)
        trophies.setMatrixAt(count, _m.compose(_p, _q, _s))
        count += 1
      }
      trophies.count = count
      trophies.instanceMatrix.needsUpdate = true
    }

    // --- Sky tint by zone ---------------------------------------------------------
    if (flight.active) {
      const zi = zoneIndexAt(flight.meter)
      const blend = smoothstep(ZONES[zi].start, ZONES[zi].start + 80, flight.meter)
      const prev = ZONE_SKIES[Math.max(0, zi - 1)]
      const cur = ZONE_SKIES[zi]
      _skyTop.copy(prev[0]).lerp(cur[0], zi === 0 ? 1 : blend)
      _skyHorizon.copy(prev[1]).lerp(cur[1], zi === 0 ? 1 : blend)
      skyUniforms.topColor.value.copy(_skyTop)
      skyUniforms.horizonColor.value.copy(_skyHorizon)
      if (scene.fog) scene.fog.color.copy(_skyHorizon)

      const stars = starsRef.current
      if (stars && particles) {
        const spaceBlend = zi === ZONES.length - 1 ? blend : 0
        stars.visible = spaceBlend > 0.01
        stars.material.opacity = spaceBlend
        stars.position.copy(camera.position)
      }
    } else if (starsRef.current) {
      starsRef.current.visible = false
    }

    // --- Speed lines --------------------------------------------------------------
    const lines = streakRef.current
    if (lines) {
      const active = flight.active && speedLines && trackWindow.warp
      if (!active) {
        lines.count = 0
      } else {
        const travel = Math.min(speed, 400) * delta * 0.6
        lines.count = STREAKS
        for (let i = 0; i < STREAKS; i += 1) {
          const st = streakState[i]
          st.z += travel
          if (st.z > 4) st.z -= 34
          _v.set(Math.cos(st.a) * st.r, Math.sin(st.a) * st.r * 0.7, st.z - 4)
          _v.applyQuaternion(camera.quaternion).add(camera.position)
          _q.copy(camera.quaternion)
          _s.set(1, 1, 2 + Math.min(speed, 400) * 0.02)
          lines.setMatrixAt(i, _m.compose(_v, _q, _s))
        }
        lines.instanceMatrix.needsUpdate = true
      }
    }
  })

  return (
    <group ref={rootRef}>
      {/* The course itself, down at the foot of the lobby's cliff. */}
      <group position={[0, COURSE_Y, 0]}>
        <group ref={groupRef} />
        <group ref={gatesRef} />
        <primitive ref={warpRef} object={assets.warpFloor} />
        <primitive ref={trophyRef} object={assets.trophies} />
        <primitive object={assets.greens} />
      </group>
      <primitive ref={planeRef} object={assets.planeModel} />
      <primitive ref={tracerRef} object={assets.tracer} />
      <primitive ref={underRef} object={assets.under} />
      <primitive ref={flashRef} object={assets.flash} />
      <primitive ref={streakRef} object={assets.streakMesh} />
      <primitive ref={starsRef} object={assets.stars} />
    </group>
  )
}
