import { EGGS, LANES, PETS, PLANES, SHOP, WORLD2_POWER } from '@shared/balance'
import { formatNumber } from '@shared/format'
import {
  DUEL_PADS,
  EGG_STANDS,
  FREE_REWARD,
  LANE_TARGET_X,
  laneCenterZ,
  PLANE_PADS,
  PORTAL,
  SPHINX_STAND,
} from '@shared/world'

import { eggHeight } from '../world/eggs'
import { CANDY_SHOP, CHEST, EVENT_ALTAR, MAILBOX } from '../world/lobbyDecor'
import { LANE_THEMES } from '../world/structures'

/**
 * Text styles, as gradients top-to-bottom, matching the reference signage.
 */
export const TEXT = {
  gold: ['#fffaa8', '#ffd52a', '#ff9c00'],
  green: ['#e6ffb0', '#8dff4f', '#2fd12f'],
  price: ['#d9ff9a', '#7dff4a', '#2fd12f'],
  white: ['#ffffff', '#ffffff', '#dfe7f0'],
  red: ['#ffb0a8', '#ff4a3b', '#d4142a'],
  blue: ['#e0faff', '#7fe2ff', '#2fa8ff'],
  purple: ['#f1deff', '#c78bff', '#8a3fe0'],
  orange: ['#fff0c2', '#ffa33a', '#ff6a14'],
}

const tint = (hex) => ['#ffffff', hex, hex]

/** "FREE / x1 Power", "1 Rebirth / x2 Power", "VERY OP! / 45 / x30 Power"... */
export function laneLabelSpec(index) {
  const lane = LANES[index]
  const theme = LANE_THEMES[index]
  const lines = []
  if (lane.product) {
    lines.push({ text: lane.tag, size: 50, rainbow: true })
    lines.push({ text: `${formatNumber(SHOP[lane.product].price)} Wins`, size: 44, icon: 'trophy', gradient: TEXT.gold })
  } else if (lane.rebirths === 0) {
    lines.push({ text: 'FREE', size: 50, gradient: TEXT.green })
  } else {
    const word = lane.rebirths === 1 ? 'Rebirth' : 'Rebirths'
    lines.push({ text: `${lane.rebirths} ${word}`, size: 46, icon: 'rebirth', gradient: tint(theme.text) })
  }
  lines.push({ text: `x${lane.mult} Power`, size: 50, icon: 'muscle', gradient: TEXT.gold })
  return { lines, pxPerUnit: 56 }
}

export function laneLabels() {
  return LANES.map((lane, i) => ({
    id: `lane-${i}`,
    position: [LANE_TARGET_X, lane.product ? 11.4 : 10.6, laneCenterZ(i)],
    spec: laneLabelSpec(i),
    fade: 150,
  }))
}

/** Ownership state of each shop pad: 'equipped' | 'owned' | 'buy' | 'locked'. */
export function padState(profile, index) {
  const plane = PLANES[index]
  if (profile.equippedPlane === plane.id) return 'equipped'
  if (profile.ownedPlanes.includes(plane.id)) return 'owned'
  const previous = PLANES[index - 1]
  return !previous || profile.ownedPlanes.includes(previous.id) ? 'buy' : 'locked'
}

/** "+6 Power" over "28 Wins", "OWNED" or "EQUIPPED". */
export function padLabelSpec(index, state) {
  const plane = PLANES[index]
  const status =
    state === 'equipped'
      ? { text: 'EQUIPPED', size: 40, gradient: TEXT.gold }
      : state === 'owned'
        ? { text: 'OWNED', size: 40, gradient: TEXT.green }
        : { text: `${formatNumber(plane.cost)} Wins`, size: 40, icon: 'trophy', gradient: state === 'locked' ? TEXT.red : TEXT.gold }
  return {
    lines: [{ text: `+${formatNumber(plane.power)} Power`, size: 38, icon: 'muscle', fill: '#ffffff' }, status],
    pxPerUnit: 70,
  }
}

/** Largest a pad label can get, so its atlas slot fits every state. */
const padReserve = (index) => ({
  lines: [
    { text: `+${formatNumber(PLANES[index].power)} Power`, size: 38, icon: 'muscle' },
    { text: `${formatNumber(PLANES[index].cost)} Wins`, size: 40, icon: 'trophy' },
  ],
})

export function padLabels(profile) {
  return PLANE_PADS.map((pad) => ({
    id: `pad-${pad.index}`,
    // Each row back rides higher, so they clear the rows in front seen from the plaza.
    position: [pad.x, pad.y + 4.6 + pad.row * 2.2, pad.z],
    spec: padLabelSpec(pad.index, padState(profile, pad.index)),
    reserve: padReserve(pad.index),
    // Only the stands near you: twenty at once is a wall of text.
    fade: 26,
  }))
}

