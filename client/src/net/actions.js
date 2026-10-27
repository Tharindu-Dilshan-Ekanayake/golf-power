/**
 * Player intents. The UI never changes game state itself: it calls one of these, the
 * authority (the Colyseus room, or the offline stand-in) validates it, and the result
 * comes back as an updated profile or an event.
 */

let transport = null

/** Installs the active connection: `{ send(type, payload) }`. */
export function setTransport(next) {
  transport = next
}

export function send(type, payload) {
  if (!transport) return
  transport.send(type, payload)
}

export const actions = {
  /** The hit off the Hit Zone; `strike` is where the swing meter stood (0-1). */
  throwPlane: (strike) => send('throw', strike === undefined ? undefined : { strike }),
  /** Our swing in a duel; `strike` is where the swing meter stood (0-1). */
  duelHit: (strike) => send('duelHit', { strike }),
  /** A click throw anywhere outside the throw area (see ClickThrow). */
  click: () => send('click'),
  enterLane: (lane) => send('enterLane', { lane }),
  leaveLane: () => send('leaveLane'),
  rebirth: () => send('rebirth'),
  buyPlane: (id) => send('buyPlane', { id }),
  equipPlane: (id) => send('equipPlane', { id }),
  /** Candy Shop: buy a pumpkin skin with Candy Corn (at the shop), or wear one ('' = the club's look). */
  buySkin: (id) => send('buySkin', { id }),
  equipSkin: (id) => send('equipSkin', { id }),
  hatch: (eggId, count = 1) => send('hatch', { eggId, count }),
  openEggItem: (itemId) => send('openEggItem', { itemId }),
  equipPet: (uid) => send('equipPet', { uid }),
  unequipPet: (uid) => send('unequipPet', { uid }),
  equipBestPets: () => send('equipBest'),
  deletePet: (uid) => send('deletePet', { uid }),
  usePotion: (itemId) => send('usePotion', { itemId }),
  claimDaily: (day) => send('claimDaily', { day }),
  claimPlaytime: (index) => send('claimPlaytime', { index }),
  claimFreeReward: () => send('claimFreeReward'),
  setSetting: (key, value) => send('setting', { key, value }),
  portal: () => send('portal'),
  /** Buys a shop item with Wins; see shop.js. */
  purchase: (productId) => send('purchase', { productId }),
}
