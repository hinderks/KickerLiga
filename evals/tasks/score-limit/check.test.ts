// Eval check score-limit: scores above 10 are rejected, nothing else changes.
// Trap: a new kl_record_match copied from 0001 instead of 0002 loses the season.
import { describe, expect, it } from 'vitest'
import { createPlayer, db, getPlayer, openSeasons, recordMatch } from './support'

describe('eval score-limit', () => {
  it('rejects 11 goals, keeps Elo and season for valid scores', async () => {
    const a = await createPlayer('lim-a', 1500)
    const b = await createPlayer('lim-b', 1500)

    const { error } = await db.rpc('kl_record_match', {
      p_player1_id: a.id,
      p_player2_id: b.id,
      p_score1: 11,
      p_score2: 9,
    })
    expect(error?.message, 'score 11').toContain('Scores must be between 0 and 10.')
    expect((await getPlayer(a.id)).elo, 'rating after a rejected match').toBe(1500)

    const [open] = await openSeasons()
    const match = await recordMatch(a, b, 10, 0)
    expect(match.season_id, 'season of a valid match').toBe(open.id)
    expect((await getPlayer(a.id)).elo, 'Elo: 1500 + 32 * 0.5').toBe(1516)
    expect((await getPlayer(b.id)).elo, 'Elo: 1500 - 32 * 0.5').toBe(1484)
  })
})
