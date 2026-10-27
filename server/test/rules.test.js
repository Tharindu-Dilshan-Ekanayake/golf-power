import assert from 'node:assert/strict'
import { test } from 'node:test'

import { EGGS, GREEN_RINGS, HOLES, levelCap, PLANES, SHOP, SWING_MIN, TUTORIAL } from '../../shared/balance.js'
import { formatNumber } from '../../shared/format.js'
import {
  applyRebirth,
  applyThrow,
  ballStyleId,
  buySkin,
  equipSkin,
  applyTrain,
  baseThrowWins,
  buyPlane,
  createProfile,
  dailyStatus,
  greenAt,
  hatchEgg,
  normalizeProfile,
  swingGrade,
  swingStrength,
  throwDistance,
} from '../../shared/logic.js'
import { PlayerSession } from '../../shared/session.js'
import { CANDY_SHOP, LANE_FAR_X, LANE_NEAR_X, laneCenterZ, PLANE_PADS } from '../../shared/world.js'

test('candy corn: earned by hits, spent on skins at the shop, kept in the save', () => {
  const p = createProfile('a', 'A')
  assert.equal(p.candy, 0)
  const r = applyThrow(p, 0, { strike: 0.85, rand: () => 0.5 })
  assert.equal(r.candy, p.candy)
  assert.ok(r.candy >= 1)
  // A skin needs its price in Candy Corn, takes it, and is worn at once.
  assert.equal(buySkin(p, 'toxic').ok, false)
  p.candy = 100
  assert.deepEqual(buySkin(p, 'toxic'), { ok: true, bought: true, skinId: 'toxic' })
  assert.equal(p.candy, 20)
  assert.equal(ballStyleId(p), 'skin_toxic')
  // Owning it, buying again is just wearing it; '' goes back to the club.
  assert.equal(buySkin(p, 'toxic').ok, true)
  assert.equal(p.candy, 20)
  assert.equal(equipSkin(p, 'ghost').ok, false)
  equipSkin(p, '')
  assert.equal(ballStyleId(p), p.equippedPlane)
  // Saves round-trip, and a bad one can't wear a skin it doesn't own.
  const back = normalizeProfile(JSON.parse(JSON.stringify(p)), 'a', 'A')
  assert.deepEqual([back.candy, back.ownedSkins], [20, ['toxic']])
  assert.equal(normalizeProfile({ equippedSkin: 'king', candy: -5 }, 'a', 'A').equippedSkin, '')
  assert.equal(normalizeProfile({ candy: -5 }, 'a', 'A').candy, 0)
})

test('the session sells skins only at the Candy Shop', () => {
  const profile = createProfile('a', 'A')
  profile.candy = 500
  const pos = { x: 0, y: 0, z: 0 }
  const session = new PlayerSession(profile, { now: 0, emit: () => {}, getPosition: () => pos })
  session.handle('buySkin', { id: 'ghost' }, 0)
  assert.deepEqual(profile.ownedSkins, [])
  Object.assign(pos, { x: CANDY_SHOP.x, z: CANDY_SHOP.z + 4.5 })
  session.handle('buySkin', { id: 'ghost' }, 0)
  assert.deepEqual(profile.ownedSkins, ['ghost'])
  assert.equal(profile.candy, 470)
})

test('numbers format like the HUD', () => {
  assert.deepEqual(
    [0, 999, 1000, 1234, 7300, 14000, 2.5e6, 9999].map(formatNumber),
    ['0', '999', '1K', '1.2K', '7.3K', '14K', '2.5M', '9.9K'],
  )
})

test('level caps follow R0=2, R1=15, R2=25, then rise with sqrt', () => {
  assert.deepEqual([0, 1, 2, 3, 10, 27].map(levelCap), [2, 15, 25, 37, 59, 85])
})

test('distance: big early jumps, steadier later, never shrinking', () => {
  // The first minute's power reaches the second biome; the last one takes trillions.
  assert.ok(throwDistance(0) >= 50)
  assert.ok(throwDistance(400) > 240, `got ${throwDistance(400)}`)
  assert.ok(throwDistance(1e9) > 2400 && throwDistance(1e9) < 2600)
  assert.ok(throwDistance(3e15) > 12800, `got ${throwDistance(3e15)}`)
  let last = 0
  for (let e = 0; e <= 15; e += 0.25) {
    const d = throwDistance(10 ** e)
    assert.ok(d > last, `not increasing at 1e${e}`)
    last = d
  }
})

