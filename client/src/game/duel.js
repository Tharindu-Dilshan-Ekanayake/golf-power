import { ballStyleId, swingGrade } from '@shared/logic'
import { DUEL_PADS } from '@shared/world'

import { sfx } from '../audio/sfx'
import { actions } from '../net/actions'
import { remotePlayers, startRemoteSwing } from '../net/remotePlayers'
import { getGame, useGame } from '../store/game'
import { burst } from './fx/fxQueue'
import { showWorldLabel } from './labels/registry'
import { spawnPopup } from './fx/popups'
import { FULL_RELEASE_DELAY, FULL_SWING_TIME } from './playerPose'
import { runtime } from './runtime'
import { GOLF_HEADING, restoreCamera, swingState } from './swing'

/**
 * The client's side of the 1v1 duel (the rules are shared/duel.js, run by the server):
 * turns the server's duel messages into the show. Both duelists are framed side by side
 * and swing with the meter; both balls fly down the course; a beat later the verdict -
 * the winner dances with their club held high to a fanfare, the loser drops to their
 * knees pounding the ground to a sad trombone, and everyone in the lobby sees it.
 */

/** After the result arrives, a beat for the balls to fly before the verdict. */
export const DUEL_REVEAL_MS = 1800
/** Watching from this close (to the rings) counts as watching: you see the scoreboard and hear it. */
const WATCH_RADIUS = 40
/** Duel balls fly at most this long, so the verdict isn't kept waiting. */
const MAX_FLIGHT_S = 6
const MID_X = (DUEL_PADS[0].x + DUEL_PADS[1].x) / 2
const MID_Z = (DUEL_PADS[0].z + DUEL_PADS[1].z) / 2

/** The rings' own signs, out of the way while a duel has the scoreboard. */
const DUEL_LABELS = ['duel', 'duel-blue', 'duel-red']

const GOLD = 'linear-gradient(180deg, #fffaa8 0%, #ffd52a 45%, #ff9c00 100%)'
const GLOOM = 'linear-gradient(180deg, #e8ecf4 0%, #9aa6bc 55%, #5a6478 100%)'

let timers = []
const later = (ms, fn) => timers.push(setTimeout(fn, ms))
function clearTimers() {
  for (const id of timers) clearTimeout(id)
  timers = []
}

/** When our swing started, so our ball leaves as the club meets it. */
let swingStartedAt = 0

/** Whether you're close enough to the rings to be watching. */
export function watchingDuel() {
  const p = runtime.player.position
  return Math.hypot(p.x - MID_X, p.z - MID_Z) < WATCH_RADIUS
}

function setDuelists(players, on) {
  for (const d of players) {
    const r = remotePlayers.get(d.sid)
    if (r) r.dueling = on
  }
}

/** Where a duelist stands: you, or another player as last drawn. */
function positionOf(sid) {
  if (sid === getGame().net.sessionId) return runtime.player.position
  return remotePlayers.get(sid)?.position || null
}

function setEmote(sid, kind) {
  const now = performance.now()
  if (sid === getGame().net.sessionId) {
    const p = runtime.player
    p.emote = kind
    p.emoteAt = now
    // Turned to face the camera (and the lobby) for it.
    p.heading = 0
    return
  }
  const r = remotePlayers.get(sid)
  if (r) {
    r.emote = kind
    r.emoteAt = now
  }
}

/** Steps us onto our ring, side-on to the course, frozen, with both of us in the picture and the meter up. */
function squareUp(side) {
  const p = runtime.player
  const pad = DUEL_PADS[side]
  getGame().closePanel()
  p.position.set(pad.x, p.position.y, pad.z)
  p.heading = GOLF_HEADING
  p.frozen = true
  p.dueling = true
  p.duelShot = false
  p.emote = null
  const cam = runtime.camera
  if (swingState.cameraDistance == null) swingState.cameraDistance = cam.distance
  cam.yaw = 0
  cam.pitch = 0.2
  cam.distance = 8.5
  cam.lookOffset.set(MID_X - pad.x, -0.3, -1.2)
  cam.ease = 3.2
  useGame.setState({ swing: true })
}

/** A duelist's shot, flying down the course from their ring. */
function launchBall(msg, mine) {
  const pad = DUEL_PADS[msg.side]
  // Ours leaves as our club meets it; theirs as their swing (which starts now) does.
  const delay = mine ? Math.max(0, swingStartedAt + FULL_RELEASE_DELAY * 1000 - performance.now()) : FULL_RELEASE_DELAY * 1000
  if (!mine) startRemoteSwing(msg.sid, 20000)
  const planeId = mine ? ballStyleId(getGame().profile) : remotePlayers.get(msg.sid)?.ballId || 'paper'
  runtime.ghostThrows.push({
    sid: msg.sid,
    distance: msg.distance,
    duration: Math.min(msg.duration, MAX_FLIGHT_S),
    planeId,
    x: pad.x,
    z: pad.z,
    y0: 0.25,
    scale: 1,
    startedAt: performance.now() + delay,
  })
}

