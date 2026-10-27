import { duelPadAt } from './world.js'

/** Milliseconds of countdown once both rings are taken, to take the swing, and of the result. */
export const DUEL_COUNTDOWN_MS = 3000
export const DUEL_SWING_MS = 12000
export const DUEL_RESULT_MS = 7000
/** The same two again, straight after: a longer count, so either can step off first. */
export const DUEL_REMATCH_MS = 6000
/** Leeway for stepping about on a ring during the countdown (network jitter). */
const PAD_SLACK = 0.6

/**
 * The 1v1 duel at the Hit Zone's east end, for one lobby. When one player stands on the
 * blue ring and another on the red, a countdown starts (stepping off calls it off);
 * then both swing, and whoever's ball goes further wins. Both still standing there
 * afterwards? A rematch.
 *
 * Transport-agnostic, like PlayerSession: the host feeds it everyone's positions every
 * tick and the duelists' hits, and broadcasts what it `send`s:
 * - { phase: 'ready', players: [{ sid, name }, { sid, name }], ms, rematch }  countdown (blue
 *   first); `rematch` when it's the same two as the duel just played
 * - { phase: 'swing', players, ms }  swing now, within `ms`
 * - { phase: 'hit', side, sid, distance, duration }  one duelist's shot, to fly
 * - { phase: 'result', players, distances, missed, winner, ms }  `winner` 0, 1 or -1 (a draw)
 * - { phase: 'cancel' }
 *
 * @param {{ send: (payload: object) => void,
 *           shoot: (sid: string, strike: number) => ({ distance: number, duration: number } | null),
 *           hold: (sid: string, until: number) => void,
 *           finish: (winnerSid: string, loserSid: string) => void }} host
 *   `shoot` works out a duelist's shot; `hold` keeps a duelist from training until a
 *   server time (0 lets go); `finish` rewards the winner.
 */
export class DuelArena {
  constructor({ send, shoot, hold, finish }) {
    this.send = send
    this.shoot = shoot
    this.hold = hold
    this.finish = finish
    this.reset()
  }

  reset() {
    /** 'idle' | 'ready' | 'swing' | 'result' */
    this.phase = 'idle'
    /** [blue, red] as `{ sid, name }`. */
    this.players = null
    this.shots = [null, null]
    /** Server time the current phase ends. */
    this.until = 0
  }

  /**
   * Advances the duel. `players` maps session id -> `{ x, z, name }` for everyone in
   * the lobby.
   */
  tick(now, players) {
    if (this.phase === 'idle') {
      const on = [null, null]
      for (const [sid, p] of players) {
        const pad = duelPadAt(p.x, p.z)
        if (pad >= 0 && !on[pad]) on[pad] = { sid, name: p.name }
      }
      // Whoever played last must both step off before a fresh pair counts as new.
      if (this.last && !this.last.every((sid) => players.has(sid) && duelPadAt(players.get(sid).x, players.get(sid).z) >= 0)) this.last = null
      if (on[0] && on[1]) {
        const rematch = Boolean(this.last) && on.every((d, i) => d.sid === this.last[i])
        this.players = on
        this.shots = [null, null]
        this.enter('ready', now, rematch ? DUEL_REMATCH_MS : DUEL_COUNTDOWN_MS, { rematch })
      }
      return
    }
    if (this.phase === 'ready') {
      const stayed = this.players.every((d, i) => {
        const p = players.get(d.sid)
        return p && duelPadAt(p.x, p.z, PAD_SLACK) === i
      })
      if (!stayed) this.cancel()
      else if (now >= this.until) {
        this.enter('swing', now, DUEL_SWING_MS)
        for (const d of this.players) this.hold(d.sid, now + DUEL_SWING_MS + DUEL_RESULT_MS)
      }
      return
    }
    if (this.phase === 'swing') {
      if (now >= this.until) this.resolve(now)
      return
    }
    if (this.phase === 'result' && now >= this.until) this.release()
  }

  /** A duelist's swing, `strike` where their meter stood (0-1). */
  hit(sid, strike, now) {
    if (this.phase !== 'swing') return
    const side = this.players.findIndex((d) => d.sid === sid)
    if (side < 0 || this.shots[side]) return
    if (typeof strike !== 'number' || !Number.isFinite(strike)) return
    const shot = this.shoot(sid, Math.min(1, Math.max(0, strike)))
    if (!shot) return
    this.shots[side] = shot
    this.send({ phase: 'hit', side, sid, distance: shot.distance, duration: shot.duration })
    if (this.shots[0] && this.shots[1]) this.resolve(now)
  }

  /** Someone left the lobby: a duel they were in is off. */
  leave(sid) {
    if (!this.players?.some((d) => d.sid === sid)) return
    if (this.phase === 'ready' || this.phase === 'swing') this.cancel()
  }

  enter(phase, now, ms, extra = {}) {
    this.phase = phase
    this.until = now + ms
    this.send({ phase, players: this.players, ms, ...extra })
  }

  /** Both have swung, or time's up: the longer shot wins (no swing at all counts as 0 m). */
  resolve(now) {
    const distances = this.shots.map((s) => (s ? s.distance : 0))
    const winner = distances[0] === distances[1] ? -1 : distances[0] > distances[1] ? 0 : 1
    this.phase = 'result'
    this.until = now + DUEL_RESULT_MS
    this.send({ phase: 'result', players: this.players, distances, missed: this.shots.map((s) => !s), winner, ms: DUEL_RESULT_MS })
    if (winner >= 0) this.finish(this.players[winner].sid, this.players[1 - winner].sid)
  }

  cancel() {
    this.send({ phase: 'cancel' })
    this.release()
    this.last = null
  }

  /** The duel's over: the duellists go free (and are remembered, for a rematch). */
  release() {
    for (const d of this.players || []) this.hold(d.sid, 0)
    this.last = this.phase === 'result' ? this.players.map((d) => d.sid) : null
    this.reset()
  }
}
