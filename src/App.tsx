import { useLoaderData, useRevalidator } from 'react-router-dom'
import { AddPlayerForm } from './components/AddPlayerForm'
import { Ranking } from './components/Ranking'
import { RecentMatches } from './components/RecentMatches'
import { RecordMatchForm } from './components/RecordMatchForm'
import { addPlayer, recordMatch } from './lib/api'
import type { LeagueData } from './lib/league'

export default function App() {
  const { players, matches } = useLoaderData() as LeagueData
  const revalidator = useRevalidator()

  async function handleAdd(name: string) {
    await addPlayer(name)
    await revalidator.revalidate()
  }

  async function handleRecord(player1Id: string, player2Id: string, score1: number, score2: number) {
    await recordMatch(player1Id, player2Id, score1, score2)
    await revalidator.revalidate()
  }

  return (
    <div className="min-h-dvh bg-felt-950 text-cream">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(ellipse_at_top,_rgba(201,162,39,0.14),_transparent_60%)]" />
      <main className="relative mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <header className="mb-10">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-gold">Faculty league</p>
          <h1 className="font-display mt-1 text-6xl tracking-wide text-cream sm:text-7xl">KickerLiga</h1>
          <p className="mt-2 max-w-xl text-sm text-felt-50/70">
            Add players, record 1v1 matches, and watch Elo ratings reshuffle the ranking.
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="rounded-2xl border border-white/10 bg-felt-900/80 p-5 shadow-xl shadow-black/20">
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-gold">Ranking</h2>
            <Ranking players={players} matches={matches} />
          </section>

          <div className="space-y-6">
            <section className="rounded-2xl border border-white/10 bg-felt-900/80 p-5">
              <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-gold">New player</h2>
              <AddPlayerForm onAdd={handleAdd} />
            </section>
            <section className="rounded-2xl border border-white/10 bg-felt-900/80 p-5">
              <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-gold">Record match</h2>
              <RecordMatchForm players={players} onRecord={handleRecord} />
            </section>
          </div>

          <section className="rounded-2xl border border-white/10 bg-felt-900/80 p-5 lg:col-span-2">
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-gold">Recent matches</h2>
            <RecentMatches players={players} matches={matches} />
          </section>
        </div>
      </main>
    </div>
  )
}
