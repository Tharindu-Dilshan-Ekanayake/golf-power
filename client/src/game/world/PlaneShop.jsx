import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { Color, Group, Matrix4, Quaternion, Vector3 } from 'three'

import { PLANES } from '@shared/balance'
import { PAD_SIZE, PLANE_PADS } from '@shared/world'

import { useGame } from '../../store/game'
import { BlockSet, disposeBlocks } from '../blocks'
import { createGroundGlow, disposeGlow } from '../glow'
import { CLUB_LENGTH, clubGlow, createClubSet, disposeClubMesh } from '../golfClub'
import { padLabelSpec, padState } from '../labels/lobbyLabels'
import { updateWorldLabel } from '../labels/registry'
import { sharedMaterials, STYLE } from '../materials'

/** Pad colours by state, as in the reference: green owned, yellow equipped, red not. */
const PAD_COLORS = {
  equipped: new Color('#ffd21f'),
  owned: new Color('#3fdc4a'),
  buy: new Color('#ff3b3b'),
  locked: new Color('#b0262b'),
}

const _m = new Matrix4()
const _q = new Quaternion()
const _tilt = new Quaternion()
const _p = new Vector3()
const _one = new Vector3(1, 1, 1)
const _up = new Vector3(0, 1, 0)
const _side = new Vector3(0, 0, 1)

/** Size the display clubs are drawn at, and how high their heads float over the pedestal. */
const CLUB_SCALE = 1.8
const HOVER = 0.3
/** Height of a pedestal's top above its tier. */
const PEDESTAL_TOP = 1.0

/**
 * Display pedestals, all in one block set: a dark plinth with a slab on top glowing in
 * the club's colour, and a gold-rimmed plate on top for the club to float over. The
 * first PLANE_PADS.length blocks are the floor plates under them (recoloured by
 * ownership, so their instance index is the pad index); the pedestals follow.
 */
function buildStands() {
  const set = new BlockSet()
  const plate = PAD_SIZE - 0.3
  for (const pad of PLANE_PADS) set.addOn(pad.x, pad.y, pad.z, plate, 0.05, plate, '#ffffff', STYLE.GLOW)
  for (const pad of PLANE_PADS) {
    const glow = clubGlow(PLANES[pad.index].id)
    const { x, y, z } = pad
    set.addOn(x, y + 0.05, z, 1.6, 0.45, 1.6, '#231c30', STYLE.SMOOTH)
    set.addOn(x, y + 0.5, z, 1.3, PEDESTAL_TOP - 0.62, 1.3, glow, STYLE.GLOW)
    set.addOn(x, y + PEDESTAL_TOP - 0.12, z, 1.5, 0.12, 1.5, '#ffcf3a', STYLE.GLOW)
    set.addOn(x, y + PEDESTAL_TOP, z, 1.2, 0.04, 1.2, '#231c30', STYLE.SMOOTH)
  }
  return set.build(sharedMaterials().blocks)
}

/**
 * The golf club shop: twenty pedestals on the two stone tiers, each with its club
 * floating upright over it, turning slowly in a pool of its own colour's light. Floor
 * plates recolour and labels rewrite as you buy and equip. Draw calls: the stands, the
 * light pools, and one per club shape (see golfClub.js).
 */
export function PlaneShop() {
  const owned = useGame((s) => s.profile.ownedPlanes)
  const equipped = useGame((s) => s.profile.equippedPlane)
  const padsRef = useRef(null)
  const clubsRef = useRef(null)

  const assets = useMemo(() => {
    const pads = buildStands()
    // Each club in the mesh of its shape, at its own slot there.
    const set = createClubSet(PLANES.length)
    const slots = PLANE_PADS.map((pad) => {
      const id = PLANES[pad.index].id
      const mesh = set.meshFor(id)
      const slot = mesh.count
      mesh.setClub(slot, id)
      mesh.count += 1
      mesh.visible = true
      return { mesh, slot }
    })
    const clubs = new Group()
    for (const m of set.list) clubs.add(m)
    clubs.userData.slots = slots
    // Every club is its own draw call, skipped whenever it's off screen. It only turns
    // and bobs where it stands, so a sphere a little bigger than at rest always holds it.
    for (const pad of PLANE_PADS) {
      const { mesh, slot } = slots[pad.index]
      _p.set(pad.x, pad.y + PEDESTAL_TOP + HOVER + CLUB_LENGTH * CLUB_SCALE, pad.z)
      mesh.setMatrixAt(slot, _m.compose(_p, _q.identity(), _one.setScalar(CLUB_SCALE)))
    }
    for (const m of set.list) {
      if (m.count === 0) continue
      m.computeBoundingSphere()
      m.boundingSphere.radius += 0.6
      m.frustumCulled = true
    }
    // The light each club throws on its tier.
    const pools = createGroundGlow(PLANE_PADS.map((pad) => ({ x: pad.x, y: pad.y + 0.04, z: pad.z, color: clubGlow(PLANES[pad.index].id), radius: 2.1, strength: 0.6 })))
    return { pads, clubs, pools }
  }, [])

  useEffect(
    () => () => {
      disposeBlocks(assets.pads)
      for (const m of assets.clubs.children) disposeClubMesh(m)
      disposeGlow(assets.pools)
    },
    [assets],
  )

  // Recolour pads and rewrite their labels whenever ownership changes.
  useEffect(() => {
    const pads = padsRef.current
    const profile = { ownedPlanes: owned, equippedPlane: equipped }
    for (const pad of PLANE_PADS) {
      const state = padState(profile, pad.index)
      pads?.setColorAt(pad.index, PAD_COLORS[state])
      updateWorldLabel(`pad-${pad.index}`, padLabelSpec(pad.index, state))
    }
    if (pads?.instanceColor) pads.instanceColor.needsUpdate = true
  }, [owned, equipped])

  // Each club floats upright, head down, turning slowly and bobbing a little, leaning
  // just enough to show off its face.
  useFrame((state) => {
    const clubs = clubsRef.current
    if (!clubs) return
    const slots = clubs.userData.slots
    const t = state.clock.elapsedTime
    for (const pad of PLANE_PADS) {
      _q.setFromAxisAngle(_up, t * 0.6 + pad.index * 0.9)
      _tilt.setFromAxisAngle(_side, 0.12)
      _q.premultiply(_tilt)
      const bob = Math.sin(t * 1.4 + pad.index) * 0.08
      _p.set(pad.x, pad.y + PEDESTAL_TOP + HOVER + bob + CLUB_LENGTH * CLUB_SCALE, pad.z)
      _m.compose(_p, _q, _one.setScalar(CLUB_SCALE))
      const { mesh, slot } = slots[pad.index]
      mesh.setMatrixAt(slot, _m)
    }
    for (const m of clubs.children) m.instanceMatrix.needsUpdate = true
  })

  return (
    <>
      <primitive ref={padsRef} object={assets.pads} />
      <primitive ref={clubsRef} object={assets.clubs} />
      <primitive object={assets.pools} />
    </>
  )
}

export default PlaneShop
