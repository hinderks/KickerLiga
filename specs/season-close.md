# Spec: season close

Status: accepted, 16.10.2026.

## Goal

The league plays in seasons. Closing a season freezes its final ranking and starts the next season.
Ratings carry over into the next season, but move halfway back towards the start rating, so that
a new season is open again without losing all information.

## Scope

1. A new migration `supabase/migrations/0002_seasons.sql`.
2. A function `closeSeason` in `src/lib/api.ts` that calls the RPC.
3. Types in `src/lib/types.ts` for the new tables.

## Data model

| Object | Definition |
|---|---|
| `kl_seasons` | `id uuid primary key default gen_random_uuid()`, `name text not null` (not blank), `started_at timestamptz not null default now()`, `closed_at timestamptz` (null while open) |
| One open season | at most one row with `closed_at is null` (enforce with a unique partial index) |
| First season | the migration creates one open season named `Season 1` |
| `kl_matches.season_id` | `uuid not null references kl_seasons (id)`; existing matches belong to `Season 1` |
| `kl_season_standings` | `season_id uuid references kl_seasons (id)`, `player_id uuid references kl_players (id)`, `rank integer`, `elo integer`, `played integer`, `wins integer`, `draws integer`, `losses integer`, all `not null`, primary key `(season_id, player_id)` |

RLS on both new tables; `anon` and `authenticated` may select. Writes happen only through functions.

## Functions

`kl_record_match` keeps its signature and behaviour and additionally stores the id of the open
season in `season_id`. Without an open season it raises an exception.

`kl_close_season(p_season_id uuid, p_next_name text) returns kl_seasons`, `security definer`,
executable by `anon` and `authenticated`. In one transaction it:

1. raises an exception if the season does not exist, is already closed, or `p_next_name` is blank;
2. writes one row into `kl_season_standings` for every player with at least one match in this
   season: `elo` is the rating at closing time, `played`, `wins`, `draws`, `losses` count only
   matches of this season;
3. assigns `rank` 1, 2, 3, … ordered by `elo` descending, then `wins` descending, then
   `lower(name)` ascending; ranks are unique;
4. sets `closed_at = now()` for the season;
5. sets the rating of every player, including players without matches, to
   `round(1500 + (elo - 1500) / 2.0)` (Postgres `round` on numeric, half away from zero);
6. creates the next open season with name `p_next_name` and returns it.

## Acceptance criteria

- AC1 Existing matches get `season_id` of `Season 1`; no match without a season.
- AC2 New matches are stored with the open season.
- AC3 After closing, the season has `closed_at`, and exactly one season is open: the new one.
- AC4 Standings contain only players who played in the season, with correct counts.
- AC5 Ranks follow elo, then wins, then name.
- AC6 Every rating moves halfway towards 1500, rounded as above; standings keep the old rating.
- AC7 Closing an unknown or already closed season, or a blank next name, raises an exception
  and changes nothing.
- AC8 `closeSeason(seasonId, nextName)` in `src/lib/api.ts` calls `kl_close_season`.

## Out of scope

UI changes, tournament mode, reopening a season, deleting matches.
