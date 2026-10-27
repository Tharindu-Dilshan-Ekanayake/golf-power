import { formatDuration, formatNumber } from '@shared/format'

/** The three leaderboards: titles, colours and value formatting. */
export const BOARD_INFO = {
  rebirths: { title: 'Top Rebirths', color: '#ff4fa8', frame: '#d62a86', format: (v) => formatNumber(v) },
  playtime: { title: 'Top Playtime', color: '#59e04a', frame: '#2fa02a', format: (v) => formatDuration(v * 1000) },
  power: { title: 'Top Power', color: '#ffc21e', frame: '#d99a0c', format: (v) => formatNumber(v) },
}


/** Rows for a board: the server's top 10, or just you when offline. */
export function boardRows(leaderboards, profile, id) {
  if (leaderboards?.[id]?.length) return leaderboards[id]
  const value = id === 'rebirths' ? profile.rebirths : id === 'playtime' ? profile.stats.playtime : profile.stats.bestPower
  return [{ name: profile.name, value }]
}
