// Eval check rename-player: renamePlayer in src/lib/api.ts.
import { describe, expect, it } from 'vitest'
import * as api from '../../src/lib/api'
import { createPlayer, getPlayer, runId } from './support'

type Rename = (id: string, name: string) => Promise<{ id: string; name: string }>

describe('eval rename-player', () => {
  it('renames, trims, rejects blank and taken names', async () => {
    const renamePlayer = (api as Record<string, unknown>).renamePlayer as Rename
    expect(typeof renamePlayer, 'renamePlayer exported from src/lib/api.ts').toBe('function')
    const a = await createPlayer('ren-a', 1500)
    const b = await createPlayer('ren-b', 1500)

    const renamed = await renamePlayer(a.id, `  AT ${runId} ren-new  `)
    expect(renamed.name, 'returned name, trimmed').toBe(`AT ${runId} ren-new`)
    expect((await getPlayer(a.id)).name, 'stored name').toBe(`AT ${runId} ren-new`)

    await expect(renamePlayer(a.id, '   '), 'blank name').rejects.toThrow('Enter a player name.')
    await expect(renamePlayer(a.id, b.name), 'taken name').rejects.toThrow(
      'A player with that name already exists.',
    )
    expect((await getPlayer(a.id)).name, 'name after rejected renames').toBe(`AT ${runId} ren-new`)
  })
})
