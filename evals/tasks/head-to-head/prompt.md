Add head-to-head statistics for two players.

1. A new migration with the Postgres function
   `kl_head_to_head(p_player_a uuid, p_player_b uuid) returns json`, executable by `anon` and
   `authenticated`. It counts all matches between the two players in all seasons and returns
   `{"played": n, "a_wins": n, "b_wins": n, "draws": n}` from the view of player a. It raises an
   exception if one of the players does not exist.
2. A function `headToHead(playerAId: string, playerBId: string)` in `src/lib/api.ts` that calls it
   and returns that object.

Follow the definition of done in AGENTS.md.
