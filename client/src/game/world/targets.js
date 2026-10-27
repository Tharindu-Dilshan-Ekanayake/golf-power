import { Matrix4, OctahedronGeometry, SphereGeometry, TorusGeometry } from 'three'

import { LANE_COUNT, LANE_DIR, LANE_TARGET_X, laneCenterZ } from '@shared/world'

import { disc, star } from '../geometry'
import { STYLE } from '../materials'

/**
 * The goal at the end of each training bay, one design per bay as in the reference: a
 * pumpkin bullseye, slime ring, cobweb star, purple gem, gold wheel, lava hexagon, red
 * crystal, rainbow ring and galaxy portal, each in a net.
 *
 * All nine are merged into the props mesh, so they cost nothing extra to draw.
 */

/** Height of the board centre; the pedestal top is at 1.2. */
export const TARGET_Y = 3
/** Where training shots aim: the board face, which looks east down its lane. */
export const targetPoint = (lane) => [LANE_TARGET_X + LANE_DIR * 1.2, TARGET_Y - 0.6, laneCenterZ(lane)]

/**
 * Designs are written facing +Z at the origin (z = 0 is the board, FACE its front) and
 * turned to face east (+X) at their lane's end by buildTargets.
 */
const BOARD_Z = 0
const FACE = BOARD_Z - 1.55

/**
 * A football goal facing the lane: two posts and a crossbar in `frame`, lower back
 * posts, and a net over the back, sides and top in `color`. The nets are thin slabs in
 * the plate pattern (a lattice), so they read as netting. (The jack-o-lanterns on the
 * posts and the bulbs on the crossbar are blocks, see structures.js.)
 */
function board(props, x, color, frame, style = STYLE.STUDS) {
  const net = style === STYLE.GALAXY ? style : STYLE.PLATE
  const half = 1.9
  const top = TARGET_Y + 1.9
  const depth = 1.7
  const back = BOARD_Z - depth
  // Front frame.
  for (const side of [-1, 1]) {
    props.box(x + side * half, top / 2, BOARD_Z, 0.28, top, 0.28, frame, STYLE.SMOOTH)
    // Back posts, shorter, joined to the front by the roof bars.
    props.box(x + side * half, (top - 0.9) / 2, back, 0.2, top - 0.9, 0.2, frame, STYLE.SMOOTH)
    props.box(x + side * half, top - 0.45, BOARD_Z - depth / 2, 0.2, 0.2, depth, frame, STYLE.SMOOTH, [0.3, 0, 0])
    // Side net.
    props.box(x + side * half, (top - 0.4) / 2, BOARD_Z - depth / 2, 0.06, top - 0.5, depth, color, net)
  }
  props.box(x, top, BOARD_Z, half * 2 + 0.28, 0.28, 0.28, frame, STYLE.SMOOTH)
  props.box(x, top - 0.45, back, half * 2, 0.2, 0.2, frame, STYLE.SMOOTH)
  // Back net and roof net.
  props.box(x, (top - 0.4) / 2, back, half * 2, top - 0.5, 0.06, color, net)
  props.box(x, top - 0.25, BOARD_Z - depth / 2, half * 2, 0.06, depth, color, net, [0.3, 0, 0])
  // Post down to the pedestal.
  props.box(x, 0.9, back - 0.3, 0.6, 1.8, 0.4, frame, STYLE.SMOOTH)
}

function rings(props, x, list) {
  list.forEach(([radius, color, style = STYLE.SMOOTH], i) => {
    props.add(disc(radius, 0.08, 36), { position: [x, TARGET_Y, FACE + 0.06 + i * 0.03], color, style })
  })
}

