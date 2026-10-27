import { formatClock } from '@shared/format'

import useNow from '../useNow'
import StrokeText from '../StrokeText'
import { u } from './style'

/**
 * The Halloween event clock, bottom-right. Wall-clock driven, so everyone sees the same
 * thing: a 15-minute cycle where the current event runs for its first few minutes, and
 * the Pumpkin King appears on the hour. Display only: the events themselves are not
 * part of the game rules (yet).
 */
const SLOT_MS = 15 * 60 * 1000
const EVENT_MS = 3 * 60 * 1000
const KING_MS = 60 * 60 * 1000
const EVENTS = [
  { name: 'LUCKY HOUR', color: '#7dff3a' },
  { name: 'CANDY CORN MADNESS', color: '#ffa51c' },
  { name: 'HALLOWEEN BOSSES', color: '#c78bff' },
]

function schedule(now) {
  const slot = Math.floor(now / SLOT_MS)
  const into = now - slot * SLOT_MS
  const current = EVENTS[slot % EVENTS.length]
  const next = EVENTS[(slot + 1) % EVENTS.length]
  const active = into < EVENT_MS
  return {
    active,
    current,
    next,
    untilEnd: EVENT_MS - into,
    untilNext: SLOT_MS - into,
    untilKing: KING_MS - (now % KING_MS),
  }
}

export function EventTimers() {
  const now = useNow(1000)
  const s = schedule(now)
  return (
    <div className="pointer-events-none absolute flex flex-col items-end" style={{ right: u(12), bottom: u(10), gap: u(4) }}>
      <div style={{ fontSize: u(26) }}>
        <StrokeText stroke={u(6)} fill="#ff9a2a">
          PUMPKIN KING IN {formatClock(s.untilKing)}
        </StrokeText>
      </div>
      {s.active ? (
        <>
          <div style={{ fontSize: u(30) }}>
            <StrokeText stroke={u(7)} fill={s.current.color}>
              {s.current.name}
            </StrokeText>
          </div>
          <div style={{ fontSize: u(20) }}>
            <StrokeText stroke={u(5)}>ENDS IN {formatClock(s.untilEnd)}</StrokeText>
          </div>
        </>
      ) : (
        <>
          <div style={{ fontSize: u(30) }}>
            <StrokeText stroke={u(7)} className="italic">
              NEXT: {s.next.name}
            </StrokeText>
          </div>
          <div style={{ fontSize: u(20) }}>
            <StrokeText stroke={u(5)}>IN {formatClock(s.untilNext)}</StrokeText>
          </div>
        </>
      )}
    </div>
  )
}

export default EventTimers
