export type PlayerId = string

export interface Player {
  id: PlayerId
  rating?: number
  matchesPlayed?: number
}

export interface Match {
  id: string
  playedAt: string // ISO 8601 timestamp
  teamA: PlayerId[]
  teamB: PlayerId[]
  goalsA: number
  goalsB: number
}

export interface HistoryEntry {
  matchId: string
  playerId: PlayerId
  before: number
  after: number
}

export interface LeagueResult {
  ratings: Record<PlayerId, number>
  history: HistoryEntry[]
}

const INITIAL_RATING = 1500
const SCALE = 400
const K_NEW = 40
const K_ESTABLISHED = 32
const NEW_PLAYER_MATCHES = 5
const MAX_TEAM_SIZE = 2

export function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + 10 ** ((ratingB - ratingA) / SCALE))
}

function kFactor(matchesPlayed: number): number {
  return matchesPlayed < NEW_PLAYER_MATCHES ? K_NEW : K_ESTABLISHED
}

function mean(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

function validateGoals(match: Match, goals: number): void {
  if (!Number.isInteger(goals) || goals < 0) {
    throw new Error(`Match ${match.id}: invalid goals ${goals}`)
  }
}

function validateMatch(match: Match, known: Set<PlayerId>): number {
  const { teamA, teamB } = match
  if (teamA.length === 0 || teamB.length === 0) {
    throw new Error(`Match ${match.id}: teams must not be empty`)
  }
  if (teamA.length !== teamB.length) {
    throw new Error(`Match ${match.id}: teams must have the same size`)
  }
  if (teamA.length > MAX_TEAM_SIZE) {
    throw new Error(`Match ${match.id}: only singles and doubles are supported`)
  }

  const seen = new Set<PlayerId>()
  for (const playerId of [...teamA, ...teamB]) {
    if (!known.has(playerId)) {
      throw new Error(`Match ${match.id}: unknown player ${playerId}`)
    }
    if (seen.has(playerId)) {
      throw new Error(`Match ${match.id}: player ${playerId} appears twice`)
    }
    seen.add(playerId)
  }

  validateGoals(match, match.goalsA)
  validateGoals(match, match.goalsB)

  const time = Date.parse(match.playedAt)
  if (Number.isNaN(time)) {
    throw new Error(`Match ${match.id}: invalid playedAt ${match.playedAt}`)
  }
  return time
}

export function replayLeague(players: Player[], matches: Match[]): LeagueResult {
  const ratings = new Map<PlayerId, number>()
  const played = new Map<PlayerId, number>()
  for (const player of players) {
    if (ratings.has(player.id)) {
      throw new Error(`Duplicate player id ${player.id}`)
    }
    ratings.set(player.id, player.rating ?? INITIAL_RATING)
    played.set(player.id, player.matchesPlayed ?? 0)
  }

  const known = new Set(ratings.keys())
  const matchIds = new Set<string>()
  const ordered = matches.map((match) => {
    if (matchIds.has(match.id)) {
      throw new Error(`Duplicate match id ${match.id}`)
    }
    matchIds.add(match.id)
    return { match, time: validateMatch(match, known) }
  })

  ordered.sort((a, b) => {
    if (a.time !== b.time) return a.time - b.time
    if (a.match.id === b.match.id) return 0
    return a.match.id < b.match.id ? -1 : 1
  })

  const history: HistoryEntry[] = []
  for (const { match } of ordered) {
    const ratingOf = (id: PlayerId) => ratings.get(id)!
    const ratingA = mean(match.teamA.map(ratingOf))
    const ratingB = mean(match.teamB.map(ratingOf))
    const scoreA =
      match.goalsA > match.goalsB ? 1 : match.goalsA < match.goalsB ? 0 : 0.5

    const sides = [
      { team: match.teamA, score: scoreA, expected: expectedScore(ratingA, ratingB) },
      { team: match.teamB, score: 1 - scoreA, expected: expectedScore(ratingB, ratingA) },
    ]

    // Compute all changes from pre-match ratings before applying any of them.
    const updates: HistoryEntry[] = []
    for (const { team, score, expected } of sides) {
      for (const playerId of team) {
        const before = ratingOf(playerId)
        const k = kFactor(played.get(playerId)!)
        const after = before + Math.round(k * (score - expected))
        updates.push({ matchId: match.id, playerId, before, after })
      }
    }

    for (const entry of updates) {
      ratings.set(entry.playerId, entry.after)
      played.set(entry.playerId, played.get(entry.playerId)! + 1)
      history.push(entry)
    }
  }

  return { ratings: Object.fromEntries(ratings), history }
}