test('the swing meter sets the strength: full in the PERFECT band, weaker below', () => {
  assert.equal(swingStrength(0.85), 1)
  assert.equal(swingStrength(undefined), 1)
  assert.ok(swingStrength(0) === SWING_MIN)
  assert.ok(swingStrength(0.5) > SWING_MIN && swingStrength(0.5) < 1)
  assert.ok(swingStrength(1) < 1)
  assert.equal(swingGrade(0.85), 'perfect')
})

test('a ball in the hole is a hole in one and lands in it; rings pay less', () => {
  const p = createProfile('a', 'A')
  const hole = HOLES[0]
  // Find the power whose full, unscattered hit lands right on the first hole.
  let lo = 0
  let hi = 1e12
  for (let i = 0; i < 200; i += 1) {
    const mid = (lo + hi) / 2
    if (throwDistance(mid) < hole) lo = mid
    else hi = mid
  }
  p.power = hi
  const r = applyThrow(p, 0, { strike: 0.85, rand: () => 0.5 })
  assert.equal(r.green.ring, 0)
  assert.equal(r.distance, hole)
  assert.ok(r.wins >= Math.round(baseThrowWins(hole) * GREEN_RINGS[0].mult) - 1)
  assert.equal(greenAt(hole + 10).mult, GREEN_RINGS.find((g) => g.radius >= 10).mult)
  assert.equal(greenAt(hole + 40), null)
})

test('training levels up every 10 throws and stops at the cap', () => {
  const p = createProfile('a', 'A')
  for (let i = 0; i < 30; i += 1) applyTrain(p, 0, 0)
  assert.equal(p.level, 2)
  assert.equal(p.power, 30, 'classic frisbee in the free lane: +1 per throw at levels 1-2')
})

test('rebirth needs max level, resets power, keeps wins and planes', () => {
  const p = createProfile('a', 'A')
  assert.equal(applyRebirth(p).ok, false)
  for (let i = 0; i < 10; i += 1) applyTrain(p, 0, 0)
  p.wins = 50
  assert.equal(applyRebirth(p).ok, true)
  assert.equal(p.rebirths, 1)
  assert.equal(p.power, 0)
  assert.equal(p.wins, 50)
})

test('locked lanes give nothing', () => {
  const p = createProfile('a', 'A')
  assert.equal(applyTrain(p, 1, 0).ok, false)
  assert.equal(p.power, 0)
})

test('planes are bought in order with wins', () => {
  const p = createProfile('a', 'A')
  p.wins = 1000
  assert.equal(buyPlane(p, PLANES[3].id).ok, false)
  assert.equal(buyPlane(p, PLANES[1].id).ok, true)
  assert.equal(p.wins, 1000 - PLANES[1].cost)
  assert.equal(p.equippedPlane, PLANES[1].id)
})

test('egg odds add up to 100% and hatching charges wins', () => {
  for (const [id, egg] of Object.entries(EGGS)) {
    assert.equal(egg.pets.reduce((s, [, w]) => s + w, 0), 100, id)
  }
  const p = createProfile('a', 'A')
  p.wins = EGGS.basic.cost.wins
  const r = hatchEgg(p, 'basic', 1, { rand: () => 0 })
  assert.equal(r.ok, true)
  assert.equal(p.wins, 0)
  assert.equal(p.pets[0].id, 'cat')
  assert.deepEqual(p.equippedPets, [p.pets[0].uid])
})

test('throws pay wins and never consume power', () => {
  const p = createProfile('a', 'A')
  p.power = 7300
  const r = applyThrow(p, 0)
  assert.equal(p.power, 7300)
  assert.ok(r.wins > 0 && p.wins === r.wins)
})

test('daily rewards unlock one per day', () => {
  const p = createProfile('a', 'A')
  const states = dailyStatus(p, 0).map((d) => d.state)
  assert.deepEqual(states.slice(0, 3), ['ready', 'next', 'locked'])
})

test('corrupt or old saves load safely', () => {
  const p = normalizeProfile({ pets: [{ uid: 1, id: 'nope' }], equippedPets: [1], ownedPlanes: [] }, 'x', 'X')
  assert.deepEqual(p.pets, [])
  assert.deepEqual(p.equippedPets, [])
  assert.deepEqual(p.ownedPlanes, ['paper'])
})

