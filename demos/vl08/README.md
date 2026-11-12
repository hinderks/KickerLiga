# Lecture 8 demo: a long task, and measuring the harness

Two parts. First OpenCode implements `specs/tournament-mode.md`, a task that does not fit into one
context window, once with the harness of lecture 7 and once with the long-task harness. Then the
eval runner compares both harness variants on eight tasks.

## Branches

| Branch | Content |
|---|---|
| `vl08` | start state: seasons from lecture 7 merged, spec `specs/tournament-mode.md`, acceptance tests AC1 to AC10, harness of lecture 7 unchanged, eval set in `evals/` |
| `vl08-long` | `vl08` plus the long-task harness, one commit per component (see below) |
| `vl08-solution` | `vl08` plus a reference implementation (fallback and screenshot) |

## What `vl08-long` adds, one commit each

| Part | File | Mechanism | Role in the session |
|---|---|---|---|
| Progress file | `AGENTS.md`, section "Long tasks" | text the agent reads (K3) | plan, decisions and open errors live in `notes/progress.md`, not only in the context |
| Command | `.opencode/commands/feature.md` | command (K3) | `/feature <spec>`: plan into the file, one step at a time, check after each step |
| Compaction hook | `.opencode/plugins/keep-progress.ts` | plugin hook `experimental.session.compacting` (K4) | hands `notes/progress.md` to the compaction prompt, so the summary keeps the plan |
| Subagent | `.opencode/agents/scout.md` | agent with `mode: subagent`, no edit, no bash (K4) | searches outside the main context, returns 15 lines at most |

Because each component is its own commit, the eval runner can measure them one at a time:
`--harness vl08-long~2` is the progress file alone, `vl08-long~1` adds the hook, `vl08-long` adds
the subagent. Names checked against the OpenCode source, tag v1.18.31.

Note on `scout`: it does not set `read`. A `read: allow` in an agent would come after the project
rules and override `*.env: deny`, because the last matching rule wins.

## One-time setup

As for lecture 7 (`demos/vl07/README.md`): demo project in `.env.demo`, Supabase CLI, `npm install`,
start OpenCode once in each branch so that `.opencode/node_modules` exists.

## Before every run (rehearsal and lecture)

    git switch vl08                                            # run 1; vl08-long for run 2
    git restore . && git clean -fd supabase/migrations src notes
    npm run demo:reset                                         # migrations 0001, 0002 + seed
    npm run test:acceptance                                    # tournament AC1 to AC10 FAIL, season close passes
    npm test && npm run lint && npm run typecheck              # must pass

Then start `opencode` in the TUI (not `opencode run`: bash rules on "ask" are refused headless).

## Run 1: harness of lecture 7 (`vl08`)

Paste `prompt.md`. What to point at:

- the context usage in the TUI as test output and file reads pile up;
- a compaction, if one happens: what the summary keeps and what the agent asks or reads again;
- the same files read several times;
- the step limit (40): OpenCode removes the tools and asks for a summary; the task is unfinished;
- the final message: does it claim done while acceptance tests are red?

## Run 2: long-task harness (`vl08-long`)

Type `/feature specs/tournament-mode.md`. What to point at:

- `notes/progress.md` appears first: the plan with a check per step;
- after each step: check, then the file is updated (decisions, open errors);
- calls to `scout` and the short answer that comes back;
- at the step limit: start a new session with `/feature specs/tournament-mode.md` again; it reads
  the file and continues with the first open step.

## Saving the logs for the slides

After each run, find the session id with `opencode session list` and export it:

    opencode export <session id> > demos/vl08/run1.json      # run2.json for the second run

Take two or three excerpts as text for the slide "What the log shows". The export holds token
counts per step (`step-finish`) and compactions (`compaction` parts).

## Forcing a compaction on stage (optional)

Qwen3.8-27B has a large context window, so 40 steps may never fill it. To show compaction within
the lecture, lower the window for this run only; say so on the slide:

    OPENCODE_CONFIG_CONTENT='{"provider":{"openrouter":{"models":{"qwen/qwen3.8-27b":{"limit":{"context":48000,"output":8192}}}}}}' opencode

`OPENCODE_CONFIG_CONTENT` is merged after the project config; `limit.context` is what OpenCode uses
to decide when the context overflows.

## Part 2: eval runner

See `evals/README.md`. Before the lecture:

    npm run eval -- --self-test                          # free; every line must say OK
    npm run eval -- --harness vl08 --runs 3              # baseline
    npm run eval -- --harness vl08-long~2 --runs 3       # progress file only: one change at a time

The two `.md` files in `evals/results/` give the values for the slide "Keep the change?". Live in
the lecture: one small task with n = 2, for example

    npm run eval -- --harness vl08-long --runs 2 --tasks win-rate

## Fallback

    git switch vl08-solution
    npm run demo:reset          # applies 0001, 0002, 0003 and the seed
    npm run test:acceptance     # season close 8 of 8, tournament 10 of 10
    npm run dev                 # create a tournament in the UI for the bracket screenshot

## Checked before handover (12.11.2026)

Against a local Postgres 16 with PostgREST 12.2.3 and Supabase-like roles and default privileges,
not against Supabase itself:

- start state: tournament AC1 to AC10 fail with a readable message per criterion
- reference solution: 10 of 10 pass, also on a second run against the same database; season close
  8 of 8 still pass
- six deliberate bugs are caught: seeding ascending (AC2 and more), sides swapped when advancing
  (AC3, AC5, AC6), byes not advancing (AC3), draws allowed (AC7), no champion (AC6, AC9),
  tie-break by name descending (AC2, AC5)
- eval runner `--self-test`: all eight tasks fail at the start and pass with the reference
- eval runner with a fake `opencode` binary: sandbox, checks, usage from `opencode export` including
  a subagent session, results table and CSV
- not checked: a real OpenCode run with a model, the Supabase CLI path of the runner
