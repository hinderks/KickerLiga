// Eval check undo-last-match: kl_undo_last_match and undoLastMatch.
import { describe, expect, it } from 'vitest'
import * as api from '../../src/lib/api'
import { createPlayer, db, getPlayer, recordMatch } from './support'

describe('eval undo-last-match', () => {
  it('deletes the latest match and restores both ratings', async () => {
    const a = await createPlayer('undo-a', 1600)
    const b = await createPlayer('undo-b', 1400)
    await recordMatch(a, b, 10, 7)
    const last = await recordMatch(b, a, 10, 2)
    expect((await getPlayer(b.id)).elo, 'rating changed by the match').not.toBe(1400)

    const { data, error } = await db.rpc('kl_undo_last_match')
    expect(error?.message ?? null, 'kl_undo_last_match').toBeNull()
    expect((data as { id: string }).id, 'returned match').toBe(last.id)

    const restored = [(await getPlayer(b.id)).elo, (await getPlayer(a.id)).elo]
    const before = last as unknown as { player1_elo_before: number; player2_elo_before: number }
    expect(restored, 'ratings before the match').toEqual([before.player1_elo_before, before.player2_elo_before])
    const { data: gone } = await db.from('kl_matches').select('id').eq('id', last.id)
    expect(gone, 'match deleted').toEqual([])

    const undoLastMatch = (api as Record<string, unknown>).undoLastMatch as () => Promise<{
      player1_id: string
    }>
    expect(typeof undoLastMatch, 'undoLastMatch exported from src/lib/api.ts').toBe('function')
    const again = await undoLastMatch()
    expect(again.player1_id, 'undo through api removes the match before').toBe(a.id)
  })
})
