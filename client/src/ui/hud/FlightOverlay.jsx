import { useCallback, useEffect, useState } from 'react'

import { ZONES } from '@shared/balance'
import { formatNumber } from '@shared/format'
import { zoneIndexAt } from '@shared/logic'

import { sfx } from '../../audio/sfx'
import { flight } from '../../game/flight/flightControl'
import { courseProgress, setDistanceElement } from '../../game/flight/hudLink'
import { useGame } from '../../store/game'
import Icon from '../Icon'
import { iconUrl } from '../icons'
import StrokeText from '../StrokeText'
import { GRADIENTS, u } from './style'

/** Each course zone's colour on the bar, in order (the flag at its start matches). */
const ZONE_COLORS = ['#58c24a', '#3aa0ff', '#ffc02a', '#2fbf6a', '#9fe0ff', '#ff5a2a', '#9a7ae0', '#ff5cc8', '#c2182b', '#5a6cff']

const BAR_WIDTH = 820

/** A zone's flag: a white pole with a pennant in the zone's colour, rippling gently. */
function Flag({ left, color, finish = false }) {
  return (
    <span className="absolute" style={{ left, top: u(-30), width: u(4), height: u(36), marginLeft: u(-2), background: '#f4efe9', borderRadius: u(2), boxShadow: `0 0 0 ${u(1.5)} #120c1c` }}>
      <span
        className="pp-pennant absolute"
        style={{
          left: u(3),
          top: u(1),
          width: u(22),
          height: u(15),
          background: finish ? 'repeating-conic-gradient(#120c1c 0 25%, #ffffff 0 50%) 0 0 / 50% 50%' : color,
          clipPath: finish ? 'none' : 'polygon(0 0, 100% 50%, 0 100%)',
          filter: `drop-shadow(0 0 ${u(1.5)} #120c1c)`,
        }}
      />
    </span>
  )
}

/**
 * The course bar along the top while a ball is in the air: a glossy rounded track with
 * one stretch per biome (dim ahead of the ball, lit up behind it), a pennant at each
 * biome's start and a chequered flag at the end, a gold diamond at your best distance,
 * the pumpkin riding along it, and under it the distance in a pill that follows it.
 * The ball, the fill and the number are written straight to the DOM (see hudLink), so
 * React never re-renders during a flight.
 */
