import { useEffect, useRef, useState } from 'react'

import { SWING_MIN, SWING_PERFECT } from '@shared/balance'
import { swingGrade, swingStrength, throwDistance } from '@shared/logic'

import { duelSwing } from '../../game/duel'
import { cancelSwing, hitSwing, swingState } from '../../game/swing'
import { useGame } from '../../store/game'
import StrokeText from '../StrokeText'
import { ChunkyButton } from './parts'
import { GRADIENTS, u } from './style'

/** Seconds for the marker to run the bar from bottom to top and back. */
const PERIOD = 1.3
/** Taps this soon after the meter opens are ignored (the press that opened it). */
const GRACE_MS = 180
/** How long the grade stays up: its animation's length (.pp-result in index.css). */
const GRADE_MS = 1500
/** The bar's PERFECT band (0 bottom - 1 top), from the rules. */
const PERFECT = SWING_PERFECT

/** The grade a meter reading earns, as the rules judge it. */
const GRADES = {
  perfect: { text: 'PERFECT!', color: '#7dff3a' },
  great: { text: 'GREAT!', color: '#ffd21f' },
  good: { text: 'GOOD', color: '#ffffff' },
}
const gradeOf = (v) => GRADES[swingGrade(v)]

/** Where on the bar (0-1) a swing comes out at `k` of full strength (swingStrength inverted). */
const levelFor = (k) => PERFECT[0] * ((k - SWING_MIN) / (1 - SWING_MIN)) ** (1 / 1.5)
/** Marks down the side of the bar, so it's plain how much each spot hits. */
const TICKS = [
  { at: (PERFECT[0] + PERFECT[1]) / 2, text: 'MAX', color: '#7dff3a' },
  { at: levelFor(0.75), text: '75%', color: '#ffffff' },
  { at: levelFor(0.5), text: '50%', color: '#ffffff' },
  { at: 0.02, text: '25%', color: '#ffffff' },
]

/**
 * The swing meter, as in the reference: a tall bar with a marker sweeping up and down, a
 * green sweet spot just under a grey cap, "Tap to Hit!" under it and a red CANCEL. A tap
 * anywhere (or E / Enter / Space) takes the swing; Escape or CANCEL backs out.
 *
 * The marker is moved straight on its element every frame, so React never re-renders
 * during the sweep. Where the marker stands sets the swing's strength: full in the
 * PERFECT band, weaker below it (to land short on a green), a little over above it.
 */
