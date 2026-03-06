#!/usr/bin/env bun
import { sources } from "../src/sources/index.js"
import type { NewsItem } from "../src/types.js"

interface ParsedArgs {
  help: boolean
  filter: string[]
  timeout: number
  verbose: boolean
}

function parseArgs(): ParsedArgs {
  const args = Bun.argv.slice(2)
  const parsed: ParsedArgs = {
    help: false,
    filter: [],
    timeout: 30000,
    verbose: false,
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === "-h" || arg === "--help") {
      parsed.help = true
    } else if (arg === "-v" || arg === "--verbose") {
      parsed.verbose = true
    } else if ((arg === "-t" || arg === "--timeout") && args[i + 1]) {
      parsed.timeout = parseInt(args[++i], 10) * 1000
    } else if (!arg.startsWith("-")) {
      parsed.filter.push(arg)
    }
  }

  return parsed
}

function showHelp(): void {
  console.log(`
Usage: bun scripts/test-sources.ts [options] [source...]

Test and validate news sources.

Arguments:
  source...             Filter by source names (supports partial match)

Options:
  -t, --timeout N       Timeout per source in seconds (default: 30)
  -v, --verbose         Show item details for each source
  -h, --help            Show this help message

Examples:
  bun scripts/test-sources.ts                  Test all sources
  bun scripts/test-sources.ts github hackernews Test specific sources
  bun scripts/test-sources.ts bilibili -v      Verbose output for bilibili
`)
}

interface SourceResult {
  source: string
  status: "ok" | "fail"
  items: number
  errors: string[]
  duration: number
}

function validateItems(items: NewsItem[]): string[] {
  const errors: string[] = []

  if (!Array.isArray(items)) {
    errors.push("returned value is not an array")
    return errors
  }

  if (items.length === 0) {
    errors.push("returned empty array")
    return errors
  }

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    if (item.id == null || item.id === "") {
      errors.push(`item[${i}]: missing id`)
    }
    if (!item.title || typeof item.title !== "string" || item.title.trim() === "") {
      errors.push(`item[${i}]: missing or empty title`)
    }
    if (errors.length >= 5) {
      errors.push(`... (stopped after 5 errors)`)
      break
    }
  }

  return errors
}

async function testSource(name: string, timeout: number): Promise<SourceResult> {
  const start = performance.now()
  try {
    const items = await Promise.race([
      sources[name](),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), timeout),
      ),
    ])
    const duration = performance.now() - start
    const errors = validateItems(items)
    return {
      source: name,
      status: errors.length > 0 ? "fail" : "ok",
      items: Array.isArray(items) ? items.length : 0,
      errors,
      duration,
    }
  } catch (err: any) {
    return {
      source: name,
      status: "fail",
      items: 0,
      errors: [err.message],
      duration: performance.now() - start,
    }
  }
}

async function main(): Promise<void> {
  const args = parseArgs()
  if (args.help) {
    showHelp()
    process.exit(0)
  }

  let sourceNames = Object.keys(sources).sort()

  if (args.filter.length > 0) {
    sourceNames = sourceNames.filter((name) =>
      args.filter.some((f) => name.includes(f)),
    )
    if (sourceNames.length === 0) {
      console.error(`No sources matched: ${args.filter.join(", ")}`)
      process.exit(1)
    }
  }

  console.log(`Testing ${sourceNames.length} sources (timeout: ${args.timeout / 1000}s)\n`)

  const results = await Promise.all(
    sourceNames.map(async (name) => {
      const r = await testSource(name, args.timeout)
      const ms = Math.round(r.duration)
      if (r.status === "ok") {
        console.log(`  \x1b[32m✓\x1b[0m ${name} (${r.items} items, ${ms}ms)`)
      } else {
        console.log(`  \x1b[31m✗\x1b[0m ${name}: ${r.errors[0]} (${ms}ms)`)
      }
      if (args.verbose && r.status === "ok") {
        console.log(`    fields sample: ${JSON.stringify(Object.keys(r))}`)
      }
      return r
    }),
  )

  const ok = results.filter((r) => r.status === "ok")
  const fail = results.filter((r) => r.status === "fail")

  console.log(`\n${"─".repeat(50)}`)
  console.log(`\n  Total: ${results.length}  Passed: \x1b[32m${ok.length}\x1b[0m  Failed: \x1b[31m${fail.length}\x1b[0m\n`)

  if (fail.length > 0) {
    console.log("Failed sources:")
    for (const f of fail) {
      console.log(`  \x1b[31m✗\x1b[0m ${f.source}`)
      for (const e of f.errors) {
        console.log(`      ${e}`)
      }
    }
    console.log()
    process.exit(1)
  }
}

main().catch((err) => {
  console.error("Error:", err.message)
  process.exit(1)
})
