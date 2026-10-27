import {
  BufferGeometry,
  Color,
  CylinderGeometry,
  Euler,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  MeshLambertMaterial,
  Quaternion,
  SphereGeometry,
  Vector3,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

import { createGlowInstances, disposeGlow, glowTime } from './glow'

/**
 * The game ball: a jack-o-lantern pumpkin, the thing every player hits.
 *
 * The module keeps its original "frisbee" names, as do the profile fields and ids the
 * saves use; only the look changed.
 *
 * One lumpy pumpkin mesh for all of them. Each ball's look - skin colour, face colour
 * and one of twenty skins - is per instance, and the face is drawn in the fragment
 * shader. So every ball in the game, in any skin, shares one geometry, one material and
 * one compiled shader program.
 *
 * Local frame: the glowing face looks down +Z, the stem points up +Y, radius 0.5.
 */

/**
 * Looks by id (the ids and stats live in shared/balance.js; the ids are the original
 * plane ids so existing saves keep working). `color` is the pumpkin's skin, `accent` its
 * glowing face, `glow` the halo every ball of that kind carries, and `design` picks the
 * face (eyes and mouth, see DESIGN_GLSL) plus the rarer skins' extra shine.
 */
export const FRISBEE_STYLES = {
  paper: { color: '#f25a00', accent: '#ffd23a', glow: '#ff6a00', design: 0 },
  sky: { color: '#e9e4f4', accent: '#7dff3a', glow: '#b9ffa0', design: 1 },
  newspaper: { color: '#ffd21f', accent: '#ff5a14', glow: '#ffe066', design: 2 },
  cardboard: { color: '#9a5a2e', accent: '#ffb347', glow: '#ff9a3c', design: 3 },
  racer: { color: '#e0261c', accent: '#ffe14a', glow: '#ff5a3b', design: 4 },
  ocean: { color: '#1f6fe0', accent: '#7ff0ff', glow: '#2fa8ff', design: 5 },
  jungle: { color: '#3ccf4e', accent: '#f4ff6a', glow: '#5cff6a', design: 6 },
  royal: { color: '#8a3ee8', accent: '#ffd21f', glow: '#c77dff', design: 7 },
  crystal: { color: '#9ff6ff', accent: '#ffffff', glow: '#7ff6ff', design: 8 },
  golden: { color: '#ffc61a', accent: '#fff3b0', glow: '#ffd21f', design: 9 },
  candy: { color: '#ff8fd0', accent: '#ffffff', glow: '#ff7ad9', design: 10 },
  ice: { color: '#c9f3ff', accent: '#3f9cff', glow: '#9fe8ff', design: 11 },
  lava: { color: '#3a1410', accent: '#ff6a1e', glow: '#ff4a1c', design: 12 },
  thunder: { color: '#2b2f8f', accent: '#ffe14a', glow: '#ffe14a', design: 13 },
  neon: { color: '#16161f', accent: '#39ff88', glow: '#39ff88', design: 14 },
  galaxy: { color: '#2a1450', accent: '#ffffff', glow: '#a46bff', design: 15 },
  dragon: { color: '#1f8a4a', accent: '#ffd21f', glow: '#4cff7a', design: 16 },
  rainbow: { color: '#ffffff', accent: '#ffffff', glow: '#ff7ad9', design: 17 },
  diamond: { color: '#d9f7ff', accent: '#5fc8ff', glow: '#bff4ff', design: 18 },
  cosmic: { color: '#120a2a', accent: '#ff5bd8', glow: '#ff5bd8', design: 19 },
  // The Candy Shop's pumpkin skins (see SKINS in shared/balance.js), as `skin_<id>`.
  skin_ghost: { color: '#f1f5ff', accent: '#9fffe8', glow: '#b9fff0', design: 12 },
  skin_toxic: { color: '#4fd12a', accent: '#d6ff3a', glow: '#7dff3a', design: 13 },
  skin_blood: { color: '#8f0f1a', accent: '#ff4a3b', glow: '#ff2a2a', design: 14 },
  skin_witch: { color: '#6a2bb8', accent: '#7dff3a', glow: '#b15cff', design: 15 },
  skin_frost: { color: '#aee8ff', accent: '#2f8cff', glow: '#8fe0ff', design: 16 },
  skin_king: { color: '#ffc61a', accent: '#7a1fd0', glow: '#ffd21f', design: 17 },
}

// Parsed once, so frame code can look colours up without allocating.
const parse = (key) =>
  Object.fromEntries(Object.entries(FRISBEE_STYLES).map(([id, s]) => [id, new Color(s[key])]))
const COLORS = parse('color')
const ACCENTS = parse('accent')
const GLOWS = parse('glow')

export const frisbeeColor = (id) => COLORS[id] || COLORS.paper
export const frisbeeAccent = (id) => ACCENTS[id] || ACCENTS.paper
export const frisbeeGlow = (id) => GLOWS[id] || GLOWS.paper
export const frisbeeDesign = (id) => (FRISBEE_STYLES[id] || FRISBEE_STYLES.paper).design

// --- Geometry ------------------------------------------------------------------------

let baseGeometry = null

/** The ball on the tee, and in flight (it grows from one to the other off the club). */
export const TEE_BALL_SCALE = 0.26
export const FLIGHT_BALL_SCALE = 0.72
/** Half the ball's height at scale 1 (it's a squashed sphere), for resting it on the ground. */
export const BALL_HALF_HEIGHT = 0.42

/**
 * A pumpkin: a squashed sphere pinched into eight lobes, dimpled at the top, with a
 * short stem merged on. The stem is told apart from the body in the shader by where it
 * is, since a mesh only has the one instance colour.
 */
function pumpkinBaseGeometry() {
  if (!baseGeometry) {
    const body = new SphereGeometry(0.5, 24, 16)
    const position = body.getAttribute('position')
    const v = new Vector3()
    for (let i = 0; i < position.count; i += 1) {
      v.fromBufferAttribute(position, i)
      const r = Math.hypot(v.x, v.z)
      const angle = Math.atan2(v.z, v.x)
      // Lobes: the radius dips in the grooves between ribs, most at the equator.
      const lobe = 1 - 0.1 * (0.5 - 0.5 * Math.cos(angle * 8)) * (r / 0.5)
      const dimple = v.y > 0.3 ? 1 - (v.y - 0.3) * 0.9 * (1 - r / 0.5) : 1
      v.x *= lobe
      v.z *= lobe
      v.y *= 0.84 * dimple
      position.setXYZ(i, v.x, v.y, v.z)
    }
    body.computeVertexNormals()
    const stem = new CylinderGeometry(0.06, 0.09, 0.2, 6)
    stem.translate(0.015, 0.42, 0)
    const merged = mergeGeometries([body.toNonIndexed(), stem.toNonIndexed()], false)
    body.dispose()
    stem.dispose()
    baseGeometry = merged
  }
  return baseGeometry
}

// --- Material ------------------------------------------------------------------------

const vertexHead = /* glsl */ `
  attribute vec3 aAccent;
  attribute float aDesign;
  varying vec3 vFLocal;
  varying vec3 vFAccent;
  varying float vFDesign;
`

const vertexBody = /* glsl */ `
  vFLocal = position;
  vFAccent = aAccent;
  vFDesign = aDesign;
`

const fragmentHead = /* glsl */ `
  varying vec3 vFLocal;
  varying vec3 vFAccent;
  varying float vFDesign;
  uniform float uFTime;

  const float TAU = 6.2831853;

  // 1 inside a diamond of half-size s, with an anti-aliased edge.
  float fDiamond(vec2 p, float s, float w) {
    return 1.0 - smoothstep(s - w, s + w, abs(p.x) + abs(p.y));
  }
  float fBox(vec2 p, vec2 hs, float w) {
    vec2 d = abs(p) - hs;
    return 1.0 - smoothstep(-w, w, max(d.x, d.y));
  }
  float fDisc(vec2 p, float r, float w) {
    return 1.0 - smoothstep(r - w, r + w, length(p));
  }
`

/**
 * The face, chosen per instance by the design number mod 4: diamond eyes and a toothy
 * slot (the classic), round eyes and a grin, slanted eyes and a zigzag, tall slits and
 * an O. Everything else is the skin: lobed shading, a green stem, and a sweeping shine
 * on the rarer skins.
 */
const DESIGN_GLSL = /* glsl */ `
  {
    float d = vFDesign + 0.5;
        vec3 tint = vFAccent;
    vec3 col = diffuseColor.rgb;
    float angle = atan(vFLocal.z, vFLocal.x);
    float r = length(vFLocal.xz);

    // Deep grooves between the lobes, lighter ribs, and a touch darker underneath.
    float rib = 0.5 + 0.5 * cos(angle * 8.0);
    col *= (0.58 + 0.42 * sqrt(rib)) * (0.8 + 0.2 * smoothstep(-0.42, 0.25, vFLocal.y));
    // The stem: a dark ridged green, up in the dimple.
    float stem = step(0.34, vFLocal.y) * step(r, 0.14);
    col = mix(col, vec3(0.2, 0.36, 0.1) * (0.75 + 0.25 * cos(angle * 6.0)), stem);

    // The face, on the +Z side only: a carved, angry jack-o-lantern. Slanted eyes with a
    // scowl, a little triangle nose and a wide grin with two fangs down and two up.
    vec2 q = vFLocal.xy / 0.5;
    float front = smoothstep(0.1, 0.4, vFLocal.z / 0.5) * (1.0 - stem);
    float aa = 0.035;
    vec2 e = vec2(abs(q.x) - 0.4, q.y - 0.14);
    float eyeD = max(max(abs(e.x) - 0.22, e.y - (0.1 + 0.55 * e.x)), -0.12 - e.y);
    float eyes = 1.0 - smoothstep(-aa, aa, eyeD);
    float noseD = max(abs(q.x) - 0.11 * (0.02 - q.y) / 0.17, max(q.y - 0.02, -0.15 - q.y));
    float nose = 1.0 - smoothstep(-aa, aa, noseD);
    float xx = q.x * q.x;
    float mTop = -0.3 + 0.28 * xx;
    float mBot = -0.7 + 0.5 * xx;
    float mouthD = max(max(abs(q.x) - 0.72, q.y - mTop), mBot - q.y);
    float mouth = 1.0 - smoothstep(-aa, aa, mouthD);
    // Fangs cut the mouth: two hang from the top lip, two rise from the bottom.
    float ax = abs(abs(q.x) - 0.24);
    float topFang = step(ax, 0.1 * (1.0 - (mTop - q.y) / 0.22)) * step(q.y, mTop) * step(mTop - 0.22, q.y);
    float bx = abs(abs(q.x) - 0.46);
    float botFang = step(bx, 0.1 * (1.0 - (q.y - mBot) / 0.2)) * step(mBot, q.y) * step(q.y, mBot + 0.2);
    mouth *= 1.0 - max(topFang, botFang);
    float face = clamp(eyes + nose + mouth, 0.0, 1.0) * front;
    // The carved edge: a dark lip of cut flesh round every hole.
    float cut = min(min(eyeD, noseD), mouthD);
    float lip = (1.0 - smoothstep(0.0, 0.07, cut)) * (1.0 - face) * front;
    col *= 1.0 - 0.6 * lip;
    // The face glows in the skin's accent colour, hottest deep inside the cuts.
    vec3 hot = mix(tint, vec3(1.0, 0.96, 0.7), smoothstep(-0.02, -0.12, cut) * 0.7);
    col = mix(col, hot, face);
    diffuseColor.rgb = col;
    // A pumpkin lit from within: the skin glows a touch in its own colour (enough to stay
    // a deep orange at night, not so much it washes out), the face a lot.
    totalEmissiveRadiance += col * 0.2 + hot * face * 1.0;

    // Rarer skins catch a sweeping shine, and the rainbow ones shimmer through every hue.
    float sweep = 1.0 - smoothstep(0.0, 0.08, abs(fract((vFLocal.x + vFLocal.y) * 0.9 - uFTime * 0.45) - 0.5));
    if ((d > 7.0 && d < 10.0) || d > 15.0) diffuseColor.rgb += vec3(0.5) * sweep * (1.0 - stem);
    if ((d > 8.0 && d < 9.0) || (d > 17.0 && d < 19.0)) diffuseColor.rgb += 0.2 * (0.5 + 0.5 * cos(TAU * (angle / TAU + uFTime * 0.2 + vec3(0.0, 0.33, 0.67))));
  }
`

/**
 * Glossy shell, after lighting: a soft highlight from a fixed light up and to the side
 * of the view, and a warm candle-coloured rim round the silhouette.
 */
const SHINE_GLSL = /* glsl */ `
  {
    vec3 fV = normalize(vViewPosition);
    vec3 fN = normalize(normal);
    vec3 fH = normalize(normalize(vec3(0.45, 0.85, 0.35)) + fV);
    float fSpec = pow(max(dot(fN, fH), 0.0), 28.0);
    float fRim = pow(1.0 - max(dot(fN, fV), 0.0), 3.0);
    outgoingLight += vec3(0.24, 0.2, 0.15) * fSpec + vec3(0.32, 0.12, 0.02) * fRim;
  }
`

let sharedMaterial = null

/** The one material every ball uses. */
export function frisbeeMaterial() {
  if (!sharedMaterial) {
    sharedMaterial = new MeshLambertMaterial({
      color: 0xffffff,
      emissive: new Color('#000000'),
    })
    sharedMaterial.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>\n${vertexHead}`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>\n${vertexBody}`)
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>\n${fragmentHead}`)
        .replace('#include <color_fragment>', `#include <color_fragment>\n${DESIGN_GLSL}`)
        .replace('#include <opaque_fragment>', `${SHINE_GLSL}\n#include <opaque_fragment>`)
      // The lobby's clock, which already ticks every frame for the halos.
      shader.uniforms.uFTime = glowTime
    }
    sharedMaterial.customProgramCacheKey = () => 'pumpkin-v2'
  }
  return sharedMaterial
}

