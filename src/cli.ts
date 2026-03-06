#!/usr/bin/env bun
import { sources } from "./sources/index.js"
import type { ErrorEnvelope, FetchEnvelope, ListEnvelope, SourceMeta } from "./types.js"
import { NEWS_ITEM_FIELDS } from "./types.js"

interface ParsedArgs {
  command: string | undefined
  json: boolean
  pretty: boolean
  fields: string[]
  limit: number | undefined
}

function parseArgs(argv: string[]): ParsedArgs {
  const raw = argv.slice(2)
  let json = false
  let pretty = false
  const fields: string[] = []
  let limit: number | undefined
  let command: string | undefined

  for (let i = 0; i < raw.length; i++) {
    const arg = raw[i]
    if (arg === "--json") {
      json = true
    } else if (arg === "--output" && raw[i + 1] === "json") {
      json = true
      i++
    } else if (arg === "--pretty") {
      pretty = true
    } else if (arg === "--fields" && raw[i + 1]) {
      fields.push(...raw[++i].split(",").map(f => f.trim()).filter(Boolean))
    } else if (arg === "--limit" && raw[i + 1]) {
      limit = parseInt(raw[++i], 10)
    } else if (!arg.startsWith("-") && command === undefined) {
      command = arg
    }
  }

  return { command, json, pretty, fields, limit }
}

const opts = parseArgs(process.argv)

function jsonOut(data: unknown) {
  console.log(opts.pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data))
}

function emitError(msg: string, code: string, exitCode: number, suggestions?: string[]): never {
  if (opts.json) {
    const envelope: ErrorEnvelope = { error: msg, code }
    if (suggestions?.length) envelope.suggestions = suggestions
    process.stderr.write(JSON.stringify(envelope) + "\n")
  } else {
    console.error(`Error: ${msg}`)
    if (suggestions?.length) {
      console.error(`Did you mean: ${suggestions.join(", ")}?`)
    }
  }
  process.exit(exitCode)
}

function printHelp() {
  console.log(`Usage: newsnow <source> [options]
       newsnow list [--json | --output json] [--pretty]
       newsnow schema [--pretty]

Commands:
  list          List all available sources
  schema        Print machine-readable JSON Schema for this CLI
  <source>      Fetch news from the given source

Options:
  --json            Output as JSON
  --output json     Alias for --json
  --pretty          Pretty-print JSON output
  --fields f1,f2    Filter output fields (JSON mode only)
  --limit N         Limit number of items returned

Sources: ${Object.keys(sources).length} available. Run "newsnow list" to see all.`)
}

function buildSourceMeta(): SourceMeta[] {
  const envVarMap: Record<string, string[]> = {
    producthunt: ["PRODUCTHUNT_API_TOKEN"],
  }
  return Object.keys(sources).sort().map(name => ({
    name,
    category: name.split("-")[0],
    envVars: envVarMap[name] || [],
  }))
}

function printList() {
  const metas = buildSourceMeta()
  if (opts.json) {
    const envelope: ListEnvelope = { count: metas.length, sources: metas }
    jsonOut(envelope)
  } else {
    console.log(`Available sources (${metas.length}):\n`)
    const groups: Record<string, string[]> = {}
    for (const m of metas) {
      if (!groups[m.category]) groups[m.category] = []
      groups[m.category].push(m.name)
    }
    for (const [base, items] of Object.entries(groups).sort(([a], [b]) => a.localeCompare(b))) {
      if (items.length === 1) {
        console.log(`  ${items[0]}`)
      } else {
        console.log(`  ${base}: ${items.join(", ")}`)
      }
    }
  }
}

