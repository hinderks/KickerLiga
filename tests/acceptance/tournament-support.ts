// Helpers for the tournament acceptance tests (specs/tournament-mode.md).
// Same demo database as support.ts.

import { db, type Player } from './support'

export type Tournament = {
  id: string
  season_id: string
  name: string
  size: number
  created_at: string
  finished_at: string | null
  champion_id: string | null
}

export type Entry = { tournament_id: string; player_id: string; seed: number }

export type TMatch = {
  id: string
  tournament_id: string
  round: number
  slot: number
  player1_id: string | null
  player2_id: string | null
  winner_id: string | null
  match_id: string | null
}

function fail(what: string, error: { message: string } | null): never {
  throw new Error(`${what}: ${error?.message ?? 'no data'}`)
}

export async function createTournamentRpc(name: string, players: Player[]): Promise<Tournament> {
  const { data, error } = await db.rpc('kl_create_tournament', {
    p_name: name,
    p_player_ids: players.map((p) => p.id),
  })
  if (error || !data) fail('kl_create_tournament', error)
  return data as Tournament
}

export async function createTournamentIds(name: string, ids: string[]) {
  return db.rpc('kl_create_tournament', { p_name: name, p_player_ids: ids })
}

export async function playRpc(matchId: string, score1: number, score2: number): Promise<TMatch> {
  const { data, error } = await db.rpc('kl_play_tournament_match', {
    p_match_id: matchId,
    p_score1: score1,
    p_score2: score2,
  })
  if (error || !data) fail('kl_play_tournament_match', error)
  return data as TMatch
}

export async function tournamentById(id: string): Promise<Tournament> {
  const { data, error } = await db.from('kl_tournaments').select('*').eq('id', id).single()
  if (error || !data) fail('select kl_tournaments', error)
  return data as Tournament
}

export async function countTournaments(): Promise<number> {
  const { count, error } = await db
    .from('kl_tournaments')
    .select('id', { count: 'exact', head: true })
  if (error || count === null) fail('count kl_tournaments', error)
  return count
}

export async function entriesOf(tournamentId: string): Promise<Entry[]> {
  const { data, error } = await db
    .from('kl_tournament_entries')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('seed')
  if (error || !data) fail('select kl_tournament_entries', error)
  return data as Entry[]
}

export async function matchesOf(tournamentId: string): Promise<TMatch[]> {
  const { data, error } = await db
    .from('kl_tournament_matches')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('round')
    .order('slot')
  if (error || !data) fail('select kl_tournament_matches', error)
  return data as TMatch[]
}

export function at(matches: TMatch[], round: number, slot: number): TMatch {
  const match = matches.find((m) => m.round === round && m.slot === slot)
  if (!match) throw new Error(`no match in round ${round}, slot ${slot}`)
  return match
}

// League matches (kl_matches) in which any of the players took part.
export async function leagueMatchCount(players: Player[]): Promise<number> {
  const ids = players.map((p) => p.id).join(',')
  const { count, error } = await db
    .from('kl_matches')
    .select('id', { count: 'exact', head: true })
    .or(`player1_id.in.(${ids}),player2_id.in.(${ids})`)
  if (error || count === null) fail('count kl_matches', error)
  return count
}

export async function leagueMatch(id: string) {
  const { data, error } = await db.from('kl_matches').select('*').eq('id', id).single()
  if (error || !data) fail('select kl_matches', error)
  return data as {
    id: string
    player1_id: string
    player2_id: string
    score1: number
    score2: number
    player1_elo_before: number
    player2_elo_before: number
    player1_elo_after: number
    player2_elo_after: number
    season_id: string
  }
}
