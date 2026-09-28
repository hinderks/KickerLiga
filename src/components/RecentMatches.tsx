import { formatDistanceToNow } from 'date-fns'
import { formatDelta } from '../lib/stats'
import type { Match, Player } from '../lib/types'

type Props = {
  players: Player[]
  matches: Match[]
}

export function RecentMatches({ players, matches }: Props) {
  const names = new Map(players.map((player) => [player.id, player.name]))
  const recent = matches.slice(0, 12)

  if (recent.length === 0) {
    return <p className="text-sm text-felt-50/60">No matches recorded yet.</p>
  }

  return (
    <ul className="space-y-2">
      {recent.map((match) => {
        const p1 = names.get(match.player1_id) ?? 'Unknown'
        const p2 = names.get(match.player2_id) ?? 'Unknown'
        const p1Won = match.score1 > match.score2
        const p2Won = match.score2 > match.score1
        return (
          <li
            key={match.id}
            className="rounded-lg border border-white/8 bg-felt-950/40 px-3 py-2.5 text-sm"
          >
            <div className="flex items-baseline justify-between gap-3">
              <p className="min-w-0 truncate">
                <span className={p1Won ? 'font-semibold text-cream' : 'text-felt-50/80'}>{p1}</span>
                <span className="mx-2 tabular-nums text-cream">
                  {match.score1}–{match.score2}
                </span>
                <span className={p2Won ? 'font-semibold text-cream' : 'text-felt-50/80'}>{p2}</span>
              </p>
              <p className="shrink-0 text-xs text-felt-50/45">
                {formatDistanceToNow(new Date(match.played_at), { addSuffix: true })}
              </p>
            </div>
            <p className="mt-1 text-xs tabular-nums text-felt-50/50">
              {p1} {formatDelta(match.player1_elo_after, match.player1_elo_before)}
              <span className="mx-2">·</span>
              {p2} {formatDelta(match.player2_elo_after, match.player2_elo_before)}
            </p>
          </li>
        )
      })}
    </ul>
  )
}