/** The verdict: popups over both heads, the winner's confetti, the dance and the weeping. */
function reveal(msg, side) {
  const game = getGame()
  if (game.duel?.phase !== 'result') return
  game.setDuel({ ...game.duel, revealed: true, revealedAt: Date.now() })
  msg.players.forEach((d, i) => {
    const kind = msg.winner < 0 ? null : i === msg.winner ? 'win' : 'lose'
    const at = positionOf(d.sid)
    if (kind) setEmote(d.sid, kind)
    if (!at) return
    const text = msg.winner < 0 ? 'DRAW!' : kind === 'win' ? 'WINNER!' : msg.missed[i] ? 'TOO SLOW!' : 'LOSER...'
    spawnPopup(text, { x: at.x, y: at.y + 2.6, z: at.z }, { gradient: kind === 'lose' ? GLOOM : GOLD, scale: 1.6, life: 2800 })
    if (kind === 'win') burst({ x: at.x, y: at.y + 2.2, z: at.z, count: 60, speed: 8 })
  })
  if (side >= 0 && msg.winner >= 0 && side !== msg.winner) sfx.sadTrombone()
  else if (side >= 0 || watchingDuel()) sfx.fanfare()
}

/** Puts everything back: unfrozen, the camera returned, nobody dancing. */
export function endDuel() {
  clearTimers()
  const game = getGame()
  const p = runtime.player
  if (p.dueling) {
    p.dueling = false
    p.duelShot = false
    p.frozen = false
    restoreCamera()
    if (game.swing) useGame.setState({ swing: false })
  }
  p.emote = null
  for (const r of remotePlayers.values()) {
    r.dueling = false
    r.emote = null
  }
  for (const id of DUEL_LABELS) showWorldLabel(id, true)
  if (game.duel) game.setDuel(null)
}

/** One duel message from the server (see shared/duel.js for what each carries). */
export function onDuelEvent(msg) {
  const game = getGame()
  const me = game.net.sessionId
  const side = msg.players ? msg.players.findIndex((d) => d.sid === me) : -1
  switch (msg.phase) {
    case 'ready': {
      // A rematch can arrive before the last result's clean-up timer; tidy up first.
      endDuel()
      getGame().setDuel({ phase: 'ready', players: msg.players, side, endsAt: Date.now() + msg.ms, rematch: Boolean(msg.rematch), distances: [null, null], winner: null, revealed: false })
      for (const id of DUEL_LABELS) showWorldLabel(id, false)
      // A beep on each of the last three seconds.
      if (side >= 0 || watchingDuel()) for (let i = 3; i >= 1; i -= 1) later(Math.max(0, msg.ms - i * 1000), () => sfx.duelBeep(false))
      break
    }
    case 'swing': {
      game.setDuel({ ...game.duel, phase: 'swing', players: msg.players, side, endsAt: Date.now() + msg.ms, distances: [null, null], winner: null, revealed: false })
      setDuelists(msg.players, true)
      if (side >= 0 || watchingDuel()) sfx.duelBeep(true)
      if (side >= 0) squareUp(side)
      break
    }
    case 'hit': {
      if (!game.duel) return
      const distances = [...game.duel.distances]
      distances[msg.side] = msg.distance
      game.setDuel({ ...game.duel, distances })
      launchBall(msg, msg.sid === me)
      break
    }
    case 'result': {
      // Time ran out before we swung: the meter goes.
      if (side >= 0 && game.swing) useGame.setState({ swing: false })
      game.setDuel({
        ...game.duel,
        phase: 'result',
        players: msg.players,
        side,
        distances: msg.distances,
        missed: msg.missed,
        winner: msg.winner,
        revealed: false,
        endsAt: Date.now() + msg.ms,
      })
      later(DUEL_REVEAL_MS, () => reveal(msg, side))
      later(msg.ms, endDuel)
      break
    }
    case 'cancel':
      endDuel()
      break
    default:
      break
  }
}

/** Our swing in a duel, from the meter: `strike` is where it stood. Returns whether it went. */
export function duelSwing(strike) {
  const game = getGame()
  if (!game.swing || game.duel?.phase !== 'swing' || game.duel.side < 0) return false
  useGame.setState({ swing: false })
  const p = runtime.player
  p.swingTimer = FULL_SWING_TIME
  p.throwSeq += 1
  swingStartedAt = performance.now()
  later(FULL_RELEASE_DELAY * 1000, () => {
    p.duelShot = true
    sfx.golfHit(swingGrade(strike) === 'perfect')
  })
  actions.duelHit(strike)
  return true
}
