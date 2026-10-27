import { useFrame } from '@react-three/fiber'
import { Suspense, useEffect, useMemo, useRef } from 'react'
import { Quaternion, Vector3 } from 'three'

import { ballStyleId } from '@shared/logic'
import { clampToWalkable, groundHeightAt, STATIC_COLLIDERS } from '@shared/world'

import { sfx } from '../audio/sfx'
import { getGame } from '../store/game'
import { getQuality } from '../store/quality'
import ErrorBoundary from '../ui/ErrorBoundary'
import FallbackAvatar from './FallbackAvatar'
import { BALL_HALF_HEIGHT, TEE_BALL_SCALE, createFrisbeeModel } from './frisbee'
import HeldClub from './HeldClub'
import PlayerAvatar from './PlayerAvatar'
import { CATCH_TIME, FULL_DOWN_FROM, FULL_RELEASE_AT, FULL_SWING_TIME, RELEASE_AT, THROW_TIME } from './playerPose'
import { runtime, SIDE_ON } from './runtime'
import useKeyboard from './useKeyboard'

export const PLAYER_HEIGHT = 1.8
const RADIUS = 0.45

const WALK_SPEED = 7.5
const SPRINT_MULTIPLIER = 1.45
const ACCELERATION = 16
const GRAVITY = 32
const JUMP_SPEED = 10.5
/** Ledges up to this high are walked straight onto (the shop's back stage). */
const STEP_UP = 1.05
/** Seconds standing still before the golfer settles over an imaginary ball. */
const SETTLE_TIME = 0.25

// Scratch objects, reused each frame so the loop allocates nothing.
const _input = new Vector3()
const _move = new Vector3()
const _camForward = new Vector3()
const _camRight = new Vector3()
const _targetQuat = new Quaternion()
const _up = new Vector3(0, 1, 0)
const _clamped = { x: 0, z: 0 }

/** How big the teed-up pumpkin is, how high its centre sits, and its gap from the clubface. */
const TEE_SCALE = TEE_BALL_SCALE
const TEE_HEIGHT = BALL_HALF_HEIGHT * TEE_SCALE + 0.01
const FACE_GAP = 0.2

/**
 * The pumpkin ball, teed up on the ground in front of the player with its face towards
 * the camera. Shown while standing in the Hit Zone, and through a swing until the club
 * meets it; every shot (the hit off the Hit Zone, training shots) starts from here, so
 * `runtime.player.frisbeeAt` is set to it.
 */
function TeeBall() {
  const ref = useRef(null)
  const model = useMemo(() => {
    const m = createFrisbeeModel({ glowSize: 1.2, glowIntensity: 0.1 })
    m.scale.setScalar(TEE_SCALE)
    return m
  }, [])

  useEffect(() => () => model.dispose(), [model])

  useFrame(() => {
    const group = ref.current
    if (!group) return
    const player = runtime.player
    group.setFrisbee(ballStyleId(getGame().profile))
    group.setGlowSize(1.2 * getQuality().frisbeeGlow)
    // In the Hit Zone, through a training swing, and on a duel ring until the shot.
    const ahead = getGame().zone.throwArea || player.throwTimer > 0 || (player.dueling && !player.duelShot)
    group.visible = ahead && !player.frisbeeAway
    // Just in front of the clubface: where the head rests, a little towards the target
    // (off the golfer's left).
    const fx = Math.sin(player.yaw)
    const fz = Math.cos(player.yaw)
    const left = player.teeLeft + FACE_GAP
    group.position.set(
      player.position.x + fx * player.teeForward + fz * left,
      player.position.y + TEE_HEIGHT,
      player.position.z + fz * player.teeForward - fx * left,
    )
    // Its face looks south, back at the lobby and the camera framing the shot.
    group.rotation.y = 0
    player.frisbeeAt.copy(group.position)
  })

  return <primitive ref={ref} object={model} />
}

/** Pushes a circle out of an axis-aligned rect. Returns true on contact. */
function pushOut(pos, rect) {
  const cx = Math.min(rect.maxX, Math.max(rect.minX, pos.x))
  const cz = Math.min(rect.maxZ, Math.max(rect.minZ, pos.z))
  const dx = pos.x - cx
  const dz = pos.z - cz
  const d2 = dx * dx + dz * dz
  if (d2 >= RADIUS * RADIUS) return false

  if (d2 > 1e-8) {
    const d = Math.sqrt(d2)
    const push = (RADIUS - d) / d
    pos.x += dx * push
    pos.z += dz * push
    return true
  }

  // Centre inside the rect (spawned in, or a wall appeared on top of us): leave by the
  // nearest side.
  const left = pos.x - rect.minX
  const right = rect.maxX - pos.x
  const near = pos.z - rect.minZ
  const far = rect.maxZ - pos.z
  const m = Math.min(left, right, near, far)
  if (m === left) pos.x = rect.minX - RADIUS
  else if (m === right) pos.x = rect.maxX + RADIUS
  else if (m === near) pos.z = rect.minZ - RADIUS
  else pos.z = rect.maxZ + RADIUS
  return true
}

