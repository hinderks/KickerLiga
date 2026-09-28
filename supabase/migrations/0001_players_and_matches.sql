create table if not exists kl_players (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  elo integer not null default 1000,
  created_at timestamptz not null default now(),
  constraint kl_players_name_not_blank check (char_length(trim(name)) > 0)
);

create unique index if not exists kl_players_name_unique on kl_players (lower(trim(name)));

create table if not exists kl_matches (
  id uuid primary key default gen_random_uuid(),
  player1_id uuid not null references kl_players (id) on delete restrict,
  player2_id uuid not null references kl_players (id) on delete restrict,
  score1 integer not null,
  score2 integer not null,
  player1_elo_before integer not null,
  player2_elo_before integer not null,
  player1_elo_after integer not null,
  player2_elo_after integer not null,
  played_at timestamptz not null default now(),
  constraint kl_matches_distinct_players check (player1_id <> player2_id),
  constraint kl_matches_scores_non_negative check (score1 >= 0 and score2 >= 0)
);

create index if not exists kl_matches_played_at_idx on kl_matches (played_at desc);

alter table kl_players enable row level security;
alter table kl_matches enable row level security;

create policy kl_players_select on kl_players
  for select to anon, authenticated using (true);
create policy kl_players_insert on kl_players
  for insert to anon, authenticated with check (true);
create policy kl_players_update on kl_players
  for update to anon, authenticated using (true) with check (true);

create policy kl_matches_select on kl_matches
  for select to anon, authenticated using (true);
create policy kl_matches_insert on kl_matches
  for insert to anon, authenticated with check (true);

grant select, insert, update on table kl_players to anon, authenticated;
grant select, insert on table kl_matches to anon, authenticated;

create or replace function kl_record_match(
  p_player1_id uuid,
  p_player2_id uuid,
  p_score1 integer,
  p_score2 integer
)
returns kl_matches
language plpgsql
security definer
set search_path = public
as $$
declare
  r1 kl_players;
  r2 kl_players;
  expected1 numeric;
  actual1 numeric;
  new1 integer;
  new2 integer;
  result kl_matches;
begin
  if p_player1_id = p_player2_id then
    raise exception 'Pick two different players.';
  end if;
  if p_score1 < 0 or p_score2 < 0 then
    raise exception 'Scores must be whole numbers of 0 or more.';
  end if;

  select * into r1 from kl_players where id = p_player1_id for update;
  if r1.id is null then
    raise exception 'One of the players is missing.';
  end if;

  select * into r2 from kl_players where id = p_player2_id for update;
  if r2.id is null then
    raise exception 'One of the players is missing.';
  end if;

  expected1 := 1 / (1 + power(10::numeric, (r2.elo - r1.elo)::numeric / 400));
  if p_score1 > p_score2 then
    actual1 := 1;
  elsif p_score1 < p_score2 then
    actual1 := 0;
  else
    actual1 := 0.5;
  end if;

  new1 := round(r1.elo + 32 * (actual1 - expected1));
  new2 := round(r2.elo + 32 * ((1 - actual1) - (1 - expected1)));

  insert into kl_matches (
    player1_id,
    player2_id,
    score1,
    score2,
    player1_elo_before,
    player2_elo_before,
    player1_elo_after,
    player2_elo_after
  ) values (
    p_player1_id,
    p_player2_id,
    p_score1,
    p_score2,
    r1.elo,
    r2.elo,
    new1,
    new2
  )
  returning * into result;

  update kl_players set elo = new1 where id = p_player1_id;
  update kl_players set elo = new2 where id = p_player2_id;

  return result;
end;
$$;

revoke all on function kl_record_match(uuid, uuid, integer, integer) from public;
grant execute on function kl_record_match(uuid, uuid, integer, integer) to anon, authenticated;
