import { AdditiveBlending, Color, InstancedMesh, Matrix4, PlaneGeometry, Quaternion, ShaderMaterial, Vector3 } from 'three'

/**
 * Soft glowing halos for frisbees: camera-facing quads with a radial falloff, blended
 * additively. Procedural (no texture) and always instanced - a single frisbee's halo is
 * an instance of one - so every halo shares one shader program.
 *
 * Colour comes from instanceColor; size is the instance (and object) scale.
 */

const vertexShader = /* glsl */ `
  uniform vec3 uColor;
  varying vec2 vUv;
  varying vec3 vColor;
  void main() {
    vUv = uv;
    mat4 m = modelMatrix;
    #ifdef USE_INSTANCING
      m = modelMatrix * instanceMatrix;
    #endif
    vec3 center = (m * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
    float size = length(m[0].xyz);
    vec4 mv = viewMatrix * vec4(center, 1.0);
    mv.xy += position.xy * size;
    gl_Position = projectionMatrix * mv;
    vColor = uColor;
    #ifdef USE_INSTANCING_COLOR
      vColor = instanceColor;
    #endif
  }
`

const fragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uIntensity;
  varying vec2 vUv;
  varying vec3 vColor;
  void main() {
    float d = length(vUv - 0.5) * 2.0;
    float core = 1.0 - smoothstep(0.0, 1.0, d);
    float pulse = 0.85 + 0.15 * sin(uTime * 4.0);
    float a = core * core * uIntensity * pulse;
    gl_FragColor = vec4(vColor * a, 1.0);
  }
`

/** Shared clock for every halo's pulse; advanced once per frame by whoever draws. */
export const glowTime = { value: 0 }

const QUAD = new PlaneGeometry(1, 1)

function glowMaterial(color, intensity) {
  return new ShaderMaterial({
    uniforms: {
      uColor: { value: new Color(color) },
      uTime: glowTime,
      uIntensity: { value: intensity },
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  })
}

/** Many halos in one draw call; position/size via setMatrixAt, colour via setColorAt. */
export function createGlowInstances(max, intensity = 0.9) {
  const mesh = new InstancedMesh(QUAD, glowMaterial('#ffffff', intensity), max)
  mesh.setColorAt(0, new Color('#ffffff'))
  mesh.count = 0
  mesh.renderOrder = 5
  mesh.frustumCulled = false
  return mesh
}

/** Disposes a halo made by either factory (the quad is shared and stays). */
export function disposeGlow(mesh) {
  mesh.material.dispose()
  mesh.dispose?.()
}

// --- Ground pools --------------------------------------------------------------------

const POOL_VERTEX = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vColor;
  void main() {
    vUv = uv;
    vColor = instanceColor;
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  }
`

const POOL_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform float uBase;
  varying vec2 vUv;
  varying vec3 vColor;
  void main() {
    float d = length(vUv - 0.5) * 2.0;
    float fall = 1.0 - smoothstep(0.0, 1.0, d);
    // A slow, slight flicker, like a flame.
    float flick = 0.94 + 0.06 * sin(uTime * 5.0 + vColor.r * 40.0);
    gl_FragColor = vec4(vColor * fall * fall * uBase * flick, 1.0);
  }
`

const FLAT = new PlaneGeometry(1, 1).rotateX(-Math.PI / 2)
const _m = new Matrix4()
const _q = new Quaternion()
const _p = new Vector3()
const _s = new Vector3()
const _yAxis = new Vector3(0, 1, 0)
const _upright = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), Math.PI / 2)

/**
 * The warm pools of light under lanterns, pumpkins and string lights: flat additive
 * quads on the ground with a soft falloff, all in one draw call and no texture. Cheap
 * enough for every preset (no lights are added to the scene; the studs and colours are
 * simply brightened where the pool falls).
 *
 * @param {Array<{ x: number, y: number, z: number, color: string, radius: number, strength: number }>} spots
 */
export function createGroundGlow(spots) {
  const material = new ShaderMaterial({
    uniforms: { uTime: glowTime, uBase: { value: 1 } },
    vertexShader: POOL_VERTEX,
    fragmentShader: POOL_FRAGMENT,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -8,
  })
  const mesh = new InstancedMesh(FLAT, material, Math.max(1, spots.length))
  const color = new Color()
  spots.forEach((spot, i) => {
    if (spot.wall) {
      // Stood upright (the quad's depth axis becomes its height) and turned to face out.
      _p.set(spot.x, spot.y, spot.z)
      _q.setFromAxisAngle(_yAxis, spot.wall.yaw).multiply(_upright)
      _s.set(spot.radius * 2, 1, spot.wall.height * 2)
    } else {
      _p.set(spot.x, spot.y + 0.06, spot.z)
      _q.identity()
      _s.setScalar(spot.radius * 2)
    }
    mesh.setMatrixAt(i, _m.compose(_p, _q, _s))
    mesh.setColorAt(i, color.set(spot.color).multiplyScalar(spot.strength))
  })
  mesh.count = spots.length
  mesh.renderOrder = 4
  mesh.frustumCulled = false
  return mesh
}
