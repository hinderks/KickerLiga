// protect-checks: keeps the agent away from its own checks and secrets.
//
// opencode.json denies edits to tests, configs and the harness itself.
// This hook adds two rules that need code:
// - committed migrations (git ls-files) must not change: the cloud
//   database has applied them. A migration created in this task may.
// - .env files must not be read (the .example files may).
// Throwing an error stops the tool call; the model sees the message.

import type { Plugin } from "@opencode-ai/plugin"
import { execFileSync } from "node:child_process"
import path from "node:path"

const ENV_FILE = /(^|\/)\.env(\.|$)/

function committedMigrations(root: string): Set<string> {
  try {
    const out = execFileSync("git", ["ls-files", "supabase/migrations"], {
      cwd: root,
      encoding: "utf8",
    })
    return new Set(out.split("\n").filter(Boolean))
  } catch {
    return new Set()
  }
}

// Files an edit, write or apply_patch call would touch, relative to root.
function targets(tool: string, args: Record<string, unknown>, root: string): string[] {
  const rel = (file: string) => path.relative(root, path.resolve(root, file))
  if ((tool === "edit" || tool === "write") && typeof args.filePath === "string") {
    return [rel(args.filePath)]
  }
  if (tool === "apply_patch" && typeof args.patchText === "string") {
    const files = args.patchText.matchAll(/^\*\*\* (?:Update|Delete|Add) File: (.+)$/gm)
    return [...files].map((match) => rel(match[1].trim()))
  }
  return []
}

export const ProtectChecks: Plugin = async ({ worktree }) => ({
  "tool.execute.before": async (input, output) => {
    const args = (output.args ?? {}) as Record<string, unknown>

    if (input.tool === "read" && typeof args.filePath === "string") {
      const file = path.relative(worktree, path.resolve(worktree, args.filePath))
      if (ENV_FILE.test(file) && !file.endsWith(".example")) {
        throw new Error(`Reading ${file} is blocked: .env files hold secrets.`)
      }
    }

    const committed = committedMigrations(worktree)
    for (const file of targets(input.tool, args, worktree)) {
      if (committed.has(file)) {
        throw new Error(
          `${file} is a committed migration and must not change. ` +
            "Write a new migration with the next number instead.",
        )
      }
    }
  },
})
