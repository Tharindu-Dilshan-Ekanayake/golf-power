import { ZONES } from '@shared/balance'
import { zoneIndexAt } from '@shared/logic'

/**
 * The flight's progress readout is DOM written from the frame loop: the distance pill
 * and the ball riding along the course bar. The overlay registers its elements here;
 * the renderer writes to them at most UPDATE_HZ times a second and only when the
 * whole-metre value changes, so React never re-renders during a flight and the
 * outlined text isn't repainted every frame.
 */
const UPDATE_MS = 1000 / 15

/** The text span(s) that show the distance. */
let spans = []
/** Elements whose `left` follows the ball along the bar (the ball itself and the pill). */
let followers = []
/** Elements whose width grows with the ball (the lit part of the bar). */
let fills = []
let shown = -1
let lastWrite = 0

export function setDistanceElement(el) {
  spans = el ? [...el.querySelectorAll('[data-distance]')] : []
  followers = el ? [...el.querySelectorAll('[data-follow]')] : []
  fills = el ? [...el.querySelectorAll('[data-fill]')] : []
  shown = -1
  lastWrite = 0
}

/** 12345 -> "12,345" without toLocaleString's per-call cost. */
function withCommas(n) {
  let s = String(n)
  for (let i = s.length - 3; i > 0; i -= 3) s = `${s.slice(0, i)},${s.slice(i)}`
  return s
}

/**
 * Where a distance sits along the bar, 0-1: each zone gets an equal slice, filled by
 * how far through the zone you are (the last zone is read as 2 km long).
 */
export function courseProgress(meters) {
  const zi = zoneIndexAt(meters)
  const start = ZONES[zi].start
  const length = zi + 1 < ZONES.length ? ZONES[zi + 1].start - start : 2000
  return Math.min(1, (zi + Math.min(1, (meters - start) / length)) / ZONES.length)
}

export function writeDistance(meters, now = performance.now()) {
  const m = Math.floor(meters)
  if (spans.length === 0 || m === shown || now - lastWrite < UPDATE_MS) return
  shown = m
  lastWrite = now
  const text = `${withCommas(m)} m`
  for (const span of spans) span.textContent = text
  const left = `${courseProgress(m) * 100}%`
  for (const el of followers) el.style.left = left
  for (const el of fills) el.style.width = left
}
