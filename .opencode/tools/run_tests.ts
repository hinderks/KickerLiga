// run_tests: runs Vitest and returns a short, structured result.
//
// suite "unit" runs src/**/*.test.ts (vite.config.ts), "acceptance" runs
// tests/acceptance/ against the demo database (vitest.acceptance.config.ts),
// "all" runs both. Only failures come back in detail: test name and the
// first lines of the message. Raw Vitest output would fill the context.
//
// Errors are returned as text, never thrown: the model reads them and
// can correct its next step. Only the default export: every named
// export would become a tool of its own.

import { tool } from "@opencode-ai/plugin"
import { spawn } from "node:child_process"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"

type Suite = "unit" | "acceptance"
const CONFIG: Record<Suite, string[]> = {
  unit: [],
  acceptance: ["--config", "vitest.acceptance.config.ts"],
}

type Assertion = { fullName: string; status: string; failureMessages?: string[] }
type FileResult = { name: string; message?: string; assertionResults?: Assertion[] }
type Report = { numTotalTests: number; numPassedTests: number; testResults: FileResult[] }

const ANSI = new RegExp(String.fromCharCode(27) + "\\[[0-9;]*m", "g")

// First lines of a failure, without stack frames.
function short(message: string, root: string): string {
  return message
    .replace(ANSI, "")
    .split("\n")
    .filter((line) => !/^\s+at /.test(line))
    .slice(0, 8)
    .join("\n    ")
    .replaceAll(root + path.sep, "")
    .slice(0, 800)
}

function vitest(root: string, args: string[]): Promise<string> {
  return new Promise((resolve) => {
    let output = ""
    const bin = path.join(root, "node_modules", ".bin", "vitest")
    const child = spawn(bin, ["run", ...args], {
      cwd: root,
      env: { ...process.env, FORCE_COLOR: "0", NO_COLOR: "1" },
    })
    child.stdout.on("data", (chunk) => (output += chunk))
    child.stderr.on("data", (chunk) => (output += chunk))
    child.on("error", (error) => resolve(`could not start vitest: ${error.message}`))
    child.on("close", () => resolve(output))
  })
}

async function runSuite(suite: Suite, root: string): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "run-tests-"))
  const file = path.join(dir, "report.json")
  try {
    const output = await vitest(root, [
      ...CONFIG[suite],
      "--reporter=json",
      `--outputFile=${file}`,
    ])
    let report: Report
    try {
      report = JSON.parse(await readFile(file, "utf8")) as Report
    } catch {
      const lastLines = output.replace(ANSI, "").trim().split("\n").slice(-25)
      return `suite ${suite}: ERROR, Vitest wrote no report\n    ${lastLines.join("\n    ")}`
    }

    const lines: string[] = []
    for (const result of report.testResults) {
      const rel = path.relative(root, result.name)
      if (result.message) lines.push(`FILE ERROR ${rel}\n    ${short(result.message, root)}`)
      for (const test of result.assertionResults ?? []) {
        if (test.status === "skipped" || test.status === "pending") {
          lines.push(`SKIPPED ${test.fullName}`)
        }
        if (test.status !== "failed") continue
        const message = short((test.failureMessages ?? []).join("\n"), root)
        lines.push(`FAIL ${test.fullName}\n    ${message}`)
      }
    }
    const passed = report.numPassedTests === report.numTotalTests && lines.length === 0
    const head = `suite ${suite}: ${passed ? "PASS" : "FAIL"}, ${report.numPassedTests} of ${report.numTotalTests} tests passed`
    return [head, ...lines].join("\n")
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

export default tool({
  description:
    "Run the Vitest tests and get a short result: PASS, or FAIL with the name and " +
    "message of each failing test. suite 'unit' runs src/**/*.test.ts, 'acceptance' " +
    "runs tests/acceptance/ against the demo database (call run_migrations first), " +
    "'all' runs both. Use this instead of calling vitest through bash.",
  args: {
    suite: tool.schema
      .enum(["unit", "acceptance", "all"])
      .default("all")
      .describe("Which tests to run"),
  },
  async execute(args, context) {
    const suites: Suite[] = args.suite === "all" ? ["unit", "acceptance"] : [args.suite]
    const results: string[] = []
    for (const suite of suites) results.push(await runSuite(suite, context.worktree))
    return results.join("\n\n")
  },
})
