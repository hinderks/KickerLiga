import { describe, expect, it } from 'vitest'
import { expectedScore, replayLeague, type Match, type Player } from './elo'

let seq = 0
function match(overrides: Partial<Match> = {}): Match {
  seq += 1
  return {
    id: `m${String(seq).padStart(3, '0')}`,
    playedAt: new Date(Date.UTC(2026, 0, 1) + seq * 60_000).toISOString(),
    teamA: ['a'],
    teamB: ['b'],
    goalsA: 10,
    goalsB: 5,
    ...overrides,
  }
}

const ab: Player[] = [{ id: 'a' }, { id: 'b' }]
const abcd: Player[] = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }]

describe('expectedScore', () => {
  it('is 0.5 for equal ratings', () => {
    expect(expectedScore(1500, 1500)).toBe(0.5)
  })

  it('uses a scale of 400', () => {
    expect(expectedScore(1900, 1500)).toBeCloseTo(1 / 1.1, 10)
    expect(expectedScore(1500, 1900)).toBeCloseTo(1 / 11, 10)
  })

  it('is symmetric: both sides sum to 1', () => {
    expect(expectedScore(1623, 1488) + expectedScore(1488, 1623)).toBeCloseTo(1, 12)
  })
})

describe('replayLeague defaults', () => {
  it('starts players at 1500 and returns them without matches', () => {
    expect(replayLeague(ab, [])).toEqual({ ratings: { a: 1500, b: 1500 }, history: [] })
  })

  it('keeps given ratings', () => {
    const result = replayLeague([{ id: 'a', rating: 1700 }, { id: 'b' }], [])
    expect(result.ratings).toEqual({ a: 1700, b: 1500 })
  })
})

describe('singles results', () => {
  it('win between new equal players: +20 / -20', () => {
    const m = match()
    expect(replayLeague(ab, [m]).history).toEqual([
      { matchId: m.id, playerId: 'a', before: 1500, after: 1520 },
      { matchId: m.id, playerId: 'b', before: 1500, after: 1480 },
    ])
  })

  it('loss is scored 0 for team A', () => {
    const result = replayLeague(ab, [match({ goalsA: 3, goalsB: 10 })])
    expect(result.ratings).toEqual({ a: 1480, b: 1520 })
  })

  it('draw between equal players changes nothing', () => {
    const result = replayLeague(ab, [match({ goalsA: 7, goalsB: 7 })])
    expect(result.ratings).toEqual({ a: 1500, b: 1500 })
  })

  it('favourite winning gains little, rounded to integers', () => {
    // expected(1600 vs 1400) ≈ 0.7597 → 40 * 0.2403 ≈ 9.61 → 10
    const players = [{ id: 'a', rating: 1600 }, { id: 'b', rating: 1400 }]
    expect(replayLeague(players, [match()]).ratings).toEqual({ a: 1610, b: 1390 })
  })

  it('draw against a weaker player costs the favourite', () => {
    // 40 * (0.5 - 0.7597) ≈ -10.39 → -10
    const players = [{ id: 'a', rating: 1600 }, { id: 'b', rating: 1400 }]
    const result = replayLeague(players, [match({ goalsA: 4, goalsB: 4 })])
    expect(result.ratings).toEqual({ a: 1590, b: 1410 })
  })

  it('keeps ratings integral over many matches', () => {
    const matches = Array.from({ length: 30 }, (_, i) =>
      match({ goalsA: i % 3, goalsB: (i * 7) % 4, teamA: i % 2 ? ['a'] : ['b'], teamB: i % 2 ? ['b'] : ['a'] }),
    )
    const result = replayLeague([{ id: 'a', rating: 1537 }, { id: 'b', rating: 1411 }], matches)
    for (const entry of result.history) {
      expect(Number.isInteger(entry.after)).toBe(true)
    }
  })
})

