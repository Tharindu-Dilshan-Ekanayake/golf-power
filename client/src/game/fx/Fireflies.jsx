import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { Color, Matrix4, Quaternion, Vector3 } from 'three'

import { mulberry32 } from '@shared/rng'
import { PLAZA } from '@shared/world'

import { useQuality } from '../../store/quality'
import { createGlowInstances, disposeGlow } from '../glow'
import { runtime } from '../runtime'

const COUNT = 46
const COLORS = ['#ffb02a', '#ffd21f', '#b15cff', '#7dff3a', '#ff7a14']

const _m = new Matrix4()
const _q = new Quaternion()
const _p = new Vector3()
const _s = new Vector3()

/**
 * Fireflies and embers drifting over the lobby: soft glowing motes wandering on slow
 * loops, a few in each colour of the night. One instanced draw call, no texture, and
 * only on presets with particles; hidden while the camera is off chasing a ball.
 */
export function Fireflies() {
  const enabled = useQuality((s) => s.settings.particles)
  const ref = useRef(null)

  const { mesh, motes } = useMemo(() => {
    const rand = mulberry32(41)
    const m = createGlowInstances(COUNT, 1.1)
    const color = new Color()
    const list = Array.from({ length: COUNT }, (_, i) => {
      m.setColorAt(i, color.set(COLORS[i % COLORS.length]))
      return {
        x: PLAZA.minX + 4 + rand() * (PLAZA.maxX - PLAZA.minX - 8),
        z: PLAZA.minZ + 6 + rand() * (PLAZA.maxZ - PLAZA.minZ - 10),
        y: 0.8 + rand() * 4.5,
        r: 1.5 + rand() * 3,
        speed: 0.15 + rand() * 0.35,
        phase: rand() * Math.PI * 2,
        size: 0.35 + rand() * 0.35,
      }
    })
    m.instanceColor.needsUpdate = true
    m.count = COUNT
    return { mesh: m, motes: list }
  }, [])

  useEffect(() => () => disposeGlow(mesh), [mesh])

  useFrame((state) => {
    const glow = ref.current
    if (!glow) return
    glow.visible = enabled && runtime.camera.mode === 'follow'
    if (!glow.visible) return
    const t = state.clock.elapsedTime
    for (let i = 0; i < COUNT; i += 1) {
      const f = motes[i]
      const a = t * f.speed + f.phase
      _p.set(f.x + Math.cos(a) * f.r, f.y + Math.sin(a * 1.7) * 0.6, f.z + Math.sin(a * 0.8) * f.r)
      // Each one breathes brighter and dimmer on its own beat.
      glow.setMatrixAt(i, _m.compose(_p, _q, _s.setScalar(f.size * (0.75 + 0.35 * Math.sin(t * 2.3 + f.phase)))))
    }
    glow.instanceMatrix.needsUpdate = true
  })

  return <primitive ref={ref} object={mesh} />
}

export default Fireflies
