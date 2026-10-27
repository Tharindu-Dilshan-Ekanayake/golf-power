import { CLICK_INTERVAL } from '@shared/balance'

import { actions } from '../net/actions'
import { getGame } from '../store/game'
import { runtime } from './runtime'
import { startSwing } from './swing'

let lastClickAt = -Infinity

/**
 * Takes a shot, if you can right now: a click shot (a x1 training hit, at most one per
 * CLICK_INTERVAL - the authority enforces it too) anywhere outside the Hit Zone. In
 * the Hit Zone it's the real hit, but only when `stage` is set - tapping the world
 * there does nothing, the HIT! button and the touch button do - and that starts the
 * swing meter. Returns whether a shot was sent or the meter started.
 *
 * @param {{ stage?: boolean }} [options]
 */
export function throwFromHand({ stage = false } = {}) {
  const game = getGame()
  if (game.panel || game.flight || game.throwResult || game.swing || runtime.camera.mode !== 'follow') return false
  // In a duel, the meter is the only swing.
  if (game.duel && game.duel.side >= 0) return false
  if (game.zone.throwArea) {
    if (!stage) return false
    return startSwing()
  }
  const now = performance.now()
  if (now - lastClickAt < CLICK_INTERVAL * 1000) return false
  lastClickAt = now
  actions.click()
  return true
}
