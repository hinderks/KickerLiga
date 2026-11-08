-- Seed data for the demo database (lecture 7).
-- Runs after all migrations on `supabase db reset`. Works before and after
-- 0002_seasons.sql exists: matches go through kl_record_match, which keeps
-- its signature and assigns the open season once seasons exist.
-- The acceptance test AC1 relies on these four player ids.

insert into kl_players (id, name, elo) values
  ('00000000-0000-4000-8000-000000000001', 'Ada', 1500),
  ('00000000-0000-4000-8000-000000000002', 'Ben', 1500),
  ('00000000-0000-4000-8000-000000000003', 'Cleo', 1500),
  ('00000000-0000-4000-8000-000000000004', 'Dan', 1500);

select kl_record_match('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', 10, 6);
select kl_record_match('00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000004', 8, 10);
select kl_record_match('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000003', 10, 10);
