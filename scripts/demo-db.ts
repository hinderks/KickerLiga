// Demo database for lecture 7: loads .env.demo, refuses to touch
// anything but the demo project, and runs the Supabase CLI against it.
//
// seed_db and npm run demo:reset drop every table in the database they
// point at, so the guard is strict: the project ref must be set, the
// connection string and the API URL must both contain it, and it must
// differ from the project in .env.local (the course database).
//
// Used by the custom tools in .opencode/tools/, by
// vitest.acceptance.config.ts and by scripts/reset-demo-db.ts.

import { spawn } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"

export type DemoEnv = {
  projectRef: string
  dbUrl: string
  apiUrl: string
  publishableKey: string
}

function parseEnvFile(file: string): Record<string, string> {
  const result: Record<string, string> = {}
  for (const raw of readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith("#")) continue
    const eq = line.indexOf("=")
    if (eq < 0) continue
    let value = line.slice(eq + 1).trim()
    if (/^(["']).*\1$/.test(value)) value = value.slice(1, -1)
    result[line.slice(0, eq).trim()] = value
  }
  return result
}

function refOf(apiUrl: string): string | undefined {
  return /^https:\/\/([a-z0-9]+)\.supabase\.co\/?$/.exec(apiUrl)?.[1]
}

export function loadDemoEnv(root: string): DemoEnv {
  const file = path.join(root, ".env.demo")
  if (!existsSync(file)) {
    throw new Error(
      ".env.demo is missing. Copy .env.demo.example to .env.demo and fill in the demo project.",
    )
  }
  const env = parseEnvFile(file)
  const demo: DemoEnv = {
    projectRef: env.KL_DEMO_PROJECT_REF ?? "",
    dbUrl: env.KL_DEMO_DB_URL ?? "",
    apiUrl: env.VITE_SUPABASE_URL ?? "",
    publishableKey: env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "",
  }

  const missing = Object.entries({
    KL_DEMO_PROJECT_REF: demo.projectRef,
    KL_DEMO_DB_URL: demo.dbUrl,
    VITE_SUPABASE_URL: demo.apiUrl,
    VITE_SUPABASE_PUBLISHABLE_KEY: demo.publishableKey,
  })
    .filter(([, value]) => !value)
    .map(([key]) => key)
  if (missing.length) throw new Error(`.env.demo lacks: ${missing.join(", ")}`)

  if (refOf(demo.apiUrl) !== demo.projectRef) {
    throw new Error("VITE_SUPABASE_URL in .env.demo does not belong to KL_DEMO_PROJECT_REF.")
  }
  if (!demo.dbUrl.includes(demo.projectRef)) {
    throw new Error("KL_DEMO_DB_URL in .env.demo does not contain KL_DEMO_PROJECT_REF.")
  }

  const course = path.join(root, ".env.local")
  if (existsSync(course)) {
    const courseRef = refOf(parseEnvFile(course).VITE_SUPABASE_URL ?? "")
    if (courseRef === demo.projectRef) {
      throw new Error("The demo project is the course project from .env.local. Refusing.")
    }
  }
  return demo
}

// Hides the password of a connection string in CLI output.
export function mask(text: string, dbUrl: string): string {
  return text
    .split(dbUrl)
    .join("<demo db url>")
    .replace(/(postgres(?:ql)?:\/\/[^:\s]+:)[^@\s]+@/g, "$1***@")
}

export type CliResult = { ok: boolean; output: string }

// Runs `supabase <args> --db-url <demo> --yes` in root.
export function runSupabase(args: string[], root: string, dbUrl: string): Promise<CliResult> {
  return new Promise((resolve) => {
    let output = ""
    const child = spawn("supabase", [...args, "--db-url", dbUrl, "--yes"], {
      cwd: root,
      env: { ...process.env, NO_COLOR: "1" },
    })
    child.stdout.on("data", (chunk) => (output += chunk))
    child.stderr.on("data", (chunk) => (output += chunk))
    child.on("error", (error: NodeJS.ErrnoException) => {
      const hint =
        error.code === "ENOENT"
          ? "The Supabase CLI is not installed or not on PATH."
          : error.message
      resolve({ ok: false, output: hint })
    })
    child.on("close", (code) => resolve({ ok: code === 0, output: mask(output, dbUrl) }))
  })
}

// Keeps the last lines of long CLI output.
export function tail(text: string, lines = 40): string {
  return text.trim().split("\n").slice(-lines).join("\n")
}
