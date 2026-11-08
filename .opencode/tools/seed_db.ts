// seed_db: rebuilds the demo database from scratch (`supabase db reset`):
// drops all tables and functions, applies every file in
// supabase/migrations/ in order, then loads supabase/seed.sql.
// Only the demo project from .env.demo is accepted (scripts/demo-db.ts).
//
// Errors are returned as text, never thrown.

import { tool } from "@opencode-ai/plugin"
import { loadDemoEnv, runSupabase, tail } from "../../scripts/demo-db.ts"

export default tool({
  description:
    "Rebuild the demo database: drop everything, apply all migrations in " +
    "supabase/migrations/ in order, load supabase/seed.sql. Use it when a migration " +
    "you created in this task failed or was wrong and you have fixed the file, or " +
    "when you need the known seed data again. Takes up to a minute.",
  args: {},
  async execute(_args, context) {
    let demo
    try {
      demo = loadDemoEnv(context.worktree)
    } catch (error) {
      return `FAILED: ${(error as Error).message}`
    }
    const result = await runSupabase(["db", "reset"], context.worktree, demo.dbUrl)
    return `${result.ok ? "OK" : "FAILED"}\n${tail(result.output)}`
  },
})
