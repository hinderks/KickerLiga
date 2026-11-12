// Acceptance tests for specs/tournament-mode.md, AC1 to AC10.
// They run against the demo database (.env.demo), never the course database.
// These tests decide when the task is done. Do not change them.

import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import * as api from '../../src/lib/api'
import { createPlayer, db, getPlayer, openSeasons, runId, type Player } from './support'
import {
  at,
  countTournaments,
  createTournamentIds,
  createTournamentRpc,
  entriesOf,
  leagueMatch,
  leagueMatchCount,
  matchesOf,
  playRpc,
  tournamentById,
  type TMatch,
  type Tournament,
} from './tournament-support'

// The bracket helper may not exist yet. A variable specifier keeps the
// type check of the test file independent of it.
const BRACKET_MODULE = '../../src/lib/bracket'

describe('tournament mode (specs/tournament-mode.md)', () => {
  // Eight players with known seeds: elo first, then name (tieA before tieB).
  type Eight = {
    tournament: Tournament
    seeds: Player[] // seeds[1] is seed 1, index 0 unused
    leagueBefore: number
    openSeasonId: string
  }
  let eight: Promise<Eight> | undefined
  const eightPlayers = () => (eight ??= createEight())

  async function createEight(): Promise<Eight> {
    const open = await openSeasons()
    if (open.length !== 1) throw new Error(`expected exactly one open season, found ${open.length}`)
    const s1 = await createPlayer('t8-s1', 1900)
    const s2 = await createPlayer('t8-s2', 1800)
    const s3 = await createPlayer('t8-s3', 1700)
    const tieA = await createPlayer('t8-tie-a', 1650)
    const tieB = await createPlayer('t8-tie-b', 1650)
    const s6 = await createPlayer('t8-s6', 1500)
    const s7 = await createPlayer('t8-s7', 1400)
    const s8 = await createPlayer('t8-s8', 1300)
    const seeds = [s1, s1, s2, s3, tieA, tieB, s6, s7, s8]
    const leagueBefore = await leagueMatchCount(seeds.slice(1))
    // Deliberately not in seed order.
    const tournament = await createTournamentRpc(`AT ${runId} eight`, [s7, tieB, s1, s8, s3, tieA, s6, s2])
    return { tournament, seeds, leagueBefore, openSeasonId: open[0].id }
  }

  // Plays the whole eight-player bracket, checking the state after each round.
  type Played = {
    afterRound1: TMatch[]
    afterRound2: TMatch[]
    beforeFinal: Tournament
    final: Tournament
    firstPlayed: TMatch
    firstEloBefore: [number, number]
  }
  let played: Promise<Played> | undefined
  const playAll = () => (played ??= playEight())

  async function playEight(): Promise<Played> {
    const { tournament, seeds } = await eightPlayers()
    const id = tournament.id
    let matches = await matchesOf(id)

    const firstEloBefore: [number, number] = [
      (await getPlayer(seeds[1].id)).elo,
      (await getPlayer(seeds[8].id)).elo,
    ]
    const firstPlayed = await playRpc(at(matches, 1, 1).id, 10, 4) // seed 1 beats seed 8
    await playRpc(at(matches, 1, 2).id, 3, 10) // seed 5 beats seed 4 (player2 wins)
    await playRpc(at(matches, 1, 3).id, 10, 6) // seed 2 beats seed 7
    await playRpc(at(matches, 1, 4).id, 10, 8) // seed 3 beats seed 6
    const afterRound1 = await matchesOf(id)

    matches = afterRound1
    await playRpc(at(matches, 2, 1).id, 10, 7) // seed 1 beats seed 5
    await playRpc(at(matches, 2, 2).id, 9, 10) // seed 3 beats seed 2
    const afterRound2 = await matchesOf(id)
    const beforeFinal = await tournamentById(id)

    await playRpc(at(afterRound2, 3, 1).id, 10, 2) // seed 1 beats seed 3
    const final = await tournamentById(id)
    return { afterRound1, afterRound2, beforeFinal, final, firstPlayed, firstEloBefore }
  }

  it('AC1: a tournament of 8 players has size 8, 8 entries and 7 matches, no league match', async () => {
    const { tournament, seeds, leagueBefore, openSeasonId } = await eightPlayers()
    expect(tournament.size, 'size').toBe(8)
    expect(tournament.season_id, 'season of the tournament').toBe(openSeasonId)
    expect(tournament.finished_at, 'finished_at of a new tournament').toBeNull()
    expect((await entriesOf(tournament.id)).length, 'entries').toBe(8)

    const matches = await matchesOf(tournament.id)
    const perRound = [1, 2, 3].map((r) => matches.filter((m) => m.round === r).length)
    expect(perRound, 'matches per round').toEqual([4, 2, 1])
    expect(await leagueMatchCount(seeds.slice(1)), 'league matches after creating').toBe(leagueBefore)
  })

  it('AC2: seeds follow elo then name; round 1 pairs 1v8, 4v5, 2v7, 3v6', async () => {
    const { tournament, seeds } = await eightPlayers()
    const entries = await entriesOf(tournament.id)
    expect(
      entries.map((e) => e.player_id),
      'players in seed order 1 to 8',
    ).toEqual(seeds.slice(1).map((p) => p.id))

    const matches = await matchesOf(tournament.id)
    const pairs = [
      [1, 8],
      [4, 5],
      [2, 7],
      [3, 6],
    ]
    pairs.forEach(([a, b], i) => {
      const m = at(matches, 1, i + 1)
      expect([m.player1_id, m.player2_id], `round 1, slot ${i + 1}: seed ${a} v seed ${b}`).toEqual([
        seeds[a].id,
        seeds[b].id,
      ])
    })
  })

  it('AC3: with 6 players seeds 1 and 2 get byes and stand in round 2', async () => {
    const p = [
      await createPlayer('t6-s1', 1950),
      await createPlayer('t6-s2', 1850),
      await createPlayer('t6-s3', 1750),
      await createPlayer('t6-s4', 1650),
      await createPlayer('t6-s5', 1550),
      await createPlayer('t6-s6', 1450),
    ]
    const leagueBefore = await leagueMatchCount(p)
    const tournament = await createTournamentRpc(`AT ${runId} six`, [...p].reverse())
    expect(tournament.size, 'size for 6 players').toBe(8)

    const matches = await matchesOf(tournament.id)
    for (const [slot, seed] of [
      [1, 0],
      [3, 1],
    ]) {
      const bye = at(matches, 1, slot)
      expect(bye.player1_id, `round 1, slot ${slot}: seed ${seed + 1}`).toBe(p[seed].id)
      expect(bye.player2_id, `round 1, slot ${slot}: no opponent`).toBeNull()
      expect(bye.winner_id, `round 1, slot ${slot}: bye winner`).toBe(p[seed].id)
      expect(bye.match_id, `round 1, slot ${slot}: no league match`).toBeNull()
    }
    expect(at(matches, 2, 1).player1_id, 'seed 1 in round 2, slot 1, player1').toBe(p[0].id)
    expect(at(matches, 2, 2).player1_id, 'seed 2 in round 2, slot 2, player1').toBe(p[1].id)
    expect(await leagueMatchCount(p), 'league matches after byes').toBe(leagueBefore)
    expect((await getPlayer(p[0].id)).elo, 'rating of seed 1 after a bye').toBe(1950)
  })

  it('AC4: playing a match records one league match and stores winner and match', async () => {
    const { seeds, openSeasonId, leagueBefore } = await eightPlayers()
    const { firstPlayed, firstEloBefore } = await playAll()
    expect(firstPlayed.winner_id, 'winner of round 1, slot 1').toBe(seeds[1].id)
    expect(firstPlayed.match_id, 'league match of round 1, slot 1').not.toBeNull()

    const league = await leagueMatch(firstPlayed.match_id ?? '')
    expect([league.player1_id, league.player2_id, league.score1, league.score2]).toEqual([
      seeds[1].id,
      seeds[8].id,
      10,
      4,
    ])
    expect(league.season_id, 'season of the league match').toBe(openSeasonId)
    expect(
      [league.player1_elo_before, league.player2_elo_before],
      'ratings before the match',
    ).toEqual(firstEloBefore)
    expect(league.player1_elo_after, 'winner gains rating').toBeGreaterThan(firstEloBefore[0])
    expect(league.player2_elo_after, 'loser loses rating').toBeLessThan(firstEloBefore[1])
    // 7 tournament matches played, no byes: 7 league matches.
    expect(await leagueMatchCount(seeds.slice(1)), 'league matches after the tournament').toBe(
      leagueBefore + 7,
    )
  })

  it('AC5: the winner advances to the right slot and side', async () => {
    const { seeds } = await eightPlayers()
    const { afterRound1, afterRound2 } = await playAll()
    const r2s1 = at(afterRound1, 2, 1)
    const r2s2 = at(afterRound1, 2, 2)
    expect([r2s1.player1_id, r2s1.player2_id], 'round 2, slot 1: seed 1 v seed 5').toEqual([
      seeds[1].id,
      seeds[5].id,
    ])
    expect([r2s2.player1_id, r2s2.player2_id], 'round 2, slot 2: seed 2 v seed 3').toEqual([
      seeds[2].id,
      seeds[3].id,
    ])
    const final = at(afterRound2, 3, 1)
    expect([final.player1_id, final.player2_id], 'final: seed 1 v seed 3').toEqual([
      seeds[1].id,
      seeds[3].id,
    ])
  })

  it('AC6: after the final the tournament has a champion and finished_at', async () => {
    const { seeds } = await eightPlayers()
    const { beforeFinal, final } = await playAll()
    expect(beforeFinal.champion_id, 'champion before the final').toBeNull()
    expect(beforeFinal.finished_at, 'finished_at before the final').toBeNull()
    expect(final.champion_id, 'champion').toBe(seeds[1].id)
    expect(final.finished_at, 'finished_at after the final').not.toBeNull()
  })

  it('AC7: invalid plays raise an exception and change nothing', async () => {
    const p = [
      await createPlayer('t4-s1', 1700),
      await createPlayer('t4-s2', 1600),
      await createPlayer('t4-s3', 1500),
      await createPlayer('t4-s4', 1400),
    ]
    const tournament = await createTournamentRpc(`AT ${runId} four`, p)
    let matches = await matchesOf(tournament.id)
    const leagueBefore = await leagueMatchCount(p)

    await expect(playRpc(at(matches, 1, 1).id, 5, 5), 'draw').rejects.toThrow()
    await expect(playRpc(at(matches, 2, 1).id, 10, 3), 'final without players').rejects.toThrow()
    await expect(playRpc(randomUUID(), 10, 3), 'unknown match').rejects.toThrow()
    expect(await leagueMatchCount(p), 'league matches after invalid plays').toBe(leagueBefore)
    matches = await matchesOf(tournament.id)
    expect(at(matches, 1, 1).winner_id, 'winner after a rejected draw').toBeNull()

    await playRpc(at(matches, 1, 1).id, 10, 3)
    await expect(playRpc(at(matches, 1, 1).id, 3, 10), 'match with a winner').rejects.toThrow()
    matches = await matchesOf(tournament.id)
    expect(at(matches, 1, 1).winner_id, 'winner after a second play').toBe(p[0].id)
    expect(await leagueMatchCount(p), 'league matches after a second play').toBe(leagueBefore + 1)
  })

  it('AC8: invalid tournaments raise an exception and create nothing', async () => {
    const a = await createPlayer('t-inv-a', 1500)
    const b = await createPlayer('t-inv-b', 1500)
    const before = await countTournaments()
    const cases: [string, string, string[]][] = [
      ['blank name', '   ', [a.id, b.id]],
      ['one player', `AT ${runId} one`, [a.id]],
      ['duplicate player', `AT ${runId} dup`, [a.id, b.id, a.id]],
      ['unknown player', `AT ${runId} unknown`, [a.id, randomUUID()]],
    ]
    for (const [what, name, ids] of cases) {
      const { error } = await createTournamentIds(name, ids)
      expect(error, `${what}: exception`).not.toBeNull()
    }
    expect(await countTournaments(), 'number of tournaments').toBe(before)
  })

  it('AC9: the api functions use the tournament RPCs and table', async () => {
    const fns = api as Record<string, unknown>
    for (const name of ['createTournament', 'playTournamentMatch', 'listTournamentMatches']) {
      expect(typeof fns[name], `${name} exported from src/lib/api.ts`).toBe('function')
    }
    const createTournament = fns.createTournament as (n: string, ids: string[]) => Promise<Tournament>
    const listTournamentMatches = fns.listTournamentMatches as (id: string) => Promise<TMatch[]>
    const playTournamentMatch = fns.playTournamentMatch as (
      id: string,
      s1: number,
      s2: number,
    ) => Promise<TMatch>

    const a = await createPlayer('t-api-a', 1600)
    const b = await createPlayer('t-api-b', 1500)
    const tournament = await createTournament(`AT ${runId} api`, [b.id, a.id])
    expect(tournament.size, 'size of a two-player tournament').toBe(2)
    const matches = await listTournamentMatches(tournament.id)
    expect(matches.map((m) => [m.round, m.slot]), 'matches listed by round and slot').toEqual([[1, 1]])
    const result = await playTournamentMatch(matches[0].id, 4, 10)
    expect(result.winner_id, 'winner through api').toBe(b.id)
    const { data } = await db.from('kl_tournaments').select('champion_id').eq('id', tournament.id).single()
    expect(data?.champion_id, 'champion through api').toBe(b.id)
  })

  it('AC10: seedOrder in src/lib/bracket.ts returns the standard seed order', async () => {
    let mod: Record<string, unknown>
    try {
      mod = (await import(/* @vite-ignore */ BRACKET_MODULE)) as Record<string, unknown>
    } catch (error) {
      throw new Error(`src/lib/bracket.ts cannot be loaded: ${(error as Error).message}`)
    }
    expect(typeof mod.seedOrder, 'seedOrder exported from src/lib/bracket.ts').toBe('function')
    const seedOrder = mod.seedOrder as (size: number) => number[]
    expect(seedOrder(2)).toEqual([1, 2])
    expect(seedOrder(4)).toEqual([1, 4, 2, 3])
    expect(seedOrder(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6])
    expect(seedOrder(16)).toEqual([1, 16, 8, 9, 4, 13, 5, 12, 2, 15, 7, 10, 3, 14, 6, 11])
    expect(() => seedOrder(6), 'size 6 is no power of two').toThrow()
  })
})
