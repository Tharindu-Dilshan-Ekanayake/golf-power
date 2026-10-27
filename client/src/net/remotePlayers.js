import { Vector3 } from 'three'

import { sfx } from '../audio/sfx'
import { FULL_DOWN_FROM, FULL_RELEASE_AT, FULL_RELEASE_DELAY, FULL_SWING_TIME } from '../game/playerPose'
import { runtime } from '../game/runtime'

/**
 * Other players, as the network last described them. Network callbacks write here;
 * the renderer reads it each frame and interpolates between snapshots, drawing
 * everyone ~110 ms in the past so 10 Hz updates still move smoothly.
 */

/** sessionId -> remote player */
export const remotePlayers = new Map()

const MAX_SNAPSHOTS = 24

export function upsertRemotePlayer(sessionId, state) {
  let r = remotePlayers.get(sessionId)
  if (!r) {
    r = {
      sessionId,
      name: '',
      snaps: [],
      position: new Vector3(state.x, state.y, state.z),
      yaw: state.rotY,
      speed: 0,
      anim: 'idle',
      planeId: 'paper',
      /** The look of their ball: their pumpkin skin, else their club's. */
      ballId: 'paper',
      /** Their avatar's outfit, parsed from `look`; `lookKey` is the raw string. */
      look: null,
      lookKey: '',
      /** Throw count as last seen; the renderer plays a throw for each new one. */
      throws: state.throws,
      seenThrows: state.throws,
      throwT: 0,
      catchT: 0,
      frisbeeAway: false,
      petIds: [],
      /** Follow state per equipped pet, grown as needed and reused. */
      pets: [],
      walkPhase: 0,
      /** Seconds left on a full swing off the Hit Zone or a duel ring (see startRemoteSwing). */
      swingT: 0,
      swingAt: -1e9,
      /** Until when their tee ball is gone (struck, and flying). */
      ballAwayUntil: 0,
      /** 0-1 into the golf stance (eased by the renderer, as for you). */
      address: 1,
      /** In a duel right now (their swing is the duel's, not a training toss). */
      dueling: false,
      /** A duel's ending, danced or wept: 'win' | 'lose' | null, from `emoteAt` (ms). */
      emote: null,
      emoteAt: 0,
    }
    r.shadow = { position: r.position, size: 1.1, visible: true }
    runtime.shadowCasters.add(r.shadow)
    remotePlayers.set(sessionId, r)
  }
  r.name = state.name
  r.anim = state.anim
  r.planeId = state.planeId
  r.ballId = state.ballId || state.planeId
  r.throws = state.throws
  if (state.look !== r.lookKey) {
    r.lookKey = state.look
    try {
      r.look = state.look ? JSON.parse(state.look) : null
    } catch {
      r.look = null
    }
  }
  r.petIds = [...state.petIds]
  while (r.pets.length < r.petIds.length) {
    r.pets.push({ id: '', position: r.position.clone(), yaw: 0, hop: 0 })
  }
  const last = r.snaps[r.snaps.length - 1]
  if (!last || last.x !== state.x || last.y !== state.y || last.z !== state.z || last.r !== state.rotY) {
    r.snaps.push({ t: performance.now(), x: state.x, y: state.y, z: state.z, r: state.rotY })
    if (r.snaps.length > MAX_SNAPSHOTS) r.snaps.shift()
  }
}

/**
 * Another player's full swing, started the moment the server tells us their shot is
 * away (so it plays in step with their screen): the whole swing from the address, their
 * tee ball waiting on the ground until the club meets it, then gone for `awayMs` while
 * it flies. Plays the whoosh of the downswing and the strike if they're near.
 *
 * @returns {object|null} the remote player, if we know them
 */
export function startRemoteSwing(sessionId, awayMs = 2500) {
  const r = remotePlayers.get(sessionId)
  if (!r) return null
  const now = performance.now()
  r.swingT = FULL_SWING_TIME
  r.swingAt = now
  r.ballAwayUntil = now + FULL_RELEASE_DELAY * 1000 + awayMs
  if (runtime.camera.mode === 'follow' && r.position.distanceTo(runtime.player.position) < 45) {
    const swing = FULL_SWING_TIME * 1000
    setTimeout(() => sfx.clubWhoosh(FULL_SWING_TIME * (FULL_RELEASE_AT - FULL_DOWN_FROM)), swing * FULL_DOWN_FROM)
    setTimeout(() => sfx.golfHit(false), FULL_RELEASE_DELAY * 1000)
  }
  return r
}

export function removeRemotePlayer(sessionId) {
  const r = remotePlayers.get(sessionId)
  if (!r) return
  runtime.shadowCasters.delete(r.shadow)
  remotePlayers.delete(sessionId)
}

export function clearRemotePlayers() {
  for (const id of [...remotePlayers.keys()]) removeRemotePlayer(id)
  runtime.remotePets.length = 0
  runtime.ghostThrows.length = 0
}
