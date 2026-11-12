// Eval check head-to-head: kl_head_to_head and headToHead.
import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import * as api from '../../src/lib/api'
import { createPlayer, db, recordMatch } from './support'

describe('eval head-to-head', () => {
  it('counts matches between two players from the view of player a', async () => {
    const a = await createPlayer('h2h-a', 1500)
    const b = await createPlayer('h2h-b', 1500)
    const c = await createPlayer('h2h-c', 1500)
    await recordMatch(a, b, 10, 5)
    await recordMatch(b, a, 3, 10)
    await recordMatch(b, a, 10, 8)
    await recordMatch(a, b, 6, 6)
    await recordMatch(a, c, 10, 1)

    const { data, error } = await db.rpc('kl_head_to_head', { p_player_a: a.id, p_player_b: b.id })
    expect(error?.message ?? null, 'kl_head_to_head').toBeNull()
    expect(data).toEqual({ played: 4, a_wins: 2, b_wins: 1, draws: 1 })

    const swapped = await db.rpc('kl_head_to_head', { p_player_a: b.id, p_player_b: a.id })
    expect(swapped.data, 'from the view of b').toEqual({ played: 4, a_wins: 1, b_wins: 2, draws: 1 })

    const unknown = await db.rpc('kl_head_to_head', { p_player_a: a.id, p_player_b: randomUUID() })
    expect(unknown.error, 'unknown player raises').not.toBeNull()

    const headToHead = (api as Record<string, unknown>).headToHead as (x: string, y: string) => Promise<unknown>
    expect(typeof headToHead, 'headToHead exported from src/lib/api.ts').toBe('function')
    expect(await headToHead(a.id, b.id)).toEqual({ played: 4, a_wins: 2, b_wins: 1, draws: 1 })
  })
})
