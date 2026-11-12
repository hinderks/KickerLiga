// Eval check season-standings: listSeasonStandings in src/lib/api.ts.
import { describe, expect, it } from 'vitest'
import * as api from '../../src/lib/api'
import { closeSeasonRpc, createPlayer, openSeasons, recordMatch, runId } from './support'

type Row = { player_id: string; rank: number; name: string; wins: number }

describe('eval season-standings', () => {
  it('lists standings of a season by rank with the player name', async () => {
    const list = (api as Record<string, unknown>).listSeasonStandings as (id: string) => Promise<Row[]>
    expect(typeof list, 'listSeasonStandings exported from src/lib/api.ts').toBe('function')

    const [open] = await openSeasons()
    const a = await createPlayer('st-a', 1700)
    const b = await createPlayer('st-b', 1300)
    await recordMatch(a, b, 10, 2)
    await closeSeasonRpc(open.id, `AT ${runId} after standings`)

    const rows = await list(open.id)
    expect(rows.map((r) => r.rank), 'ordered by rank').toEqual(rows.map((_, i) => i + 1))
    const rowA = rows.find((r) => r.player_id === a.id)
    expect(rowA?.name, 'flat field name').toBe(a.name)
    expect(rowA?.wins, 'columns of kl_season_standings').toBe(1)
  })
})
