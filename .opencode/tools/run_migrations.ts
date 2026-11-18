// run_migrations: applies new files in supabase/migrations/ to the demo
// database (`supabase db push`). Migrations already applied are skipped.
// Only the demo project from .env.demo is accepted (scripts/demo-db.ts);
// the agent never sees the connection string.
//
// Errors are returned as text, never thrown.

import { tool } from "@opencode-ai/plugin"
import { loadDemoEnv, runSupabase, tail } from "../../scripts/demo-db.ts"

export default tool({
  description:
    "Apply new migrations from supabase/migrations/ to the demo database. " +
    "Returns OK with the CLI output, or FAILED with the SQL error. Call it after " +
    "writing a migration and before run_tests with suite 'acceptance'.",
  args: {},
  async execute(_args, context) {
    let demo
    try {
      demo = loadDemoEnv(context.worktree)
    } catch (error) {
      return `FAILED: ${(error as Error).message}`
    }
    const result = await runSupabase(["db", "push"], context.worktree, demo.dbUrl)
    return `${result.ok ? "OK" : "FAILED"}\n${tail(result.output)}`
  },
})
