import { PORTAL } from '@shared/world'

import { STYLE } from '../materials'

/** The doorway's opening: its height, and the height of its middle. */
export const PORTAL_HEIGHT = 7
export const PORTAL_CENTER_Y = 0.4 + PORTAL_HEIGHT / 2

const FRAME = '#1c1636'
const TRIM = '#3a2a6a'
const BONE = '#f4efe9'

/**
 * The World 2 gate, as in the reference: a dark gothic doorway on the back wall with a
 * pointed crown, a skull and crossbones over it, glowing purple trim and candles at its
 * feet. The swirl inside is Portal.jsx.
 */
export function buildPortalFrame(blocks) {
  const { x, z } = PORTAL
  const half = PORTAL.radius - 0.4
  const top = 0.4 + PORTAL_HEIGHT
  blocks.addOn(x, 0, z, half * 2 + 3.4, 0.4, 2.6, FRAME, STYLE.STUDS)
  for (const side of [-1, 1]) {
    blocks.addOn(x + side * (half + 0.7), 0.4, z, 1.4, PORTAL_HEIGHT + 0.6, 1.6, FRAME, STYLE.STUDS)
    blocks.addOn(x + side * (half + 0.05), 0.4, z - 0.82, 0.14, PORTAL_HEIGHT, 0.1, '#b15cff', STYLE.GLOW)
    // Little spires on the corners.
    blocks.addOn(x + side * (half + 0.7), top + 0.6, z, 0.8, 1.4, 0.8, TRIM, STYLE.SMOOTH)
    blocks.addOn(x + side * (half + 0.7), top + 2, z, 0.4, 0.8, 0.4, TRIM, STYLE.SMOOTH)
    // Candles at the foot.
    blocks.addOn(x + side * (half + 2), 0, z - 0.8, 0.45, 1.2, 0.45, BONE, STYLE.SMOOTH)
    blocks.addOn(x + side * (half + 2), 1.2, z - 0.8, 0.3, 0.4, 0.3, '#b15cff', STYLE.GLOW)
  }
  // The pointed crown over the opening, in steps.
  for (let i = 0; i < 4; i += 1) {
    blocks.addOn(x, top + i * 0.7, z, half * 2 + 1.4 - i * 1.7, 0.7, 1.5, i % 2 ? TRIM : FRAME, STYLE.SMOOTH)
  }
  blocks.addOn(x, top, z - 0.8, half * 2, 0.14, 0.1, '#b15cff', STYLE.GLOW)
  // Skull and crossbones on the crown's face.
  const sy = top + 1.3
  blocks.addOn(x, sy, z - 0.9, 1.7, 1.5, 0.5, BONE, STYLE.SMOOTH)
  blocks.addOn(x, sy - 0.4, z - 0.9, 1.1, 0.5, 0.5, BONE, STYLE.SMOOTH)
  for (const side of [-1, 1]) {
    blocks.add(x + side * 0.4, sy + 0.85, z - 1.17, 0.42, 0.42, 0.06, '#b15cff', STYLE.GLOW)
    blocks.add(x, sy + 0.4, z - 0.75, 3.4, 0.36, 0.3, BONE, STYLE.SMOOTH, 0, 0, side * 0.6)
  }
}
