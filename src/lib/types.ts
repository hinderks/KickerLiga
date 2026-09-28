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
}

export type PlayerRecord = {
  wins: number
  losses: number
  draws: number
  played: number
}
