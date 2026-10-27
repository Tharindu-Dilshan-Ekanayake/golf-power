import { CylinderGeometry } from 'three'

import { DUEL_PADS, STAGE } from '@shared/world'

import { STYLE } from '../materials'

const DISC = new CylinderGeometry(1, 1, 1, 28)

/**
 * The Hit Zone, as in the reference: no stage, just a long flat strip of dark maroon
 * brick along the lobby's north edge with "HIT ZONE" painted across it (see
 * throwArea.js), open to the course on its north edge (an invisible barrier stops
 * players walking off), and the two 1v1 duel rings (blue and red) at its east end.
 *
 * Boxes go into the world's block set and the rings into its props, so it adds no draw
 * calls.
 *
 * No two faces here share a plane: every layer stands a clear step proud of what it
 * sits on (flush faces flicker, worst on phones' coarser depth buffers).
 */
export function buildStage(blocks, props) {
  const { minX, maxX, minZ, maxZ } = STAGE
  const width = maxX - minX
  const depth = maxZ - minZ
  const cx = (minX + maxX) / 2
  const cz = (minZ + maxZ) / 2

  // The strip: dark brick running along the whole edge between the candy shop and the
  // bays, with a lighter border where it meets the plaza.
  blocks.addOn(cx, 0, cz, width, STAGE.height, depth, '#5a2630', STYLE.STUDS)
  blocks.addOn(cx, 0, maxZ + 0.35, width, STAGE.height + 0.02, 0.7, '#7a4a52', STYLE.STUDS)

  // The duel rings: a coloured disc with a dark centre, so each reads as a ring.
  for (const pad of DUEL_PADS) {
    props.add(DISC, { position: [pad.x, 0.1, pad.z], scale: [1.7, 0.04, 1.2], color: pad.color, style: STYLE.GLOW })
    props.add(DISC, { position: [pad.x, 0.13, pad.z], scale: [1.35, 0.04, 0.95], color: '#5a2630', style: STYLE.STUDS })
  }
}
