import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { Group, Matrix4, Quaternion, Vector3 } from 'three'

import { remotePlayers } from '../net/remotePlayers'
import { getGame } from '../store/game'
import { CLUB_SOLE, createClubSet, disposeClubMesh } from './golfClub'
import { CLUB_GRIP, CLUB_TILT, WRIST_AXIS } from './playerPose'
import { runtime } from './runtime'

// Scratch objects, reused each frame so the loop allocates nothing.
const _clubM = new Matrix4()
const _clubOne = new Vector3(1, 1, 1)
const _clubIdentity = new Quaternion()
const _handQ = new Quaternion()
const _handP = new Vector3()
const _aim = new Quaternion()
const _aimDir = new Vector3()
const _clubDown = new Vector3(0, -1, 0)
const _carry = new Quaternion()
const _swingQ = new Quaternion()
const _hinge = new Quaternion()
const _emoteQ = new Quaternion()
/** How far the wrists cock the club back at the top of the swing, radians. */
const WRIST_COCK = -1.45

const smooth01 = (x) => {
  const t = Math.min(1, Math.max(0, x))
  return t * t * (3 - 2 * t)
}

/**
 * A golfer's club in their right hand, in its own shape and materials (see golfClub.js):
 * yours, or (with `sessionId`) another player's. It lives inside the hand anchor the avatar
 * moves onto the palm each frame, so it swings with the arms; here it only sets how it
 * is gripped, from the avatar's own motion (`motionRef`: address, swing timers, the
 * wrists' hinge and any duel emote, as computePose left them).
 *
 * @param {{ motionRef: React.MutableRefObject<object>, sessionId?: string }} props
 */
export function HeldClub({ motionRef, sessionId = null }) {
  const mesh = useMemo(() => {
    // Every shape ready, only the one in hand shown (no draw calls for the others).
    const set = createClubSet(1)
    const group = new Group()
    // The grip offset is baked in; how the club hangs from the hand is the group's own
    // rotation, set every frame below.
    for (const m of set.list) {
      m.setMatrixAt(0, _clubM.compose(CLUB_GRIP, _clubIdentity, _clubOne))
      m.instanceMatrix.needsUpdate = true
      m.count = 1
      group.add(m)
    }
    group.quaternion.copy(CLUB_TILT)
    group.userData.set = set
    return group
  }, [])
  const ref = useRef(null)
  const shown = useRef(null)

  useEffect(
    () => () => {
      for (const m of mesh.children) disposeClubMesh(m)
    },
    [mesh],
  )

  useFrame(() => {
    const club = ref.current
    const motion = motionRef.current
    if (!club || !motion) return
    const remote = sessionId ? remotePlayers.get(sessionId) : null
    if (sessionId && !remote) return
    const subject = remote || runtime.player
    const id = remote ? remote.planeId : getGame().profile.equippedPlane
    if (shown.current !== id) {
      shown.current = id
      const set = club.userData.set
      for (const m of set.list) m.visible = false
      const m = set.meshFor(id)
      m.visible = true
      m.setClub(0, id)
    }

    // Three ways to hold it, all worked out in the world and turned into the hand's frame
    // so they suit any avatar's proportions: loosely at the side when walking about, the head
    // resting on the ground just behind the ball at the address, and through a swing
    // following the arms round with the wrists cocking and releasing it.
    const address = motion.address ?? 1
    const hand = club.parent
    hand.getWorldPosition(_handP)
    hand.getWorldQuaternion(_handQ)
    _handQ.invert()

    // Walking about: held loosely at the side, the head just off the ground ahead.
    const fx = Math.sin(subject.yaw)
    const fz = Math.cos(subject.yaw)
    const lift = Math.min(CLUB_SOLE * 0.95, Math.max(0.2, _handP.y - subject.position.y - 0.12))
    const ahead = Math.sqrt(CLUB_SOLE * CLUB_SOLE - lift * lift)
    // Out a little to the right of the line of walking, so it clears the legs.
    _aimDir.set(fx * ahead - fz * 0.25, -lift, fz * ahead + fx * 0.25).normalize()
    _carry.setFromUnitVectors(_clubDown, _aimDir).premultiply(_handQ)

    // At the address: the sole rests exactly on the floor, straight out in front of the
    // hands, wherever the avatar's arms put them - never into the ground.
    const drop = Math.min(CLUB_SOLE * 0.995, Math.max(0.1, _handP.y - subject.position.y - 0.01))
    const along = Math.sqrt(CLUB_SOLE * CLUB_SOLE - drop * drop)
    _aimDir.set(fx * along, -drop, fz * along)
    // Where your club head rests, relative to you: the ball is teed up just in front of
    // the clubface (see TeeBall). Measured only while standing still over the ball, so
    // the swing can't drag it about.
    const swinging = motion.swingT > 0 || motion.throwT > 0
    if (!remote && !swinging && address > 0.95) {
      const hx = _handP.x + _aimDir.x - subject.position.x
      const hz = _handP.z + _aimDir.z - subject.position.z
      runtime.player.teeForward = hx * fx + hz * fz
      runtime.player.teeLeft = hx * fz - hz * fx
    }
    _aim.setFromUnitVectors(_clubDown, _aimDir.normalize()).premultiply(_handQ)
    _aim.slerp(_carry, 1 - address)

    // Through a swing: the club leaves the floor only as far as the wrists cock it - up
    // into the backswing, back down to the ball at impact, up again into the finish.
    const hinge = motion.hinge || 0
    const through = swinging ? Math.min(1, hinge * 1.8) : 0
    if (through > 0) {
      _hinge.setFromAxisAngle(WRIST_AXIS, WRIST_COCK * hinge)
      _swingQ.copy(CLUB_TILT).multiply(_hinge)
      _aim.slerp(_swingQ, smooth01(through))
    }

    // A duel's end: the winner holds the club up high like a trophy; the loser lets it
    // drop, lying out flat on the ground to their right.
    const emoteW = motion.emote ? smooth01(motion.emoteT / 0.35) : 0
    if (emoteW > 0) {
      if (motion.emote === 'win') _aimDir.set(0, 1, 0)
      else _aimDir.set(-fz * 0.85 + fx * 0.45, -0.1, fx * 0.85 + fz * 0.45).normalize()
      _emoteQ.setFromUnitVectors(_clubDown, _aimDir).premultiply(_handQ)
      _aim.slerp(_emoteQ, emoteW)
    }
    club.quaternion.copy(_aim)
  })

  return <primitive ref={ref} object={mesh} />
}

export default HeldClub