test('the session only trains where the player really stands', () => {
  const events = []
  const pos = { x: 0, y: 0, z: 0 }
  const s = new PlayerSession(createProfile('a', 'A'), { now: 0, emit: (t) => events.push(t), getPosition: () => pos })
  s.handle('enterLane', { lane: 0 }, 0)
  s.tick(2, 0)
  assert.equal(s.profile.power, 0, 'claimed a lane from spawn')
  Object.assign(pos, { x: (LANE_NEAR_X + LANE_FAR_X) / 2, z: laneCenterZ(0) })
  s.tick(2, 0)
  assert.ok(s.profile.power > 0)
})

test('planes can only be bought standing on their pad', () => {
  const pos = { x: 0, y: 0, z: 0 }
  const p = createProfile('a', 'A')
  p.wins = 100
  const s = new PlayerSession(p, { now: 0, emit: () => {}, getPosition: () => pos })
  s.handle('buyPlane', { id: 'sky' }, 0)
  assert.equal(p.ownedPlanes.length, 1)
  Object.assign(pos, { x: PLANE_PADS[1].x, z: PLANE_PADS[1].z })
  s.handle('buyPlane', { id: 'sky' }, 0)
  assert.equal(p.ownedPlanes.length, 2)
})

test('click throws train at x1, rate limited and not in the throw area', () => {
  const p = createProfile('a', 'A')
  const pos = { x: 0, z: 14 }
  const s = new PlayerSession(p, { now: 0, emit: () => {}, getPosition: () => pos })
  s.handle('click', {}, 1000)
  assert.equal(p.power, 1)
  assert.equal(p.levelProgress, 1)
  s.handle('click', {}, 1050)
  assert.equal(p.power, 1)
  s.handle('click', {}, 1200)
  assert.equal(p.power, 2)
  Object.assign(pos, { x: 0, z: -36 })
  s.handle('click', {}, 2000)
  assert.equal(p.power, 2)
})

test('only brand-new players get the tutorial', () => {
  const fresh = normalizeProfile({ rebirths: 0, tutorialStep: 1 }, 'a', 'A')
  assert.equal(fresh.tutorialStep, 1)
  // Past the rebirth, all that's left is buying a club - unless they already own one.
  const reborn = normalizeProfile({ rebirths: 1, level: 0, tutorialStep: 1 }, 'b', 'B')
  assert.equal(TUTORIAL[reborn.tutorialStep].event, 'buyPlane')
  const owner = normalizeProfile({ rebirths: 1, tutorialStep: 1, ownedPlanes: ['paper', 'sky'] }, 'c', 'C')
  assert.equal(owner.tutorialStep, TUTORIAL.length)
})

test('the guide runs hit, train, rebirth, buy a club, then ends', () => {
  assert.deepEqual(TUTORIAL.map((s) => s.event), ['throw', 'train', 'rebirth', 'buyPlane'])
  const p = createProfile('a', 'A')
  const s = new PlayerSession(p, { now: 0, emit: () => {}, getPosition: () => ({ x: 0, z: -36 }) })
  s.handle('throw', {}, 1000)
  assert.equal(p.tutorialStep, 1)
  s.tutorial('train')
  s.tutorial('hatch') // not a step any more
  assert.equal(p.tutorialStep, 2)
  s.tutorial('rebirth')
  assert.equal(p.tutorialStep, 3)
  s.tutorial('buyPlane')
  assert.equal(p.tutorialStep, TUTORIAL.length)
})

test('the shop sells for Wins only', () => {
  const p = createProfile('a', 'A')
  const s = new PlayerSession(p, { now: 0, emit: () => {}, getPosition: () => ({ x: 0, z: 0 }) })
  s.handle('purchase', { productId: 'power100k' }, 0)
  assert.equal(p.power, 0)
  p.wins = SHOP.power100k.price + 7
  s.handle('purchase', { productId: 'power100k' }, 0)
  assert.equal(p.power, 1e5)
  assert.equal(p.wins, 7)
  p.wins = SHOP.laneVeryOp.price
  s.handle('purchase', { productId: 'laneVeryOp' }, 0)
  assert.equal(p.passes.laneVeryOp, true)
  assert.equal(p.wins, 0)
})
