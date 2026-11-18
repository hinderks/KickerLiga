// Calls the custom tool describe_table directly, without a model.
// Usage: bun scripts/try-describe-table.ts kl_players
// Runs with Bun, the runtime OpenCode uses for tools; tsx fails because
// @opencode-ai/plugin only ships an ESM import entry. Needs
// .opencode/node_modules, which OpenCode installs on its first start.

import describeTable from "../.opencode/tools/describe_table.ts"

const table = process.argv[2] ?? "kl_players"
const context = { worktree: process.cwd() } as Parameters<
  typeof describeTable.execute
>[1]

console.log(await describeTable.execute({ table }, context))
