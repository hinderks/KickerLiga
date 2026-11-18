// The KickerLiga eval set: eight tasks from one-liner to feature.
//
// start  git ref the task starts from (app state; the harness comes from --harness)
// check  test files that decide pass or fail. "hidden" checks live in
//        evals/tasks/<id>/check.test.ts and are copied in only after the agent
//        has finished, so the agent cannot read or game them.
// minutes  wall-clock budget per run; the step limit comes from the harness.

export type EvalTask = {
  id: string
  size: 'S' | 'M' | 'L'
  start: string
  minutes: number
  check: { hidden: true } | { hidden: false; files: string[] }
}

export const TASKS: EvalTask[] = [
  { id: 'win-rate', size: 'S', start: 'vl08', minutes: 10, check: { hidden: true } },
  { id: 'rename-player', size: 'S', start: 'vl08', minutes: 10, check: { hidden: true } },
  { id: 'season-standings', size: 'S', start: 'vl08', minutes: 10, check: { hidden: true } },
  { id: 'head-to-head', size: 'M', start: 'vl08', minutes: 15, check: { hidden: true } },
  { id: 'score-limit', size: 'M', start: 'vl08', minutes: 15, check: { hidden: true } },
  { id: 'undo-last-match', size: 'M', start: 'vl08', minutes: 15, check: { hidden: true } },
  {
    id: 'season-close',
    size: 'L',
    start: 'vl07',
    minutes: 25,
    check: { hidden: false, files: ['tests/acceptance/season-close.test.ts'] },
  },
  {
    id: 'tournament-mode',
    size: 'L',
    start: 'vl08',
    minutes: 40,
    check: { hidden: false, files: ['tests/acceptance/tournament-mode.test.ts'] },
  },
]
