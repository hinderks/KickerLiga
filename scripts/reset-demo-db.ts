// npm run demo:reset: puts the demo database back to the start state of
// lecture 7 (migrations committed in git plus supabase/seed.sql).
// Refuses while supabase/migrations/ holds uncommitted files, because
// those would be applied too. Clean up the last demo run first:
//   git restore . && git clean -fd supabase/migrations src

import { execFileSync } from "node:child_process"
import { loadDemoEnv, runSupabase, tail } from "./demo-db.ts"

const root = process.cwd()
const demo = loadDemoEnv(root)

const pending = execFileSync("git", ["status", "--porcelain", "supabase/migrations"], {
  cwd: root,
  encoding: "utf8",
}).trim()
if (pending) {
  console.error(`Uncommitted migrations, reset aborted:\n${pending}`)
  process.exit(1)
}

console.log(`Resetting demo project ${demo.projectRef} ...`)
const result = await runSupabase(["db", "reset"], root, demo.dbUrl)
console.log(tail(result.output))
process.exit(result.ok ? 0 : 1)
