// Acceptance tests for specs/season-close.md, AC1 to AC8.
// They run against the demo database (.env.demo), never the course database.
// These tests decide when the task is done. Do not change them.

import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import * as api from '../../src/lib/api'
import {
  carriedOver,
  closeSeasonRpc,
  countSeasons,
  createPlayer,
  db,
  getPlayer,
  openSeasons,
  recordMatch,
  runId,
  SEED_PLAYERS,
  seasonById,
  standings,
  type Player,
  type Season,
  type Standing,
} from './support'

describe('season close (specs/season-close.md)', () => {
  it('AC1: existing matches belong to Season 1', async () => {
    const { data: season1, error } = await db
      .from('kl_seasons')
      .select('id')
      .eq('name', 'Season 1')
      .single()
    expect(error?.message ?? null, 'exactly one season named "Season 1"').toBeNull()

    const { data: matches, error: matchError } = await db
      .from('kl_matches')
      .select('id, season_id')
      .in('player1_id', SEED_PLAYERS)
    expect(matchError?.message ?? null, 'select kl_matches').toBeNull()
    expect(matches?.length, 'seed matches from supabase/seed.sql').toBeGreaterThan(0)
    for (const match of matches ?? []) {
      expect(match.season_id, `season of seed match ${match.id}`).toBe(season1?.id)
    }
  })

  it('AC2: a new match is stored with the open season', async () => {
    const [open] = await openSeasons()
    expect(open, 'an open season').toBeDefined()
    const a = await createPlayer('ac2-a', 1500)
    const b = await createPlayer('ac2-b', 1500)
    const match = await recordMatch(a, b, 10, 5)
    expect(match.season_id, 'season_id returned by kl_record_match').toBe(open.id)
  })

  // One season close for AC3 to AC8. Each test awaits it, so a failing
  // setup shows up in every criterion instead of skipping them silently.
  type Flow = {
    closedId: string
    next: Season
    table: Standing[]
    players: Record<string, Player>
    before: Map<string, number>
  }
  let flow: Promise<Flow> | undefined
  const closing = () => (flow ??= closeOneSeason())

  async function closeOneSeason(): Promise<Flow> {
    const open = await openSeasons()
    if (open.length !== 1) throw new Error(`expected exactly one open season, found ${open.length}`)
    const closedId = open[0].id

    const players: Record<string, Player> = {
      a: await createPlayer('a', 1600),
      b: await createPlayer('b', 1400),
      idle: await createPlayer('idle', 1501),
      tieA: await createPlayer('tie-a', 1500),
      tieB: await createPlayer('tie-b', 1500),
      p: await createPlayer('p', 1500),
      q: await createPlayer('q', 1500),
    }
    await recordMatch(players.a, players.b, 10, 4)
    await recordMatch(players.a, players.b, 7, 7)
    await recordMatch(players.tieA, players.p, 10, 3)
    await recordMatch(players.tieB, players.q, 10, 3)

    const before = new Map<string, number>()
    for (const player of Object.values(players)) {
      before.set(player.id, (await getPlayer(player.id)).elo)
    }

    const next = await closeSeasonRpc(closedId, `AT ${runId} next`)
    const table = await standings(closedId)
    return { closedId, next, table, players, before }
  }

  describe('closing a season', () => {
    it('AC3: the season is closed and exactly the new season is open', async () => {
      const { closedId, next } = await closing()
      const closed = await seasonById(closedId)
      expect(closed.closed_at, 'closed_at of the closed season').not.toBeNull()

      const open = await openSeasons()
      expect(open.map((s) => s.id), 'open seasons after closing').toEqual([next.id])
      expect(next.name).toBe(`AT ${runId} next`)
    })

    it('AC4: standings contain only players who played, with correct counts', async () => {
      const { table, players } = await closing()
      const row = (p: Player) => table.find((s) => s.player_id === p.id)
      expect(row(players.idle), 'player without matches').toBeUndefined()
      expect(row(players.a)).toMatchObject({ played: 2, wins: 1, draws: 1, losses: 0 })
      expect(row(players.b)).toMatchObject({ played: 2, wins: 0, draws: 1, losses: 1 })
      expect(row(players.p)).toMatchObject({ played: 1, wins: 0, draws: 0, losses: 1 })
    })

    it('AC5: ranks follow elo, then wins, then name', async () => {
      const { table, players } = await closing()
      expect(table.map((s) => s.rank), 'ranks 1, 2, 3, ... without gaps').toEqual(
        table.map((_, i) => i + 1),
      )
      for (let i = 1; i < table.length; i++) {
        const [hi, lo] = [table[i - 1], table[i]]
        const ordered = hi.elo > lo.elo || (hi.elo === lo.elo && hi.wins >= lo.wins)
        expect(ordered, `rank ${hi.rank} before rank ${lo.rank}`).toBe(true)
      }
      const rankOf = (p: Player) => table.find((s) => s.player_id === p.id)?.rank ?? 0
      expect(rankOf(players.tieA), 'equal elo and wins: name decides').toBeLessThan(
        rankOf(players.tieB),
      )
    })

    it('AC6: ratings move halfway towards 1500; standings keep the old rating', async () => {
      const { table, players, before } = await closing()
      for (const player of Object.values(players)) {
        const old = before.get(player.id) ?? 0
        const now = (await getPlayer(player.id)).elo
        expect(now, `${player.name}: ${old} moves halfway to 1500`).toBe(carriedOver(old))

        const row = table.find((s) => s.player_id === player.id)
        if (row) expect(row.elo, `${player.name}: rating in standings`).toBe(old)
      }
    })

    it('AC7: invalid closing raises an exception and changes nothing', async () => {
      const { closedId, next, players } = await closing()
      const seasons = await countSeasons()
      const elo = (await getPlayer(players.a.id)).elo

      await expect(closeSeasonRpc(randomUUID(), 'x'), 'unknown season').rejects.toThrow()
      await expect(closeSeasonRpc(closedId, 'x'), 'already closed season').rejects.toThrow()
      await expect(closeSeasonRpc(next.id, '   '), 'blank next name').rejects.toThrow()

      expect(await countSeasons(), 'number of seasons').toBe(seasons)
      expect((await openSeasons()).map((s) => s.id), 'open season').toEqual([next.id])
      expect((await getPlayer(players.a.id)).elo, 'rating').toBe(elo)
    })

    it('AC8: closeSeason in src/lib/api.ts calls kl_close_season', async () => {
      const closeSeason = (api as Record<string, unknown>).closeSeason
      expect(typeof closeSeason, 'closeSeason exported from src/lib/api.ts').toBe('function')

      const { next } = await closing()
      const name = `AT ${runId} via api`
      await (closeSeason as (id: string, name: string) => Promise<unknown>)(next.id, name)
      expect((await seasonById(next.id)).closed_at, 'season closed through api').not.toBeNull()
      expect((await openSeasons()).map((s) => s.name), 'new open season').toEqual([name])
    })
  })
})