function CourseBar() {
  // A callback ref: registered when the element mounts, cleared when it unmounts.
  const ref = useCallback((el) => setDistanceElement(el), [])
  // Your best before this shot (a marker at this shot's own distance would give it away).
  const [best] = useState(() => (flight.bestBefore > 0 && flight.bestBefore !== flight.distance ? courseProgress(flight.bestBefore) * 100 : -1))
  const segment = (i, bright) => {
    const c = ZONE_COLORS[i % ZONE_COLORS.length]
    return bright ? `linear-gradient(180deg, ${c} 0%, ${c} 55%, rgba(0,0,0,0.25) 140%)` : c
  }
  return (
    <div ref={ref} className="pointer-events-none absolute left-1/2 -translate-x-1/2" style={{ top: u(46), width: u(BAR_WIDTH) }}>
      {ZONES.map((zone, i) => (i === 0 ? null : <Flag key={zone.id} left={`${(i / ZONES.length) * 100}%`} color={ZONE_COLORS[i % ZONE_COLORS.length]} />))}
      <Flag left="100%" finish />
      <div
        className="relative"
        style={{
          height: u(44),
          padding: u(4),
          borderRadius: u(22),
          border: `${u(4)} solid #120c1c`,
          background: '#1b1328',
          boxShadow: `0 ${u(5)} 0 rgba(0,0,0,0.45), 0 0 ${u(20)} rgba(170, 100, 255, 0.45)`,
        }}
      >
        <div className="relative h-full overflow-hidden" style={{ borderRadius: u(16) }}>
          {/* The course ahead: dim. */}
          <div className="absolute inset-0 flex" style={{ filter: 'saturate(0.45) brightness(0.5)' }}>
            {ZONES.map((zone, i) => (
              <div key={zone.id} className="h-full flex-1" style={{ background: segment(i, false) }} />
            ))}
          </div>
          {/* The course flown: lit, revealed up to the ball. */}
          <div data-fill className="absolute inset-y-0 left-0 overflow-hidden" style={{ width: 0 }}>
            <div className="absolute inset-y-0 left-0 flex" style={{ width: u(BAR_WIDTH - 16) }}>
              {ZONES.map((zone, i) => (
                <div key={zone.id} className="h-full flex-1" style={{ background: segment(i, true) }} />
              ))}
            </div>
          </div>
          {ZONES.map((zone, i) =>
            i === 0 ? null : <span key={zone.id} className="absolute inset-y-0" style={{ left: `${(i / ZONES.length) * 100}%`, width: u(2), background: 'rgba(18, 12, 28, 0.55)' }} />,
          )}
          <div className="absolute inset-x-0 top-0" style={{ height: '48%', background: 'linear-gradient(180deg, rgba(255,255,255,0.45), rgba(255,255,255,0.06))' }} />
        </div>
      </div>
      {best >= 0 && (
        <span className="absolute" style={{ left: `${best}%`, top: u(-6), width: u(18), height: u(18), marginLeft: u(-9), transform: 'rotate(45deg)', background: 'linear-gradient(135deg, #fff6a3, #ffc21e 60%, #e08a00)', border: `${u(3)} solid #120c1c`, boxShadow: `0 0 ${u(10)} #ffd21f` }} />
      )}
      <span data-follow className="absolute" style={{ left: 0, top: u(-6) }}>
        <img
          src={iconUrl('frisbee')}
          alt=""
          draggable={false}
          style={{ width: u(56), height: u(56), marginLeft: u(-28), display: 'block', filter: `drop-shadow(0 0 ${u(8)} #ffb02a) drop-shadow(0 ${u(3)} 0 rgba(0,0,0,0.5))` }}
        />
      </span>
      <div data-follow className="absolute flex flex-col items-center" style={{ left: 0, top: u(56), transform: 'translateX(-50%)' }}>
        <span style={{ width: 0, height: 0, borderLeft: `${u(9)} solid transparent`, borderRight: `${u(9)} solid transparent`, borderBottom: `${u(10)} solid #120c1c` }} />
        <div
          className="flex items-center justify-center"
          style={{
            minWidth: u(118),
            padding: `${u(3)} ${u(16)}`,
            borderRadius: u(14),
            border: `${u(3)} solid #120c1c`,
            background: 'linear-gradient(180deg, #3a2160 0%, #1d1033 100%)',
            boxShadow: `inset 0 0 0 ${u(2)} rgba(255, 176, 42, 0.8), 0 ${u(4)} 0 rgba(0,0,0,0.45)`,
            fontSize: u(32),
            color: '#ffe08a',
            textShadow: `0 ${u(2)} 0 #120c1c`,
          }}
        >
          <span data-distance className="pp-font">
            0 m
          </span>
        </div>
      </div>
    </div>
  )
}

/** Counts a number up from 0 to `value` over `ms`, with a tick now and then. */
function useCountUp(value, ms = 900) {
  const [shown, setShown] = useState(0)
  useEffect(() => {
    const start = performance.now()
    let ticks = 0
    const id = setInterval(() => {
      const k = Math.min(1, (performance.now() - start) / ms)
      const eased = 1 - (1 - k) * (1 - k) * (1 - k)
      setShown(Math.round(value * eased))
      if ((ticks += 1) % 3 === 0 && k < 1) sfx.power()
      if (k >= 1) clearInterval(id)
    }, 33)
    return () => clearInterval(id)
  }, [value, ms])
  return shown
}

/**
 * A biome's title card, swept across the screen as the ball flies into it, as in the
 * reference: the name in its colour and how much more it pays. The flight is polled a
 * few times a second (never from the frame loop) and a card shown when the zone changes.
 */
