import { describe, expect, it } from 'vitest'
import { expectedScore, K_FACTOR, ratingsAfterMatch } from './elo'

describe('expectedScore', () => {
  it('is 0.5 when ratings are equal', () => {
    expect(expectedScore(1000, 1000)).toBe(0.5)
  })

  it('is higher for the stronger player', () => {
    expect(expectedScore(1200, 1000)).toBeGreaterThan(0.5)
    expect(expectedScore(1000, 1200)).toBeLessThan(0.5)
  })
})

describe('ratingsAfterMatch', () => {
  it('moves K/2 points when equals play a decisive match', () => {
    const { ratingA, ratingB } = ratingsAfterMatch(1000, 1000, 10, 5)
    expect(ratingA).toBe(1000 + K_FACTOR / 2)
    expect(ratingB).toBe(1000 - K_FACTOR / 2)
  })

  it('does not change ratings on a draw between equals', () => {
    expect(ratingsAfterMatch(1000, 1000, 5, 5)).toEqual({
      ratingA: 1000,
      ratingB: 1000,
    })
  })

  it('rewards an underdog win more than a favourite win', () => {
    const upset = ratingsAfterMatch(1000, 1200, 10, 7)
    const favourite = ratingsAfterMatch(1200, 1000, 10, 7)
    expect(upset.ratingA - 1000).toBeGreaterThan(favourite.ratingA - 1200)
  })
})
