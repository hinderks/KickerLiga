// Hidden acceptance test for the Session 3 demo "One task, three models".
// Copy this file into src/lib/__acceptance__/ ONLY AFTER the agent has finished.
// The agent never sees it, like a held-out benchmark task.
// Run: npx vitest run src/lib/__acceptance__
import { describe, expect, it } from 'vitest';
import { expectedScore, replayLeague, type Match, type Player } from '../elo';

const at = (day: number) => `2026-10-${String(day).padStart(2, '0')}T18:00:00Z`;
const m = (id: string, day: number, teamA: string[], teamB: string[], goalsA: number, goalsB: number): Match => ({
  id, playedAt: at(day), teamA, teamB, goalsA, goalsB,
});
const vet = (id: string, rating = 1500): Player => ({ id, rating, matchesPlayed: 10 });

describe('expectedScore', () => {
  it('is 0.5 for equal ratings', () => {
    expect(expectedScore(1500, 1500)).toBeCloseTo(0.5, 10);
  });
  it('matches the Elo formula for a 200 point gap', () => {
    expect(expectedScore(1600, 1400)).toBeCloseTo(0.7597, 4);
  });
  it('is symmetric: both sides sum to 1', () => {
    expect(expectedScore(1712, 1388) + expectedScore(1388, 1712)).toBeCloseTo(1, 10);
  });
});

describe('replayLeague, single matches', () => {
  it('A1 new players start at 1500 and use K = 40', () => {
    const r = replayLeague([{ id: 'a' }, { id: 'b' }], [m('m1', 1, ['a'], ['b'], 10, 4)]);
    expect(r.ratings).toEqual({ a: 1520, b: 1480 });
  });
  it('A2 established players use K = 32, favourite wins', () => {
    const r = replayLeague([vet('a', 1600), vet('b', 1400)], [m('m1', 1, ['a'], ['b'], 10, 7)]);
    expect(r.ratings).toEqual({ a: 1608, b: 1392 });
  });
  it('A3 upset: the underdog gains more', () => {
    const r = replayLeague([vet('a', 1400), vet('b', 1600)], [m('m1', 1, ['a'], ['b'], 10, 8)]);
    expect(r.ratings).toEqual({ a: 1424, b: 1576 });
  });
  it('A4 draw between unequal players moves both towards each other', () => {
    const r = replayLeague([vet('a', 1600), vet('b', 1400)], [m('m1', 1, ['a'], ['b'], 5, 5)]);
    expect(r.ratings).toEqual({ a: 1592, b: 1408 });
  });
});

describe('replayLeague, doubles and provisional K', () => {
  it('B1 2v2 uses the mean team rating; each player has their own K', () => {
    const players: Player[] = [
      vet('a1', 1600), vet('a2', 1400), vet('b1', 1500), { id: 'b2', rating: 1500, matchesPlayed: 2 },
    ];
    const r = replayLeague(players, [m('m1', 1, ['a1', 'a2'], ['b1', 'b2'], 10, 6)]);
    expect(r.ratings).toEqual({ a1: 1616, a2: 1416, b1: 1484, b2: 1480 });
  });
  it('B2 K drops from 40 to 32 after the fifth match', () => {
    const players: Player[] = [{ id: 'p', rating: 1500, matchesPlayed: 4 }, vet('q')];
    const r = replayLeague(players, [m('m1', 1, ['p'], ['q'], 10, 3), m('m2', 2, ['p'], ['q'], 10, 9)]);
    expect(r.ratings).toEqual({ p: 1534, q: 1470 });
  });
});

describe('replayLeague, ordering', () => {
  it('C1 processes matches by playedAt, not by array order', () => {
    const players: Player[] = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const later = m('m-late', 2, ['a'], ['c'], 10, 2);
    const earlier = m('m-early', 1, ['b'], ['a'], 10, 7);
    const r = replayLeague(players, [later, earlier]);
    expect(r.ratings).toEqual({ a: 1501, b: 1520, c: 1479 });
  });
  it('C2 breaks ties in playedAt by match id', () => {
    const players = [vet('x'), vet('y')];
    const r = replayLeague(players, [m('m-b', 1, ['y'], ['x'], 10, 0), m('m-a', 1, ['x'], ['y'], 10, 0)]);
    expect(r.ratings).toEqual({ x: 1499, y: 1501 });
  });
});

describe('replayLeague, history and purity', () => {
  it('D1 writes one history entry per player and match, team A first', () => {
    const players = [vet('a1', 1600), vet('a2', 1400), vet('b1'), vet('b2')];
    const r = replayLeague(players, [m('m1', 1, ['a1', 'a2'], ['b1', 'b2'], 10, 6)]);
    expect(r.history).toEqual([
      { matchId: 'm1', playerId: 'a1', before: 1600, after: 1616 },
      { matchId: 'm1', playerId: 'a2', before: 1400, after: 1416 },
      { matchId: 'm1', playerId: 'b1', before: 1500, after: 1484 },
      { matchId: 'm1', playerId: 'b2', before: 1500, after: 1484 },
    ]);
  });
  it('D2 does not mutate its inputs', () => {
    const players = [vet('a', 1600), vet('b', 1400)];
    const matches = [m('m2', 2, ['a'], ['b'], 1, 10), m('m1', 1, ['a'], ['b'], 10, 1)];
    const before = JSON.stringify({ players, matches });
    replayLeague(players, matches);
    expect(JSON.stringify({ players, matches })).toBe(before);
  });
});

describe('replayLeague, validation', () => {
  const two = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  it('E1 rejects an unknown player', () => {
    expect(() => replayLeague(two, [m('m1', 1, ['a'], ['zz'], 10, 0)])).toThrow();
  });
  it('E2 rejects a player on both teams', () => {
    expect(() => replayLeague(two, [m('m1', 1, ['a', 'b'], ['a', 'c'], 10, 0)])).toThrow();
  });
  it('E3 rejects teams of unequal size', () => {
    expect(() => replayLeague(two, [m('m1', 1, ['a'], ['b', 'c'], 10, 0)])).toThrow();
  });
  it('E4 rejects negative or fractional goals', () => {
    expect(() => replayLeague(two, [m('m1', 1, ['a'], ['b'], -1, 0)])).toThrow();
    expect(() => replayLeague(two, [m('m1', 1, ['a'], ['b'], 2.5, 0)])).toThrow();
  });
  it('E5 rejects duplicate match ids', () => {
    expect(() =>
      replayLeague(two, [m('m1', 1, ['a'], ['b'], 10, 0), m('m1', 2, ['a'], ['b'], 10, 0)]),
    ).toThrow();
  });
});