export function eggLabels() {
  return EGG_STANDS.map((stand) => {
    const egg = EGGS[stand.eggId]
    const lines = stand.big
      ? [
          { text: egg.name, size: 54, gradient: TEXT.purple },
          { text: `${formatNumber(egg.cost.wins)} Wins`, size: 46, icon: 'trophy', gradient: TEXT.gold },
        ]
      : [
          { text: egg.name, size: 50, fill: '#ffffff' },
          { text: `${formatNumber(egg.cost.wins)} Wins`, size: 44, icon: 'trophy', gradient: TEXT.gold },
        ]
    return {
      id: `egg-${stand.eggId}`,
      // Low over the egg, clear of the leaderboard behind it.
      position: [stand.x, eggHeight(stand) + (stand.big ? 2.4 : 2.2), stand.z],
      spec: { lines, pxPerUnit: 68 },
      fade: 100,
    }
  })
}

/** The limited Sphinx showcase: price, hype, and live stock. */
export function sphinxLabelSpec(stock) {
  const mult = PETS.sphinx.mult
  return {
    lines: [
      { text: `${formatNumber(SHOP.sphinx.price)} Wins`, size: 46, icon: 'trophy', gradient: TEXT.gold },
      { text: 'BEST IN GAME', size: 56, gradient: TEXT.red },
      { text: 'Sphinx', size: 76, fill: '#ffffff' },
      { text: `${formatNumber(mult * 100 - 100)}% BETTER`, size: 54, rainbow: true },
      { text: `${formatNumber(stock)} Left`, size: 50, gradient: TEXT.green },
    ],
    pxPerUnit: 56,
  }
}

export function sphinxLabel(stock) {
  return {
    id: 'sphinx',
    position: [SPHINX_STAND.x, 11.5, SPHINX_STAND.z],
    spec: sphinxLabelSpec(stock),
    reserve: sphinxLabelSpec(88888),
    fade: 140,
  }
}

const freeRewardLabel = () => ({
  id: 'free-reward',
  position: [FREE_REWARD.x, 4.6, FREE_REWARD.z],
  spec: { lines: [{ text: 'FREE REWARD', size: 50, gradient: ['#fff2b0', '#ffb347', '#ff6a1e'] }], pxPerUnit: 76 },
  fade: 70,
})

const portalLabel = () => ({
  id: 'portal',
  position: [PORTAL.x, 13.6, PORTAL.z],
  spec: {
    lines: [
      { text: 'WORLD 2', size: 58, gradient: TEXT.purple },
      { text: 'STEP IN TO TRAVEL', size: 34, gradient: TEXT.green },
      { text: `Needs ${formatNumber(WORLD2_POWER)} Power`, size: 42, icon: 'muscle', gradient: TEXT.gold },
    ],
    pxPerUnit: 56,
  },
  fade: 140,
})

/** The Halloween signs: Candy Shop, Event Starter, the quest mailbox, the training bays. */
function decorLabels() {
  return [
    {
      id: 'candy-shop',
      position: [CANDY_SHOP.x, 8.2, CANDY_SHOP.z + 2],
      spec: { lines: [{ text: 'CANDY SHOP', size: 56, gradient: TEXT.orange }, { text: 'Pumpkin Skins', size: 34, gradient: TEXT.purple }], pxPerUnit: 52 },
      fade: 90,
    },
    {
      id: 'event-starter',
      position: [EVENT_ALTAR.x, 9, EVENT_ALTAR.z],
      spec: { lines: [{ text: 'EVENT STARTER', size: 52, fill: '#ffffff' }, { text: 'SUMMON AN EVENT', size: 36, gradient: TEXT.purple }], pxPerUnit: 52 },
      fade: 110,
    },
    {
      id: 'mailbox',
      position: [MAILBOX.x, 7, MAILBOX.z],
      spec: { lines: [{ text: 'QUESTS', size: 48, gradient: TEXT.gold }], pxPerUnit: 56 },
      fade: 70,
    },
    {
      id: 'duel',
      position: [15, 6.4, -36.4],
      spec: { lines: [{ text: '1V1 DUEL', size: 66, gradient: TEXT.gold }, { text: 'STAND ON A TEE', size: 38, fill: '#ffffff' }], pxPerUnit: 62 },
      fade: 80,
    },
    {
      id: 'duel-blue',
      position: [DUEL_PADS[0].x, 2.4, DUEL_PADS[0].z],
      spec: { lines: [{ text: 'STAND HERE', size: 40, fill: '#ffffff' }], pxPerUnit: 76 },
      fade: 32,
    },
    {
      id: 'duel-red',
      position: [DUEL_PADS[1].x, 2.4, DUEL_PADS[1].z],
      spec: { lines: [{ text: 'STAND HERE', size: 40, fill: '#ffffff' }], pxPerUnit: 76 },
      fade: 32,
    },
    {
      id: 'group-reward',
      position: [CHEST.x + 6, 6.2, CHEST.z - 1],
      spec: {
        lines: [
          { text: 'GROUP REWARD', size: 48, fill: '#ffffff' },
          { text: '2X WINS • 10 MIN', size: 44, gradient: TEXT.gold },
          { text: 'LIKE THE GAME!', size: 38, gradient: TEXT.blue },
        ],
        pxPerUnit: 64,
      },
      fade: 70,
    },
  ]
}

/** Every label in the lobby. */
export function lobbyLabels(profile, { sphinxStock = 0 } = {}) {
  return [...laneLabels(), ...padLabels(profile), ...eggLabels(), sphinxLabel(sphinxStock), freeRewardLabel(), portalLabel(), ...decorLabels()]
}
