import { Quaternion, Vector3 } from 'three'

/**
 * The player's body language, shared by the Bloxity avatar and the blocky stand-in so
 * both move the same way.
 *
 * `computePose` turns the motion state into joint angles; each avatar applies them to
 * its own limbs. Angles are radians in character space (the character faces +Z, its
 * left side is +X), about each joint's pivot:
 *   swing - about X: negative swings a limb forward (arm up in front, knee up)
 *   sway  - about Z: positive moves a limb towards +X
 *   twist - about Y: positive turns the right shoulder forward
 * `lift` raises (or, to keep bent legs on the ground, lowers) the body, in metres.
 */

/** Seconds a golf swing lasts, backswing to finish. (The "throw" names are historical.) */
export const THROW_TIME = 0.7
/** Fraction of the swing at which the club meets the ball. */
export const RELEASE_AT = 0.5
/** Seconds from the start of a swing to the impact. */
export const RELEASE_DELAY = THROW_TIME * RELEASE_AT
/** Nothing is caught in golf; kept so the ball-away bookkeeping stays as it was. */
export const CATCH_TIME = 0.01

/**
 * The full swing off the Hit Zone - slower and grander than a training swing: a
 * takeaway, a turn to the top and a beat's pause there, a fast downswing, the strike at
 * FULL_RELEASE_AT, and a high finish held while the ball flies.
 */
export const FULL_SWING_TIME = 1.5
export const FULL_RELEASE_AT = 0.56
/** Fraction of the full swing at which the downswing starts. */
export const FULL_DOWN_FROM = 0.46
export const FULL_RELEASE_DELAY = FULL_SWING_TIME * FULL_RELEASE_AT

export const POSED_BONES = [
  'Spine1',
  'Neck1',
  'ArmL1',
  'ArmL2',
  'ArmR1',
  'ArmR2',
  'LegL1',
  'LegL2',
  'LegR1',
  'LegR2',
]

/** Written by `computePose` every frame; one shared result, never reallocated. */
export const pose = {
  lift: 0,
  bones: Object.fromEntries(POSED_BONES.map((name) => [name, { swing: 0, sway: 0, twist: 0 }])),
}

/** Sway sign that moves a limb away from the body, per side. */
const OUT_L = 1
const OUT_R = -1

const clamp01 = (x) => Math.min(1, Math.max(0, x))
const lerp = (a, b, t) => a + (b - a) * t
const smooth = (edge0, edge1, x) => {
  const t = clamp01((x - edge0) / (edge1 - edge0))
  return t * t * (3 - 2 * t)
}

/** Length of each leg segment (thigh, shin) of a 1.8 m avatar, in metres. */
const LEG_SEGMENT = 0.37

/** How much higher a foot sits than with the leg straight, for its hip and knee angles. */
function legDrop(hip, knee) {
  const t = pose.bones[hip].swing
  const k = pose.bones[knee].swing
  return LEG_SEGMENT * (2 - Math.cos(t) - Math.cos(t + k))
}

/** Adds to a joint, scaled by weight `w`. */
function add(name, swing, sway, twist, w) {
  const b = pose.bones[name]
  b.swing += swing * w
  b.sway += sway * w
  b.twist += twist * w
}

/** Pulls a joint towards an absolute angle by `k` (0 keeps it, 1 replaces it). */
function blend(name, swing, sway, twist, k) {
  const b = pose.bones[name]
  b.swing += (swing - b.swing) * k
  b.sway += (sway - b.sway) * k
  b.twist += (twist - b.twist) * k
}

/**
 * Golf address: feet a shoulder-width apart, knees flexed, tilted forward from the hips
 * with a straight back, both arms hanging straight down to meet on the club in front of
 * the thighs, eyes on the ball. While standing over the ball it lives a little: a slow
 * waggle of the club, a shift of weight, and now and then a glance down the course.
 */
