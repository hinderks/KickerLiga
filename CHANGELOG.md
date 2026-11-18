# Changelog

All notable changes to KickerLiga. One line per change under `Unreleased`, newest first,
starting with Added, Changed or Fixed and naming the spec or file it concerns.

## Unreleased

- Added: eval set with eight tasks and runner `npm run eval` (`evals/`).
- Added: acceptance tests for `specs/tournament-mode.md` (AC1 to AC10) against the demo database.
- Added: seasons and season close (`specs/season-close.md`): migration `0002_seasons.sql`, `closeSeason` in `src/lib/api.ts`.
- Added: acceptance tests for `specs/season-close.md` (AC1 to AC8) against a demo database.
- Added: demo tools `run_migrations`, `seed_db` and `run_tests` for OpenCode.
- Added: custom tool `describe_table` for OpenCode.
