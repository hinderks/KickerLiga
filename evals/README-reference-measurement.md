# KickerLiga eval: design and reference measurement

Lecture 8, AI in Software Development, WS 2026/27. Reference measurement on 15.11.2026.
Code: folder `evals/` in branch `vl08` of the KickerLiga repository.

## 1. Question

Does a progress file for long tasks make the harness measurably better, and what does it cost?

Two harness variants are compared that differ in exactly one component. Everything else is held
fixed: model, OpenCode version, context window, tasks, start states and budgets.

## 2. The two harnesses

Both variants are OpenCode configurations in the repository: `AGENTS.md`, `opencode.json` and the
folder `.opencode/`. The runner takes these three from the git ref given with `--harness`.

### Baseline: `vl08` (harness of lecture 7)

| Part | File | Content |
|---|---|---|
| Context | `AGENTS.md` | stack, commands, database rules (prefix `kl_`, new migrations only, RLS), code rules, definition of done (functional, technical, organisational) |
| Domain tools | `.opencode/tools/` | `run_migrations` (applies new migrations to the demo database), `seed_db` (rebuilds the demo database), `run_tests` (Vitest, short structured result), `describe_table` |
| Permissions | `opencode.json` | read and edit allowed, except tests, configs, the harness itself and `.env` files; bash `ask` by default, a few npm and git commands allowed, `git commit` and `git push` denied; `external_directory` denied |
| Hook | `.opencode/plugins/protect-checks.ts` | blocks edits to committed migrations and reads of `.env` files |
| Stop criterion | `opencode.json` | `agent.build.steps` = 40 |

### Variant: `vl08-long~2` (baseline plus progress file)

Adds one component, in one commit:

- `AGENTS.md`, new section "Long tasks": keep the plan in `notes/progress.md`, read it first if it
  exists, otherwise create it from the spec as small steps with a check each; after each step run
  the check and update the file (ticked steps, decisions, open errors); update it before stopping.
- `.opencode/commands/feature.md`: command `/feature <spec>` that applies this rule.

The eval prompts do not call `/feature`, so in the measurement only the `AGENTS.md` rule takes
effect. The full long-task harness `vl08-long` adds two more commits (a compaction hook that hands
`notes/progress.md` to the compaction prompt, and a read-only subagent `scout`); these were shown in
the demo runs but not measured.

## 3. The eight tasks

Each task has a prompt (`evals/tasks/<id>/prompt.md`), a start ref, a time budget, an automatic
check and a reference solution (`reference.patch`). Defined in `evals/tasks.ts`.

| Task | Size | Start | Budget | What the agent has to do | Check |
|---|---|---|---|---|---|
| `win-rate` | S | `vl08` | 10 min | `winRate(record)` in `src/lib/stats.ts`: (wins + draws / 2) / played, three decimals, 0 without matches, with unit tests | hidden: five input and output pairs |
| `rename-player` | S | `vl08` | 10 min | `renamePlayer(id, name)` in `src/lib/api.ts`: trims, rejects blank and taken names with fixed messages | hidden: rename against the database, both error messages |
| `season-standings` | S | `vl08` | 10 min | `listSeasonStandings(seasonId)`: standings by rank with the player name as a flat field | hidden: closes a season, checks order, name and counts |
| `head-to-head` | M | `vl08` | 15 min | migration with RPC `kl_head_to_head(a, b) returns json` plus `headToHead` in the API | hidden: counts from both sides, unknown player raises |
| `score-limit` | M | `vl08` | 15 min | reject scores above 10 in `kl_record_match`, everything else unchanged | hidden: 11 rejected, Elo and season of a valid match unchanged. Trap: a new `kl_record_match` copied from migration 0001 instead of 0002 loses the season |
| `undo-last-match` | M | `vl08` | 15 min | migration with RPC `kl_undo_last_match()` that restores both ratings and deletes the match, plus `undoLastMatch` | hidden: ratings restored, match deleted, API call |
| `season-close` | L | `vl07` | 25 min | `specs/season-close.md` (the task of lecture 7) | visible: `tests/acceptance/season-close.test.ts`, 8 criteria |
| `tournament-mode` | L | `vl08` | 40 min | `specs/tournament-mode.md`: knockout bracket with seeding, byes, two RPCs, API, helper with unit tests, UI | visible: `tests/acceptance/tournament-mode.test.ts`, 10 criteria |

Hidden checks live in `evals/tasks/<id>/check.test.ts` and are copied into the sandbox only after
the agent has finished. Visible checks are the acceptance tests the agent may read but not change.

