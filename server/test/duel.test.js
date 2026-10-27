import assert from 'node:assert/strict'
import { test } from 'node:test'

import { DUEL_COUNTDOWN_MS, DUEL_REMATCH_MS, DUEL_RESULT_MS, DUEL_SWING_MS, DuelArena } from '../../shared/duel.js'
import { createProfile, duelShot, throwDistance } from '../../shared/logic.js'
import { DUEL_PADS } from '../../shared/world.js'

/** An arena with two players' Power, recording everything it says and does. */
function setup(power = { a: 0, b: 1e6 }) {
  const sent = []
  const held = {}
  const finished = []
  const profiles = { a: createProfile('a', 'Ann'), b: createProfile('b', 'Bob') }
  profiles.a.power = power.a
  profiles.b.power = power.b
  const arena = new DuelArena({
    send: (payload) => sent.push(payload),
    shoot: (sid, strike) => duelShot(profiles[sid], strike, () => 0.5),
    hold: (sid, until) => (held[sid] = until),
    finish: (winner, loser) => finished.push([winner, loser]),
  })
  const onPads = new Map([
    ['a', { x: DUEL_PADS[0].x, z: DUEL_PADS[0].z, name: 'Ann' }],
    ['b', { x: DUEL_PADS[1].x, z: DUEL_PADS[1].z, name: 'Bob' }],
  ])
  return { arena, sent, held, finished, onPads }
}

test('a duel needs a player on each ring', () => {
  const { arena, sent } = setup()
  arena.tick(0, new Map([['a', { x: DUEL_PADS[0].x, z: DUEL_PADS[0].z, name: 'Ann' }]]))
  assert.equal(arena.phase, 'idle')
  assert.equal(sent.length, 0)
})

test('the longer shot wins; the winner is rewarded and the duelists are held', () => {
  const { arena, sent, held, finished, onPads } = setup()
  arena.tick(0, onPads)
  assert.equal(arena.phase, 'ready')
  assert.deepEqual(sent[0].players.map((p) => p.sid), ['a', 'b'])
  // Hits before the swing phase don't count.
  arena.hit('a', 0.85, 100)
  assert.equal(sent.length, 1)
  arena.tick(DUEL_COUNTDOWN_MS, onPads)
  assert.equal(arena.phase, 'swing')
  assert.ok(held.a > DUEL_COUNTDOWN_MS)
  // A perfect swing with no Power loses to a weak one with lots.
  arena.hit('a', 0.85, DUEL_COUNTDOWN_MS + 500)
  arena.hit('a', 0.85, DUEL_COUNTDOWN_MS + 600)
  arena.hit('b', 0.1, DUEL_COUNTDOWN_MS + 900)
  const hits = sent.filter((m) => m.phase === 'hit')
  assert.equal(hits.length, 2)
  assert.equal(hits[0].distance, throwDistance(0))
  const result = sent.at(-1)
  assert.equal(result.phase, 'result')
  assert.equal(result.winner, 1)
  assert.deepEqual(finished, [['b', 'a']])
  arena.tick(DUEL_COUNTDOWN_MS + 900 + DUEL_RESULT_MS, onPads)
  assert.equal(arena.phase, 'idle')
  assert.equal(held.a, 0)
  // Still both on the rings: a rematch, with a longer count to step off in.
  arena.tick(DUEL_COUNTDOWN_MS + 1000 + DUEL_RESULT_MS, onPads)
  assert.equal(arena.phase, 'ready')
  assert.equal(sent.at(-1).rematch, true)
  assert.equal(sent.at(-1).ms, DUEL_REMATCH_MS)
})

test('stepping off during the countdown, or leaving, calls it off', () => {
  const { arena, sent, onPads } = setup()
  arena.tick(0, onPads)
  arena.tick(500, new Map([...onPads, ['b', { x: 0, z: 0, name: 'Bob' }]]))
  assert.equal(arena.phase, 'idle')
  assert.equal(sent.at(-1).phase, 'cancel')
  arena.tick(1000, onPads)
  arena.tick(1000 + DUEL_COUNTDOWN_MS, onPads)
  arena.leave('a')
  assert.equal(arena.phase, 'idle')
})

test('no swing in time counts as 0 m; nobody swinging is a draw', () => {
  const { arena, sent, finished, onPads } = setup({ a: 0, b: 0 })
  arena.tick(0, onPads)
  arena.tick(DUEL_COUNTDOWN_MS, onPads)
  arena.hit('a', 'cheat', DUEL_COUNTDOWN_MS + 10)
  arena.tick(DUEL_COUNTDOWN_MS + DUEL_SWING_MS, onPads)
  const result = sent.at(-1)
  assert.deepEqual(result.distances, [0, 0])
  assert.deepEqual(result.missed, [true, true])
  assert.equal(result.winner, -1)
  assert.equal(finished.length, 0)
})