function stance(w, time) {
  if (w <= 0) return
  const breath = Math.sin(time * 1.8)
  const waggle = Math.sin(time * 1.3) * 0.05
  // A glance at the target (off the left shoulder) for about a second every ~5 s.
  const glance = smooth(0, 0.3, Math.sin(time * 1.25) - 0.75) * 0.65
  add('LegL1', -0.2, 0.17 * OUT_L, 0, w)
  add('LegL2', 0.36, 0, 0, w)
  add('LegR1', -0.2, 0.17 * OUT_R, 0, w)
  add('LegR2', 0.36, 0, 0, w)
  add('Spine1', -0.4 + breath * 0.01, 0, waggle * 0.6, w)
  add('Neck1', 0.28, 0, glance - waggle * 0.6, w)
  add('ArmL1', -0.42 + breath * 0.015, -0.3 * OUT_L + waggle, 0, w)
  add('ArmL2', -0.08, 0, 0, w)
  add('ArmR1', -0.42 - breath * 0.015, -0.3 * OUT_R + waggle, 0, w)
  add('ArmR2', -0.22, 0, 0, w)
}

/** Standing about the lobby: upright and easy, weight on both feet, breathing. */
function relaxed(w, time) {
  if (w <= 0) return
  const breath = Math.sin(time * 1.8)
  add('LegL1', -0.04, 0.08 * OUT_L, 0, w)
  add('LegL2', 0.08, 0, 0, w)
  add('LegR1', 0.02, 0.08 * OUT_R, 0, w)
  add('LegR2', 0.06, 0, 0, w)
  add('Spine1', -0.05 + breath * 0.012, 0, 0, w)
  add('ArmL1', 0.04 + breath * 0.02, 0.12 * OUT_L, 0, w)
  add('ArmL2', -0.2, 0, 0, w)
}

/** The club carried loosely in the right hand, the arm a little forward to hold it. */
function carry(w) {
  if (w <= 0) return
  blend('ArmR1', -0.22, 0.1 * OUT_R, 0, w * 0.6)
  blend('ArmR2', -0.35, 0, 0, w * 0.6)
}

/**
 * Walk to sprint: arms and legs swing against each other, the body leans in and bobs
 * once per step. `phase` advances faster with speed, so the steps quicken.
 */
function stride(phase, ratio) {
  const cycle = Math.sin(phase)
  const leg = 0.85 * ratio
  const arm = 0.75 * ratio
  add('LegL1', cycle * leg, 0, 0, 1)
  add('LegR1', -cycle * leg, 0, 0, 1)
  // Knees fold on the back swing only.
  add('LegL2', Math.max(0, -cycle) * 1.1 * ratio, 0, 0, 1)
  add('LegR2', Math.max(0, cycle) * 1.1 * ratio, 0, 0, 1)
  add('ArmL1', -cycle * arm, 0.08 * OUT_L * ratio, 0, 1)
  add('ArmR1', cycle * arm, 0.16 * OUT_R * ratio, 0, 1)
  add('ArmL2', -(0.35 + Math.max(0, -cycle) * 0.5) * ratio, 0, 0, 1)
  add('ArmR2', -(0.35 + Math.max(0, cycle) * 0.5) * ratio, 0, 0, 1)
  add('Spine1', -(0.08 + 0.14 * ratio) * ratio, 0, cycle * 0.12 * ratio, 1)
}

/**
 * In the air: one knee up and the arms out on the way up; falling, the legs straighten
 * and reach down for the ground.
 */
function airborne(vy) {
  const f = smooth(0, 1, clamp01((2 - vy) / 9))
  add('LegL1', lerp(-1.3, -0.35, f), 0.08 * OUT_L, 0, 1)
  add('LegL2', lerp(1.6, 0.25, f), 0, 0, 1)
  add('LegR1', lerp(0.25, -0.1, f), 0.08 * OUT_R, 0, 1)
  add('LegR2', lerp(0.5, 0.2, f), 0, 0, 1)
  add('ArmL1', lerp(-0.35, -0.6, f), lerp(1.15, 1.45, f) * OUT_L, 0, 1)
  add('ArmL2', -0.35, 0, 0, 1)
  add('ArmR1', lerp(-0.25, -0.5, f), lerp(1.05, 1.35, f) * OUT_R, 0, 1)
  add('ArmR2', -0.4, 0, 0, 1)
  add('Spine1', lerp(-0.15, 0.06, f), 0, 0, 1)
}

