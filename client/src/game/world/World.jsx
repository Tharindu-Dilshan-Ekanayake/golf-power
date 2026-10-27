import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useState } from 'react'

import { useQuality } from '../../store/quality'
import { asToyInstance, BlockSet, disposeBlocks, PropBuilder } from '../blocks'
import { createGroundGlow, disposeGlow, glowTime } from '../glow'
import { createToyMaterial, sharedMaterials, toyTime } from '../materials'
import { createGroundGeometry, createGroundMap } from './ground'
import { glowSpots, recordGlows } from './halloween'
import { buildEggStands } from './eggs'
import { buildLandmarks, buildLobbyDecor } from './lobbyDecor'
import { buildPortalFrame } from './portalFrame'
import { buildStage } from './stage'
import { buildLanes, buildShop } from './structures'
import { buildTargets } from './targets'
import { createPaintedSigns } from './throwArea'
import { buildTerrain } from './terrain'

/**
 * The static lobby: ground plane, every box (hills, trees, lane floors, stages) in one
 * InstancedMesh, and every non-box prop (targets...) merged into one mesh. Three draw
 * calls for the whole environment.
 *
 * Built once. Quality only decides tree density at build time and whether the result
 * casts/receives realtime shadows.
 */
export function World() {
  const shadows = useQuality((s) => s.settings.shadows === 'realtime')
  const [signs, setSigns] = useState([])

  // Drives every animated toy-material style (water...).
  useFrame((state) => {
    toyTime.value = state.clock.elapsedTime
    glowTime.value = state.clock.elapsedTime
  })

  useEffect(() => {
    let made = []
    let cancelled = false
    const dispose = (list) => {
      for (const sign of list) {
        sign.geometry.dispose()
        sign.material.dispose()
        sign.texture.dispose()
      }
    }
    createPaintedSigns(useQuality.getState().settings.maxTexture).then((list) => {
      if (cancelled) {
        dispose(list)
        return
      }
      made = list
      setSigns(list)
    })
    return () => {
      cancelled = true
      dispose(made)
    }
  }, [])

  const { blocks, ground, props, pools } = useMemo(() => {
    performance.mark('pp:world-start')
    const { decorDensity, maxTexture } = useQuality.getState().settings
    const set = new BlockSet()
    recordGlows(true)
    buildTerrain(set, { treeDensity: decorDensity })
    buildLanes(set)
    const propBuilder = new PropBuilder()
    buildShop(set, { detail: decorDensity >= 0.75 })
    buildStage(set, propBuilder)
    buildPortalFrame(set)

    buildLobbyDecor(set, { detail: decorDensity >= 0.75 })
    buildLandmarks(set)
    buildTargets(propBuilder)
    buildEggStands(set, propBuilder)
    recordGlows(false)

    const map = createGroundMap(maxTexture)
    const groundMaterial = createToyMaterial({ instanced: false, vertexColors: false, map, studScale: 2 })

    performance.mark('pp:world-end')
    return {
      blocks: set.build(sharedMaterials().blocks),
      props: asToyInstance(propBuilder.build(), sharedMaterials().toy),
      ground: { geometry: createGroundGeometry(), material: groundMaterial, map },
      pools: createGroundGlow(glowSpots),
    }
  }, [])

  useEffect(
    () => () => {
      disposeBlocks(blocks)
      props.geometry.dispose()
      props.dispose()
      ground.geometry.dispose()
      ground.material.dispose()
      ground.map.dispose()
      disposeGlow(pools)
    },
    [blocks, ground, props, pools],
  )

  return (
    <>
      <mesh geometry={ground.geometry} material={ground.material} receiveShadow={shadows} />
      <primitive object={blocks} castShadow={shadows} receiveShadow={shadows} />
      <primitive object={props} castShadow={shadows} receiveShadow={shadows} />
      <primitive object={pools} />
      {signs.map((sign) => (
        <mesh key={sign.texture.uuid} geometry={sign.geometry} material={sign.material} position={sign.position} rotation={sign.rotation} renderOrder={1} />
      ))}
    </>
  )
}

export default World
