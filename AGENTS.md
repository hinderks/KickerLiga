# KickerLiga

Web app for the table football league of our faculty: players, 1v1 matches, Elo ranking.
React 19, TypeScript strict, Vite, Tailwind CSS v4, react-router-dom 7, supabase-js v2, Vitest, ESLint 9.
The backend is a Supabase cloud project. There is no application server.
Specifications live in `specs/`.

## Commands

- Unit tests: `npm test` (or the tool `run_tests` with suite `unit`)
- Type check: `npm run typecheck`
- Lint: `npm run lint`
- Build: `npm run build`

## Database

- All tables, functions and indexes use the prefix `kl_`.
- Schema changes only as a new file `supabase/migrations/NNNN_description.sql`, numbered after the
  highest existing number.
- Never edit a migration that is committed to git: the cloud database has already applied it.
  A migration you created in the current task may be changed; then rebuild with `seed_db`.
- Every migration must work on existing rows. The database already contains players and matches.
- Enable row level security on every new table and add policies in the style of `0001`.
- Logic that changes ratings runs in Postgres functions (RPC), for example `kl_record_match`.
  Client code never computes or writes Elo values.
- You work against a demo database, never the course database. Use these tools:
  - `run_migrations` applies new migrations.
  - `seed_db` rebuilds the demo database: all migrations from scratch, then `supabase/seed.sql`.
  - `run_tests` with suite `acceptance` runs `tests/acceptance/` against the demo database.

## Code

- Data access only in `src/lib/api.ts`, through the supabase-js client. No ORM, no extra data library.
- Shared types in `src/lib/types.ts`. Pure helpers in `src/lib/` with tests next to them (`*.test.ts`).
- Do not add dependencies.
- Never read or write `.env` files.

## Definition of done

A task is done only when every item below holds. Your final message lists each item with the
check you ran and its result.

Functional
- The acceptance tests named in the task pass: `run_migrations`, then `run_tests` with suite
  `acceptance`.

Technical
- `run_tests` with suite `unit` passes.
- `npm run typecheck`, `npm run lint` and `npm run build` pass.
- New logic in TypeScript has unit tests next to it.

Organisational
- One entry in `CHANGELOG.md` under `Unreleased`, in the style of the existing entries.
- No commit, no push: leave all changes in the working tree for review.

Never change tests, test or lint configuration, or thresholds to make a check pass.
If a check cannot pass, stop and explain why.
