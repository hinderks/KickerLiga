# Lecture 7 demo: OpenCode until the acceptance tests pass

Branch `vl07`. The agent implements `specs/season-close.md`. The functional criteria
(AC1 to AC8) are executable tests in `tests/acceptance/`; the technical and organisational
criteria are the definition of done in `AGENTS.md`. The prompt in `prompt.md` states only
the functional part.

## What the harness adds compared to vl05

| Part | File | Role in the session |
|---|---|---|
| Acceptance tests | `tests/acceptance/season-close.test.ts` | functional criteria as checks |
| Definition of done | `AGENTS.md` | technical and organisational criteria (text) |
| Domain tools | `.opencode/tools/run_migrations.ts`, `seed_db.ts`, `run_tests.ts` | signal sources |
| Stop criterion | `opencode.json`, `agent.build.steps` = 40 | exit of the loop |
| Permissions | `opencode.json`, `permission` | agent cannot edit tests, configs or the harness |
| Hook | `.opencode/plugins/protect-checks.ts` | committed migrations and `.env` files protected |
| Guard | `scripts/demo-db.ts` | tools only reach the demo project |

## One-time setup

1. Create a second Supabase project (free tier) only for this demo.
2. `cp .env.demo.example .env.demo` and fill in ref, connection string, URL and publishable key.
3. Supabase CLI on PATH (`supabase --version`).
4. `npm install`, start OpenCode once so that `.opencode/node_modules` exists.

## Before every run (rehearsal and lecture)

    git switch vl07
    git restore . && git clean -fd supabase/migrations src   # remove the last run
    npm run demo:reset                                        # migrations 0001 + seed
    npm run test:acceptance                                   # must FAIL: no seasons yet
    npm test && npm run lint && npm run typecheck             # must pass

Then start `opencode` in the TUI (not `opencode run`: bash rules on "ask" are refused
headless) and paste `prompt.md`.

## What to point at during the run

- The first `run_tests` call with suite `acceptance`: which AC fails, with what message.
- The edit that follows the failure, then the next test run.
- The final message: does it list every item of the definition of done with its check?
- If the agent reaches 40 steps, OpenCode removes the tools and asks for a summary:
  the stop criterion in action.

## Fallback

Branch `vl07-solution` holds a reference implementation: migration `0002_seasons.sql`,
`closeSeason` in `src/lib/api.ts`, types and a changelog entry.

    git switch vl07-solution
    npm run demo:reset          # applies 0001, 0002 and the seed
    npm run test:acceptance     # all eight criteria green

Run `npm run demo:reset` on `vl07` again before the next rehearsal.

## Checked before handover (08.11.2026)

Against a local Postgres 16 with PostgREST 12.2.3 behind an HTTPS front, not against
Supabase itself:

- start state: all eight criteria fail with a readable message per criterion
- reference solution: 8 of 8 pass, both after `db push` onto seeded data and after a full reset,
  and on a second run against the same database
- three deliberate bugs are caught: integer division in the carry-over (AC6), `round` on
  double precision instead of numeric (AC6), standings that include idle players (AC4)
- guard refuses the course project and a connection string of another project
