// Eval check win-rate: winRate in src/lib/stats.ts.
import { describe, expect, it } from 'vitest'
import * as stats from '../../src/lib/stats'

describe('eval win-rate', () => {
  it('winRate: (wins + draws / 2) / played, three decimals, 0 without matches', () => {
    const winRate = (stats as Record<string, unknown>).winRate as (r: object) => number
    expect(typeof winRate, 'winRate exported from src/lib/stats.ts').toBe('function')
    expect(winRate({ wins: 0, losses: 0, draws: 0, played: 0 })).toBe(0)
    expect(winRate({ wins: 3, losses: 1, draws: 0, played: 4 })).toBe(0.75)
    expect(winRate({ wins: 1, losses: 1, draws: 1, played: 3 })).toBe(0.5)
    expect(winRate({ wins: 2, losses: 3, draws: 2, played: 7 })).toBe(0.429)
    expect(winRate({ wins: 0, losses: 2, draws: 1, played: 3 })).toBe(0.167)
  })
})