/**
 * The full swing's key poses, as absolute joint angles over the address stance. Each is
 * `[swing, sway, twist]` per joint; legs too, for the weight shift. Sway signs: OUT_*
 * moves a limb away from its own side, so both arms going "right" is -OUT_L for the left
 * (across the chest) and +OUT_R for the right (out to the side).
 */
const SWING_KEYS = {
  // At the top: shoulders turned well away, arms raised over the right shoulder, the
  // right elbow folded and the left arm straight, head still down on the ball, the
  // weight settled into the right leg.
  top: {
    Spine1: [-0.34, 0, -1.25],
    Neck1: [0.3, 0, 1.0],
    ArmL1: [-1.75, -0.62 * OUT_L, 0],
    ArmL2: [-0.12, 0, 0],
    ArmR1: [-1.55, 0.55 * OUT_R, 0],
    ArmR2: [-1.45, 0, 0],
    LegL1: [-0.24, 0.12 * OUT_L, 0],
    LegL2: [0.48, 0, 0],
    LegR1: [-0.16, 0.2 * OUT_R, 0],
    LegR2: [0.3, 0, 0],
  },
  // Impact: back at the address, the hips and shoulders a touch open, arms straight.
  impact: {
    Spine1: [-0.46, 0, 0.3],
    Neck1: [0.26, 0, -0.18],
    ArmL1: [-0.52, -0.18 * OUT_L, 0],
    ArmL2: [-0.04, 0, 0],
    ArmR1: [-0.55, -0.34 * OUT_R, 0],
    ArmR2: [-0.12, 0, 0],
    LegL1: [-0.14, 0.17 * OUT_L, 0],
    LegL2: [0.22, 0, 0],
    LegR1: [-0.22, 0.12 * OUT_R, 0],
    LegR2: [0.42, 0, 0],
  },
  // The finish: tall and turned right round to the target, the club wrapped high over
  // the left shoulder, the right foot up on its toe, head up watching the ball fly.
  finish: {
    Spine1: [-0.04, 0, 1.4],
    Neck1: [-0.08, 0, -0.75],
    ArmL1: [-2.05, 0.55 * OUT_L, 0],
    ArmL2: [-1.5, 0, 0],
    ArmR1: [-1.95, -0.6 * OUT_R, 0],
    ArmR2: [-0.55, 0, 0],
    LegL1: [-0.08, 0.14 * OUT_L, 0],
    LegL2: [0.04, 0, 0],
    LegR1: [0.42, 0.06 * OUT_R, 0],
    LegR2: [0.95, 0, 0],
  },
}
const SWING_JOINTS = Object.keys(SWING_KEYS.top)

/** Eases a value in slowly and out quickly (the downswing's whip). */
const easeIn = (t) => t * t * t

/** The full swing's timing: takeaway, top, pause, strike, finish, back home. */
const FULL_TIMING = { backFrom: 0.04, top: 0.42, downFrom: FULL_DOWN_FROM, hit: FULL_RELEASE_AT, finish: 0.74, homeFrom: 0.94, size: 1 }
/**
 * A training swing's: the same swing, quicker and three-quarter length, striking at
 * RELEASE_AT and back at the address in time for the next one.
 */
const TRAIN_TIMING = { backFrom: 0.02, top: 0.36, downFrom: 0.38, hit: RELEASE_AT, finish: 0.66, homeFrom: 0.78, size: 0.72 }

/**
 * A golf swing, `p` 0..1 through it, from the address: a smooth takeaway to the top, a
 * beat's pause, a fast whip down to impact at `hit`, through to the finish, held, and
 * back to the address at the end. `size` shortens it (a three-quarter swing goes less
 * far back and through). Sets how far the wrists are cocked, for the club.
 */