/**
 * The local player: a kinematic character controller.
 *
 * No physics engine: the world is flat ground, a few raised floors and a list of
 * rectangular walls, which a circle-vs-rect push-out handles exactly. That saves the
 * ~2 MB Rapier WASM download and keeps the active rigid body count at zero.
 *
 * Reads and writes `runtime.player`; never touches React state per frame.
 *
 * @param {{ onAvatarReady?: () => void }} props
 */
export function Player({ onAvatarReady }) {
  const groupRef = useRef(null)
  const visualRef = useRef(null)
  /** Moved onto the right palm by whichever avatar is showing. */
  const handRef = useRef(null)
  const keys = useKeyboard()
  const velocity = useRef(new Vector3())
  const vy = useRef(0)
  const lastFootfall = useRef(0)
  /** Seconds standing still, for settling into the address. */
  const stillFor = useRef(0)

  /** Handed to the avatar so it can pose itself. A ref: written every frame. */
  const motionRef = useRef({
    time: 0,
    speed: 0,
    grounded: true,
    maxSpeed: WALK_SPEED,
    vy: 0,
    stride: 0,
    throwT: 0,
    catchT: 0,
    swingT: 0,
    address: 0,
    /** A duel's ending ('win' | 'lose' | null) and seconds into it; see playerPose. */
    emote: null,
    emoteT: 0,
    /** How far the wrists are cocked, written by computePose for the club. */
    hinge: 0,
  })

  useEffect(() => {
    const caster = { position: runtime.player.position, size: 1.1 }
    runtime.shadowCasters.add(caster)
    return () => runtime.shadowCasters.delete(caster)
  }, [])

  useFrame((state, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05)
    const player = runtime.player
    const pos = player.position
    const k = keys.current
    const joy = runtime.input

    // --- Input, relative to the camera ----------------------------------------
    _input.set(0, 0, 0)
    if (!player.frozen) {
      _input.set(
        (k.right ? 1 : 0) - (k.left ? 1 : 0) + joy.joyX,
        0,
        (k.backward ? 1 : 0) - (k.forward ? 1 : 0) - joy.joyY,
      )
    }
    const inputLength = Math.min(1, _input.length())
    const sprint = k.sprint ? SPRINT_MULTIPLIER : 1
    const maxSpeed = WALK_SPEED * sprint

    if (inputLength > 0.02) {
      _input.normalize()
      // Flatten the camera's forward onto the ground plane so "up" always means
      // "away from the camera".
      state.camera.getWorldDirection(_camForward)
      _camForward.y = 0
      _camForward.normalize()
      _camRight.crossVectors(_camForward, _up).normalize()
      _move
        .set(0, 0, 0)
        .addScaledVector(_camForward, -_input.z)
        .addScaledVector(_camRight, _input.x)
        .normalize()
        .multiplyScalar(maxSpeed * inputLength)
    } else {
      _move.set(0, 0, 0)
    }

    // Ease towards the target velocity: crisp, but no instant 0->max snaps.
    const blend = 1 - Math.exp(-ACCELERATION * delta)
    velocity.current.lerp(_move, blend)

    // --- Horizontal move + collision --------------------------------------------
    const prevX = pos.x
    const prevZ = pos.z
    pos.x += velocity.current.x * delta
    pos.z += velocity.current.z * delta

    for (const rect of STATIC_COLLIDERS) pushOut(pos, rect)
    for (const rect of runtime.dynamicColliders) pushOut(pos, rect)
    clampToWalkable(pos.x, pos.z, _clamped)
    pos.x = _clamped.x
    pos.z = _clamped.z

    // A ledge too tall to step onto acts as a wall.
    let floor = groundHeightAt(pos.x, pos.z)
    if (floor - pos.y > STEP_UP) {
      pos.x = prevX
      pos.z = prevZ
      floor = groundHeightAt(pos.x, pos.z)
    }

    // --- Vertical ---------------------------------------------------------------
    const wantJump = !player.frozen && (k.jump || joy.jump)
    if (wantJump && player.grounded) {
      vy.current = JUMP_SPEED
      player.grounded = false
      sfx.jump()
    }
    vy.current -= GRAVITY * delta
    pos.y += vy.current * delta

    if (pos.y <= floor) {
      // Coming down from a jump (not just stepping off a kerb) lands with a thump.
      if (!player.grounded && vy.current < -5) sfx.jumpLand()
      pos.y = floor
      vy.current = 0
      player.grounded = true
    } else if (pos.y - floor > 0.05) {
      // Walked off a ledge, or still rising from a jump.
      player.grounded = false
    }

    // --- Facing -----------------------------------------------------------------
    // Walking sets the heading; the body faces it, turning side-on as the golfer settles
    // over the ball (so a shot, off their left, goes the way they were heading).
    const speed = Math.hypot(velocity.current.x, velocity.current.z)
    if (speed > 0.3) player.heading = Math.atan2(velocity.current.x, velocity.current.z)
    player.yaw = player.heading - SIDE_ON * player.address
    if (visualRef.current) {
      _targetQuat.setFromAxisAngle(_up, player.yaw)
      visualRef.current.quaternion.slerp(_targetQuat, 1 - Math.pow(0.0005, delta))
    }
    const group = groupRef.current
    if (group) {
      // Step-ups ease in over a few frames on the visual only; the logical position
      // snaps so collision and triggers stay exact.
      const steppingUp = player.grounded && pos.y > group.position.y
      const visualY = steppingUp
        ? group.position.y + (pos.y - group.position.y) * Math.min(1, delta * 18)
        : pos.y
      group.position.set(pos.x, visualY, pos.z)
    }

    // --- Throw and catch -------------------------------------------------------
    // The frisbee is away from the release until the swing ends (a training shot), or
    // for the whole flight off the stage; it comes back into the hand with a catch.
    // The swing runs on game time, so the slow-motion strike slows the golfer too.
    const gameDelta = delta * runtime.timeScale
    player.throwTimer = Math.max(0, player.throwTimer - gameDelta)
    // The full swing off the Hit Zone: the whoosh of the downswing as it starts down,
    // peaking as the club meets the ball.
    const before = player.swingTimer
    player.swingTimer = Math.max(0, player.swingTimer - gameDelta)
    const downAt = FULL_SWING_TIME * (1 - FULL_DOWN_FROM)
    if (before > downAt && player.swingTimer <= downAt) sfx.clubWhoosh(FULL_SWING_TIME * (FULL_RELEASE_AT - FULL_DOWN_FROM))
    const wasAway = player.frisbeeAway
    if (player.swingTimer > 0) player.frisbeeAway = player.swingTimer <= FULL_SWING_TIME * (1 - FULL_RELEASE_AT)
    else player.frisbeeAway = player.throwTimer > 0 ? player.throwTimer <= THROW_TIME * (1 - RELEASE_AT) : runtime.camera.mode === 'flight'

    // Over the ball - lining up a shot, swinging, training, on a duel ring, or just
    // standing still for a moment - the golfer settles into the address, as on the Hit
    // Zone; walking, they carry the club at their side (and dancing, or weeping, after a
    // duel, they stand up for it). Quick into a swing, and quick out of it to walk off.
    const game = getGame()
    stillFor.current = player.grounded && speed < 0.3 ? stillFor.current + delta : 0
    const addressing =
      !player.emote &&
      (game.swing || player.swingTimer > 0 || player.throwTimer > 0 || player.dueling || game.zone.lane >= 0 || stillFor.current > SETTLE_TIME)
    const rate = player.throwTimer > 0 || (!addressing && speed > 0.3) ? 14 : 5
    player.address += ((addressing ? 1 : 0) - player.address) * (1 - Math.exp(-rate * delta))
    player.catchTimer = wasAway && !player.frisbeeAway ? CATCH_TIME : Math.max(0, player.catchTimer - delta)
    // A new throw starts with the frisbee already in hand.
    if (player.throwTimer > 0) player.catchTimer = 0

    // --- Publish motion ---------------------------------------------------------
    player.speed = speed
    player.anim = !player.grounded ? 'jump' : player.throwTimer > 0 || player.swingTimer > 0 ? 'throw' : speed > 0.5 ? 'walk' : 'idle'

    const motion = motionRef.current
    motion.time += gameDelta
    motion.speed = speed
    motion.grounded = player.grounded
    // Full stride amplitude at a sprint, so walking reads as a walk.
    motion.maxSpeed = WALK_SPEED * SPRINT_MULTIPLIER
    motion.vy = vy.current
    // Steps quicken with speed: the stride phase runs faster rather than jumping.
    motion.stride += delta * (5 + 6 * Math.min(1, speed / (WALK_SPEED * SPRINT_MULTIPLIER)))
    // A footstep each time a foot comes down (twice per stride cycle).
    const footfall = Math.floor(motion.stride / Math.PI)
    if (footfall !== lastFootfall.current) {
      lastFootfall.current = footfall
      if (player.grounded && speed > 1.5) sfx.step()
    }
    motion.throwT = player.throwTimer
    motion.swingT = player.swingTimer
    motion.address = player.address
    motion.catchT = player.catchTimer
    motion.emote = player.emote
    motion.emoteT = player.emote ? (performance.now() - player.emoteAt) / 1000 : 0
  })

  return (
    <>
      <TeeBall />
      <group ref={groupRef}>
      <group ref={visualRef}>
        <group ref={handRef}>
          <HeldClub motionRef={motionRef} />
        </group>
        <ErrorBoundary fallback={<FallbackAvatar motionRef={motionRef} handRef={handRef} onReady={onAvatarReady} />}>
          <Suspense fallback={<FallbackAvatar motionRef={motionRef} handRef={handRef} />}>
            <PlayerAvatar onReady={onAvatarReady} targetHeight={PLAYER_HEIGHT} motionRef={motionRef} handRef={handRef} />
          </Suspense>
        </ErrorBoundary>
      </group>
    </group>
    </>
  )
}

export default Player