describe('K factor', () => {
  it('is 32 for players with at least 5 matches', () => {
    const players = [{ id: 'a', matchesPlayed: 5 }, { id: 'b', matchesPlayed: 12 }]
    expect(replayLeague(players, [match()]).ratings).toEqual({ a: 1516, b: 1484 })
  })

  it('is chosen per player', () => {
    const players = [{ id: 'a', matchesPlayed: 4 }, { id: 'b', matchesPlayed: 5 }]
    expect(replayLeague(players, [match()]).ratings).toEqual({ a: 1520, b: 1484 })
  })

  it('switches from 40 to 32 after the fifth match in the replay', () => {
    // Draws between equal players change nothing, so only the K factor of
    // the final win matters.
    const draws = Array.from({ length: 5 }, () => match({ goalsA: 1, goalsB: 1 }))
    const four = replayLeague(ab, [...draws.slice(0, 4), match()])
    const five = replayLeague(ab, [...draws, match()])
    expect(four.ratings).toEqual({ a: 1520, b: 1480 })
    expect(five.ratings).toEqual({ a: 1516, b: 1484 })
  })

  it('counts matchesPlayed from the input on top of replayed matches', () => {
    const players = [{ id: 'a', matchesPlayed: 4 }, { id: 'b', matchesPlayed: 4 }]
    const result = replayLeague(players, [match({ goalsA: 2, goalsB: 2 }), match()])
    expect(result.ratings).toEqual({ a: 1516, b: 1484 })
  })
})

describe('doubles', () => {
  it('uses the mean team rating and updates all players from pre-match ratings', () => {
    const players = [
      { id: 'a', rating: 1600 },
      { id: 'b', rating: 1400 },
      { id: 'c' },
      { id: 'd' },
    ]
    const m = match({ teamA: ['a', 'b'], teamB: ['c', 'd'] })
    expect(replayLeague(players, [m]).history).toEqual([
      { matchId: m.id, playerId: 'a', before: 1600, after: 1620 },
      { matchId: m.id, playerId: 'b', before: 1400, after: 1420 },
      { matchId: m.id, playerId: 'c', before: 1500, after: 1480 },
      { matchId: m.id, playerId: 'd', before: 1500, after: 1480 },
    ])
  })

  it('applies individual K factors within a team', () => {
    const players = [{ id: 'a', matchesPlayed: 20 }, { id: 'b' }, { id: 'c' }, { id: 'd', matchesPlayed: 5 }]
    const m = match({ teamA: ['b', 'a'], teamB: ['d', 'c'], goalsA: 0, goalsB: 10 })
    const result = replayLeague(players, [m])
    expect(result.history.map((h) => h.playerId)).toEqual(['b', 'a', 'd', 'c'])
    expect(result.ratings).toEqual({ a: 1484, b: 1480, c: 1520, d: 1516 })
  })

  it('compares team means for the expectation', () => {
    // A: mean 1600, B: mean 1400 → same as the 1600 vs 1400 singles case
    const players = [
      { id: 'a', rating: 1700 },
      { id: 'b', rating: 1500 },
      { id: 'c', rating: 1300 },
      { id: 'd', rating: 1500 },
    ]
    const result = replayLeague(players, [match({ teamA: ['a', 'b'], teamB: ['c', 'd'] })])
    expect(result.ratings).toEqual({ a: 1710, b: 1510, c: 1290, d: 1490 })
  })
})