function golfSwing(p, timing) {
  const { backFrom, top: topAt, downFrom, hit: hitAt, finish: finishAt, homeFrom, size } = timing
  const back = smooth(backFrom, topAt, p) * size
  const down = easeIn(clamp01((p - downFrom) / (hitAt - downFrom)))
  const through = smooth(hitAt, finishAt, p) * size
  const home = smooth(homeFrom, 1, p)
  for (const name of SWING_JOINTS) {
    const b = pose.bones[name]
    const top = SWING_KEYS.top[name]
    const hit = SWING_KEYS.impact[name]
    const fin = SWING_KEYS.finish[name]
    // Address (whatever the stance gave) -> top -> impact -> finish -> address.
    const ax = b.swing
    const ay = b.sway
    const az = b.twist
    let sw = lerp(ax, top[0], back)
    let sy = lerp(ay, top[1], back)
    let tw = lerp(az, top[2], back)
    sw = lerp(sw, hit[0], down)
    sy = lerp(sy, hit[1], down)
    tw = lerp(tw, hit[2], down)
    sw = lerp(sw, fin[0], through)
    sy = lerp(sy, fin[1], through)
    tw = lerp(tw, fin[2], through)
    b.swing = lerp(sw, ax, home)
    b.sway = lerp(sy, ay, home)
    b.twist = lerp(tw, az, home)
  }
  // Wrists: cocked at the top, released through impact, re-cocked into the finish. (At
  // impact `down` is 1 and `through` 0, so a shortened swing still meets the ball.)
  swingWrist.hinge = lerp(lerp(lerp(0, 1, back), 0, down), 0.7, through) * (1 - home)
}

/** How far the wrists are cocked, while a pose is worked out (copied to `motion.hinge`). */
const swingWrist = { hinge: 0 }

/**
 * A duel's ending, for everyone to see, blended in over a moment. 'win': a victory
 * dance - bouncing on the beat, hips swaying, the club pumped overhead with both hands,
 * a hop on every other beat. 'lose': down on the knees, slumped, head hung, fists
 * pounding the ground in turn, shoulders shaking. Returns how high the dance hops.
 */
function emotePose(kind, t) {
  const w = smooth(0, 0.35, t)
  if (kind === 'win') {
    const beat = t * Math.PI * 4
    const bob = 0.5 + 0.5 * Math.sin(beat)
    blend('Spine1', -0.05, Math.sin(beat / 2) * 0.22, Math.sin(beat / 2) * 0.35, w)
    blend('Neck1', Math.sin(beat) * 0.18, -Math.sin(beat / 2) * 0.15, 0, w)
    blend('ArmL1', -2.7 + Math.sin(beat) * 0.35, 0.3 * OUT_L, 0, w)
    blend('ArmL2', -0.25 - bob * 0.3, 0, 0, w)
    blend('ArmR1', -2.7 - Math.sin(beat) * 0.35, 0.3 * OUT_R, 0, w)
    blend('ArmR2', -0.25 - (1 - bob) * 0.3, 0, 0, w)
    blend('LegL1', -0.35 * bob, 0.1 * OUT_L, 0, w)
    blend('LegL2', 0.7 * bob, 0, 0, w)
    blend('LegR1', -0.35 * bob, 0.1 * OUT_R, 0, w)
    blend('LegR2', 0.7 * bob, 0, 0, w)
    return Math.max(0, Math.sin(beat / 2)) ** 3 * 0.22 * w
  }
  const sob = Math.sin(t * 14) * 0.04
  const poundL = Math.max(0, Math.sin(t * 9))
  const poundR = Math.max(0, Math.sin(t * 9 + Math.PI))
  // Thighs straight down and shins flat behind: kneeling (the lift drops the body onto
  // the knees).
  blend('LegL1', 0.05, 0.12 * OUT_L, 0, w)
  blend('LegL2', 1.55, 0, 0, w)
  blend('LegR1', 0.05, 0.12 * OUT_R, 0, w)
  blend('LegR2', 1.55, 0, 0, w)
  blend('Spine1', -0.75 + sob, 0, 0, w)
  blend('Neck1', 0.55, sob * 3, 0, w)
  blend('ArmL1', -0.9 - poundL * 0.8, -0.15 * OUT_L, 0, w)
  blend('ArmL2', -0.3, 0, 0, w)
  blend('ArmR1', -0.9 - poundR * 0.8, -0.15 * OUT_R, 0, w)
  blend('ArmR2', -0.3, 0, 0, w)
  return 0
}

