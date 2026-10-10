export type PlayerId = string

export interface Player {
  id: PlayerId
  rating?: number
  matchesPlayed?: number
}

export interface Match {
  id: string
  playedAt: string
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

const DEFAULT_RATING = 1500
const K_PROBATION = 40
const K_ESTABLISHED = 32
const PROBATION_THRESHOLD = 5

export function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + 10 ** ((ratingB - ratingA) / 400))
}

function getRating(ratings: Map<PlayerId, number>, id: PlayerId): number {
  return ratings.get(id) ?? DEFAULT_RATING
}

function teamRating(ratings: Map<PlayerId, number>, team: PlayerId[]): number {
  let sum = 0
  for (const id of team) {
    sum += getRating(ratings, id)
  }
  return sum / team.length
}

function kFactor(matchesPlayed: number): number {
  return matchesPlayed < PROBATION_THRESHOLD ? K_PROBATION : K_ESTABLISHED
}

function matchResult(goalsA: number, goalsB: number): [number, number] {
  if (goalsA > goalsB) return [1, 0]
  if (goalsA < goalsB) return [0, 1]
  return [0.5, 0.5]
}

function validateInputs(players: Player[], matches: Match[]): void {
  const playerIds = new Set(players.map((p) => p.id))

  const matchIds = new Set<string>()

  for (const match of matches) {
    if (matchIds.has(match.id)) {
      throw new Error(`Duplicate match id: ${match.id}`)
    }
    matchIds.add(match.id)

    if (match.teamA.length === 0 || match.teamB.length === 0) {
      throw new Error(`Empty team in match: ${match.id}`)
    }

    if (match.teamA.length !== match.teamB.length) {
      throw new Error(`Teams of different size in match: ${match.id}`)
    }

    const seen = new Set<PlayerId>()
    for (const id of [...match.teamA, ...match.teamB]) {
      if (!playerIds.has(id)) {
        throw new Error(`Unknown player id: ${id}`)
      }
      if (seen.has(id)) {
        throw new Error(`Player appears twice in match: ${id}`)
      }
      seen.add(id)
    }

    if (!Number.isInteger(match.goalsA) || match.goalsA < 0) {
      throw new Error(`Invalid goalsA in match: ${match.id}`)
    }
    if (!Number.isInteger(match.goalsB) || match.goalsB < 0) {
      throw new Error(`Invalid goalsB in match: ${match.id}`)
    }
  }
}

export function replayLeague(players: Player[], matches: Match[]): LeagueResult {
  validateInputs(players, matches)

  const ratings = new Map<PlayerId, number>()
  const matchesPlayed = new Map<PlayerId, number>()

  for (const player of players) {
    ratings.set(player.id, player.rating ?? DEFAULT_RATING)
    matchesPlayed.set(player.id, player.matchesPlayed ?? 0)
  }

  const sorted = [...matches].sort((a, b) => {
    const cmp = a.playedAt.localeCompare(b.playedAt)
    return cmp !== 0 ? cmp : a.id.localeCompare(b.id)
  })

  const history: HistoryEntry[] = []

  for (const match of sorted) {
    const ratingABefore = teamRating(ratings, match.teamA)
    const ratingBBefore = teamRating(ratings, match.teamB)
    const [scoreA, scoreB] = matchResult(match.goalsA, match.goalsB)

    const expA = expectedScore(ratingABefore, ratingBBefore)
    const expB = expectedScore(ratingBBefore, ratingABefore)

    const snapshots: HistoryEntry[] = []

    for (const id of match.teamA) {
      const before = getRating(ratings, id)
      const k = kFactor(matchesPlayed.get(id)!)
      const delta = Math.round(k * (scoreA - expA))
      snapshots.push({ matchId: match.id, playerId: id, before, after: before + delta })
    }

    for (const id of match.teamB) {
      const before = getRating(ratings, id)
      const k = kFactor(matchesPlayed.get(id)!)
      const delta = Math.round(k * (scoreB - expB))
      snapshots.push({ matchId: match.id, playerId: id, before, after: before + delta })
    }

    for (const entry of snapshots) {
      ratings.set(entry.playerId, entry.after)
      matchesPlayed.set(entry.playerId, matchesPlayed.get(entry.playerId)! + 1)
    }

    history.push(...snapshots)
  }

  const resultRatings: Record<PlayerId, number> = {}
  for (const [id, rating] of ratings) {
    resultRatings[id] = rating
  }

  return { ratings: resultRatings, history }
}