describe('ordering', () => {
  const players: Player[] = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
  const first: Match = { id: 'x1', playedAt: '2026-02-01T10:00:00Z', teamA: ['a'], teamB: ['b'], goalsA: 10, goalsB: 0 }
  const second: Match = { id: 'x2', playedAt: '2026-02-02T10:00:00Z', teamA: ['a'], teamB: ['c'], goalsA: 0, goalsB: 10 }

  it('processes matches by playedAt regardless of input order', () => {
    const sorted = replayLeague(players, [first, second])
    const reversed = replayLeague(players, [second, first])
    expect(reversed).toEqual(sorted)
    expect(sorted.history.map((h) => h.matchId)).toEqual(['x1', 'x1', 'x2', 'x2'])
    // a: 1500 → 1520, then loses against 1500 c: expected ≈ 0.5288 → -21
    expect(sorted.ratings).toEqual({ a: 1499, b: 1480, c: 1521 })
  })

  it('breaks playedAt ties by id ascending', () => {
    const t = '2026-03-01T12:00:00Z'
    const mB: Match = { ...first, id: 'b', playedAt: t }
    const mA: Match = { ...second, id: 'a', playedAt: t }
    const result = replayLeague(players, [mB, mA])
    expect(result.history.map((h) => h.matchId)).toEqual(['a', 'a', 'b', 'b'])
  })

  it('compares timestamps as instants, not strings', () => {
    // 10:00+02:00 is 08:00Z, i.e. before 09:00Z
    const early: Match = { ...second, id: 'z', playedAt: '2026-04-01T10:00:00+02:00' }
    const late: Match = { ...first, id: 'y', playedAt: '2026-04-01T09:00:00Z' }
    const result = replayLeague(players, [late, early])
    expect(result.history.map((h) => h.matchId)).toEqual(['z', 'z', 'y', 'y'])
  })
})

describe('immutability', () => {
  it('does not mutate players or matches', () => {
    const players: Player[] = [{ id: 'a', rating: 1550, matchesPlayed: 3 }, { id: 'b' }, { id: 'c' }, { id: 'd' }]
    const matches = [
      match({ teamA: ['a', 'b'], teamB: ['c', 'd'], playedAt: '2026-05-02T00:00:00Z' }),
      match({ playedAt: '2026-05-01T00:00:00Z' }),
    ]
    const playersCopy = structuredClone(players)
    const matchesCopy = structuredClone(matches)
    const deepFreeze = <T,>(items: T[]): T[] => Object.freeze(items.map((item) => Object.freeze(item))) as T[]
    replayLeague(deepFreeze(players), deepFreeze(matches))
    expect(players).toEqual(playersCopy)
    expect(matches).toEqual(matchesCopy)
  })
})

describe('validation', () => {
  it('rejects unknown player ids', () => {
    expect(() => replayLeague(ab, [match({ teamB: ['zz'] })])).toThrow(Error)
  })

  it('rejects a player appearing twice in one match', () => {
    expect(() => replayLeague(ab, [match({ teamB: ['a'] })])).toThrow(Error)
    expect(() => replayLeague(abcd, [match({ teamA: ['a', 'a'], teamB: ['c', 'd'] })])).toThrow(Error)
  })

  it('rejects empty teams', () => {
    expect(() => replayLeague(ab, [match({ teamA: [] })])).toThrow(Error)
    expect(() => replayLeague(ab, [match({ teamA: [], teamB: [] })])).toThrow(Error)
  })

  it('rejects teams of different size', () => {
    expect(() => replayLeague(abcd, [match({ teamA: ['a', 'b'], teamB: ['c'] })])).toThrow(Error)
  })

  it('rejects teams larger than doubles', () => {
    const six = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => ({ id }))
    expect(() => replayLeague(six, [match({ teamA: ['a', 'b', 'c'], teamB: ['d', 'e', 'f'] })])).toThrow(Error)
  })

  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])('rejects goals %s', (goals) => {
    expect(() => replayLeague(ab, [match({ goalsA: goals })])).toThrow(Error)
    expect(() => replayLeague(ab, [match({ goalsB: goals })])).toThrow(Error)
  })

  it('accepts zero goals', () => {
    expect(() => replayLeague(ab, [match({ goalsA: 0, goalsB: 0 })])).not.toThrow()
  })

  it('rejects duplicate match ids', () => {
    expect(() => replayLeague(ab, [match({ id: 'dup' }), match({ id: 'dup' })])).toThrow(Error)
  })

  it('rejects an invalid playedAt', () => {
    expect(() => replayLeague(ab, [match({ playedAt: 'yesterday' })])).toThrow(Error)
  })

  it('validates all matches before returning any result', () => {
    const late = match({ playedAt: '2030-01-01T00:00:00Z', teamB: ['nobody'] })
    expect(() => replayLeague(ab, [match(), late])).toThrow(Error)
  })
})
