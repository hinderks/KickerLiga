import { UserPlus } from 'lucide-react'
import { useState, type FormEvent } from 'react'

type Props = {
  onAdd: (name: string) => Promise<void>
}

export function AddPlayerForm({ onAdd }: Props) {
  const [name, setName] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setPending(true)
    setError(null)
    try {
      await onAdd(name)
      setName('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add player.')
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="space-y-3">
      <label className="block text-xs font-semibold uppercase tracking-wider text-felt-50/70">
        Name
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="e.g. Alex"
          autoComplete="off"
          className="mt-1.5 w-full rounded-lg border border-white/10 bg-felt-950/60 px-3 py-2 text-sm text-cream placeholder:text-felt-50/30 outline-none focus:border-gold/70"
        />
      </label>
      {error ? <p className="text-sm text-rod-red">{error}</p> : null}
      <button
        type="submit"
        disabled={pending || !name.trim()}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gold px-3 py-2 text-sm font-semibold text-felt-950 disabled:opacity-50"
      >
        <UserPlus size={16} />
        {pending ? 'Adding…' : 'Add player'}
      </button>
    </form>
  )
}