function ZoneCard() {
  const [card, setCard] = useState(null)
  useEffect(() => {
    let last = 0
    const id = setInterval(() => {
      if (!flight.active) return
      const zi = zoneIndexAt(flight.meter)
      if (zi <= last) return
      last = zi
      const zone = ZONES[zi]
      const bonus = Math.round((zone.winsPerMeter / ZONES[0].winsPerMeter - 1) * 100)
      setCard({ name: zone.name, bonus, color: ZONE_COLORS[zi % ZONE_COLORS.length], id: performance.now() })
      sfx.laneEnter()
    }, 120)
    return () => clearInterval(id)
  }, [])
  useEffect(() => {
    if (!card) return undefined
    const id = setTimeout(() => setCard(null), 1900)
    return () => clearTimeout(id)
  }, [card])
  if (!card) return null
  return (
    <div key={card.id} className="pp-zone-card pointer-events-none absolute inset-x-0 flex flex-col items-center" style={{ top: '30%' }}>
      <div style={{ fontSize: u(30), letterSpacing: '0.2em' }}>
        <StrokeText stroke={u(7)}>ENTERING</StrokeText>
      </div>
      <div style={{ fontSize: u(104), lineHeight: 1.05 }}>
        <StrokeText stroke={u(18)} gradient={`linear-gradient(180deg, #ffffff 0%, #ffffff 45%, ${card.color} 100%)`}>
          {card.name.toUpperCase()}
        </StrokeText>
      </div>
      <div style={{ height: u(8), width: u(520), marginTop: u(6), background: `linear-gradient(90deg, transparent, ${card.color}, transparent)` }} />
      <div className="flex items-center" style={{ gap: u(8), marginTop: u(8), fontSize: u(44) }}>
        <Icon name="trophy" size={u(52)} />
        <StrokeText stroke={u(9)} gradient={GRADIENTS.gold}>
          +{card.bonus}% WINS
        </StrokeText>
      </div>
    </div>
  )
}

/** The landing receipt: "+N Wins" in the middle of the screen, counting up. */
function ThrowResult({ result }) {
  const wins = useCountUp(result.wins)
  return (
    <div key={result.id} className="pp-result-hold pointer-events-none absolute left-1/2 top-[38%] flex flex-col items-center">
      {result.green && (
        <div style={{ fontSize: u(result.green.ring === 0 ? 120 : 84), marginBottom: u(6), transform: 'rotate(-4deg)' }}>
          <StrokeText stroke={u(18)} gradient={result.green.ring === 0 ? GRADIENTS.rainbow : GRADIENTS.gold}>
            {result.green.label} x{result.green.mult}
          </StrokeText>
        </div>
      )}
      <div className="flex items-center" style={{ gap: u(14), fontSize: u(110) }}>
        <Icon name="trophy" size={u(130)} />
        <StrokeText stroke={u(18)} gradient={GRADIENTS.gold}>
          +{formatNumber(wins)} Wins
        </StrokeText>
      </div>
      <div style={{ fontSize: u(48) }}>
        <StrokeText stroke={u(10)}>{formatNumber(result.distance)} m</StrokeText>
      </div>
      {result.candy > 0 && (
        <div className="flex items-center" style={{ gap: u(6), fontSize: u(42), marginTop: u(4) }}>
          <Icon name="candyCorn" size={u(56)} />
          <StrokeText stroke={u(9)} gradient={GRADIENTS.gold}>
            +{formatNumber(result.candy)}
          </StrokeText>
        </div>
      )}
    </div>
  )
}

/**
 * The cinematic grade while a ball flies: a soft vignette darkens the corners and a
 * faint violet-to-amber wash grades the picture.
 * Plain CSS over the canvas - no post-processing pass, so it costs the GPU nothing.
 */
function CinemaFrame() {
  return (
    <div className="pp-cinema pointer-events-none absolute inset-0">
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% 55%, rgba(0,0,0,0) 55%, rgba(8,2,24,0.55) 100%)' }} />
      <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(120,60,255,0.10) 0%, rgba(0,0,0,0) 45%, rgba(255,140,40,0.10) 100%)', mixBlendMode: 'soft-light' }} />
    </div>
  )
}

export function FlightOverlay() {
  const flying = useGame((s) => Boolean(s.flight))
  const result = useGame((s) => s.throwResult)
  return (
    <>
      {flying && <CinemaFrame />}
      {flying && <CourseBar />}
      {flying && <ZoneCard />}
      {result && <ThrowResult result={result} />}
    </>
  )
}

export default FlightOverlay
