import { useEffect } from 'react'

import { startSwing } from '../../game/swing'
import { useGame } from '../../store/game'
import Icon from '../Icon'
import StrokeText from '../StrokeText'
import { ChunkyButton } from './parts'
import { GRADIENTS, u } from './style'

/**
 * The big green HIT! button, shown while standing in the Hit Zone: it starts the swing
 * meter (see SwingMeter). E or Enter does too.
 */
export function ThrowButton() {
  const visible = useGame((s) => s.zone.throwArea && !s.flight && !s.throwResult && !s.swing)
  // The bouncing arrow is the guide's "hit the ball" step; once that's done it's gone.
  const guiding = useGame((s) => s.profile.tutorialStep === 0)

  useEffect(() => {
    if (!visible) return undefined
    const onKey = (e) => {
      if (e.repeat) return
      if (e.code === 'KeyE' || e.code === 'Enter') startSwing()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [visible])

  if (!visible) return null
  return (
    <div className="pointer-events-none absolute left-1/2 flex -translate-x-1/2 flex-col items-center" style={{ bottom: u(236) }}>
      {guiding && <Icon name="arrowDown" size={u(76)} className="pp-bounce" style={{ marginBottom: u(6) }} />}
      <ChunkyButton gradient={GRADIENTS.greenButton} onClick={() => startSwing()} style={{ width: u(180), height: u(78) }} radius={22} border={5}>
        <span style={{ fontSize: u(62) }}>
          <StrokeText stroke={u(11)}>HIT!</StrokeText>
        </span>
      </ChunkyButton>
    </div>
  )
}

export default ThrowButton
