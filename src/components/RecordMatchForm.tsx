import { Swords } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import type { Player } from '../lib/types'

type Props = {
  players: Player[]
  onRecord: (player1Id: string, player2Id: string, score1: number, score2: number) => Promise<void>
}

export function RecordMatchForm({ players, onRecord }: Props) {
  const [player1Id, setPlayer1Id] = useState('')
  const [player2Id, setPlayer2Id] = useState('')
  const [score1, setScore1] = useState('')
  const [score2, setScore2] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const ready = players.length >= 2

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setPending(true)
    setError(null)
    try {
      await onRecord(player1Id, player2Id, Number.parseInt(score1, 10), Number.parseInt(score2, 10))
      setScore1('')
      setScore2('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not record match.')
    } finally {
      setPending(false)
    }
  }

  if (!ready) {
    return <p className="text-sm text-felt-50/60">Add at least two players to record a match.</p>
  }

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="space-y-3">
      <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
        <PlayerSide
          label="Player 1"
          playerId={player1Id}
          score={score1}
          excludeId={player2Id}
          players={players}
          onPlayerId={setPlayer1Id}
          onScore={setScore1}
        />
        <p className="pb-2 text-xs font-semibold text-felt-50/50">vs</p>
        <PlayerSide
          label="Player 2"
          playerId={player2Id}
          score={score2}
          excludeId={player1Id}
          players={players}
          onPlayerId={setPlayer2Id}
          onScore={setScore2}
        />
      </div>
      {error ? <p className="text-sm text-rod-red">{error}</p> : null}
      <button
        type="submit"
        disabled={pending || !player1Id || !player2Id || score1 === '' || score2 === ''}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-cream px-3 py-2 text-sm font-semibold text-felt-950 disabled:opacity-50"
      >
        <Swords size={16} />
        {pending ? 'Saving…' : 'Record match'}
      </button>
    </form>
  )
}

type SideProps = {
  label: string
  playerId: string
  score: string
  excludeId: string
  players: Player[]
  onPlayerId: (id: string) => void
  onScore: (score: string) => void
}

function PlayerSide({
  label,
  playerId,
  score,
  excludeId,
  players,
  onPlayerId,
  onScore,
}: SideProps) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-semibold uppercase tracking-wider text-felt-50/70">
        {label}
        <select
          value={playerId}
          onChange={(event) => onPlayerId(event.target.value)}
          className="mt-1.5 w-full rounded-lg border border-white/10 bg-felt-950/60 px-2 py-2 text-sm text-cream outline-none focus:border-gold/70"
        >
          <option value="">Select</option>
          {players
            .filter((player) => player.id !== excludeId)
            .map((player) => (
              <option key={player.id} value={player.id}>
                {player.name}
              </option>
            ))}
        </select>
      </label>
      <label className="block text-xs font-semibold uppercase tracking-wider text-felt-50/70">
        Score
        <input
          type="number"
          min={0}
          step={1}
          inputMode="numeric"
          value={score}
          onChange={(event) => onScore(event.target.value)}
          className="mt-1.5 w-full rounded-lg border border-white/10 bg-felt-950/60 px-3 py-2 text-sm text-cream outline-none focus:border-gold/70"
        />
      </label>
    </div>
  )
}
