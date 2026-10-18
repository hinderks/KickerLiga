# KickerLiga

Web app for the table football league of our faculty: players, 1v1 matches, Elo ranking.
React 19, TypeScript strict, Vite, Tailwind CSS v4, react-router-dom 7, supabase-js v2, Vitest, ESLint 9.
The backend is a Supabase cloud project. There is no application server.

## Commands

- Test: `npm test`
- Type check: `npm run typecheck`
- Lint: `npm run lint`

## Database

- All tables, functions and indexes use the prefix `kl_`.
- Schema changes only as a new file `supabase/migrations/NNNN_description.sql`, numbered after the
  highest existing number. Never edit an existing migration: the cloud database has already applied it.
- The cloud database already contains players and matches. Every migration must work on existing rows.
- Enable row level security on every new table and add policies in the style of `0001`.
- Logic that changes ratings runs in Postgres functions (RPC), for example `kl_record_match`.
  Client code never computes or writes Elo values.
- There is no local database. You cannot apply migrations; write SQL carefully.

## Code

- Data access only in `src/lib/api.ts`, through the supabase-js client. No ORM, no extra data library.
- Shared types in `src/lib/types.ts`. Pure helpers in `src/lib/` with tests next to them (`*.test.ts`).
- Do not add dependencies.
- Never read or write `.env` files.

## Done means

- `npm test`, `npm run typecheck` and `npm run lint` pass.
- New logic in TypeScript has tests.
- Your final message lists what you changed and what you could not verify.