export function SwingMeter() {
  const swing = useGame((s) => s.swing)
  const inArea = useGame((s) => s.zone.throwArea)
  // In a duel the tap is the duel's swing, and there's no backing out.
  const duelMode = useGame((s) => s.duel?.phase === 'swing' && s.duel.side >= 0)
  const markerRef = useRef(null)
  const valueRef = useRef(0)
  const startedAt = useRef(0)
  const readoutRefs = useRef([])
  const [grade, setGrade] = useState(null)

  // The sweep.
  useEffect(() => {
    if (!swing) return undefined
    startedAt.current = performance.now()
    // The distance a swing would carry from where the marker stands, beside it.
    const full = throwDistance(useGame.getState().profile.power)
    let shown = -1
    let raf = 0
    const tick = () => {
      const t = ((performance.now() - startedAt.current) / 1000 / PERIOD) % 1
      valueRef.current = 1 - Math.abs(t * 2 - 1)
      if (markerRef.current) markerRef.current.style.bottom = `${valueRef.current * 100}%`
      const metres = Math.round(full * swingStrength(valueRef.current))
      if (metres !== shown) {
        shown = metres
        for (const el of readoutRefs.current) if (el) el.textContent = `${metres.toLocaleString()} m`
      }
      raf = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [swing])

  const take = () => {
    if (performance.now() - startedAt.current < GRACE_MS) return
    const result = gradeOf(valueRef.current)
    swingState.grade = swingGrade(valueRef.current)
    const pct = Math.round(swingStrength(valueRef.current) * 100)
    const hit = duelMode ? duelSwing(valueRef.current) : hitSwing(valueRef.current)
    if (hit) setGrade({ ...result, pct, id: performance.now() })
  }

  // Keys.
  useEffect(() => {
    if (!swing) return undefined
    const onKey = (e) => {
      if (e.repeat) return
      if (e.code === 'Escape' && !duelMode) cancelSwing()
      else if (e.code === 'KeyE' || e.code === 'Enter' || e.code === 'Space') take()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // Walking out of the Hit Zone (it can't happen while frozen, but a teleport can) cancels.
  useEffect(() => {
    if (swing && !inArea && !duelMode) cancelSwing()
  }, [swing, inArea, duelMode])

  // The grade fades after a moment (the length of its pop-in-and-fade animation).
  useEffect(() => {
    if (!grade) return undefined
    const id = setTimeout(() => setGrade(null), GRADE_MS)
    return () => clearTimeout(id)
  }, [grade])

  return (
    <>
      {swing && (
        <>
          {/* Catches the tap anywhere on screen. */}
          <div className="pointer-events-auto absolute inset-0" onPointerDown={take} />
          {/* In a duel, far right: clear of the opponent beside you. */}
          <div className="pointer-events-none absolute" style={{ left: duelMode ? '86%' : '62.5%', top: '30%', width: u(58) }}>
            <div
              className="relative"
              style={{
                height: u(330),
                borderRadius: u(10),
                border: `${u(4)} solid #111`,
                background: `linear-gradient(180deg, #ececf0 0%, #ececf0 8%, #38d65a 8%, #6fdc3c 28%, #e6d92a 52%, #ff9a1f 76%, #ff5a2a 100%)`,
                boxShadow: `0 ${u(4)} 0 rgba(0,0,0,0.4), inset 0 0 0 ${u(3)} rgba(255,255,255,0.7)`,
              }}
            >
              {TICKS.map((tick) => (
                <span
                  key={tick.text}
                  className="absolute whitespace-nowrap"
                  style={{ right: `calc(100% + ${u(10)})`, bottom: `${tick.at * 100}%`, transform: 'translateY(50%)', fontSize: u(tick.text === 'MAX' ? 24 : 19) }}
                >
                  <StrokeText stroke={u(5)} fill={tick.color}>
                    {tick.text}
                  </StrokeText>
                </span>
              ))}
              {/* The sweet spot's edges. */}
              <span className="absolute inset-x-0" style={{ top: `${(1 - PERFECT[1]) * 100}%`, height: u(3), background: 'rgba(255,255,255,0.85)' }} />
              <span className="absolute inset-x-0" style={{ top: `${(1 - PERFECT[0]) * 100}%`, height: u(3), background: 'rgba(255,255,255,0.85)' }} />
              <span
                ref={markerRef}
                className="absolute"
                style={{ left: u(-14), right: u(-14), bottom: 0, height: u(12), marginBottom: u(-6), borderRadius: u(6), background: '#fff', border: `${u(3)} solid #111` }}
              >
                {/* How far a swing from here carries. */}
                <span className="pp-text absolute whitespace-nowrap" style={{ left: `calc(100% + ${u(10)})`, top: '50%', transform: 'translateY(-50%)', fontSize: u(28) }}>
                  <span ref={(el) => (readoutRefs.current[0] = el)} aria-hidden="true" className="pp-text-stroke" style={{ WebkitTextStrokeWidth: u(7) }} />
                  <span ref={(el) => (readoutRefs.current[1] = el)} className="pp-text-fill" style={{ color: '#ffffff' }} />
                </span>
              </span>
            </div>
            <div className="text-center" style={{ marginTop: u(6), fontSize: u(30), marginLeft: u(-60), marginRight: u(-60) }}>
              <StrokeText stroke={u(7)}>Tap to Hit!</StrokeText>
            </div>
          </div>
          {/* Above the letterbox bar, so it's never cut off. */}
          {!duelMode && <div className="pointer-events-none absolute left-1/2 -translate-x-1/2" style={{ bottom: `calc(9vh + ${u(22)})` }}>
            <ChunkyButton gradient={GRADIENTS.redButton} onClick={cancelSwing} radius={10} style={{ width: u(205), height: u(62) }}>
              <span style={{ fontSize: u(44) }}>
                <StrokeText stroke={u(9)}>CANCEL</StrokeText>
              </span>
            </ChunkyButton>
          </div>}
        </>
      )}
      {grade && (
        <div key={grade.id} className="pp-result pointer-events-none absolute left-1/2 top-[28%] flex flex-col items-center">
          <span style={{ fontSize: u(84), lineHeight: 1 }}>
            <StrokeText stroke={u(16)} fill={grade.color}>
              {grade.text}
            </StrokeText>
          </span>
          <span style={{ fontSize: u(40), marginTop: u(6) }}>
            <StrokeText stroke={u(9)} fill="#ffffff">
              {grade.pct}% POWER
            </StrokeText>
          </span>
        </div>
      )}
    </>
  )
}

export default SwingMeter
