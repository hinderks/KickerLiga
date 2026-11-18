# Eval set and runner (lecture 8)

Eight KickerLiga tasks, from a one-liner to a feature, and a runner that starts OpenCode headless
on each of them, n times, and records whether the result passes, what it cost and how long it took.
Use it to compare two harness variants with the same model, tasks and budget.

The reference measurement of lecture 8 (design, setup, results, limits) is described in
`evals/README-reference-measurement.md`.

## Tasks

| Task | Size | Start | Check |
|---|---|---|---|
| `win-rate` | S | `vl08` | hidden: `winRate` in `src/lib/stats.ts` |
| `rename-player` | S | `vl08` | hidden: `renamePlayer` in `src/lib/api.ts` |
| `season-standings` | S | `vl08` | hidden: `listSeasonStandings` with player names |
| `head-to-head` | M | `vl08` | hidden: RPC `kl_head_to_head` and `headToHead` |
| `score-limit` | M | `vl08` | hidden: scores above 10 rejected; trap: a new `kl_record_match` copied from `0001` loses the season |
| `undo-last-match` | M | `vl08` | hidden: RPC `kl_undo_last_match` and `undoLastMatch` |
| `season-close` | L | `vl07` | visible: `tests/acceptance/season-close.test.ts` (the task of lecture 7) |
| `tournament-mode` | L | `vl08` | visible: `tests/acceptance/tournament-mode.test.ts` (the long task of lecture 8) |

Each task has `evals/tasks/<id>/prompt.md`, a check, and `reference.patch` with a reference
solution. Sizes, start refs and time budgets are in `evals/tasks.ts`.

**pass** means: acceptance tests of the task, unit tests, `npm run typecheck` and `npm run lint`
all green, that is the technical and functional part of the definition of done in `AGENTS.md`.

## Running

Prerequisites as for the lecture 7 demo: `.env.demo` with the demo project, Supabase CLI on PATH,
OpenCode on PATH (pinned version), `npm install`.

    npm run eval -- --self-test                      # no model: checks fail at start, pass with the reference
    npm run eval -- --harness vl08 --runs 3          # baseline harness, all tasks, n = 3
    npm run eval -- --harness vl08-long --runs 3     # long-task harness, same tasks
    npm run eval -- --harness vl08 --runs 3 --tasks win-rate,tournament-mode

Options: `--harness <git ref>` (whose `AGENTS.md`, `opencode.json` and `.opencode/` are used, default
`HEAD`), `--runs n`, `--k k` for pass@k (default 3), `--tasks a,b`, `--model provider/model`,
`--bash harness|allow`, `--keep` (keep the sandboxes for inspection).

Start with `--self-test`. It costs no tokens and shows that every check fails before and passes
after a correct solution, against your demo project.

Results go to `evals/results/<date>-<harness>.md` (table per task and overall) and `.csv` (one row
per run). Raw event logs, check output and session exports go to `evals/runs/` (ignored by git).

## What the runner does per run

1. Builds a sandbox in the temp directory: the start ref of the task, overlaid with the harness
   files of `--harness`, as its own git repository. `evals/` and `demos/` are removed, and the
   sandbox has no other branches, so the agent can see neither the checks nor the reference
   solutions. `node_modules` is linked, `.env.demo` is copied (never `.env.local`).
2. Resets the demo database to the start state (`supabase db reset`).
3. Runs `opencode run --format json "<prompt>"` in the sandbox, with `OPENCODE_DISABLE_AUTOUPDATE=1`,
   until it ends or the time budget runs out.
4. Resets the demo database again, which applies the agent's migrations, restores `tests/` from
   the start ref, copies a hidden check in, and runs the checks.
5. Reads token usage and cost with `opencode export` for the main session and every subagent
   session (the JSON event stream of `opencode run` contains only the main session).

All runs share the one demo database, so they run one after another.

## Headless permissions

In `opencode run`, a permission set to `ask` is rejected (OpenCode v1.18.31,
`packages/opencode/src/cli/cmd/run.ts`). With `--bash harness` (default) the harness is measured as
it is: every bash command that is not explicitly allowed fails. `--bash allow` sets
`OPENCODE_PERMISSION={"bash":{"*":"allow"}}` for the sandbox only; explicit `deny` rules such as
`git push *` still win, because the last matching rule decides. With `allow` the agent can run any
other command in the sandbox, including `cat .env.demo`; the plugin hook only guards the read tool.

## Known limits

- n = 3 per task is a small sample: report n next to every rate.
- Only the demo database guard of `scripts/demo-db.ts` protects the course project. Never point
  `.env.demo` at it.
- Cost is what the provider reports through OpenCode; for a local model it is 0, report tokens and
  minutes instead.
- For testing the runner without Supabase, `KL_EVAL_RESET_CMD` (a reset command that gets the
  sandbox path) and `KL_EVAL_VITEST_CONFIG` replace the database reset and the acceptance config.
