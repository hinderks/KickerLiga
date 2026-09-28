export const INITIAL_ELO = 1000
export const K_FACTOR = 32

export function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + 10 ** ((ratingB - ratingA) / 400))
}

export function actualScore(scoreA: number, scoreB: number): number {
  if (scoreA > scoreB) return 1
  if (scoreA < scoreB) return 0
  return 0.5
}

export function nextRating(rating: number, actual: number, expected: number): number {
  return Math.round(rating + K_FACTOR * (actual - expected))
}

export function ratingsAfterMatch(
  ratingA: number,
  ratingB: number,
  scoreA: number,
  scoreB: number,
): { ratingA: number; ratingB: number } {
  const expectedA = expectedScore(ratingA, ratingB)
  const actualA = actualScore(scoreA, scoreB)
  return {
    ratingA: nextRating(ratingA, actualA, expectedA),
    ratingB: nextRating(ratingB, 1 - actualA, 1 - expectedA),
  }
}