const WHITE = new Color('#ffffff')

/**
 * Up to `max` frisbees in one draw call. Place them with setMatrixAt and style them with
 * `setStyle(index, frisbeeId)`; set `.count` to how many to draw.
 */
export function createFrisbeeMesh(max) {
  const base = pumpkinBaseGeometry()
  // Own geometry object (it needs its own per-instance attributes), sharing the disc's
  // vertex buffers.
  const geometry = new BufferGeometry()
  if (base.index) geometry.setIndex(base.index)
  for (const name of ['position', 'normal', 'uv']) geometry.setAttribute(name, base.getAttribute(name))
  const accent = new InstancedBufferAttribute(new Float32Array(max * 3), 3)
  const design = new InstancedBufferAttribute(new Float32Array(max), 1)
  geometry.setAttribute('aAccent', accent)
  geometry.setAttribute('aDesign', design)

  const mesh = new InstancedMesh(geometry, frisbeeMaterial(), max)
  mesh.setColorAt(0, WHITE)
  mesh.count = 0
  mesh.frustumCulled = false
  mesh.castShadow = true
  const styled = new Array(max).fill(null)

  /** Styles instance `i` as frisbee `id`; cheap to call every frame. */
  mesh.setStyle = (i, id) => {
    if (styled[i] === id) return
    styled[i] = id
    mesh.setColorAt(i, frisbeeColor(id))
    const a = frisbeeAccent(id)
    accent.setXYZ(i, a.r, a.g, a.b)
    design.setX(i, frisbeeDesign(id))
    mesh.instanceColor.needsUpdate = true
    accent.needsUpdate = true
    design.needsUpdate = true
  }
  return mesh
}

