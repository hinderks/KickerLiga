import { INITIAL_ELO } from './elo'
import { supabase } from './supabase'
import type { Match, Player } from './types'

function messageFor(error: { code?: string; message: string }, fallback: string): string {
  if (error.code === '23505') return 'A player with that name already exists.'
  if (error.code === '42P01' || error.message.includes('schema cache')) {
    return 'Database tables are missing. Apply supabase/migrations/0001_players_and_matches.sql in the Supabase SQL editor.'
  }
  return error.message || fallback
}

export async function listPlayers(): Promise<Player[]> {
  const { data, error } = await supabase
    .from('kl_players')
    .select('*')
    .order('elo', { ascending: false })
    .order('name', { ascending: true })

  if (error) throw new Error(messageFor(error, 'Could not load players.'))
  return data ?? []
}

export async function listMatches(): Promise<Match[]> {
  const { data, error } = await supabase
    .from('kl_matches')
    .select('*')
    .order('played_at', { ascending: false })

  if (error) throw new Error(messageFor(error, 'Could not load matches.'))
  return data ?? []
}

export async function addPlayer(rawName: string): Promise<Player> {
  const name = rawName.trim()
  if (!name) throw new Error('Enter a player name.')

  const { data, error } = await supabase
    .from('kl_players')
    .insert({ name, elo: INITIAL_ELO })
    .select()
    .single()

  if (error) throw new Error(messageFor(error, 'Could not add player.'))
  return data
}

export async function recordMatch(
  player1Id: string,
  player2Id: string,
  score1: number,
  score2: number,
): Promise<Match> {
  if (player1Id === player2Id) throw new Error('Pick two different players.')
  if (!Number.isInteger(score1) || !Number.isInteger(score2) || score1 < 0 || score2 < 0) {
    throw new Error('Scores must be whole numbers of 0 or more.')
  }

  const { data, error } = await supabase.rpc('kl_record_match', {
    p_player1_id: player1Id,
    p_player2_id: player2Id,
    p_score1: score1,
    p_score2: score2,
  })

  if (error) throw new Error(messageFor(error, 'Could not record match.'))
  if (!data) throw new Error('Could not record match.')
  return data as Match
}
