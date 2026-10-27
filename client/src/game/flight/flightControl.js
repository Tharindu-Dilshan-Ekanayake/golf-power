
import { sfx } from '../../audio/sfx'
import { getGame } from '../../store/game'
import { fadeThrough } from '../fade'
import { burst } from '../fx/fxQueue'
import { FULL_RELEASE_DELAY as RELEASE_DELAY, FULL_SWING_TIME } from '../playerPose'
import { GOLF_HEADING, restoreCamera, swingState } from '../swing'
import { runtime } from '../runtime'

/** How long the landing is held - the result card, the camera circling the ball. */
const RESULT_HOLD_MS = 1700
/** If the renderer never lands the flight (it isn't loaded), land it anyway after this much slack. */
const LAND_FALLBACK_S = 4

/**
 * The flight currently being watched. The renderer (Flight.jsx) drives it: it advances
 * `clock` every frame by the frame time times `runtime.timeScale` (so slow motion slows
 * the whole shot), calls strikeFlight at the moment of impact and landFlight when the
 * ball comes to rest. `active` is false when nothing is flying.
 */
export const flight = {
  active: false,
  startedAt: 0,
  /** Seconds of the shot played so far, in slowed-down time. */
  clock: 0,
  distance: 0,
  duration: 1,
  trophies: [],
  wins: 0,
  green: null,
  /** Metres flown so far; written by the renderer, read by the counter. */
  meter: 0,
  struck: false,
  /** performance.now() of the impact and of the landing. */
  impactAt: 0,
  landed: false,
  landedAt: 0,
  /** Set when a skip jumps the shot to its end: the camera cuts rather than flies there. */
  cut: false,
  /** The player's best distance before this shot, for the course bar's marker. */
  bestBefore: 0,
}

let timers = []

function clearTimers() {
  for (const id of timers) clearTimeout(id)
  timers = []
}

/**
 * Starts replaying a throw the authority already resolved. Everything is known up
 * front (distance, Wins, trophy positions), so the client just plays it back: no
 * per-frame network traffic for flights.
 */
export function beginFlight(result) {
  clearTimers()
  const game = getGame()
  Object.assign(flight, {
    active: true,
    startedAt: performance.now(),
    clock: 0,
    distance: result.distance,
    duration: result.duration,
    trophies: result.trophies,
    wins: result.wins,
    green: result.green || null,
    meter: 0,
    struck: false,
    cut: false,
    impactAt: 0,
    landed: false,
    landedAt: 0,
    bestBefore: game.profile.stats?.bestDistance || 0,
  })
  runtime.player.swingTimer = FULL_SWING_TIME
  runtime.player.throwSeq += 1
  runtime.player.heading = GOLF_HEADING
  runtime.player.frozen = true
  // The camera stays on the golfer through the backswing and the slow-motion strike,
  // then whips away after the ball (see Flight.jsx).
  game.startFlight({ distance: result.distance, wins: result.wins, candy: result.candy || 0, duration: result.duration, green: result.green || null })
  // Only if the renderer never picked the shot up (its clock never moved): on a slow
  // device game time can run behind real time, and the renderer lands it itself.
  timers.push(
    setTimeout(() => {
      if (flight.clock < 0.01) landFlight()
    }, (RELEASE_DELAY + result.duration + LAND_FALLBACK_S) * 1000),
  )
}

/** The club meets the ball: the crack, a camera kick, and time slows right down. */
export function strikeFlight(now) {
  flight.struck = true
  flight.impactAt = now
  const perfect = swingState.grade === 'perfect'
  sfx.golfHit(perfect)
  runtime.fx.punch = perfect ? 1.4 : 1
}

/** The camera leaves the golfer and goes after the ball. */
export function followBall() {
  runtime.camera.mode = 'flight'
  restoreCamera()
}

/** The ball has come to rest: the result, and on a green its call-out or fireworks. */
export function landFlight() {
  if (!flight.active || flight.landed) return
  flight.landed = true
  flight.landedAt = performance.now()
  runtime.timeScale = 1
  const game = getGame()
  sfx.land()
  timers.push(setTimeout(sfx.wins, 250))
  const f = runtime.flightFocus
  if (f) burst({ x: f.x, y: f.y + 0.5, z: f.z - 3, count: 40, palette: 'gold', speed: 8 })
  const green = flight.green
  if (green && f) {
    if (green.ring === 0) {
      sfx.rebirth()
      for (let i = 0; i < 6; i += 1) {
        timers.push(
          setTimeout(() => {
            burst({ x: f.x + (Math.random() - 0.5) * 10, y: f.y + 6 + Math.random() * 6, z: f.z - 6 - Math.random() * 6, count: 40, palette: i % 2 ? 'confetti' : 'gold', speed: 11 })
            sfx.trophy()
          }, i * 260),
        )
      }
    } else {
      sfx.levelUp()
    }
  }
  game.endFlight()
  timers.push(setTimeout(finishFlight, RESULT_HOLD_MS))
}

let skipping = false

/**
 * Skips ahead (a tap or click while watching): mid-flight, through a quick fade straight
 * to the ball at rest; while the result shows, straight back to the golfer. Nothing
 * before the strike - the swing always plays.
 */
export function skipFlight() {
  if (!flight.active || !flight.struck || skipping) return
  if (flight.landed) {
    finishFlight()
    return
  }
  skipping = true
  fadeThrough(
    () => {
      skipping = false
      if (!flight.active || flight.landed) return
      runtime.timeScale = 1
      runtime.camera.mode = 'flight'
      flight.clock = RELEASE_DELAY + flight.duration
      flight.cut = true
    },
    { out: 160, hold: 60, back: 260 },
  )
}

/** Hands the camera back to the player, through a quick fade so there's no jump cut. */
export function finishFlight() {
  clearTimers()
  fadeThrough(() => {
    flight.active = false
    runtime.timeScale = 1
    runtime.flightFocus = null
    runtime.player.frozen = false
    runtime.camera.mode = 'follow'
    runtime.camera.snap = true
    getGame().clearThrowResult()
  })
}