/** Frees a mesh made by createFrisbeeMesh (the shared disc and material stay). */
export function disposeFrisbeeMesh(mesh) {
  mesh.geometry.dispose()
  mesh.dispose()
}

const IDENTITY = new Matrix4()
const _spin = new Quaternion()
const _tilt = new Quaternion()
const _euler = new Euler()
const _up = new Vector3(0, 1, 0)

/**
 * A ball's orientation: turned `spin` radians about its stem (a slow turn, so the face
 * keeps coming round to the camera), then tilted (`tiltX` nose up/down, `tiltZ` banked).
 * Writes into `out`; allocates nothing.
 */
export function frisbeeOrientation(out, spin, tiltX = 0, tiltZ = 0) {
  _spin.setFromAxisAngle(_up, spin * 0.12)
  _tilt.setFromEuler(_euler.set(tiltX, 0, tiltZ))
  return out.multiplyQuaternions(_tilt, _spin)
}

/**
 * A single frisbee with its glowing halo, for the one in your hand and the one in the
 * air. `setFrisbee(id)` restyles it; `dispose()` frees what it owns.
 *
 * @param {{ glowSize?: number, glowIntensity?: number }} options halo diameter relative
 *   to the disc's, and brightness
 */
export function createFrisbeeModel({ glowSize = 1.6, glowIntensity = 0.3 } = {}) {
  const disc = createFrisbeeMesh(1)
  disc.setMatrixAt(0, IDENTITY)
  disc.count = 1
  // An instanced halo of one, so it shares the shader program with every other halo.
  const glow = createGlowInstances(1, glowIntensity)
  glow.setMatrixAt(0, IDENTITY)
  glow.count = 1
  glow.scale.setScalar(glowSize)

  const group = new Group()
  group.add(glow, disc)
  let current = null

  group.setFrisbee = (id) => {
    if (id === current) return
    current = id
    disc.setStyle(0, id)
    glow.setColorAt(0, frisbeeGlow(id))
    glow.instanceColor.needsUpdate = true
  }
  /** Halo size multiplier, e.g. from the quality preset. */
  group.setGlowSize = (size) => glow.scale.setScalar(size)
  group.dispose = () => {
    disposeFrisbeeMesh(disc)
    disposeGlow(glow)
  }

  group.setFrisbee('paper')
  return group
}

let skyMaterial = null

/**
 * The giant jack-o-lantern hanging in the sky over the course, as in the reference: the
 * ball's own model, but drawn without fog (it sits out near the edge of the view) through
 * its own copy of the ball material.
 */
export function createSkyPumpkin() {
  if (!skyMaterial) {
    const base = frisbeeMaterial()
    skyMaterial = base.clone()
    skyMaterial.fog = false
    skyMaterial.onBeforeCompile = base.onBeforeCompile
    skyMaterial.customProgramCacheKey = () => 'pumpkin-v1-sky'
  }
  const model = createFrisbeeModel({ glowSize: 1.7, glowIntensity: 0.22 })
  model.setFrisbee('paper')
  for (const child of model.children) if (child.material === frisbeeMaterial()) child.material = skyMaterial
  return model
}
