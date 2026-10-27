/** The live label batch, for systems that relabel things (pads, stock counters). */
let activeBatch = null
/** Updates (and shows/hides) requested before the batch finished building, applied once it has. */
const pending = new Map()
const pendingFades = new Map()

export function setActiveLabelBatch(batch) {
  activeBatch = batch
  if (!batch) return
  for (const [id, spec] of pending) batch.update(id, spec)
  for (const [id, shown] of pendingFades) batch.setFade(id, shown ? null : 0.001)
  pending.clear()
  pendingFades.clear()
}

export function getActiveLabelBatch() {
  return activeBatch
}

/** Hides or shows one world label (now, or as soon as the labels have built). */
export function showWorldLabel(id, shown) {
  if (activeBatch) activeBatch.setFade(id, shown ? null : 0.001)
  else pendingFades.set(id, shown)
}

/** Redraws one world label (now, or as soon as the labels have built). */
export function updateWorldLabel(id, spec) {
  if (activeBatch) activeBatch.update(id, spec)
  else pending.set(id, spec)
}
