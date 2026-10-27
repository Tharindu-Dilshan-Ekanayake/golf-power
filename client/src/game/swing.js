import { HIT_COOLDOWN } from '@shared/balance'

import { sfx } from '../audio/sfx'
import { actions } from '../net/actions'
import { getGame, useGame } from '../store/game'
import { runtime } from './runtime'

/**
 * The swing meter's state machine. Standing in the Hit Zone, HIT! (or E) starts it: the
 * player squares up to the ball and a meter sweeps up and down; a tap hits (the real
 * hit is the same `throw` intent as ever, sent now) and CANCEL backs out.
 *
 * The meter only times the swing for show (see SwingMeter): the distance and Wins of a
 * hit are decided by the authority, exactly as before.
 */

/** Where a shot off the Hit Zone is aimed: down the course, which is north. */
export const GOLF_HEADING = Math.PI

/** When the last hit was sent, for the cooldown. */
let lastHitAt = -Infinity

/** What the last swing earned, and the camera to hand back afterwards. */
export const swingState = { grade: 'good', cameraDistance: null }

/** True if a swing can be started right now. */
export function canStartSwing() {
  const g = getGame()
  return !g.swing && !g.panel && !g.flight && !g.throwResult && g.zone.throwArea && runtime.camera.mode === 'follow'
}

/** Squares up to the ball and shows the meter. Returns whether it started. */
export function startSwing() {
  if (!canStartSwing()) return false
  runtime.player.frozen = true
  // Aim down the course; the golfer squares up side-on to it, facing east with the course
  // (north) off the left shoulder.
  runtime.player.heading = GOLF_HEADING
  // Frame the shot as in the reference: over the shoulder, low, looking down the course,
  // the player on the left of the picture and the ball in the middle.
  const cam = runtime.camera
  swingState.cameraDistance = cam.distance
  cam.yaw = 0
  cam.pitch = 0.2
  cam.distance = 6.6
  cam.lookOffset.set(2.3, -0.45, -1.2)
  // A slow, smooth dolly in rather than a snap.
  cam.ease = 3.2
  sfx.swingStart()
  useGame.setState({ swing: true })
  return true
}

/** Backs out without hitting. */
export function cancelSwing() {
  if (!getGame().swing) return
  runtime.player.frozen = false
  restoreCamera()
  useGame.setState({ swing: false })
}

/** Puts the camera back to how far out the player had it. */
export function restoreCamera() {
  if (swingState.cameraDistance != null) runtime.camera.distance = swingState.cameraDistance
  swingState.cameraDistance = null
  runtime.camera.lookOffset.set(0, 0, 0)
  runtime.camera.ease = null
}

/** Takes the swing. (Movement unfreezes now; a hit that goes through freezes it again.) */
export function hitSwing(strike) {
  if (!getGame().swing) return false
  runtime.player.frozen = false
  useGame.setState({ swing: false })
  // Never inside the authority's cooldown (it would ignore the hit): after a quick skip,
  // hold the swing back the last moment until it's allowed.
  const wait = lastHitAt + HIT_COOLDOWN * 1000 + 120 - performance.now()
  const send = () => {
    lastHitAt = performance.now()
    actions.throwPlane(strike)
  }
  if (wait > 0) setTimeout(send, wait)
  else send()
  return true
}
