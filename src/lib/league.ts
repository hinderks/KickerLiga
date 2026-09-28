import { listMatches, listPlayers } from './api'
import type { Match, Player } from './types'

export type LeagueData = {
  players: Player[]
  matches: Match[]
}

export async function leagueLoader(): Promise<LeagueData> {
  const [players, matches] = await Promise.all([listPlayers(), listMatches()])
  return { players, matches }
}
