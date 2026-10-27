/**
 * A full-screen fade through dark, for scene changes that would otherwise be a jump
 * cut (the camera flying back from the far end of the course). One plain DOM layer
 * over everything, animated by CSS; the change itself happens while the screen is dark.
 */
let layer = null

function getLayer() {
  if (!layer) {
    layer = document.createElement('div')
    Object.assign(layer.style, {
      position: 'fixed',
      inset: '0',
      background: 'radial-gradient(ellipse at center, #1a0d33 0%, #07040f 100%)',
      opacity: '0',
      pointerEvents: 'none',
      zIndex: '60',
    })
    document.body.appendChild(layer)
  }
  return layer
}

/** Fades to dark over `out` ms, runs `midway`, holds a moment, then fades back in. */
export function fadeThrough(midway, { out = 260, hold = 90, back = 380 } = {}) {
  const el = getLayer()
  el.style.transition = `opacity ${out}ms ease-in`
  el.style.opacity = '1'
  setTimeout(() => {
    midway()
    setTimeout(() => {
      el.style.transition = `opacity ${back}ms ease-out`
      el.style.opacity = '0'
    }, hold)
  }, out)
}