**Pass** means all four green: acceptance tests of the task, unit tests (`vitest run`),
`npm run typecheck`, `npm run lint`. This is the technical and functional part of the definition of
done in `AGENTS.md`.

Before measuring, `npm run eval -- --self-test` shows for every task that the check fails at the
start ref and passes with the reference solution, against the real demo database.

## 4. How the runner executes a run

`npm run eval -- --harness <ref> --runs <n> [--tasks a,b] [--bash allow]` runs every task n times,
one run after another, because all runs share one demo database.

Per run:

1. **Sandbox.** A fresh directory in the temp folder: the task's start ref (`git archive`), with
   `AGENTS.md`, `opencode.json` and `.opencode/` replaced by those of the harness ref. The folders
   `evals/` and `demos/` are removed, and the sandbox becomes its own git repository with one
   commit. The agent therefore sees neither the checks nor any reference solution, and no other
   branches. `node_modules` is linked, `.env.demo` is copied (never `.env.local`).
2. **Database reset.** `supabase db reset` against the demo project: migrations of the start state
   plus seed data.
3. **Agent run, headless.** `opencode run --format json --dir <sandbox> "<prompt>"` with:
   - `PWD` set to the sandbox (OpenCode takes its project root from `PWD` before the cwd);
   - stdin closed (`opencode run` otherwise waits for the end of piped input);
   - `OPENCODE_DISABLE_AUTOUPDATE=1`;
   - with `--bash allow`: `OPENCODE_PERMISSION={"bash":{"*":"allow"}}` for this process only.
     Headless, every permission set to `ask` is rejected and ends the run; explicit `deny` rules
     such as `git push *` still win, because the last matching rule decides.
   The run ends when the agent stops (finished or step limit 40) or when the time budget is over.
   The JSON event stream is saved to `evals/runs/`.
4. **Check.** The database is reset again, which applies the agent's migrations to a fresh
   database. `tests/` is restored from the start commit, so changed tests do not count; a hidden
   check is copied in. Then acceptance tests, unit tests, typecheck and lint run.
5. **Usage.** `opencode export <session>` for the main session and every subagent session found in
   the stream (the stream of `opencode run` contains only the main session). The export goes
   straight into a file; through a pipe it is cut off at about 64 KB.

## 5. What is measured and how

| Measure | Source | Definition |
|---|---|---|
| pass | check, step 4 | all four checks green |
| pass@1, pass@k per task | n runs, c passes | unbiased estimator 1 - C(n-c, k) / C(n, k) (Chen et al., 2021, Section 2.1, Equation 1); for k = 1 this is c / n. The overall value is the mean over tasks |
| tokens per run | `step-finish` parts of the export | input + output + reasoning + cache read + cache write, main and subagent sessions |
| cost per run | `step-finish` parts | as reported by the provider through OpenCode |
| minutes per run | runner clock | start to end of `opencode run` |
| steps per run | export | number of `step-finish` parts |
| compactions per run | export | number of `compaction` parts |

Output per measurement: `evals/results/<date>-<harness>.md` (table per task and overall) and `.csv`
(one row per run, with each check separately).

## 6. Setup of the reference measurement

| Fixed | Value |
|---|---|
| Model | `openrouter/qwen/qwen3.8-27b`, provider order Alibaba, no fallbacks |
| OpenCode | 1.19.3 (the module pins 1.18.31; an update slipped through, see limits) |
| Context window | limited to 80,000 tokens with output 8,192, via `OPENCODE_CONFIG_CONTENT` |
| Runs | n = 2 per task and variant, 32 runs in total |
| Bash | `--bash allow` |
| Order | all baseline runs first, then all variant runs |

Why 80K: with the full window the long task fits into one session (demo run 1: 9 percent of the
window used, no compaction, 10 of 10), so the progress file has nothing to do. At 48K the window is
smaller than what the task needs at once, and no harness solves it (demo runs: 0 of 10 with both
harnesses). At 80K a compaction falls into the middle of the long tasks.

Why `--bash allow`: with the harness as it is, the first bash command outside the allow list ends a
headless run ("permission requested: bash (…); auto-rejecting"). The measurement would then mostly
reflect whether the model happens to call `ls`, not the harness.

## 7. Results

