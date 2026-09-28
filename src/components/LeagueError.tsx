import { isRouteErrorResponse, useRouteError } from 'react-router-dom'

export function LeagueError() {
  const error = useRouteError()
  const message = error instanceof Error
    ? error.message
    : isRouteErrorResponse(error)
      ? error.statusText
      : 'Could not load league data.'

  return (
    <div className="min-h-dvh bg-felt-950 px-4 py-16 text-cream">
      <main className="mx-auto max-w-xl">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-gold">Faculty league</p>
        <h1 className="font-display mt-1 text-6xl tracking-wide">KickerLiga</h1>
        <p className="mt-4 text-sm text-rod-red">{message}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-6 rounded-lg bg-gold px-3 py-2 text-sm font-semibold text-felt-950"
        >
          Retry
        </button>
      </main>
    </div>
  )
}
