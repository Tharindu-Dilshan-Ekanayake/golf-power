import { useEffect } from 'react'

import { skipFlight } from '../../game/flight/flightControl'
import { useGame } from '../../store/game'
import StrokeText from '../StrokeText'
import { u } from './style'
import DuelOverlay from './DuelOverlay'
import EggPanel from './EggPanel'
import FlightOverlay from './FlightOverlay'
import InteractPrompt from './InteractPrompt'
import LeftMenu from './LeftMenu'
import PowerBar from './PowerBar'
import StatsPanel from './StatsPanel'
import SwingMeter from './SwingMeter'
import ThrowButton from './ThrowButton'
import TopBar from './TopBar'
import TopCenter from './TopCenter'

/**
 * While a shot plays out or its result shows, a tap or click anywhere (or Space, Enter
 * or E) skips ahead - to the ball at rest, then back to the golfer - so hitting again
 * never means waiting. A hint says so once the ball is away.
 */
function SkipLayer() {
  const watching = useGame((s) => Boolean(s.flight || s.throwResult))
  useEffect(() => {
    if (!watching) return undefined
    const onKey = (e) => {
      if (e.repeat) return
      if (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyE') skipFlight()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [watching])
  if (!watching) return null
  return (
    <div className="pointer-events-auto absolute inset-0" onPointerDown={skipFlight}>
      <div className="pp-skip-hint absolute inset-x-0 flex justify-center" style={{ bottom: `calc(9vh + ${u(18)})`, fontSize: u(30) }}>
        <StrokeText stroke={u(7)}>TAP TO SKIP</StrokeText>
      </div>
    </div>
  )
}

/**
 * Cinematic letterbox bars: they slide in while you line up a shot and while the result
 * of one shows, and away again for normal play.
 */
function Letterbox() {
  const on = useGame((s) => s.swing || Boolean(s.throwResult))
  return (
    <>
      <div className="pp-letterbox pointer-events-none absolute inset-x-0 top-0" style={{ height: on ? '9vh' : 0 }} />
      <div className="pp-letterbox pointer-events-none absolute inset-x-0 bottom-0" style={{ height: on ? '9vh' : 0 }} />
    </>
  )
}

/**
 * The heads-up display: the logo's corner top-left, your name tag top-right, menu tiles
 * on the left, stats bottom-left, power, level and power packs bottom-centre, and the
 * Halloween event clock bottom-right.
 *
 * The root ignores pointer events so the canvas and joystick underneath keep working;
 * only the buttons themselves opt back in. While a panel is open the HUD steps aside,
 * as in the reference.
 */
export function HUD() {
  const panelOpen = useGame((s) => s.panel !== null)
  // While a ball is in the air the side menus clear out, as in the reference.
  const watching = useGame((s) => Boolean(s.flight || s.throwResult))
  // While the swing meter is up, only the stats and the meter remain, as in the reference.
  const swinging = useGame((s) => s.swing)
  // A duel's scoreboard takes the top of the screen.
  const duelOn = useGame((s) => Boolean(s.duel))
  return (
    <div className="pp-font pointer-events-none absolute inset-0 z-20 select-none">
      <Letterbox />
      <SkipLayer />
      <div className="absolute inset-0 transition-opacity duration-150" style={{ opacity: panelOpen ? 0 : 1, visibility: panelOpen ? 'hidden' : 'visible' }}>
        <TopBar />
        {!duelOn && <TopCenter />}
        {/* Hidden, not unmounted, while a ball flies: remounting them at the moment
            of the hit cost a visible hitch on slow phones. */}
        <div className="contents" style={{ visibility: watching || swinging ? 'hidden' : 'visible' }}>
          <LeftMenu />
        </div>
        <div className="contents" style={{ visibility: watching ? 'hidden' : 'visible' }}>
          <StatsPanel />
        </div>
        <div className="contents" style={{ visibility: swinging || watching ? 'hidden' : 'visible' }}>
          <PowerBar />
        </div>
        <ThrowButton />
        <InteractPrompt />
        <EggPanel />
        <FlightOverlay />
        <SwingMeter />
        <DuelOverlay />
      </div>
    </div>
  )
}

export default HUD
