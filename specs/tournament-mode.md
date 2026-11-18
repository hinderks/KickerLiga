# Spec: tournament mode

Status: accepted, 16.11.2026.

## Goal

Besides the running league, the faculty plays knockout tournaments. An organiser picks the
players, KickerLiga seeds them by rating and builds the bracket. Every tournament match is also a
normal league match: it changes the Elo ratings and belongs to the open season. The winner of the
final is the champion.

## Scope

1. A new migration `supabase/migrations/0003_tournaments.sql`.
2. Functions `createTournament`, `playTournamentMatch` and `listTournamentMatches` in
   `src/lib/api.ts`.
3. Types in `src/lib/types.ts` for the new tables.
4. A pure helper `src/lib/bracket.ts` with unit tests next to it (see "Bracket helper").
5. A tournament section in the UI: create a tournament from selected players, show the bracket
   of the latest tournament round by round, enter results of playable matches.

## Data model

| Object | Definition |
|---|---|
| `kl_tournaments` | `id uuid primary key default gen_random_uuid()`, `season_id uuid not null references kl_seasons (id)`, `name text not null` (not blank), `size integer not null` (bracket size: 2, 4, 8, 16 or 32), `created_at timestamptz not null default now()`, `finished_at timestamptz` (null while running), `champion_id uuid references kl_players (id)` (null while running) |
| `kl_tournament_entries` | `tournament_id uuid not null references kl_tournaments (id)`, `player_id uuid not null references kl_players (id)`, `seed integer not null`, primary key `(tournament_id, player_id)`, unique `(tournament_id, seed)` |
| `kl_tournament_matches` | `id uuid primary key default gen_random_uuid()`, `tournament_id uuid not null references kl_tournaments (id)`, `round integer not null` (1 is the first round), `slot integer not null` (1, 2, … within the round), `player1_id uuid references kl_players (id)`, `player2_id uuid references kl_players (id)`, `winner_id uuid references kl_players (id)`, `match_id uuid references kl_matches (id)`, unique `(tournament_id, round, slot)` |

RLS on all three tables; `anon` and `authenticated` may select. Writes happen only through functions.

## Bracket rules

- Seeds: the selected players ordered by `elo` descending, then `lower(name)` ascending, get seeds
  1, 2, 3, … at creation time.
- Size: the smallest power of two that is at least the number of players.
- Rounds: `log2(size)`. Round `r` has `size / 2^r` slots. The last round is the final.
- Standard seed order: `order(2) = [1, 2]`; `order(2m)` replaces every `s` in `order(m)` by the pair
  `s, 2m + 1 - s`. Example: `order(8) = [1, 8, 4, 5, 2, 7, 3, 6]`.
- First round: slot `k` pairs the seeds `order(size)[2k - 1]` and `order(size)[2k]`. The better
  (smaller) seed is `player1`.
- Bye: if the second seed of a pair is larger than the number of players, `player2_id` stays null,
  `winner_id` is `player1_id` at creation, `match_id` stays null, and the winner advances at once.
  A bye records no league match.
- Advancing: the winner of round `r`, slot `k` becomes a player of round `r + 1`, slot `ceil(k / 2)`:
  `player1` if `k` is odd, `player2` if `k` is even.

## Functions

`kl_create_tournament(p_name text, p_player_ids uuid[]) returns kl_tournaments`, `security definer`,
executable by `anon` and `authenticated`. In one transaction it:

1. raises an exception if `p_name` is blank, if fewer than 2 or more than 32 player ids are given,
   if an id appears twice, if a player does not exist, or if there is no open season;
2. creates the tournament in the open season with `size` as above;
3. writes one entry per player with its seed;
4. creates every match of every round; later rounds start with empty players;
5. resolves byes as described above and returns the tournament.

`kl_play_tournament_match(p_match_id uuid, p_score1 integer, p_score2 integer) returns kl_tournament_matches`,
`security definer`, executable by `anon` and `authenticated`. In one transaction it:

1. raises an exception if the match does not exist, already has a winner, lacks one of its two
   players, or if `p_score1 = p_score2` (a knockout match has no draw);
2. records the league match through `kl_record_match(player1_id, player2_id, p_score1, p_score2)`,
   so ratings and season work as for every other match;
3. stores `winner_id` and `match_id`;
4. advances the winner; after the final it sets `finished_at = now()` and `champion_id` of the
   tournament;
5. returns the updated tournament match.

## Bracket helper

`src/lib/bracket.ts` exports `seedOrder(size: number): number[]`, which returns the standard seed
order above and throws an `Error` if `size` is not a power of two of at least 2. The UI uses it, and
a label helper of your choice, to draw the bracket.

## Acceptance criteria

- AC1 Creating a tournament with 8 players stores it in the open season with size 8, 8 entries and
  7 matches (4, 2, 1 per round), and records no league match.
- AC2 Seeds follow elo, then name; the first round pairs seeds 1 v 8, 4 v 5, 2 v 7, 3 v 6 in slots
  1 to 4, the better seed as `player1`.
- AC3 With 6 players the size is 8; seeds 1 and 2 have byes and already stand in round 2 in the right
  slot and side; byes record no league match and change no rating.
- AC4 Playing a match records one league match in the open season with the usual Elo change and
  stores winner and league match.
- AC5 The winner advances to the right slot and side of the next round.
- AC6 After the final the tournament has a champion and `finished_at`; before, it has neither.
- AC7 Playing a draw, a match that already has a winner, a match without both players, or an unknown
  match raises an exception and changes nothing.
- AC8 Creating a tournament with a blank name, one player, a duplicate player or an unknown player
  raises an exception and creates nothing.
- AC9 `createTournament`, `playTournamentMatch` and `listTournamentMatches` in `src/lib/api.ts` call
  `kl_create_tournament`, `kl_play_tournament_match` and the table `kl_tournament_matches`.
- AC10 `seedOrder` in `src/lib/bracket.ts` returns the standard order for 2, 4, 8 and 16 and throws
  for 6.

## Out of scope

Double elimination, third-place match, editing or deleting a tournament, changing seeds by hand,
tournaments across seasons.
