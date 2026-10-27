import { Color, Vector3 } from 'three'

import { SKY } from './sceneStyle'

/**
 * Sky shader uniforms, module-level so other systems (the flight's zone tint, the Moon
 * Realm going dark) can retint the sky without React: they write `.value` and the next
 * frame shows it.
 */
export const skyUniforms = {
  topColor: { value: new Color(SKY.top) },
  horizonColor: { value: new Color(SKY.horizon) },
  exponent: { value: SKY.exponent },
  mountainColor: { value: new Color(SKY.mountains) },
  seaColor: { value: new Color(SKY.sea) },
  moonDirection: { value: new Vector3(...SKY.moonDirection).normalize() },
  moonRadius: { value: SKY.moonRadius },
}
