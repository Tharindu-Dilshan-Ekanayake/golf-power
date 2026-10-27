import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import {
  BackSide,
  BufferAttribute,
  CircleGeometry,
  Color,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  Quaternion,
  ShaderMaterial,
  Triangle,
  Vector3,
} from 'three'

import { mulberry32 } from '@shared/rng'

import { useQuality } from '../store/quality'
import { createSkyPumpkin } from './frisbee'
import { CLOUDS, COURSE_DROP, LIGHTS } from './sceneStyle'
import { skyUniforms } from './skyState'

/** Height of the sea's surface: just under the course's beach, far below the lobby. */
export const SEA_LEVEL = -COURSE_DROP - 1.4

/** Unit dome, scaled to just inside the camera's far plane for the current preset. */
const SKY_RADIUS = 1

/** Centre of the cloud field: the middle of the track. */
const CLOUD_CENTER = [0, 0, -80]
/** Radians per second the whole cloud field turns about its centre. */
const CLOUD_DRIFT = 0.004

const skyVertexShader = /* glsl */ `
  varying vec3 vDirection;

  void main() {
    vDirection = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const skyFragmentShader = /* glsl */ `
  uniform vec3 topColor;
  uniform vec3 horizonColor;
  uniform float exponent;
  uniform vec3 mountainColor;
  uniform vec3 seaColor;
  uniform vec3 moonDirection;
  uniform float moonRadius;

  varying vec3 vDirection;

  float hash3(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  void main() {
    vec3 d = normalize(vDirection);
    float h = d.y;
    vec3 color = mix(horizonColor, topColor, pow(max(h, 0.0), exponent));

    // Faint violet streaks of cloud, banded by height so they stay put with the camera.
    float streak = sin(d.x * 9.0 + h * 40.0) * sin(d.z * 7.0 - h * 23.0);
    color += vec3(0.07, 0.03, 0.12) * smoothstep(0.35, 1.0, streak) * smoothstep(0.02, 0.2, h);

    // Stars, fading in away from the horizon glow.
    vec3 sp = d * 150.0;
    vec3 cell = floor(sp);
    float tw = hash3(cell);
    float star = step(0.9965, tw) * (1.0 - smoothstep(0.18, 0.42, length(fract(sp) - 0.5)));
    color += vec3(1.0, 0.95, 1.0) * star * smoothstep(0.08, 0.35, h);

    // The moon: a pale pink-cream disc with soft craters, and a halo.
    float md = dot(d, moonDirection);
    float moonCos = cos(moonRadius);
    float disc = smoothstep(moonCos - 0.0006, moonCos + 0.0006, md);
    vec3 t = normalize(cross(moonDirection, vec3(0.0, 1.0, 0.0)));
    vec3 bt = cross(moonDirection, t);
    vec2 uv = vec2(dot(d, t), dot(d, bt)) / moonRadius;
    float craters = 0.5 + 0.5 * sin(uv.x * 6.0 + 1.3) * sin(uv.y * 5.0 - 0.7);
    craters *= 0.5 + 0.5 * sin(uv.x * 13.0 - uv.y * 9.0);
    vec3 moon = mix(vec3(0.96, 0.88, 0.86), vec3(0.78, 0.66, 0.66), craters * 0.55);
    color += vec3(0.65, 0.45, 0.95) * pow(max(md, 0.0), 40.0) * 0.45;
    color = mix(color, moon, disc);

    // Mountain silhouettes on the horizon, and the sea below it.
    float az = atan(d.x, d.z);
    float ridge = 0.03 + 0.022 * sin(az * 5.0) + 0.012 * sin(az * 13.0 + 1.3) + 0.006 * sin(az * 31.0);
    float mountain = (1.0 - smoothstep(ridge - 0.004, ridge + 0.004, h)) * step(0.0, h);
    color = mix(color, mountainColor, mountain);
    // Below the horizon is distant sea: hazy at the horizon, deepening downwards.
    float below = 1.0 - smoothstep(-0.012, 0.0, h);
    vec3 sea = mix(horizonColor * 0.85 + vec3(0.0, 0.04, 0.12), seaColor, smoothstep(0.0, -0.3, h));
    color = mix(color, sea, below);

    gl_FragColor = vec4(color, 1.0);
    #include <colorspace_fragment>
  }
`

/**
 * Night sky dome. Follows the camera so the horizon always sits at eye level and the
 * dome can never be walked out of.
 */
function SkyDome() {
  const ref = useRef(null)
  const camera = useThree((s) => s.camera)
  const radius = useQuality((s) => s.settings.viewDistance) * 0.9
  const uniforms = skyUniforms

  useFrame(() => {
    ref.current?.position.copy(camera.position)
  })

  return (
    <mesh ref={ref} renderOrder={-1} frustumCulled={false} scale={radius}>
      <sphereGeometry args={[SKY_RADIUS, 24, 12]} />
      <shaderMaterial
        side={BackSide}
        depthWrite={false}
        uniforms={uniforms}
        vertexShader={skyVertexShader}
        fragmentShader={skyFragmentShader}
      />
    </mesh>
  )
}

const seaVertex = /* glsl */ `
  varying vec3 vWorld;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`

const seaFragment = /* glsl */ `
  uniform float uTime;
  uniform vec3 uShallow;
  uniform vec3 uDeep;
  uniform vec3 uHaze;
  uniform vec3 uCamera;
  uniform float uRange;
  varying vec3 vWorld;

  void main() {
    vec2 p = vWorld.xz;
    float dist = length(p - uCamera.xz);
    // Deeper blue far out, a light turquoise close in.
    vec3 col = mix(uShallow, uDeep, smoothstep(0.0, uRange * 0.45, dist));
    // Slow crossing swells, and glints where they catch the moon.
    float w1 = sin(p.x * 0.35 + uTime * 0.9) * sin(p.y * 0.28 - uTime * 0.7);
    float w2 = sin((p.x + p.y) * 0.62 + uTime * 1.3);
    col += vec3(0.05, 0.1, 0.14) * (w1 * 0.5 + 0.5);
    float glint = smoothstep(0.93, 1.0, w1 * 0.5 + w2 * 0.5 + 0.35) * (1.0 - smoothstep(0.0, uRange * 0.6, dist));
    col += vec3(0.75, 0.85, 1.0) * glint * 0.55;
    // Melts into the haze at the horizon.
    col = mix(col, uHaze, smoothstep(uRange * 0.55, uRange, dist));
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`

/**
 * The sea all round the island: one flat disc following the camera, shaded in the GPU
 * (turquoise near, deep blue far, moonlit glints on slow swells, haze at the horizon).
 * No texture, one draw call.
 */
function Sea() {
  const ref = useRef(null)
  const camera = useThree((s) => s.camera)
  const radius = useQuality((s) => s.settings.viewDistance) * 0.97
  const geometry = useMemo(() => new CircleGeometry(1, 48).rotateX(-Math.PI / 2), [])
  const material = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uShallow: { value: new Color('#25c8f0') },
          uDeep: { value: new Color('#0a4fb0') },
          uHaze: skyUniforms.horizonColor,
          uCamera: { value: new Vector3() },
          uRange: { value: radius },
        },
        vertexShader: seaVertex,
        fragmentShader: seaFragment,
      }),
    [radius],
  )

  useEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
    },
    [geometry, material],
  )

  useFrame((state) => {
    const mesh = ref.current
    if (!mesh) return
    // Snapped so the disc's edge doesn't crawl as the camera moves; the waves are in
    // world space, so they stay put.
    mesh.position.set(Math.round(camera.position.x / 8) * 8, SEA_LEVEL, Math.round(camera.position.z / 8) * 8)
    mesh.material.uniforms.uTime.value = state.clock.elapsedTime
    mesh.material.uniforms.uCamera.value.copy(camera.position)
  })

  return <mesh ref={ref} geometry={geometry} material={material} scale={radius} frustumCulled={false} />
}

/**
 * A faceted puff with its shading baked into vertex colours: white where a face points
 * up or towards the sun, blue-grey underneath.
 *
 * Baked rather than lit so the clouds stay bright white regardless of the scene lights,
 * and the flat per-face colour gives the low-poly look.
 */
function createPuffGeometry() {
  const geometry = new IcosahedronGeometry(1, 1)
  const position = geometry.getAttribute('position')
  const colors = new Float32Array(position.count * 3)

  const top = new Color(CLOUDS.top)
  const bottom = new Color(CLOUDS.bottom)
  const sun = new Vector3(...LIGHTS.sunDirection).normalize()
  const a = new Vector3()
  const b = new Vector3()
  const c = new Vector3()
  const faceNormal = new Vector3()
  const faceColor = new Color()

  // IcosahedronGeometry is non-indexed: every 3 vertices are one face.
  for (let i = 0; i < position.count; i += 3) {
    a.fromBufferAttribute(position, i)
    b.fromBufferAttribute(position, i + 1)
    c.fromBufferAttribute(position, i + 2)
    Triangle.getNormal(a, b, c, faceNormal)
    // Every vertex lies on the unit sphere, so the vertex itself points outward.
    if (faceNormal.dot(a) < 0) faceNormal.negate()

    const up = faceNormal.y * 0.5 + 0.5
    const lit = Math.max(faceNormal.dot(sun), 0) * 0.35
    faceColor.copy(bottom).lerp(top, Math.min(1, up * 0.85 + lit))

    for (let v = 0; v < 3; v += 1) {
      colors[(i + v) * 3] = faceColor.r
      colors[(i + v) * 3 + 1] = faceColor.g
      colors[(i + v) * 3 + 2] = faceColor.b
    }
  }

  geometry.setAttribute('color', new BufferAttribute(colors, 3))
  return geometry
}

/**
 * Each cloud is a row of overlapping, slightly flattened puffs with one more on top.
 *
 * Kept fairly low and large: the follow camera looks slightly down, so only clouds
 * low in the sky ever reach the top of the screen. The lowest cloud bottom still sits
 * above the highest the camera can orbit.
 */
function buildCloudLayout(count) {
  const rand = mulberry32(7)
  const clouds = []

  for (let i = 0; i < count; i += 1) {
    const size = 7 + rand() * 6
    const puffCount = 3 + Math.floor(rand() * 3)
    const puffs = []

    for (let p = 0; p < puffCount; p += 1) {
      // Bigger in the middle, tapering to the ends.
      const along = (p - (puffCount - 1) / 2) * size * 0.9
      const taper = 1 - Math.abs(along) / (size * puffCount * 0.6)
      const s = size * (0.75 + rand() * 0.35) * taper
      puffs.push({
        position: [along, (rand() - 0.3) * size * 0.4, (rand() - 0.5) * size * 0.6],
        scale: [s, s * 0.75, s * 0.85],
      })
    }
    // The billow on top that makes it read as a cumulus rather than a sausage.
    puffs.push({
      position: [(rand() - 0.5) * size, size * 0.55, 0],
      scale: [size * 0.8, size * 0.65, size * 0.7],
    })

    clouds.push({
      position: [(rand() * 2 - 1) * 240, 50 + rand() * 18, (rand() * 2 - 1) * 280],
      rotationY: rand() * Math.PI,
      puffs,
    })
  }

  return clouds
}

/**
 * Every puff of every cloud in one InstancedMesh: a single draw call for the whole
 * sky, where one mesh per puff cost ~100.
 */
function Clouds() {
  const count = useQuality((s) => s.settings.cloudCount)

  const mesh = useMemo(() => {
    const layout = buildCloudLayout(count)
    const puffs = []
    const cloudQuat = new Quaternion()
    const yAxis = new Vector3(0, 1, 0)
    for (const cloud of layout) {
      cloudQuat.setFromAxisAngle(yAxis, cloud.rotationY)
      for (const puff of cloud.puffs) {
        const local = new Vector3(...puff.position).applyQuaternion(cloudQuat)
        puffs.push({
          position: local.add(new Vector3(...cloud.position)),
          quaternion: cloudQuat.clone(),
          scale: new Vector3(...puff.scale),
        })
      }
    }

    // fog off: the clouds sit past the fog's far distance and would vanish.
    const instanced = new InstancedMesh(
      createPuffGeometry(),
      new MeshBasicMaterial({ vertexColors: true, fog: false, transparent: true, opacity: 0.55, depthWrite: false }),
      puffs.length,
    )
    const matrix = new Matrix4()
    puffs.forEach((p, i) => instanced.setMatrixAt(i, matrix.compose(p.position, p.quaternion, p.scale)))
    instanced.instanceMatrix.needsUpdate = true
    instanced.computeBoundingSphere()
    instanced.position.set(...CLOUD_CENTER)
    return instanced
  }, [count])

  useEffect(
    () => () => {
      mesh.geometry.dispose()
      mesh.material.dispose()
      mesh.dispose()
    },
    [mesh],
  )

  const ref = useRef(null)
  useFrame((_state, delta) => {
    if (ref.current) ref.current.rotation.y += delta * CLOUD_DRIFT
  })

  return <primitive ref={ref} object={mesh} />
}

/**
 * The giant jack-o-lantern over the course: always out ahead to the north, high over the
 * horizon, bobbing slowly, its face turned back towards the lobby.
 */
function SkyPumpkin() {
  const ref = useRef(null)
  const camera = useThree((s) => s.camera)
  const reach = useQuality((s) => s.settings.viewDistance) * 0.8
  const model = useMemo(() => createSkyPumpkin(), [])

  useEffect(() => () => model.dispose(), [model])

  useFrame((state) => {
    const group = ref.current
    if (!group) return
    const t = state.clock.elapsedTime
    // Off to the left of the course, so it never sits behind a flying ball.
    group.position.set(camera.position.x * 0.6 - reach * 0.45, camera.position.y + reach * (0.2 + 0.01 * Math.sin(t * 0.7)), camera.position.z - reach * 0.85)
    group.rotation.set(0.12, Math.sin(t * 0.3) * 0.2, Math.sin(t * 0.5) * 0.05)
    group.scale.setScalar(reach * 0.12)
  })

  return <primitive ref={ref} object={model} />
}

/** Night sky, moon, sea and drifting low-poly clouds. */
export function Sky() {
  return (
    <>
      <SkyDome />
      <Sea />
      <SkyPumpkin />
      <Clouds />
    </>
  )
}

export default Sky
