import { createMusic } from './music'

/**
 * Sound effects and the background music, synthesised with WebAudio: no audio files
 * to download.
 *
 * Browsers only allow audio after a user gesture, so the AudioContext is created on
 * the first tap/click/key (which also starts the music) and every sound before that is
 * silently skipped.
 */

const MUTE_KEY = 'pp.muted'

let ctx = null
let master = null
let noiseBuffer = null
let music = null
let muted = readMuted()
const lastPlayed = new Map()
const muteListeners = new Set()

function readMuted() {
  try {
    return localStorage.getItem(MUTE_KEY) === '1'
  } catch {
    return false
  }
}

function unlock() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume()
    return
  }
  const Ctor = window.AudioContext || window.webkitAudioContext
  if (!Ctor) return
  ctx = new Ctor()
  master = ctx.createGain()
  master.gain.value = muted ? 0 : 0.5
  master.connect(ctx.destination)
  // One second of white noise, reused by every whoosh and crack.
  noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
  const data = noiseBuffer.getChannelData(0)
  for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1
  music = createMusic(ctx, master, noiseBuffer)
  music.start()
}

/** Installs the first-gesture unlock. Call once at startup. */
export function installAudioUnlock() {
  const events = ['pointerdown', 'keydown', 'touchend']
  const handler = () => {
    unlock()
    for (const e of events) window.removeEventListener(e, handler, true)
  }
  for (const e of events) window.addEventListener(e, handler, true)
  // Mobile browsers suspend audio in the background; resume on return.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && ctx?.state === 'suspended') ctx.resume()
  })
}

export function isMuted() {
  return muted
}

export function setMuted(value) {
  muted = value
  try {
    localStorage.setItem(MUTE_KEY, value ? '1' : '0')
  } catch {
    // Not persisted; fine.
  }
  if (master) master.gain.value = muted ? 0 : 0.5
  for (const listener of muteListeners) listener(muted)
}

/** Calls `listener(muted)` on every change; returns the unsubscribe. */
export function onMutedChange(listener) {
  muteListeners.add(listener)
  return () => muteListeners.delete(listener)
}

// --- Wind: the ball cutting through the air while it flies ---------------------------

let wind = null
let windSetAt = 0

/**
 * The ball tearing through the air: a broad rush of filtered noise, a narrow whistle
 * over it that climbs with the speed, and a flutter through both from the spinning
 * pumpkin chopping the air. `windSet(level)` (0..1, from the ball's speed) opens it up
 * and brightens it; the music ducks under it until `windStop`.
 */
function windStart() {
  if (!ctx || wind || ctx.state !== 'running') return
  const t = ctx.currentTime
  const src = ctx.createBufferSource()
  src.buffer = noiseBuffer
  src.loop = true
  const rush = ctx.createBiquadFilter()
  rush.type = 'bandpass'
  rush.Q.value = 0.7
  rush.frequency.value = 400
  const rushGain = ctx.createGain()
  rushGain.gain.value = 0.0001
  const whistle = ctx.createBiquadFilter()
  whistle.type = 'bandpass'
  whistle.Q.value = 7
  whistle.frequency.value = 900
  const whistleGain = ctx.createGain()
  whistleGain.gain.value = 0.0001
  // The flutter: the whole sound pulsing a little, faster as the ball speeds up.
  const flutter = ctx.createGain()
  flutter.gain.value = 1
  const lfo = ctx.createOscillator()
  lfo.frequency.value = 6
  const depth = ctx.createGain()
  depth.gain.value = 0.22
  lfo.connect(depth).connect(flutter.gain)
  src.connect(rush).connect(rushGain).connect(flutter)
  src.connect(whistle).connect(whistleGain).connect(flutter)
  flutter.connect(master)
  src.start(t)
  lfo.start(t)
  wind = { src, lfo, rush, rushGain, whistle, whistleGain }
  music?.duck(true)
}

function windSet(level) {
  if (!wind) return
  // Ten updates a second is plenty for a smooth swell.
  const now = performance.now()
  if (now - windSetAt < 100) return
  windSetAt = now
  const t = ctx.currentTime
  const l = Math.min(1, Math.max(0, level))
  wind.rushGain.gain.setTargetAtTime(0.03 + l * 0.18, t, 0.2)
  wind.rush.frequency.setTargetAtTime(320 + l * 2200, t, 0.25)
  wind.whistleGain.gain.setTargetAtTime(0.004 + l * 0.07, t, 0.2)
  wind.whistle.frequency.setTargetAtTime(700 + l * 2000, t, 0.25)
  wind.lfo.frequency.setTargetAtTime(5 + l * 9, t, 0.3)
}

