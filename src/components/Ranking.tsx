import { Trophy } from 'lucide-react'
import { recordFor } from '../lib/stats'
import type { Match, Player } from '../lib/types'

type Props = {
  players: Player[]
  matches: Match[]
}

const podium = ['text-gold', 'text-silver', 'text-bronze'] as const

export function Ranking({ players, matches }: Props) {
  if (players.length === 0) {
    return (
      <p className="text-sm text-felt-50/60">No players yet. Add someone to open the league.</p>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-white/10 text-xs uppercase tracking-wider text-felt-50/50">
            <th className="pb-2 pr-3 font-semibold">#</th>
            <th className="pb-2 pr-3 font-semibold">Player</th>
            <th className="pb-2 pr-3 text-right font-semibold">Elo</th>
            <th className="pb-2 pr-3 text-right font-semibold">W–L</th>
            <th className="pb-2 text-right font-semibold">P</th>
          </tr>
        </thead>
        <tbody>
          {players.map((player, index) => {
            const record = recordFor(player.id, matches)
            const rankClass = podium[index] ?? 'text-felt-50/70'
            return (
              <tr key={player.id} className="border-b border-white/5 last:border-0">
                <td className={`py-2.5 pr-3 font-semibold ${rankClass}`}>
                  <span className="inline-flex items-center gap-1">
                    {index === 0 ? <Trophy size={14} /> : null}
                    {index + 1}
                  </span>
                </td>
                <td className="py-2.5 pr-3 font-medium text-cream">{player.name}</td>
                <td className="py-2.5 pr-3 text-right tabular-nums text-cream">{player.elo}</td>
                <td className="py-2.5 pr-3 text-right tabular-nums text-felt-50/80">
                  {record.wins}–{record.losses}
                  {record.draws ? `–${record.draws}` : ''}
                </td>
                <td className="py-2.5 text-right tabular-nums text-felt-50/80">{record.played}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
