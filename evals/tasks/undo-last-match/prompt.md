Organisers sometimes record a match by mistake. Add an undo for the latest match.

1. A new migration with `kl_undo_last_match() returns kl_matches`, `security definer`, executable
   by `anon` and `authenticated`. In one transaction it takes the match of the open season with the
   latest `played_at`, sets both players' ratings back to `player1_elo_before` and
   `player2_elo_before`, deletes the match and returns it. Without a match in the open season it
   raises an exception.
2. A function `undoLastMatch()` in `src/lib/api.ts` that calls it.

Follow the definition of done in AGENTS.md.
