import type { Match, PlayerRecord } from './types'

export function recordFor(playerId: string, matches: Match[]): PlayerRecord {
  let wins = 0
  let losses = 0
  let draws = 0

  for (const match of matches) {
    const isP1 = match.player1_id === playerId
    const isP2 = match.player2_id === playerId
    if (!isP1 && !isP2) continue

    if (match.score1 === match.score2) {
      draws += 1
    } else if (
      (isP1 && match.score1 > match.score2) ||
      (isP2 && match.score2 > match.score1)
    ) {
      wins += 1
    } else {
      losses += 1
    }
  }

  return { wins, losses, draws, played: wins + losses + draws }
}

export function formatDelta(after: number, before: number): string {
  const delta = after - before
  if (delta > 0) return `+${delta}`
  if (delta < 0) return String(delta)
  return '0'
}