function printSchema() {
  const metas = buildSourceMeta()
  const categories: Record<string, string[]> = {}
  for (const m of metas) {
    if (!categories[m.category]) categories[m.category] = []
    categories[m.category].push(m.name)
  }

  const schema = {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    name: "newsnow",
    commands: {
      list: { description: "List all available news sources" },
      schema: { description: "Print this JSON Schema" },
      "<source>": { description: "Fetch news items from the named source" },
    },
    flags: {
      "--json": { description: "Output as JSON" },
      "--output": { description: "Output format", values: ["json"] },
      "--pretty": { description: "Pretty-print JSON output" },
      "--fields": { description: "Comma-separated list of fields to include", values: [...NEWS_ITEM_FIELDS] },
      "--limit": { description: "Maximum number of items to return", type: "integer" },
    },
    categories,
    $defs: {
      NewsItem: {
        type: "object",
        properties: {
          id: { type: ["string", "number"] },
          title: { type: "string" },
          url: { type: "string" },
          mobileUrl: { type: "string" },
          pubDate: { type: ["string", "number"] },
          extra: { type: "object" },
        },
        required: ["id", "title"],
      },
      FetchEnvelope: {
        type: "object",
        properties: {
          source: { type: "string" },
          count: { type: "integer" },
          items: { type: "array", items: { $ref: "#/$defs/NewsItem" } },
        },
        required: ["source", "count", "items"],
      },
      ListEnvelope: {
        type: "object",
        properties: {
          count: { type: "integer" },
          sources: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                category: { type: "string" },
                envVars: { type: "array", items: { type: "string" } },
              },
            },
          },
        },
        required: ["count", "sources"],
      },
    },
  }

  console.log(opts.pretty ? JSON.stringify(schema, null, 2) : JSON.stringify(schema))
}

function suggestSimilar(input: string): string[] {
  const names = Object.keys(sources)
  return names.filter(n =>
    n.includes(input) || input.includes(n) || levenshtein(n, input) <= 3,
  ).slice(0, 5)
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))
  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] !== b[j - 1] ? 1 : 0),
      )
  return dp[m][n]
}

async function fetchSource(name: string) {
  const handler = sources[name]
  if (!handler) {
    const similar = suggestSimilar(name)
    emitError(`Unknown source "${name}"`, "UNKNOWN_SOURCE", 1, similar.length ? similar : undefined)
  }

  // Validate --fields before fetching
  if (opts.fields.length) {
    const validFields = new Set<string>(NEWS_ITEM_FIELDS)
    const invalid = opts.fields.filter(f => !validFields.has(f))
    if (invalid.length) {
      emitError(
        `Invalid field(s): ${invalid.join(", ")}. Valid fields: ${NEWS_ITEM_FIELDS.join(", ")}`,
        "INVALID_FIELD",
        1,
      )
    }
  }

  try {
    let items = await handler()

    if (opts.limit !== undefined && opts.limit > 0) {
      items = items.slice(0, opts.limit)
    }

    if (opts.json) {
      let projected: Partial<typeof items[0]>[] = items
      if (opts.fields.length) {
        projected = items.map(item => {
          const picked: Record<string, unknown> = {}
          for (const f of opts.fields) {
            if (f in item) picked[f] = (item as any)[f]
          }
          return picked
        })
      }
      const envelope: FetchEnvelope = { source: name, count: projected.length, items: projected }
      jsonOut(envelope)
    } else {
      if (!items.length) {
        console.log("No items found.")
        return
      }
      console.log(`\n${name} (${items.length} items)\n${"─".repeat(60)}`)
      for (const [i, item] of items.entries()) {
        const parts = [`${String(i + 1).padStart(3)}. ${item.title}`]
        if (item.url) parts.push(`     ${item.url}`)
        if (item.extra?.info && typeof item.extra.info === "string") parts.push(`     ${item.extra.info}`)
        console.log(parts.join("\n"))
      }
    }
  } catch (err: any) {
    emitError(`Fetch failed for "${name}": ${err.message}`, "FETCH_ERROR", 2)
  }
}

if (!opts.command || opts.command === "help" || opts.command === "--help" || opts.command === "-h") {
  printHelp()
} else if (opts.command === "list") {
  printList()
} else if (opts.command === "schema") {
  printSchema()
} else {
  fetchSource(opts.command)
}
