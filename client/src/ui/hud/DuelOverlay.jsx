import { formatNumber } from '@shared/format'

import { watchingDuel } from '../../game/duel'
import { useGame } from '../../store/game'
import StrokeText from '../StrokeText'
import useNow from '../useNow'
import { GRADIENTS, u } from './style'

const SIDES = [
  { label: 'BLUE', panel: 'linear-gradient(180deg, #6fb6ff 0%, #2f7fe6 55%, #1a4fa8 100%)' },
  { label: 'RED', panel: 'linear-gradient(180deg, #ff8a7a 0%, #e0261c 55%, #9a1010 100%)' },
]
const GLOOM = 'linear-gradient(180deg, #e8ecf4 0%, #9aa6bc 55%, #5a6478 100%)'
const LOSE = 'linear-gradient(180deg, #ffb0a8 0%, #ff4a3b 50%, #b0101f 100%)'
/** The distances count up over this long once revealed. */
const COUNT_MS = 900

/** One duellist's card: their ring's colour, their name, and how their shot went. */
function DuelistCard({ duel, index, now }) {
  const player = duel.players[index]
  const mine = duel.side === index
  const d = duel.distances?.[index]
  let status = 'READY'
  if (duel.phase === 'swing' || (duel.phase === 'result' && !duel.revealed)) status = d != null ? 'SWUNG!' : '...'
  if (duel.revealed) {
    const k = Math.min(1, (now - duel.revealedAt) / COUNT_MS)
    status = duel.missed?.[index] ? 'TOO SLOW!' : `${formatNumber(Math.round(d * k))} m`
  }
  const won = duel.revealed && duel.winner === index
  const lost = duel.revealed && duel.winner >= 0 && duel.winner !== index
  return (
    <div
      className="relative flex flex-col items-center"
      style={{
        width: u(250),
        padding: `${u(8)} ${u(10)} ${u(10)}`,
        borderRadius: u(12),
        border: `${u(5)} solid #111`,
        background: SIDES[index].panel,
        boxShadow: `0 ${u(5)} 0 rgba(0,0,0,0.45), inset 0 ${u(3)} 0 rgba(255,255,255,0.45)`,
        transform: won ? 'scale(1.08)' : 'none',
        filter: lost ? 'saturate(0.35) brightness(0.8)' : 'none',
        transition: 'transform 0.3s, filter 0.3s',
      }}
    >
      {won && (
        <span className="absolute" style={{ top: u(-38), fontSize: u(34) }}>
          <StrokeText stroke={u(7)} gradient={GRADIENTS.gold}>
            WINNER!
          </StrokeText>
        </span>
      )}
      <span className="max-w-full truncate" style={{ fontSize: u(30) }}>
        <StrokeText stroke={u(7)}>{mine ? 'YOU' : player.name}</StrokeText>
      </span>
      <span style={{ fontSize: u(36), lineHeight: 1.1 }}>
        <StrokeText stroke={u(8)} gradient={duel.revealed ? GRADIENTS.gold : undefined}>
          {status}
        </StrokeText>
      </span>
    </div>
  )
}

/** The scoreboard across the top, and the big word in the middle: the count, then the verdict. */
function DuelBoard({ duel }) {
  const now = useNow(100)
  const left = Math.max(0, Math.ceil((duel.endsAt - now) / 1000))
  let big = null
  if (duel.phase === 'ready') {
    // A rematch counts down from further out; it only gets big for the last three.
    big = left > 3 ? { text: `REMATCH IN ${left}`, gradient: GRADIENTS.gold, key: `r${left}`, small: true } : { text: String(Math.max(1, left)), gradient: GRADIENTS.gold, key: `n${left}` }
  }
  else if (duel.phase === 'swing' && duel.side >= 0 && duel.distances[duel.side] == null) big = { text: 'SWING!', gradient: GRADIENTS.gold, key: 'swing', small: true }
  else if (duel.revealed) {
    if (duel.winner < 0) big = { text: 'DRAW!', gradient: GRADIENTS.gold, key: 'draw' }
    else if (duel.side >= 0) big = duel.side === duel.winner ? { text: 'YOU WIN!', gradient: GRADIENTS.gold, key: 'win' } : { text: 'YOU LOSE!', gradient: LOSE, key: 'lose' }
    else big = { text: `${duel.players[duel.winner].name} WINS!`, gradient: GRADIENTS.gold, key: 'wins', small: true }
  }
  return (
    <>
      <div className="pointer-events-none absolute left-1/2 flex -translate-x-1/2 items-center" style={{ top: `calc(9vh + ${u(24)})`, gap: u(14) }}>
        <DuelistCard duel={duel} index={0} now={now} />
        <div className="flex flex-col items-center">
          <span style={{ fontSize: u(54), lineHeight: 1 }}>
            <StrokeText stroke={u(11)} gradient={GRADIENTS.gold}>
              VS
            </StrokeText>
          </span>
          {duel.phase === 'swing' && (
            <span style={{ fontSize: u(26) }}>
              <StrokeText stroke={u(6)}>{left}s</StrokeText>
            </span>
          )}
        </div>
        <DuelistCard duel={duel} index={1} now={now} />
      </div>
      {duel.phase === 'ready' && duel.rematch && duel.side >= 0 && (
        <div className="pointer-events-none absolute inset-x-0 flex justify-center" style={{ bottom: u(260), fontSize: u(30) }}>
          <StrokeText stroke={u(7)}>Step off the ring to leave</StrokeText>
        </div>
      )}
      {big && (
        <div key={big.key} className="pp-result pointer-events-none absolute left-1/2 top-[34%] whitespace-nowrap" style={{ fontSize: u(big.small ? 70 : 110) }}>
          <StrokeText stroke={u(big.small ? 14 : 20)} gradient={big.gradient}>
            {big.text}
          </StrokeText>
        </div>
      )}
    </>
  )
}

/** Standing on a ring with nobody on the other. */
function WaitingHint({ offline }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 flex flex-col items-center" style={{ bottom: u(260) }}>
      <span className="pp-skip-hint" style={{ fontSize: u(40) }}>
        <StrokeText stroke={u(8)} gradient={GRADIENTS.gold}>
          WAITING FOR AN OPPONENT...
        </StrokeText>
      </span>
      <span style={{ fontSize: u(26) }}>
        <StrokeText stroke={u(6)} gradient={offline ? GLOOM : undefined}>
          {offline ? 'Duels need another player online' : 'Get a friend on the other ring!'}
        </StrokeText>
      </span>
    </div>
  )
}

/**
 * The 1v1 duel on the HUD (see game/duel.js): for the two duellists and anyone watching
 * nearby, a VS scoreboard with each one's ring colour and name, the 3-2-1 count, how
 * each shot went, and the verdict. Standing on a ring alone, a hint that it needs an
 * opponent.
 */
export function DuelOverlay() {
  const duel = useGame((s) => s.duel)
  const onRing = useGame((s) => s.zone.duelPad >= 0)
  const offline = useGame((s) => s.net.mode !== 'online')
  if (!duel) return onRing ? <WaitingHint offline={offline} /> : null
  if (duel.side < 0 && !watchingDuel()) return null
  return <DuelBoard duel={duel} />
}

export default DuelOverlay
