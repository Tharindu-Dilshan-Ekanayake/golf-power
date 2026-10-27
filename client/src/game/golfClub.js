import { BoxGeometry, CylinderGeometry, SphereGeometry } from 'three'

import { PropBuilder } from './blocks'
import { STYLE } from './materials'

/**
 * The golf club, as held, in the hand's frame (see CLUB_GRIP / CLUB_TILT in
 * playerPose.js): the grip is at the origin, the shaft runs down -Y about 1.3 m, and
 * the driver head sits at its foot with its face towards +Z.
 *
 * Two merged props, so each can be drawn as instances through the shared toy shader:
 * `body` (grip, shaft, hosel) keeps its own colours - black rubber, chrome, gold - and
 * `head` is white where it should take the club's own colour, set per instance.
 */
export const CLUB_LENGTH = 1.3
/** From the hand (the grip offset included) to the bottom of the head's sole, metres. */
export const CLUB_SOLE = 1.445

export function createClubParts() {
  const body = new PropBuilder()
  // The grip: black rubber with pale ribs, a gold cap on the end and a gold ferrule.
  body.add(new CylinderGeometry(0.058, 0.05, 0.4, 10), { position: [0, -0.12, 0], color: '#16121e', style: STYLE.SMOOTH })
  for (const y of [-0.02, -0.1, -0.18, -0.26]) {
    body.add(new CylinderGeometry(0.06, 0.06, 0.014, 10), { position: [0, y, 0], color: '#5a5268', style: STYLE.SMOOTH })
  }
  body.add(new CylinderGeometry(0.064, 0.064, 0.04, 10), { position: [0, 0.095, 0], color: '#ffcf3a', style: STYLE.GLOW })
  body.add(new CylinderGeometry(0.034, 0.05, 0.05, 10), { position: [0, -0.345, 0], color: '#ffcf3a', style: STYLE.GLOW })
  // The shaft: chrome, tapering towards the head.
  body.add(new CylinderGeometry(0.032, 0.024, 0.84, 8), { position: [0, -0.79, 0], color: '#e4e8f2', style: STYLE.SMOOTH })
  // The hosel, angling into the head.
  body.add(new CylinderGeometry(0.03, 0.038, 0.1, 8), { position: [0, -1.24, 0.03], rotation: [0.25, 0, 0], color: '#c8ccd8', style: STYLE.SMOOTH })

  const head = new PropBuilder()
  // A big rounded driver head: the crown and sides in the club's colour, a dark sole and
  // a pale striking face, with a glowing stripe along the crown.
  // Lit from within a little, so the club's colour reads at night.
  head.add(new SphereGeometry(0.5, 16, 12), { position: [0, -1.3, 0.14], scale: [0.29, 0.2, 0.48], color: '#ffffff', style: STYLE.GLOW })
  head.add(new BoxGeometry(1, 1, 1), { position: [0, -1.385, 0.14], scale: [0.24, 0.04, 0.4], color: '#2a2434', style: STYLE.SMOOTH })
  head.add(new BoxGeometry(1, 1, 1), { position: [0, -1.3, 0.37], scale: [0.2, 0.14, 0.03], color: '#e8e6f0', style: STYLE.SMOOTH })
  for (const y of [-1.33, -1.3, -1.27]) {
    head.add(new BoxGeometry(1, 1, 1), { position: [0, y, 0.387], scale: [0.15, 0.008, 0.01], color: '#8a8698', style: STYLE.SMOOTH })
  }
  head.add(new BoxGeometry(1, 1, 1), { position: [0, -1.2, 0.1], scale: [0.05, 0.018, 0.34], color: '#ffffff', style: STYLE.GLOW })
  return { body: body.build(), head: head.build() }
}
