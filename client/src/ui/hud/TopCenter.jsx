import { PLANES, TUTORIAL } from '@shared/balance'
import { formatNumber } from '@shared/format'
import { isMaxLevel, rebirthProgress } from '@shared/logic'

import { useGame } from '../../store/game'
import StrokeText from '../StrokeText'
import { GRADIENTS, u } from './style'

/** Yellow studded brick, the tutorial panel's face. */
const BRICK =
  'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.16) 0 22%, rgba(0,0,0,0) 24%) 0 0 / calc(var(--px) * 26) calc(var(--px) * 26), linear-gradient(180deg, #d9c23a 0%, #bda423 100%)'

/** The tutorial panel: a yellow brick plate titled TUTORIAL, with a progress bar on the rebirth step. */
function TutorialBanner() {
  const step = useGame((s) => s.profile.tutorialStep)
  const inThrowArea = useGame((s) => s.zone.throwArea)
  // Out of the way while lining up a shot (the meter says what to do), while it plays
  // out and while its result shows.
  const flying = useGame((s) => Boolean(s.flight || s.throwResult || s.swing))
  const progress = useGame((s) => rebirthProgress(s.profile))
  const maxed = useGame((s) => isMaxLevel(s.profile))
  const wins = useGame((s) => s.profile.wins)
  const owned = useGame((s) => s.profile.ownedPlanes)

  const current = TUTORIAL[step]
  if (!current || flying) return null
  let text = current.text
  if (current.event === 'throw' && inThrowArea) text = 'Press the HIT! button'
  if (current.event === 'rebirth' && maxed) text = 'Rebirth now!'
  if (current.event === 'buyPlane') {
    // The next club along, and whether the Wins are there yet.
    const next = PLANES.find((plane) => !owned.includes(plane.id))
    if (next) text = wins >= next.cost ? `Buy the ${next.name} - ${formatNumber(next.cost)} Wins` : `Earn ${formatNumber(next.cost)} Wins for a new club`
  }

  return (
    <div
      className="flex flex-col items-center"
      style={{
        width: u(800),
        padding: `${u(8)} ${u(20)} ${u(12)}`,
        background: BRICK,
        border: `${u(5)} solid #111`,
        borderRadius: u(14),
        boxShadow: `0 ${u(5)} 0 rgba(0,0,0,0.4), inset 0 0 0 ${u(3)} rgba(255,255,255,0.25)`,
      }}
    >
      <div style={{ fontSize: u(30) }}>
        <StrokeText stroke={u(7)}>TUTORIAL</StrokeText>
      </div>
      <div style={{ fontSize: u(40) }}>
        <StrokeText stroke={u(8)}>{text.toUpperCase()}</StrokeText>
      </div>
      {current.event === 'rebirth' && (
        <div
          className="relative overflow-hidden"
          style={{ width: '100%', height: u(30), border: `${u(3)} solid #111`, background: 'rgba(0,0,0,0.45)', marginTop: u(6) }}
        >
          <div className="absolute inset-y-0 left-0" style={{ width: `${progress * 100}%`, background: GRADIENTS.barFill }} />
          <div className="absolute inset-0 flex items-center justify-center" style={{ fontSize: u(18) }}>
            <StrokeText stroke={u(5)}>{maxed ? 'MAX LEVEL - REBIRTH!' : `${Math.floor(progress * 100)}% TO MAX LEVEL`}</StrokeText>
          </div>
        </div>
      )}
    </div>
  )
}

export function TopCenter() {
  return (
    <div className="pointer-events-none absolute left-1/2 flex -translate-x-1/2 flex-col items-center" style={{ top: u(46) }}>
      <TutorialBanner />
    </div>
  )
}

export default TopCenter
