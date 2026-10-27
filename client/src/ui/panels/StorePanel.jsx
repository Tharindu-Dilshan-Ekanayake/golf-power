import { useState } from 'react'

import { MAX_EQUIPPED_PETS, SHOP } from '@shared/balance'

import { buy } from '../../net/shop'
import { useGame } from '../../store/game'
import Icon from '../Icon'
import PetIcon from '../PetIcon'
import StrokeText from '../StrokeText'
import { AlertBadge, ChunkyButton, Price } from '../hud/parts'
import { GRADIENTS, u } from '../hud/style'
import ItemsTab from './ItemsPanel'
import Panel from './Panel'
import PetsTab from './PetsPanel'

const SECTIONS = [
  { title: 'Power Packs', items: ['power100k', 'power1m', 'power10m'] },
  { title: 'Lanes', items: ['laneVeryOp', 'laneBestOverall'] },
  { title: 'Specials', items: ['sphinx'] },
]

const ICONS = {
  laneVeryOp: 'portal',
  laneBestOverall: 'portal',
  power100k: 'muscle',
  power1m: 'muscle',
  power10m: 'muscle',
}

const BLURBS = {
  laneVeryOp: 'Unlocks the x30 Rainbow lane',
  laneBestOverall: 'Unlocks the x100 Galaxy lane',
  power100k: 'Instant +100K Power',
  power1m: 'Instant +1M Power',
  power10m: 'Instant +10M Power',
  sphinx: 'Limited: 150x Power pet',
}

/** The Store window's tabs: what Wins buy, your pets, your items. */
const TABS = [
  { id: 'store', label: 'Store', title: 'STORE', icon: 'store' },
  { id: 'pets', label: 'Pets', title: 'PETS', icon: 'pets' },
  { id: 'items', label: 'Inventory', title: 'INVENTORY', icon: 'items' },
]

/**
 * The Store window, the one place for everything you own and can buy: the shop itself,
 * and tabs for your pets and your inventory (each with a "!" when there's something to
 * do there - pets to equip, items to use).
 */
export function StorePanel() {
  const [tab, setTab] = useState('store')
  const petAlert = useGame((s) => s.profile.equippedPets.length < Math.min(MAX_EQUIPPED_PETS, s.profile.pets.length))
  const itemAlert = useGame((s) => Object.values(s.profile.items).some((n) => n > 0))
  const alerts = { pets: petAlert, items: itemAlert }
  const current = TABS.find((t) => t.id === tab)
  return (
    <Panel title={current.title} width={1080}>
      <div className="flex" style={{ gap: u(12), marginBottom: u(18) }}>
        {TABS.map((t) => (
          <ChunkyButton
            key={t.id}
            gradient={t.id === tab ? GRADIENTS.goldButton : GRADIENTS.slate}
            onClick={() => setTab(t.id)}
            radius={10}
            className="flex-1"
            style={{ height: u(70), gap: u(8), opacity: t.id === tab ? 1 : 0.85 }}
          >
            <Icon name={t.icon} size={u(46)} />
            <span style={{ fontSize: u(32) }}>
              <StrokeText stroke={u(7)}>{t.label}</StrokeText>
            </span>
            {alerts[t.id] && t.id !== tab && <AlertBadge size={30} style={{ top: u(-10), right: u(-10) }} />}
          </ChunkyButton>
        ))}
      </div>
      {tab === 'store' && <StoreTab />}
      {tab === 'pets' && <PetsTab />}
      {tab === 'items' && <ItemsTab />}
    </Panel>
  )
}

/** Everything Wins can buy besides golf clubs and eggs, grouped, with what it does. */
function StoreTab() {
  const passes = useGame((s) => s.profile.passes)
  const wins = useGame((s) => s.profile.wins)
  return (
    <div className="flex flex-col" style={{ gap: u(18) }}>
      {SECTIONS.map((section) => (
        <div key={section.title}>
          <div style={{ fontSize: u(40), marginBottom: u(8) }}>
            <StrokeText stroke={u(8)} gradient={GRADIENTS.gold}>
              {section.title}
            </StrokeText>
          </div>
          <div className="grid" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${u(200)}, 1fr))`, gap: u(12) }}>
            {section.items.map((id) => {
              const product = SHOP[id]
              const owned = product.kind === 'pass' && passes[id]
              return (
                <div
                  key={id}
                  className="flex flex-col items-center text-center"
                  style={{ padding: u(10), borderRadius: u(8), border: `${u(5)} solid #111`, background: owned ? GRADIENTS.greyButton : GRADIENTS.rewardCard }}
                >
                  {id === 'sphinx' ? <PetIcon id="sphinx" size={u(96)} /> : <Icon name={ICONS[id]} size={u(96)} />}
                  <span style={{ fontSize: u(product.name.length > 12 ? 24 : 30), lineHeight: 1.1 }}>
                    <StrokeText stroke={u(6)} style={{ whiteSpace: 'normal' }}>
                      {product.name}
                    </StrokeText>
                  </span>
                  <span className="whitespace-normal" style={{ fontSize: u(18), minHeight: u(44), margin: `${u(4)} 0` }}>
                    <span style={{ color: '#3a2a10', fontFamily: 'system-ui, sans-serif', fontWeight: 700 }}>{BLURBS[id]}</span>
                  </span>
                  <ChunkyButton
                    gradient={owned ? GRADIENTS.greyButton : GRADIENTS.greenButton}
                    disabled={owned}
                    onClick={() => buy(id)}
                    className="w-full"
                    style={{ height: u(58) }}
                  >
                    {owned ? (
                      <span style={{ fontSize: u(30) }}>
                        <StrokeText stroke={u(6)}>Owned</StrokeText>
                      </span>
                    ) : (
                      <Price amount={product.price} size={32} afford={wins >= product.price} />
                    )}
                  </ChunkyButton>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

export default StorePanel
