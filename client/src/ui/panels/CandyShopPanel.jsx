import { SKINS } from '@shared/balance'
import { formatNumber } from '@shared/format'

import { actions } from '../../net/actions'
import { useGame } from '../../store/game'
import Icon from '../Icon'
import SkinIcon from '../SkinIcon'
import StrokeText from '../StrokeText'
import { ChunkyButton } from '../hud/parts'
import { GRADIENTS, u } from '../hud/style'
import Panel from './Panel'

const CARD = 'linear-gradient(180deg, #ffb347 0%, #ff8a1e 55%, #e8620c 100%)'

/** A price in Candy Corn, red when it's out of reach. */
function CandyPrice({ amount, afford }) {
  return (
    <span className="flex items-center" style={{ gap: u(4), fontSize: u(32) }}>
      <Icon name="candyCorn" size={u(44)} />
      <StrokeText stroke={u(7)} gradient={afford ? GRADIENTS.gold : GRADIENTS.priceShort}>
        {formatNumber(amount)}
      </StrokeText>
    </span>
  )
}

/** One skin on sale: its picture, name, and the button for what you can do with it. */
function SkinCard({ skinId, name, cost, owned, equipped, candy, onBuy, onEquip }) {
  const afford = candy >= cost
  return (
    <div
      className="flex flex-col items-center text-center"
      style={{
        padding: u(10),
        borderRadius: u(10),
        border: `${u(5)} solid #111`,
        background: equipped ? GRADIENTS.rewardCard : CARD,
        boxShadow: equipped ? `0 0 0 ${u(4)} #fff, 0 0 ${u(18)} rgba(255,220,80,0.8)` : 'none',
      }}
    >
      <SkinIcon skinId={skinId} size={u(112)} />
      <span style={{ fontSize: u(name.length > 12 ? 24 : 28), lineHeight: 1.1, minHeight: u(60), display: 'flex', alignItems: 'center' }}>
        <StrokeText stroke={u(6)} style={{ whiteSpace: 'normal' }}>
          {name}
        </StrokeText>
      </span>
      {equipped ? (
        <ChunkyButton gradient={GRADIENTS.greyButton} disabled className="w-full" style={{ height: u(58) }}>
          <span style={{ fontSize: u(30) }}>
            <StrokeText stroke={u(6)}>Equipped</StrokeText>
          </span>
        </ChunkyButton>
      ) : owned ? (
        <ChunkyButton gradient={GRADIENTS.greenButton} onClick={onEquip} className="w-full" style={{ height: u(58) }}>
          <span style={{ fontSize: u(30) }}>
            <StrokeText stroke={u(6)}>Equip</StrokeText>
          </span>
        </ChunkyButton>
      ) : (
        <ChunkyButton gradient={afford ? GRADIENTS.greenButton : GRADIENTS.greyButton} onClick={onBuy} className="w-full" style={{ height: u(58) }}>
          <CandyPrice amount={cost} afford={afford} />
        </ChunkyButton>
      )}
    </div>
  )
}

/**
 * The Candy Shop: pumpkin ball skins, bought with Candy Corn (earned by hitting, more
 * the further the ball goes) and worn by every hit after. "Club's Look" is the default
 * - the ball takes the look of the club in your hands.
 */
export function CandyShopPanel() {
  const candy = useGame((s) => s.profile.candy)
  const owned = useGame((s) => s.profile.ownedSkins)
  const equipped = useGame((s) => s.profile.equippedSkin)
  const club = useGame((s) => s.profile.equippedPlane)
  return (
    <Panel title="CANDY SHOP" width={1080}>
      <div className="flex items-center justify-between" style={{ marginBottom: u(14), gap: u(12) }}>
        <span style={{ fontSize: u(30) }}>
          <StrokeText stroke={u(7)} gradient="linear-gradient(180deg, #f1deff 0%, #c78bff 50%, #8a3fe0 100%)">
            Pumpkin Skins
          </StrokeText>
        </span>
        <span className="flex items-center" style={{ gap: u(6), fontSize: u(44) }}>
          <Icon name="candyCorn" size={u(60)} />
          <StrokeText stroke={u(9)} gradient={GRADIENTS.gold}>
            {formatNumber(candy)}
          </StrokeText>
        </span>
      </div>
      <div className="grid" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${u(200)}, 1fr))`, gap: u(12) }}>
        <SkinCard skinId={club} name="Club’s Look" cost={0} owned equipped={equipped === ''} candy={candy} onEquip={() => actions.equipSkin('')} />
        {SKINS.map((skin) => (
          <SkinCard
            key={skin.id}
            skinId={`skin_${skin.id}`}
            name={skin.name}
            cost={skin.cost}
            owned={owned.includes(skin.id)}
            equipped={equipped === skin.id}
            candy={candy}
            onBuy={() => actions.buySkin(skin.id)}
            onEquip={() => actions.equipSkin(skin.id)}
          />
        ))}
      </div>
      <div className="text-center" style={{ marginTop: u(14), fontSize: u(24) }}>
        <StrokeText stroke={u(6)}>Hit the ball to earn Candy Corn - the further it flies, the more you get!</StrokeText>
      </div>
    </Panel>
  )
}

export default CandyShopPanel
