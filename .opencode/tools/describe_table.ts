// describe_table: column names and types of one KickerLiga table.
//
// Source of truth are the migrations in supabase/migrations/,
// replayed in file name order. There is no local database and the
// agent has no database credentials, so the schema is read from the
// SQL files, not queried. Covered: create table, drop table, alter
// table (rename to, add/drop/rename column, alter column type,
// set/drop not null). Anything else is ignored.
//
// Errors are returned as text, never thrown: the model reads them
// and can correct its next call.
//
// Only the default export: every named export would become a tool
// of its own.

import { tool } from "@opencode-ai/plugin"
import { readdir, readFile } from "node:fs/promises"
import path from "node:path"

type Column = { name: string; type: string; nullable: boolean }
type Schema = Map<string, Column[]>

const MIGRATIONS = "supabase/migrations"

const TYPE_END = new RegExp(
  "\\s+(not\\s+null|null|default|primary\\s+key|references|unique" +
    "|check|constraint|generated|collate)\\b",
  "i",
)
const TABLE_CONSTRAINT =
  /^(constraint|primary\s+key|unique|check|foreign\s+key|exclude)\b/i

const CREATE =
  /^create\s+table\s+(?:if\s+not\s+exists\s+)?("?[\w.]+"?)\s*\((.*)\)$/i
const DROP =
  /^drop\s+table\s+(?:if\s+exists\s+)?(.+?)(?:\s+cascade|\s+restrict)?$/i
const ALTER =
  /^alter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?("?[\w.]+"?)\s+(.+)$/i

function stripSql(sql: string): string {
  return sql
    .replace(/\$(\w*)\$[\s\S]*?\$\1\$/g, "''") // function bodies
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--[^\n]*/g, " ")
}

// Split on commas outside of parentheses, e.g. in numeric(10, 2).
function splitTopLevel(s: string): string[] {
  const parts: string[] = []
  let depth = 0
  let current = ""
  for (const ch of s) {
    if (ch === "(") depth++
    if (ch === ")") depth--
    if (ch === "," && depth === 0) {
      parts.push(current.trim())
      current = ""
    } else {
      current += ch
    }
  }
  if (current.trim()) parts.push(current.trim())
  return parts
}

const ident = (s: string) =>
  s.replace(/"/g, "").replace(/^public\./i, "").toLowerCase()

function parseColumn(def: string): Column | undefined {
  if (TABLE_CONSTRAINT.test(def)) return undefined
  const m = def.match(/^("?\w+"?)\s+(.+)$/)
  if (!m) return undefined
  const rest = m[2]
  const cut = rest.search(TYPE_END)
  const type = (cut === -1 ? rest : rest.slice(0, cut)).trim()
  const nullable =
    !/\bnot\s+null\b/i.test(rest) && !/\bprimary\s+key\b/i.test(rest)
  return { name: ident(m[1]), type: type.toLowerCase(), nullable }
}

function applyAlter(schema: Schema, table: string, actions: string) {
  for (const action of splitTopLevel(actions)) {
    const cols = schema.get(table)
    if (!cols) return
    const find = (name: string) => cols.find((c) => c.name === ident(name))
    let m: RegExpMatchArray | null
    if ((m = action.match(/^rename\s+to\s+("?\w+"?)$/i))) {
      schema.delete(table)
      schema.set(ident(m[1]), cols)
      return
    }
    if (/^(add|drop)\s+constraint\b/i.test(action)) continue
    if ((m = action.match(
      /^rename\s+(?:column\s+)?("?\w+"?)\s+to\s+("?\w+"?)$/i))) {
      const col = find(m[1])
      if (col) col.name = ident(m[2])
    } else if ((m = action.match(
      /^add\s+(?:column\s+)?(?:if\s+not\s+exists\s+)?(.+)$/i))) {
      const col = parseColumn(m[1])
      if (col && !find(col.name)) cols.push(col)
    } else if ((m = action.match(
      /^drop\s+(?:column\s+)?(?:if\s+exists\s+)?("?\w+"?)/i))) {
      const name = ident(m[1])
      schema.set(table, cols.filter((c) => c.name !== name))
    } else if ((m = action.match(
      /^alter\s+(?:column\s+)?("?\w+"?)\s+(.+)$/i))) {
      const col = find(m[1])
      if (!col) continue
      const change = m[2]
      if (/^set\s+not\s+null/i.test(change)) col.nullable = false
      if (/^drop\s+not\s+null/i.test(change)) col.nullable = true
      const t = change.match(
        /^(?:set\s+data\s+)?type\s+(.+?)(?:\s+using\b.*)?$/i)
      if (t) col.type = t[1].trim().toLowerCase()
    }
  }
}

// Replay all migrations in file name order: 0001, 0002, ...
async function loadSchema(root: string): Promise<Schema> {
  const dir = path.join(root, MIGRATIONS)
  const files = (await readdir(dir))
    .filter((f) => f.endsWith(".sql"))
    .sort()
  const schema: Schema = new Map()
  for (const file of files) {
    const sql = stripSql(await readFile(path.join(dir, file), "utf8"))
    for (const raw of sql.split(";")) {
      const stmt = raw.trim().replace(/\s+/g, " ")
      let m: RegExpMatchArray | null
      if ((m = stmt.match(CREATE))) {
        const cols = splitTopLevel(m[2])
          .map(parseColumn)
          .filter((c): c is Column => !!c)
        schema.set(ident(m[1]), cols)
      } else if ((m = stmt.match(DROP))) {
        for (const t of splitTopLevel(m[1])) schema.delete(ident(t))
      } else if ((m = stmt.match(ALTER))) {
        applyAlter(schema, ident(m[1]), m[2])
      }
    }
  }
  return schema
}

function format(cols: Column[]): string {
  const w1 = Math.max(...cols.map((c) => c.name.length))
  const w2 = Math.max(...cols.map((c) => c.type.length))
  return cols
    .map((c) =>
      [c.name.padEnd(w1), c.type.padEnd(w2),
        c.nullable ? "nullable" : "not null"].join("  "))
    .join("\n")
}

export default tool({
  description:
    "Returns column names and types of one KickerLiga table " +
    "(prefix kl_). Use before writing a query against a table. " +
    "Returns no row data. Reads the schema from " +
    "supabase/migrations/, not from the cloud database.",
  args: {
    table: tool.schema
      .string()
      .describe('Table name, starts with "kl_", e.g. kl_players'),
  },
  async execute(args, context) {
    try {
      const name = ident(args.table.trim())
      const schema = await loadSchema(context.worktree)
      const known = [...schema.keys()]
        .filter((t) => t.startsWith("kl_"))
        .sort()
      if (!name.startsWith("kl_") || !schema.has(name)) {
        return `Unknown table '${args.table}'. ` +
          `Known tables: ${known.join(", ") || "none"}.`
      }
      const cols = schema.get(name)!
      if (cols.length === 0) {
        return `Table '${name}' has no columns in the migrations.`
      }
      return format(cols)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return `describe_table failed: ${msg}. ` +
        `Check that ${MIGRATIONS}/ exists in the project root.`
    }
  },
})
