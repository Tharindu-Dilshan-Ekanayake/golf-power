import { MAX_EQUIPPED_PETS } from '@shared/balance'
import { rebirthProgress } from '@shared/logic'

import { useGame } from '../../store/game'
import Icon from '../Icon'
import StrokeText from '../StrokeText'
import { AlertBadge, ChunkyButton } from './parts'
import { u } from './style'

/** Every tile is a dark violet panel with a thin lit border, as in the reference. */
const TILE = 'linear-gradient(180deg, #4a3566 0%, #2c1d44 55%, #1d1230 100%)'

function MenuTile({ icon, label, onClick, alert, top, pointer }) {
  return (
    <ChunkyButton gradient={TILE} onClick={onClick} title={label} radius={8} border={3} className="flex-col" style={{ width: u(96), height: u(96) }}>
      <Icon name={icon} size={u(62)} style={{ marginTop: u(-16) }} />
      <span className="absolute" style={{ bottom: u(3), fontSize: u(25) }}>
        <StrokeText stroke={u(6)}>{label}</StrokeText>
      </span>
      {top && (
        <span className="absolute" style={{ top: u(-4), left: u(4), fontSize: u(24) }}>
          <StrokeText stroke={u(6)} className="italic">
            {top}
          </StrokeText>
        </span>
      )}
      {alert && <AlertBadge size={34} style={{ top: u(-12), right: u(-12) }} />}
      {pointer && <Icon name="arrowDown" size={u(70)} className="pp-bounce absolute" style={{ top: u(-100) }} />}
    </ChunkyButton>
  )
}

/**
 * The menu on the left: Rebirth (with % to next) and Store (which holds your pets and
 * inventory too, and wears a "!" when either has something to do). Daily Rewards and
 * the leaderboards are on the top bar.
 */
export function LeftMenu() {
  const togglePanel = useGame((s) => s.togglePanel)
  const rebirthPct = useGame((s) => Math.floor(rebirthProgress(s.profile) * 100))
  const petAlert = useGame((s) => s.profile.equippedPets.length < Math.min(MAX_EQUIPPED_PETS, s.profile.pets.length))
  const itemAlert = useGame((s) => Object.values(s.profile.items).some((n) => n > 0))
  // Tutorial: point at Rebirth once the first one is available.
  const pointAtRebirth = useGame((s) => s.profile.tutorialStep === 2 && rebirthProgress(s.profile) >= 1)

  return (
    <div className="pointer-events-none absolute flex flex-col" style={{ left: u(16), top: '39%', gap: u(12) }}>
      <MenuTile icon="rebirth" label="Rebirth" top={`${rebirthPct}%`} alert={rebirthPct >= 100} pointer={pointAtRebirth} onClick={() => togglePanel('rebirth')} />
      <MenuTile icon="store" label="Store" alert={petAlert || itemAlert} onClick={() => togglePanel('store')} />
    </div>
  )
}

export default LeftMenu