function windStop() {
  if (!wind) return
  const { src, lfo, rushGain, whistleGain } = wind
  wind = null
  const t = ctx.currentTime
  rushGain.gain.setTargetAtTime(0.0001, t, 0.3)
  whistleGain.gain.setTargetAtTime(0.0001, t, 0.2)
  src.stop(t + 1.5)
  lfo.stop(t + 1.5)
  music?.duck(false)
}

function ready(name, minGapMs = 0) {
  if (!ctx || muted || ctx.state !== 'running') return false
  const now = performance.now()
  if (minGapMs && now - (lastPlayed.get(name) || 0) < minGapMs) return false
  lastPlayed.set(name, now)
  return true
}

/** A short enveloped oscillator note. */
function tone(freq, { type = 'sine', at = 0, duration = 0.12, volume = 0.3, slideTo = null } = {}) {
  const t = ctx.currentTime + at
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t)
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + duration)
  gain.gain.setValueAtTime(0.0001, t)
  gain.gain.exponentialRampToValueAtTime(volume, t + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration)
  osc.connect(gain).connect(master)
  osc.start(t)
  osc.stop(t + duration + 0.02)
}

/** Filtered noise: whooshes and cracks. */
function noise({ at = 0, duration = 0.3, volume = 0.25, from = 400, to = 2400, q = 1.2 } = {}) {
  const t = ctx.currentTime + at
  const src = ctx.createBufferSource()
  src.buffer = noiseBuffer
  const filter = ctx.createBiquadFilter()
  filter.type = 'bandpass'
  filter.Q.value = q
  filter.frequency.setValueAtTime(from, t)
  filter.frequency.exponentialRampToValueAtTime(to, t + duration)
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0.0001, t)
  gain.gain.exponentialRampToValueAtTime(volume, t + duration * 0.3)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration)
  src.connect(filter).connect(gain).connect(master)
  src.start(t, Math.random() * 0.5)
  src.stop(t + duration + 0.02)
}

/**
 * Something moving fast past the ear: filtered noise swelling (slowly, then quickly) to
 * `volume` at `peak` seconds and dying away over `tail`, its pitch climbing from `from`
 * to `top` at the peak and falling to `to` after it.
 */
function whoosh({ at = 0, peak = 0.15, tail = 0.2, volume = 0.2, from = 300, top = 2200, to = 600, q = 1.4 } = {}) {
  const t = ctx.currentTime + at
  const length = peak + tail
  const src = ctx.createBufferSource()
  src.buffer = noiseBuffer
  const filter = ctx.createBiquadFilter()
  filter.type = 'bandpass'
  filter.Q.value = q
  filter.frequency.setValueAtTime(from, t)
  filter.frequency.exponentialRampToValueAtTime(top, t + peak)
  filter.frequency.exponentialRampToValueAtTime(to, t + length)
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0.0001, t)
  gain.gain.exponentialRampToValueAtTime(volume * 0.2, t + peak * 0.6)
  gain.gain.exponentialRampToValueAtTime(volume, t + peak)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + length)
  src.connect(filter).connect(gain).connect(master)
  src.start(t, Math.random() * Math.max(0, 0.95 - length))
  src.stop(t + length + 0.02)
}