| | Baseline (`vl08`) | Progress file (`vl08-long~2`) |
|---|---|---|
| Passed | 12 of 16 | 16 of 16 |
| pass@1, mean over tasks | 0.75 | 1.00 |
| Large tasks passed | 1 of 4 | 4 of 4 |
| Small and medium tasks passed | 11 of 12 | 12 of 12 |
| Tokens per run | 1.12 M | 1.24 M (+11 percent) |
| Cost per run | 0.095 USD | 0.107 USD (+12 percent) |
| Minutes per run | 6.3 | 6.5 |
| Steps per run | 26.8 | 27.6 |
| Compactions per run | 0.3 | 0.3 |

Per task (passed of 2, tokens per run):

| Task | Baseline | Progress file |
|---|---|---|
| `win-rate` | 2, 0.32 M | 2, 0.22 M |
| `rename-player` | 2, 0.56 M | 2, 0.69 M |
| `season-standings` | 1, 0.78 M | 2, 1.51 M |
| `head-to-head` | 2, 0.97 M | 2, 1.51 M |
| `score-limit` | 2, 1.42 M | 2, 1.44 M |
| `undo-last-match` | 2, 1.13 M | 2, 1.15 M |
| `season-close` | 1, 1.78 M | 2, 1.37 M |
| `tournament-mode` | 0, 1.99 M | 2, 2.01 M |

The four failed baseline runs:

- `tournament-mode` run 1: all 10 acceptance criteria green, unit tests red. With the acceptance
  tests alone as the check, this would have counted as a pass.
- `tournament-mode` run 2: the agent's migration does not apply to a fresh database
  (`syntax error at or near "declare"`); it only ran on the agent's intermediate state.
- `season-close` run 2: 2 of 8 criteria, typecheck red.
- `season-standings` run 1: the hidden check found an empty `name` field the agent had not noticed.

## 8. Interpretation

What the numbers say: the progress file rule raised pass@1 from 0.75 to 1.00 at about 11 percent
more tokens. The gain sits almost entirely in the two large tasks (1 of 4 against 4 of 4). Since
compactions were equally rare in both variants, the effect is not fewer compactions but that the
work, including the definition of done, gets finished within the step limit.

What they do not say: n = 2 is a small sample; one run more or less per task changes the rates
noticeably. The variants ran one after the other, not alternating, so provider load could differ.
It is one model, one OpenCode version and one artificial window size. For small tasks the rule
brought no measurable gain and sometimes cost tokens.

What to measure next: more runs per task, alternating order, the rule only for large tasks, and the
two further components of `vl08-long` (compaction hook, subagent) one at a time.

## 9. Limits and lessons from building the runner

- OpenCode ran as 1.19.3 although 1.18.31 is pinned; the version belongs in every results table.
- Three runner bugs surfaced only against the real OpenCode, not against a fake binary: open stdin
  (every run waited until its budget ran out), the project root taken from `PWD` (the agent worked
  in the main repository and could read the hidden checks), and the export cut off in a pipe
  (0 tokens reported). Each was fixed and the fake binary changed to behave like OpenCode.
- With `--bash allow` the agent can run any command in the sandbox, including reading `.env.demo`;
  only the demo database is reachable. In a demo run, the agent read the demo credentials through
  code (`loadDemoEnv`) although the read tool blocks `.env` files: a read rule does not stop code
  the agent executes.

## 10. Reproduce

After cloning, create local branches for the refs the runner uses (start states and harness
variants); `git archive` does not resolve `origin/...` by the short name:

    git fetch origin
    git branch vl07 origin/vl07
    git branch vl08-long origin/vl08-long
    git switch vl08

Then:

```
npm run eval -- --self-test
export OPENCODE_CONFIG_CONTENT='{"provider":{"openrouter":{"models":{"qwen/qwen3.8-27b":{"limit":{"context":80000,"output":8192}}}}}}'
npm run eval -- --harness vl08 --runs 2 --bash allow
npm run eval -- --harness vl08-long~2 --runs 2 --bash allow
```

Prerequisites: `.env.demo` with a separate Supabase demo project (copy `.env.demo.example`; never the
course project), Supabase CLI, OpenCode on the PATH with an OpenRouter key, `npm install`.

Raw logs and session exports go to `evals/runs/`, which git ignores. Do not publish them unchanged:
with `--bash allow` they can contain the content of `.env.demo`. To share a session, use
`opencode export --sanitize <session>`.

## Source

Chen, M., Tworek, J., Jun, H., Yuan, Q., Pinto, H. P. de O., et al. (2021). *Evaluating large
language models trained on code*. arXiv. https://doi.org/10.48550/arXiv.2107.03374
