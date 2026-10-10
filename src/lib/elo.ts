export type PlayerId = string;
export interface Player { id: PlayerId; rating?: number; matchesPlayed?: number }
export interface Match {
  id: string; playedAt: string;
  teamA: PlayerId[]; teamB: PlayerId[];
  goalsA: number; goalsB: number;
}
export interface HistoryEntry { matchId: string; playerId: PlayerId; before: number; after: number }
export interface LeagueResult { ratings: Record<PlayerId, number>; history: HistoryEntry[] }

const DEFAULT_RATING = 1500;
const K_HIGH = 40;
const K_NORMAL = 32;
const K_BREAK = 5;

interface Snapshot {
  readonly rating: number;
  readonly matchesPlayed: number;
}

export function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + 10 ** ((ratingB - ratingA) / 400));
}

function isIntegerGoals(goals: number): boolean {
  return typeof goals === 'number' && Number.isInteger(goals);
}

function validateGoal(goals: number): void {
  if (!isIntegerGoals(goals) || goals < 0) {
    throw new Error('Goals must be non-negative integers');
  }
}

function kFactor(matchesPlayed: number): number {
  return matchesPlayed < K_BREAK ? K_HIGH : K_NORMAL;
}

function mean(ids: readonly PlayerId[], byId: ReadonlyMap<PlayerId, Snapshot>): number {
  const total = ids.reduce((sum, id) => sum + byId.get(id)!.rating, 0);
  return total / ids.length;
}

function validatePlayerIds(ids: readonly PlayerId[], seen: ReadonlySet<PlayerId>): void {
  for (const id of ids) {
    if (seen.has(id)) {
      throw new Error(`Player ${id} appears twice in one match`);
    }
    seen.add(id);
  }
}

export function replayLeague(players: Player[], matches: Match[]): LeagueResult {
  const initialRatings = new Map<PlayerId, number>();
  const initialMatches = new Map<PlayerId, number>();
  for (const player of players) {
    if (initialRatings.has(player.id)) {
      throw new Error(`Duplicate player id ${player.id}`);
    }
    initialRatings.set(player.id, player.rating ?? DEFAULT_RATING);
    initialMatches.set(player.id, player.matchesPlayed ?? 0);
  }

  const seenMatchIds = new Set<string>();
  for (const match of matches) {
    if (seenMatchIds.has(match.id)) {
      throw new Error(`Duplicate match id ${match.id}`);
    }
    seenMatchIds.add(match.id);

    if (match.teamA.length === 0 || match.teamB.length === 0) {
      throw new Error(`Match ${match.id} has an empty team`);
    }
    if (match.teamA.length !== match.teamB.length) {
      throw new Error(`Match ${match.id} has teams of different size`);
    }
    if (match.teamA.length > 2) {
      throw new Error(`Match ${match.id} must be singles or doubles`);
    }
    validateGoal(match.goalsA);
    validateGoal(match.goalsB);
  }

  const ordered = [...matches].sort((a, b) => {
    const byTime = a.playedAt.localeCompare(b.playedAt);
    return byTime !== 0 ? byTime : a.id.localeCompare(b.id);
  });

  const ratings = new Map<PlayerId, number>(
    [...initialRatings.entries()].map(([id, rating]) => [id, rating] as [PlayerId, number]),
  );
  const matchesPlayed = new Map<PlayerId, number>(
    [...initialMatches.entries()].map(([id, count]) => [id, count] as [PlayerId, number]),
  );
  const history: HistoryEntry[] = [];

  for (const match of ordered) {
    const seen = new Set<PlayerId>();
    validatePlayerIds(match.teamA, seen);
    validatePlayerIds(match.teamB, seen);

    for (const id of [...match.teamA, ...match.teamB]) {
      if (!ratings.has(id)) {
        throw new Error(`Unknown player id ${id}`);
      }
    }

    const snapshot = new Map<PlayerId, Snapshot>();
    for (const id of [...match.teamA, ...match.teamB]) {
      snapshot.set(id, {
        rating: ratings.get(id)!,
        matchesPlayed: matchesPlayed.get(id)!,
      });
    }

    const teamARating = mean(match.teamA, snapshot);
    const teamBRating = mean(match.teamB, snapshot);
    const teamAScore =
      match.goalsA > match.goalsB ? 1 : match.goalsA < match.goalsB ? 0 : 0.5;

    const entries: HistoryEntry[] = [];
    for (const id of match.teamA) {
      applyChange(id, teamAScore, teamARating, teamBRating, snapshot, ratings, matchesPlayed, entries, match.id);
    }
    for (const id of match.teamB) {
      applyChange(id, 1 - teamAScore, teamBRating, teamARating, snapshot, ratings, matchesPlayed, entries, match.id);
    }
    history.push(...entries);
  }

  return {
    ratings: Object.fromEntries(ratings),
    history,
  };
}

function applyChange(
  id: PlayerId,
  score: number,
  ownTeamRating: number,
  opponentTeamRating: number,
  snapshot: ReadonlyMap<PlayerId, Snapshot>,
  ratings: Map<PlayerId, number>,
  matchesPlayed: Map<PlayerId, number>,
  entries: HistoryEntry[],
  matchId: string,
): void {
  const before = ratings.get(id)!;
  const expected = expectedScore(ownTeamRating, opponentTeamRating);
  const k = kFactor(snapshot.get(id)!.matchesPlayed);
  const after = before + Math.round(k * (score - expected));
  ratings.set(id, after);
  matchesPlayed.set(id, snapshot.get(id)!.matchesPlayed + 1);
  entries.push({ matchId, playerId: id, before, after });
}
