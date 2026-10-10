import { describe, expect, it } from 'vitest'
import { expectedScore, replayLeague, type Match, type Player } from './elo'

describe('expectedScore', () => {
  it('returns 0.5 for equal ratings', () => {
    expect(expectedScore(1500, 1500)).toBe(0.5)
  })

  it('returns > 0.5 when ratingA > ratingB', () => {
    expect(expectedScore(1600, 1400)).toBeGreaterThan(0.5)
  })

  it('returns < 0.5 when ratingA < ratingB', () => {
    expect(expectedScore(1400, 1600)).toBeLessThan(0.5)
  })

  it('sums to 1 for symmetric inputs', () => {
    const a = expectedScore(1600, 1400)
    const b = expectedScore(1400, 1600)
    expect(a + b).toBeCloseTo(1, 10)
  })

  it('uses scale of 400', () => {
    const score = expectedScore(1500, 1900)
    const expected = 1 / (1 + 10 ** ((1900 - 1500) / 400))
    expect(score).toBeCloseTo(expected, 10)
  })
})

describe('replayLeague', () => {
  const p = (id: string, rating?: number, matchesPlayed?: number): Player => ({
    id,
    rating,
    matchesPlayed,
  })

  const m = (
    id: string,
    playedAt: string,
    teamA: string[],
    teamB: string[],
    goalsA: number,
    goalsB: number,
  ): Match => ({ id, playedAt, teamA, teamB, goalsA, goalsB })

  describe('defaults', () => {
    it('starts unrated players at 1500', () => {
      const result = replayLeague([p('a'), p('b')], [m('1', '2024-01-01', ['a'], ['b'], 10, 0)])
      expect(result.history[0].before).toBe(1500)
    })

    it('treats missing matchesPlayed as 0', () => {
      const result = replayLeague([p('a'), p('b')], [m('1', '2024-01-01', ['a'], ['b'], 10, 0)])
      const aEntry = result.history.find((h) => h.playerId === 'a')!
      expect(aEntry.after - aEntry.before).toBe(Math.round(40 * (1 - 0.5)))
    })
  })

  describe('singles', () => {
    it('winner gains rating, loser loses same amount', () => {
      const result = replayLeague(
        [p('a'), p('b')],
        [m('1', '2024-01-01', ['a'], ['b'], 10, 0)],
      )
      const aEntry = result.history.find((h) => h.playerId === 'a')!
      const bEntry = result.history.find((h) => h.playerId === 'b')!
      expect(aEntry.before).toBe(1500)
      expect(bEntry.before).toBe(1500)
      expect(aEntry.after).toBe(1520)
      expect(bEntry.after).toBe(1480)
    })

    it('draw gives each player 0 change when ratings are equal', () => {
      const result = replayLeague(
        [p('a'), p('b')],
        [m('1', '2024-01-01', ['a'], ['b'], 5, 5)],
      )
      const aEntry = result.history.find((h) => h.playerId === 'a')!
      const bEntry = result.history.find((h) => h.playerId === 'b')!
      expect(aEntry.after).toBe(1500)
      expect(bEntry.after).toBe(1500)
    })

    it('loser gets score 0', () => {
      const result = replayLeague(
        [p('a'), p('b')],
        [m('1', '2024-01-01', ['a'], ['b'], 0, 10)],
      )
      const aEntry = result.history.find((h) => h.playerId === 'a')!
      expect(aEntry.after).toBeLessThan(aEntry.before)
    })
  })

  describe('doubles', () => {
    it('uses mean of team ratings', () => {
      const result = replayLeague(
        [p('a', 1600), p('b', 1400), p('c', 1500), p('d', 1500)],
        [m('1', '2024-01-01', ['a', 'b'], ['c', 'd'], 10, 0)],
      )
      const aEntry = result.history.find((h) => h.playerId === 'a')!
      expect(aEntry.before).toBe(1600)
      expect(aEntry.after).toBe(1620)
    })

    it('team rating is the mean of player ratings', () => {
      const result = replayLeague(
        [p('a', 1800), p('b', 1200), p('c', 1500), p('d', 1500)],
        [m('1', '2024-01-01', ['a', 'b'], ['c', 'd'], 10, 0)],
      )
      const aEntry = result.history.find((h) => h.playerId === 'a')!
      const cEntry = result.history.find((h) => h.playerId === 'c')!
      expect(aEntry.before).toBe(1800)
      expect(cEntry.before).toBe(1500)
      const teamA = (1800 + 1200) / 2
      const teamB = (1500 + 1500) / 2
      const expA = 1 / (1 + 10 ** ((teamB - teamA) / 400))
      expect(aEntry.after - aEntry.before).toBe(Math.round(40 * (1 - expA)))
      expect(cEntry.after - cEntry.before).toBe(Math.round(40 * (0 - (1 - expA))))
    })
  })

  describe('K factor', () => {
    it('uses K=40 for players with fewer than 5 matches', () => {
      const result = replayLeague(
        [p('a', 1500, 4), p('b', 1500, 4)],
        [m('1', '2024-01-01', ['a'], ['b'], 10, 0)],
      )
      const aEntry = result.history.find((h) => h.playerId === 'a')!
      expect(aEntry.after - aEntry.before).toBe(20)
    })

    it('uses K=32 for players with 5 or more matches', () => {
      const result = replayLeague(
        [p('a', 1500, 5), p('b', 1500, 5)],
        [m('1', '2024-01-01', ['a'], ['b'], 10, 0)],
      )
      const aEntry = result.history.find((h) => h.playerId === 'a')!
      expect(aEntry.after - aEntry.before).toBe(16)
    })

    it('switches from K=40 to K=32 after 5th match', () => {
      const players = [p('a', 1500, 4), p('b', 1500, 4)]
      const matches = [
        m('1', '2024-01-01', ['a'], ['b'], 10, 0),
        m('2', '2024-01-02', ['a'], ['b'], 10, 0),
      ]
      const result = replayLeague(players, matches)
      const aEntries = result.history.filter((h) => h.playerId === 'a')
      expect(aEntries[0].after - aEntries[0].before).toBe(20)
      const expA = expectedScore(aEntries[0].after, result.history[1].after)
      expect(aEntries[1].after - aEntries[1].before).toBe(Math.round(32 * (1 - expA)))
    })
  })

  describe('match ordering', () => {
    it('processes matches in playedAt order', () => {
      const players = [p('a'), p('b')]
      const matches = [
        m('2', '2024-01-02', ['a'], ['b'], 10, 0),
        m('1', '2024-01-01', ['a'], ['b'], 10, 0),
      ]
      const result = replayLeague(players, matches)
      expect(result.history[0].matchId).toBe('1')
      expect(result.history[1].matchId).toBe('1')
      expect(result.history[2].matchId).toBe('2')
      expect(result.history[3].matchId).toBe('2')
    })

    it('breaks ties in playedAt by id ascending', () => {
      const players = [p('a'), p('b')]
      const matches = [
        m('b', '2024-01-01', ['a'], ['b'], 10, 0),
        m('a', '2024-01-01', ['a'], ['b'], 10, 0),
      ]
      const result = replayLeague(players, matches)
      expect(result.history[0].matchId).toBe('a')
      expect(result.history[2].matchId).toBe('b')
    })
  })

  describe('history order', () => {
    it('lists teamA players first, then teamB players', () => {
      const result = replayLeague(
        [p('a'), p('b'), p('c'), p('d')],
        [m('1', '2024-01-01', ['a', 'b'], ['c', 'd'], 10, 0)],
      )
      expect(result.history.map((h) => h.playerId)).toEqual(['a', 'b', 'c', 'd'])
    })
  })

  describe('no mutation', () => {
    it('does not mutate input players', () => {
      const players = [p('a', 1500, 0), p('b', 1500, 0)]
      const playersCopy = JSON.parse(JSON.stringify(players))
      replayLeague(players, [m('1', '2024-01-01', ['a'], ['b'], 10, 0)])
      expect(players).toEqual(playersCopy)
    })

    it('does not mutate input matches', () => {
      const matches = [m('1', '2024-01-01', ['a'], ['b'], 10, 0)]
      const matchesCopy = JSON.parse(JSON.stringify(matches))
      replayLeague([p('a'), p('b')], matches)
      expect(matches).toEqual(matchesCopy)
    })
  })

  describe('validation', () => {
    it('throws for unknown player id', () => {
      expect(() =>
        replayLeague([p('a')], [m('1', '2024-01-01', ['a'], ['x'], 10, 0)]),
      ).toThrow(/Unknown player/)
    })

    it('throws for player appearing twice in one match', () => {
      expect(() =>
        replayLeague(
          [p('a'), p('b'), p('c')],
          [m('1', '2024-01-01', ['a', 'a'], ['b', 'c'], 10, 0)],
        ),
      ).toThrow(/appears twice/)
    })

    it('throws for empty team', () => {
      expect(() =>
        replayLeague([p('a'), p('b')], [m('1', '2024-01-01', [], ['b'], 10, 0)]),
      ).toThrow(/Empty team/)
    })

    it('throws for teams of different size', () => {
      expect(() =>
        replayLeague(
          [p('a'), p('b'), p('c')],
          [m('1', '2024-01-01', ['a'], ['b', 'c'], 10, 0)],
        ),
      ).toThrow(/different size/)
    })

    it('throws for negative goals', () => {
      expect(() =>
        replayLeague([p('a'), p('b')], [m('1', '2024-01-01', ['a'], ['b'], -1, 0)]),
      ).toThrow(/Invalid goals/)
    })

    it('throws for non-integer goals', () => {
      expect(() =>
        replayLeague([p('a'), p('b')], [m('1', '2024-01-01', ['a'], ['b'], 1.5, 0)]),
      ).toThrow(/Invalid goals/)
    })

    it('throws for duplicate match ids', () => {
      expect(() =>
        replayLeague(
          [p('a'), p('b')],
          [
            m('1', '2024-01-01', ['a'], ['b'], 10, 0),
            m('1', '2024-01-02', ['a'], ['b'], 10, 0),
          ],
        ),
      ).toThrow(/Duplicate match/)
    })
  })

  describe('ratings output', () => {
    it('returns final ratings for all players', () => {
      const result = replayLeague(
        [p('a'), p('b'), p('c')],
        [m('1', '2024-01-01', ['a'], ['b'], 10, 0)],
      )
      expect(result.ratings.a).toBe(1520)
      expect(result.ratings.b).toBe(1480)
      expect(result.ratings.c).toBe(1500)
    })

    it('ratings are integers', () => {
      const result = replayLeague(
        [p('a', 1503), p('b', 1497)],
        [m('1', '2024-01-01', ['a'], ['b'], 10, 0)],
      )
      expect(Number.isInteger(result.ratings.a)).toBe(true)
      expect(Number.isInteger(result.ratings.b)).toBe(true)
    })
  })

  describe('multiple matches accumulate', () => {
    it('second match uses updated ratings from first', () => {
      const players = [p('a'), p('b')]
      const matches = [
        m('1', '2024-01-01', ['a'], ['b'], 10, 0),
        m('2', '2024-01-02', ['a'], ['b'], 10, 0),
      ]
      const result = replayLeague(players, matches)
      const aEntries = result.history.filter((h) => h.playerId === 'a')
      expect(aEntries[0].before).toBe(1500)
      expect(aEntries[0].after).toBe(1520)
      expect(aEntries[1].before).toBe(1520)
    })
  })

  describe('empty match list', () => {
    it('returns initial ratings and empty history', () => {
      const result = replayLeague([p('a', 1600), p('b', 1400)], [])
      expect(result.ratings).toEqual({ a: 1600, b: 1400 })
      expect(result.history).toEqual([])
    })
  })

  describe('player with custom initial rating', () => {
    it('uses provided rating instead of default', () => {
      const result = replayLeague(
        [p('a', 1800), p('b', 1200)],
        [m('1', '2024-01-01', ['a'], ['b'], 10, 0)],
      )
      const aEntry = result.history.find((h) => h.playerId === 'a')!
      expect(aEntry.before).toBe(1800)
    })
  })

  describe('player appearing in different teams across matches', () => {
    it('handles player on different sides correctly', () => {
      const players = [p('a'), p('b'), p('c'), p('d')]
      const matches = [
        m('1', '2024-01-01', ['a', 'b'], ['c', 'd'], 10, 0),
        m('2', '2024-01-02', ['a', 'c'], ['b', 'd'], 10, 0),
      ]
      const result = replayLeague(players, matches)
      expect(result.history.length).toBe(8)
      expect(result.ratings.a).toBeGreaterThan(1500)
    })
  })
})
