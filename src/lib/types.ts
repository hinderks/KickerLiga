export type Player = {
  id: string
  name: string
  elo: number
  created_at: string
}

export type Match = {
  id: string
  player1_id: string
  player2_id: string
  score1: number
  score2: number
  player1_elo_before: number
  player2_elo_before: number
  player1_elo_after: number
  player2_elo_after: number
  played_at: string
  season_id: string
}

export type PlayerRecord = {
  wins: number
  losses: number
  draws: number
  played: number
}

export type Season = {
  id: string
  name: string
  started_at: string
  closed_at: string | null
}

export type SeasonStanding = {
  season_id: string
  player_id: string
  rank: number
  elo: number
  played: number
  wins: number
  draws: number
  losses: number
}