const DESIGNS = [
  // 0: classic bullseye on a white board.
  (p, x) => {
    board(p, x, '#15110f', '#d62a1a')
    // The reference's target: an orange square on the net, with a ring on it.
    p.box(x, TARGET_Y + 0.2, FACE + 0.05, 0.95, 0.95, 0.06, '#ff9a3a', STYLE.SMOOTH)
    rings(p, x, [
      [0.38, '#ff5a14'],
      [0.28, '#ff9a3a'],
    ])
  },
  // 1: green ring.
  (p, x) => {
    board(p, x, '#0e2a14', '#7dff3a')
    rings(p, x, [
      [1.35, '#7dff3a', STYLE.GLOW],
      [1.05, '#178a2b'],
      [0.75, '#7dff3a', STYLE.GLOW],
      [0.42, '#0e5f1e'],
    ])
  },
  // 2: yellow star on blue.
  (p, x) => {
    board(p, x, '#111a26', '#e8e8f2')
    p.add(star(5, 1.38, 0.6, 0.3), { position: [x, TARGET_Y, FACE + 0.2], color: '#e8e8f2', style: STYLE.SMOOTH })
  },
  // 3: purple gem.
  (p, x) => {
    board(p, x, '#1c0e3a', '#ff5cc8')
    p.add(new OctahedronGeometry(1, 0), { position: [x, TARGET_Y, FACE + 0.2], scale: [0.95, 1.35, 0.45], color: '#b47cff', style: STYLE.GLOW })
    p.add(new OctahedronGeometry(1, 0), { position: [x, TARGET_Y + 0.15, FACE + 0.45], scale: [0.45, 0.65, 0.2], color: '#ead6ff' })
  },
  // 4: gold wheel.
  (p, x) => {
    board(p, x, '#2a0c14', '#ff2b2b')
    const z = FACE + 0.2
    p.add(new TorusGeometry(1.1, 0.2, 10, 28), { position: [x, TARGET_Y, z], color: '#ffd02a', style: STYLE.GLOW })
    p.add(disc(0.38, 0.3), { position: [x, TARGET_Y, z], color: '#fff07a' })
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * Math.PI * 2
      p.box(x + Math.cos(a) * 0.55, TARGET_Y + Math.sin(a) * 0.55, z, 0.95, 0.14, 0.14, '#ffd02a', STYLE.SMOOTH, [0, 0, a])
      p.box(x + Math.cos(a) * 1.35, TARGET_Y + Math.sin(a) * 1.35, z, 0.36, 0.3, 0.3, '#ffe25a', STYLE.SMOOTH, [0, 0, a])
    }
  },
  // 5: lava hexagon.
  (p, x) => {
    board(p, x, '#2b1609', '#ff8a1e')
    rings(p, x, [
      [1.42, '#ff7a14', STYLE.GLOW],
      [0.95, '#ffb347'],
      [0.5, '#ff6a00', STYLE.GLOW],
    ])
  },
  // 6: red crystal burst.
  (p, x) => {
    board(p, x, '#3a0810', '#ff3b3b')
    p.add(star(8, 1.45, 0.65, 0.3), { position: [x, TARGET_Y, FACE + 0.2], color: '#ff2a3a', style: STYLE.GLOW })
    p.add(new OctahedronGeometry(0.5, 0), { position: [x, TARGET_Y, FACE + 0.45], color: '#ffb3b3' })
  },
  // 7: rainbow ring, VERY OP!
  (p, x) => {
    p.box(x, 1.6, BOARD_Z, 0.5, 1.2, 0.5, '#ffffff')
    const hues = ['#ff3b5c', '#ff8a1f', '#ffe53b', '#4ef05a', '#2fc6ff', '#5a6cff', '#c35cff', '#ff4fd8']
    hues.forEach((color, i) => {
      const g = new TorusGeometry(1.45, 0.32, 8, 6, (Math.PI * 2) / hues.length + 0.02)
      p.add(g, { position: [x, TARGET_Y + 0.2, FACE], rotation: [0, 0, (i / hues.length) * Math.PI * 2], color, style: STYLE.GLOW })
    })
    p.add(disc(1.1, 0.06), { position: [x, TARGET_Y + 0.2, FACE - 0.05], color: '#ffffff', style: STYLE.GLOW })
  },
  // 8: galaxy portal, BEST OVERALL!
  (p, x) => {
    board(p, x, '#101650', '#7a5cff', STYLE.GALAXY)
    p.add(new SphereGeometry(0.75, 20, 14), { position: [x, TARGET_Y, FACE + 0.6], color: '#9a5cff', style: STYLE.GLOW })
    p.add(new TorusGeometry(1.25, 0.1, 6, 36), { position: [x, TARGET_Y, FACE + 0.6], rotation: [1.2, 0.35, 0], color: '#66e3ff', style: STYLE.GLOW })
  },
]

export function buildTargets(props) {
  const turn = new Matrix4()
  for (let i = 0; i < LANE_COUNT; i += 1) {
    // Turned so the goal's mouth looks back down the bay towards the plaza.
    props.transform = turn.makeRotationY((-LANE_DIR * Math.PI) / 2).setPosition(LANE_TARGET_X, 0, laneCenterZ(i))
    DESIGNS[i](props, 0)
  }
  props.transform = null
}