/**
 * @param {{ time?: number, speed?: number, maxSpeed?: number, grounded?: boolean,
 *   vy?: number, stride?: number, throwT?: number, catchT?: number }} motion
 *   `throwT` / `catchT` count down from THROW_TIME / CATCH_TIME; `swingT` from
 *   FULL_SWING_TIME. `address` (0-1) is how far into the golf stance over the ball.
 *   `emote` ('win' | 'lose') and `emoteT` (seconds) play a duel's ending. Writes
 *   `motion.hinge`, how far the wrists are cocked, for the avatar's club.
 */
export function computePose(motion) {
  const {
    time = 0,
    speed = 0,
    maxSpeed = 6,
    grounded = true,
    vy = 0,
    stride: phase = time * 5,
    throwT = 0,
    swingT = 0,
    address = 1,
    emote = null,
    emoteT = 0,
  } = motion
  for (const name of POSED_BONES) {
    const b = pose.bones[name]
    b.swing = 0
    b.sway = 0
    b.twist = 0
  }
  pose.lift = 0

  swingWrist.hinge = 0
  if (grounded) {
    const ratio = clamp01(speed / Math.max(maxSpeed, 0.001))
    const still = 1 - smooth(0.05, 0.4, ratio)
    // Over the ball (`address` 1) in the golf stance; otherwise standing easy.
    stance(still * address, time)
    relaxed(still * (1 - address), time)
    if (ratio > 0.02) stride(phase, ratio)
  } else {
    airborne(vy)
  }
  // Away from the ball the club is carried at the side.
  carry(1 - address)
  if (swingT > 0) golfSwing(1 - swingT / FULL_SWING_TIME, FULL_TIMING)
  else if (throwT > 0) golfSwing(1 - throwT / THROW_TIME, TRAIN_TIMING)
  const hop = emote ? emotePose(emote, emoteT) : 0
  // On the ground, the body sits exactly as low as the bent legs make it, so the lower
  // foot always rests on the floor - never sunk into it, never floating - whatever the
  // pose (a crouched address, a step, the right toe lifting at the finish, kneeling).
  if (grounded) pose.lift = -Math.min(legDrop('LegL1', 'LegL2'), legDrop('LegR1', 'LegR2'))
  pose.lift += hop
  // Every avatar poses in turn through this one function, so the wrists go with the motion.
  motion.hinge = swingWrist.hinge
  return pose
}

/**
 * Where the club sits in the hand, in the hand's frame (character space with the arm
 * hanging at rest; the avatar turns that frame with the arm): the shaft runs from the
 * grip down and slightly forward, so at the address the head rests on the ground ahead.
 */
export const CLUB_GRIP = new Vector3(0, -0.04, 0.02)
export const CLUB_TILT = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -0.22)
/** The axis (in the hand's frame) the wrists cock the club about. */
export const WRIST_AXIS = new Vector3(1, 0, 0)

/** The old frisbee grip helpers, kept for the remote avatars' (now empty) hand anchors. */
export const heldFlatness = () => 0
export const GRIP_UPRIGHT = new Vector3(0, 0, 0)
export const GRIP_FLAT = new Vector3(0, 0, 0)
export const FACE_UPRIGHT = new Quaternion()
export const FACE_FLAT = new Quaternion()
