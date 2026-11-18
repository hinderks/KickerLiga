// Helpers for the acceptance tests. The client talks to the demo
// database configured in vitest.acceptance.config.ts.

import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string
const ref = process.env.KL_DEMO_PROJECT_REF ?? ''

if (!url || !key || !ref || !url.includes(ref)) {
  throw new Error('Acceptance tests need the demo database (.env.demo). Refusing.')
}

export const db = createClient(url, key)

// Unique per run, so repeated runs do not collide on player names.
export const runId = Date.now().toString(36)

// Seed players from supabase/seed.sql, all with matches before 0002.
export const SEED_PLAYERS = [
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000003',
  '00000000-0000-4000-8000-000000000004',
]

export type Player = { id: string; name: string; elo: number }
export type Season = { id: string; name: string; started_at: string; closed_at: string | null }
export type Standing = {
  season_id: string
  player_id: string
  rank: number
  elo: number
  played: number
  wins: number
  draws: number
  losses: number
}

function fail(what: string, error: { message: string } | null): never {
  throw new Error(`${what}: ${error?.message ?? 'no data'}`)
}

export async function createPlayer(label: string, elo: number): Promise<Player> {
  const { data, error } = await db
    .from('kl_players')
    .insert({ name: `AT ${runId} ${label}`, elo })
    .select('id, name, elo')
    .single()
  if (error || !data) fail('insert kl_players', error)
  return data
}

export async function getPlayer(id: string): Promise<Player> {
  const { data, error } = await db.from('kl_players').select('id, name, elo').eq('id', id).single()
  if (error || !data) fail('select kl_players', error)
  return data
}

export async function recordMatch(p1: Player, p2: Player, score1: number, score2: number) {
  const { data, error } = await db.rpc('kl_record_match', {
    p_player1_id: p1.id,
    p_player2_id: p2.id,
    p_score1: score1,
    p_score2: score2,
  })
  if (error || !data) fail('kl_record_match', error)
  return data as { id: string; season_id?: string }
}

export async function openSeasons(): Promise<Season[]> {
  const { data, error } = await db.from('kl_seasons').select('*').is('closed_at', null)
  if (error || !data) fail('select kl_seasons', error)
  return data as Season[]
}

export async function seasonById(id: string): Promise<Season> {
  const { data, error } = await db.from('kl_seasons').select('*').eq('id', id).single()
  if (error || !data) fail('select kl_seasons', error)
  return data as Season
}

export async function countSeasons(): Promise<number> {
  const { count, error } = await db.from('kl_seasons').select('id', { count: 'exact', head: true })
  if (error || count === null) fail('count kl_seasons', error)
  return count
}

export async function standings(seasonId: string): Promise<Standing[]> {
  const { data, error } = await db
    .from('kl_season_standings')
    .select('*')
    .eq('season_id', seasonId)
    .order('rank')
  if (error || !data) fail('select kl_season_standings', error)
  return data as Standing[]
}

export async function closeSeasonRpc(seasonId: string, nextName: string): Promise<Season> {
  const { data, error } = await db.rpc('kl_close_season', {
    p_season_id: seasonId,
    p_next_name: nextName,
  })
  if (error || !data) fail('kl_close_season', error)
  return data as Season
}

// Spec, step 5: round(1500 + (elo - 1500) / 2.0), Postgres round on
// numeric, half away from zero.
export function carriedOver(elo: number): number {
  const value = 1500 + (elo - 1500) / 2
  return Math.sign(value) * Math.round(Math.abs(value))
}
