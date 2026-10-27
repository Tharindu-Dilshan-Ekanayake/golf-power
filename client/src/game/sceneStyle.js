/**
 * The scene's whole look in one place: a Halloween night on a toy-brick island. Deep
 * violet sky with a huge pale moon, a cyan sea all round, maroon brick cliffs with dark
 * green grass caps, and a mauve studded plaza dotted with grass patches.
 *
 * Colours are sRGB hex, exactly as you would pick them in an image editor.
 *
 * Light intensities are three.js physical units: a light of intensity PI (~3.14)
 * lights a surface facing it to its full texture colour. The hemisphere fill plus the
 * moon add up to a little over that on the ground, which keeps the night saturated
 * rather than murky; shadowed ground only gets the fill.
 */

export const SKY = {
  /** Straight up. */
  top: '#4f17bd',
  /** At eye level. Fog uses the same colour so distant ground melts into the haze. */
  horizon: '#8a4ae0',
  /** Lower = the deep violet reaches further down towards the horizon. */
  exponent: 0.42,
  /** Distant mountain silhouettes along the horizon. */
  mountains: '#4a2796',
  /** The sea, below the horizon. */
  sea: '#1a62c8',
  /** Direction of the moon (the camera looks down -Z, so it hangs upper right). */
  moonDirection: [0.55, 0.4, -0.73],
  /** The moon's angular radius in radians. */
  moonRadius: 0.12,
}

/**
 * How far the course lies below the lobby. The lobby is a high plateau; its front edge
 * (the Hit Zone) is a cliff, and the course runs along the beach far below it, as in the
 * reference. The sea is at the course's level.
 */
export const COURSE_DROP = 14

export const FOG = {
  color: SKY.horizon,
}

export const CLOUDS = {
  /** Moonlit tops. */
  top: '#c3a6f5',
  /** Undersides, a deep violet. */
  bottom: '#7a4ed0',
}

/** Every surface colour in the lobby. */
export const PALETTE = {
  plaza: '#9a889e',
  plazaAlt: '#8a788f',
  path: '#c97a2c',
  pathEdge: '#5e4a66',
  apron: '#3aa82c',
  apronEdge: '#3a2a55',
  shopFloor: '#3f8a28',
  lawn: '#3f9a2a',
  sidewalk: '#8b7a96',
  dirt: '#8c3a34',
  trunk: '#171220',
  leaves: ['#1a1230', '#241a3d', '#150f26'],
  white: '#f4efe9',
  water: '#10b4ff',
  /** Pumpkins, stalls and lanterns. */
  pumpkin: '#ff7a14',
  pumpkinDark: '#e0560c',
  stem: '#3f8a22',
  candy: '#ffa51c',
  glow: '#ffd21f',
  purple: '#7b2fd6',
  slime: '#7dff3a',
}

export const LIGHTS = {
  /** Fill from above (moonlit sky) and below (bounce off the mauve cobbles). */
  hemiSky: '#a58cea',
  hemiGround: '#5e4280',
  hemiIntensity: 1.55,

  sunColor: '#cfc0ff',
  sunIntensity: 1.0,
  /**
   * Direction *towards* the moon light: high and a little to the left, behind the default
   * camera, so the side of the character you look at is lit and its shadow falls
   * beside it where you can see it, not hidden behind its back.
   */
  sunDirection: [-0.35, 0.9, 0.25],
  /** 1 = shadows get no sunlight at all; lower = lighter shadows. */
  shadowIntensity: 0.7,
  /** Blur radius of shadow edges, in shadow-map texels. */
  shadowSoftness: 3,
}
