import { FRISBEE_STYLES } from '../game/frisbee'

/**
 * A pumpkin ball skin as a picture: a lobed body in the skin's colour, a stem, and the
 * carved face glowing in its accent colour, haloed in its glow. `skinId` is a ball style
 * id (`skin_ghost`, or a club's id); anything unknown draws the classic orange.
 *
 * @param {{ skinId: string, size: string|number, style?: object }} props
 */
export function SkinIcon({ skinId, size, style }) {
  const look = FRISBEE_STYLES[skinId] || FRISBEE_STYLES.paper
  return (
    <svg
      viewBox="0 0 100 100"
      className="pointer-events-none select-none"
      style={{ width: size, height: size, filter: `drop-shadow(0 0 5px ${look.glow})`, ...style }}
      aria-hidden="true"
    >
      <rect x="45" y="8" width="11" height="16" rx="3" fill="#3f8a22" stroke="#111" strokeWidth="3" />
      <ellipse cx="50" cy="58" rx="42" ry="35" fill={look.color} stroke="#111" strokeWidth="4" />
      {/* The ribs. */}
      <path d="M50 24 Q30 58 50 93 M50 24 Q70 58 50 93 M50 24 Q12 58 30 87 M50 24 Q88 58 70 87" fill="none" stroke="#000" strokeOpacity="0.28" strokeWidth="3" />
      {/* The face: slanted eyes, a nose and a toothy grin, glowing. */}
      <g fill={look.accent} stroke="#111" strokeWidth="1.5" strokeLinejoin="round">
        <path d="M22 50 L40 46 L36 58 Z" />
        <path d="M78 50 L60 46 L64 58 Z" />
        <path d="M46 62 L54 62 L50 69 Z" />
        <path d="M24 72 Q50 88 76 72 L70 76 L64 73 L58 80 L50 74 L42 80 L36 73 L30 76 Z" />
      </g>
      <ellipse cx="32" cy="38" rx="10" ry="5" fill="#fff" fillOpacity="0.28" transform="rotate(-20 32 38)" />
    </svg>
  )
}

export default SkinIcon