export const sfx = {
  click() {
    if (ready('click', 40)) tone(660, { type: 'triangle', duration: 0.05, volume: 0.15 })
  },
  power() {
    if (ready('power', 110)) tone(880 + Math.random() * 120, { type: 'triangle', duration: 0.07, volume: 0.07, slideTo: 1400 })
  },
  levelUp() {
    if (!ready('levelUp')) return
    ;[523, 659, 784, 1047].forEach((f, i) => tone(f, { type: 'square', at: i * 0.07, duration: 0.14, volume: 0.09 }))
  },
  /**
   * The downswing: the club whooshing down through the air, faster and higher until it
   * meets the ball `peak` seconds from now, then gone. `size` (0-1) for a shorter swing.
   */
  clubWhoosh(peak = 0.15, size = 1) {
    if (!ready('clubWhoosh', 150)) return
    // The shaft's deep "vwoom" and the head's airy hiss over it.
    whoosh({ peak, tail: 0.22, volume: 0.24 * size, from: 260, top: 1500 + 900 * size, to: 500, q: 1.6 })
    whoosh({ peak, tail: 0.14, volume: 0.09 * size, from: 1200, top: 5200, to: 2200, q: 0.8 })
  },
  /** The squaring-up at the tee: a soft grass shuffle. */
  swingStart() {
    if (ready('swingStart', 200)) noise({ duration: 0.12, volume: 0.07, from: 700, to: 300, q: 0.7 })
  },
  /**
   * The full strike off the Hit Zone: a sharp crack, the hollow titanium "ping" of a
   * driver (two partials a little out of tune with each other, as metal rings), a deep
   * body thump, and the ball whizzing away, falling in pitch as it goes. A perfect
   * strike rings brighter and adds a rising sparkle.
   */
  golfHit(perfect = false) {
    if (!ready('golfHit', 250)) return
    noise({ duration: 0.05, volume: 0.55, from: 6000, to: 2400, q: 0.6 })
    tone(perfect ? 2480 : 2350, { type: 'sine', duration: 0.2, volume: 0.11, slideTo: 2240 })
    tone(perfect ? 3900 : 3720, { type: 'sine', duration: 0.12, volume: 0.05 })
    tone(150, { type: 'sine', duration: 0.22, volume: 0.32, slideTo: 55 })
    tone(perfect ? 1320 : 880, { type: 'triangle', at: 0.01, duration: 0.3, volume: 0.08, slideTo: perfect ? 1760 : 700 })
    whoosh({ at: 0.02, peak: 0.06, tail: 0.75, volume: 0.17, from: 3000, top: 3600, to: 650, q: 2.4 })
    if (perfect) [1047, 1319, 1568, 2093].forEach((f, i) => tone(f, { type: 'sine', at: 0.12 + i * 0.05, duration: 0.2, volume: 0.07 }))
  },
  /** A training shot's strike: a crisp "tok" and a short ping, lighter than a full hit. */
  clubHit() {
    if (!ready('clubHit', 70)) return
    noise({ duration: 0.035, volume: 0.32, from: 5200, to: 2600, q: 0.7 })
    tone(2300 + Math.random() * 160, { type: 'sine', duration: 0.1, volume: 0.07, slideTo: 2180 })
    tone(180, { type: 'sine', duration: 0.1, volume: 0.14, slideTo: 80 })
  },
  /** A training shot's ball whizzing off: a quick "fwiii", falling as it leaves. */
  ballWhiz() {
    if (ready('ballWhiz', 70)) whoosh({ peak: 0.04, tail: 0.38, volume: 0.12, from: 2600, top: 3200, to: 800, q: 3 })
  },
  trophy() {
    if (!ready('trophy', 90)) return
    tone(1319, { type: 'triangle', duration: 0.08, volume: 0.1 })
    tone(1760, { type: 'triangle', at: 0.06, duration: 0.1, volume: 0.1 })
  },
  wins() {
    if (!ready('wins')) return
    ;[988, 1319, 1568, 1976].forEach((f, i) => tone(f, { type: 'triangle', at: i * 0.06, duration: 0.18, volume: 0.13 }))
  },
  crack() {
    if (!ready('crack', 150)) return
    noise({ duration: 0.12, volume: 0.35, from: 1800, to: 600, q: 0.8 })
    tone(220, { type: 'square', duration: 0.08, volume: 0.08, slideTo: 90 })
  },
  reveal() {
    if (!ready('reveal')) return
    ;[392, 523, 659, 784, 1047].forEach((f, i) => tone(f, { type: 'triangle', at: i * 0.06, duration: 0.22, volume: 0.12 }))
  },
  buy() {
    if (!ready('buy')) return
    tone(1047, { type: 'square', duration: 0.07, volume: 0.08 })
    tone(1568, { type: 'square', at: 0.08, duration: 0.16, volume: 0.08 })
  },
  error() {
    if (ready('error', 200)) tone(160, { type: 'sawtooth', duration: 0.18, volume: 0.07, slideTo: 110 })
  },
  rebirth() {
    if (!ready('rebirth')) return
    noise({ duration: 0.8, volume: 0.15, from: 200, to: 4000, q: 0.6 })
    ;[262, 330, 392, 523, 659, 784].forEach((f, i) => tone(f, { type: 'sawtooth', at: 0.1 + i * 0.07, duration: 0.25, volume: 0.06 }))
  },
  /** A training throw hitting its target: a thwack, then a bright rising ding. */
  targetHit() {
    if (!ready('targetHit', 100)) return
    noise({ duration: 0.09, volume: 0.22, from: 2400, to: 700, q: 0.9 })
    tone(330, { type: 'square', duration: 0.06, volume: 0.05, slideTo: 160 })
    tone(988 + Math.random() * 80, { type: 'triangle', at: 0.05, duration: 0.12, volume: 0.08, slideTo: 1568 })
  },
  /** A duel's countdown: a beep each second, and a bright double one for "swing!". */
  duelBeep(go = false) {
    if (!ready('duelBeep', 300)) return
    if (go) {
      tone(1320, { type: 'square', duration: 0.16, volume: 0.09 })
      tone(1760, { type: 'square', at: 0.08, duration: 0.3, volume: 0.09 })
    } else {
      tone(880, { type: 'square', duration: 0.12, volume: 0.08 })
    }
  },
  /** Winning a duel (or watching someone win): a quick brass arpeggio up to a held chord. */
  fanfare() {
    if (!ready('fanfare', 1000)) return
    ;[523, 659, 784].forEach((f, i) => tone(f, { type: 'square', at: i * 0.1, duration: 0.12, volume: 0.07 }))
    ;[1047, 1319, 1568].forEach((f) => tone(f, { type: 'triangle', at: 0.32, duration: 0.7, volume: 0.09 }))
    tone(523, { type: 'square', at: 0.32, duration: 0.7, volume: 0.05 })
  },
  /**
   * Losing a duel: the sad trombone - "wah, wah, wah, waaaah" - four falling notes
   * through a mute that opens and closes on each, the last one long and wobbling.
   */
  sadTrombone() {
    if (!ready('sadTrombone', 1000)) return
    const notes = [
      [294, 0, 0.4],
      [277, 0.45, 0.4],
      [262, 0.9, 0.4],
      [247, 1.35, 1.3],
    ]
    notes.forEach(([freq, at, length], i) => {
      const t = ctx.currentTime + at
      const osc = ctx.createOscillator()
      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(freq, t)
      osc.frequency.linearRampToValueAtTime(freq * 0.97, t + length)
      // The mute: a resonant low-pass opening up and closing again, "wah".
      const mute = ctx.createBiquadFilter()
      mute.type = 'lowpass'
      mute.Q.value = 6
      mute.frequency.setValueAtTime(300, t)
      mute.frequency.linearRampToValueAtTime(1400, t + length * 0.3)
      mute.frequency.linearRampToValueAtTime(500, t + length)
      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0.0001, t)
      gain.gain.exponentialRampToValueAtTime(0.15, t + 0.05)
      gain.gain.setValueAtTime(0.15, t + length * 0.7)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + length)
      osc.connect(mute).connect(gain).connect(master)
      osc.start(t)
      osc.stop(t + length + 0.05)
      if (i === notes.length - 1) {
        // The last note's sorry wobble.
        const lfo = ctx.createOscillator()
        lfo.frequency.value = 6
        const depth = ctx.createGain()
        depth.gain.value = 7
        lfo.connect(depth).connect(osc.frequency)
        lfo.start(t + 0.25)
        lfo.stop(t + length)
      }
    })
  },
  /** Stepping onto an unlocked training lane: a soft rising chime. */
  laneEnter() {
    if (!ready('laneEnter', 400)) return
    ;[523, 784, 1047].forEach((f, i) => tone(f, { type: 'sine', at: i * 0.05, duration: 0.28, volume: 0.07 }))
  },
  /** A footstep on the cobbles: a soft, slightly varied tap. */
  step() {
    if (!ready('step', 180)) return
    noise({ duration: 0.06, volume: 0.05, from: 900 + Math.random() * 400, to: 300, q: 0.9 })
  },
  /** A jump: a springy little boing. */
  jump() {
    if (ready('jump', 120)) tone(260, { type: 'triangle', duration: 0.18, volume: 0.1, slideTo: 620 })
  },
  /** Landing from a jump: a soft thump. */
  jumpLand() {
    if (!ready('jumpLand', 150)) return
    tone(140, { type: 'sine', duration: 0.12, volume: 0.12, slideTo: 70 })
    noise({ duration: 0.08, volume: 0.06, from: 900, to: 300, q: 0.7 })
  },
  /** The thrown frisbee coming down at the end of its flight: thud and skid. */
  land() {
    if (!ready('land')) return
    tone(120, { type: 'sine', duration: 0.25, volume: 0.18, slideTo: 55 })
    noise({ duration: 0.5, volume: 0.14, at: 0.04, from: 1400, to: 250, q: 0.6 })
  },
  windStart,
  windSet,
  windStop,
}
