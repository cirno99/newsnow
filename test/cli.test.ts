import { describe, test, expect } from "bun:test"
import { sources } from "../src/sources/index.js"

const cwd = import.meta.dir + "/.."

function run(args: string[]) {
  return Bun.spawn(["bun", "src/cli.ts", ...args], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  })
}

describe("registry", () => {
  test("has sources registered", () => {
    const names = Object.keys(sources)
    expect(names.length).toBeGreaterThan(40)
  })

  test("all sources are functions", () => {
    for (const [name, handler] of Object.entries(sources)) {
      expect(typeof handler).toBe("function")
    }
  })

  test("contains expected source names", () => {
    const expected = [
      "baidu", "bilibili", "hackernews", "github", "weibo",
      "zhihu", "v2ex", "juejin", "36kr", "toutiao",
    ]
    for (const name of expected) {
      expect(sources).toHaveProperty(name)
    }
  })
})

describe("cli", () => {
  test("list --json returns ListEnvelope", async () => {
    const proc = run(["list", "--json"])
    const output = await new Response(proc.stdout).text()
    const envelope = JSON.parse(output)
    expect(envelope).toHaveProperty("count")
    expect(envelope).toHaveProperty("sources")
    expect(Array.isArray(envelope.sources)).toBe(true)
    expect(envelope.count).toBeGreaterThan(40)
    expect(envelope.sources[0]).toHaveProperty("name")
    expect(envelope.sources[0]).toHaveProperty("category")
    expect(envelope.sources[0]).toHaveProperty("envVars")
  })

  test("--output json alias works", async () => {
    const proc = run(["list", "--output", "json"])
    const output = await new Response(proc.stdout).text()
    const envelope = JSON.parse(output)
    expect(envelope).toHaveProperty("count")
    expect(envelope).toHaveProperty("sources")
  })

  test("help command works", async () => {
    const proc = run(["--help"])
    const output = await new Response(proc.stdout).text()
    expect(output).toContain("Usage:")
    expect(output).toContain("--fields")
    expect(output).toContain("--limit")
    expect(output).toContain("schema")
  })

  test("schema command returns valid JSON Schema", async () => {
    const proc = run(["schema"])
    const output = await new Response(proc.stdout).text()
    const schema = JSON.parse(output)
    expect(schema).toHaveProperty("$schema")
    expect(schema).toHaveProperty("commands")
    expect(schema).toHaveProperty("flags")
    expect(schema).toHaveProperty("categories")
    expect(schema).toHaveProperty("$defs")
    expect(schema.$defs).toHaveProperty("NewsItem")
    expect(schema.$defs).toHaveProperty("FetchEnvelope")
    expect(schema.$defs).toHaveProperty("ListEnvelope")
  })

  test("unknown source shows error with exitCode", async () => {
    const proc = run(["nonexistent_xyz"])
    const err = await new Response(proc.stderr).text()
    expect(err).toContain("Unknown source")
    const code = await proc.exited
    expect(code).toBe(1)
  })

  test("unknown source --json emits ErrorEnvelope to stderr", async () => {
    const proc = run(["nonexistent_xyz", "--json"])
    const err = await new Response(proc.stderr).text()
    const envelope = JSON.parse(err)
    expect(envelope).toHaveProperty("error")
    expect(envelope.code).toBe("UNKNOWN_SOURCE")
    const code = await proc.exited
    expect(code).toBe(1)
  })

  test("--fields with invalid field returns INVALID_FIELD error", async () => {
    const proc = run(["hackernews", "--json", "--fields", "bogus"])
    const err = await new Response(proc.stderr).text()
    const envelope = JSON.parse(err)
    expect(envelope.code).toBe("INVALID_FIELD")
    expect(envelope.error).toContain("bogus")
    const code = await proc.exited
    expect(code).toBe(1)
  })

  test("--pretty produces indented output", async () => {
    const proc = run(["list", "--json", "--pretty"])
    const output = await new Response(proc.stdout).text()
    expect(output).toContain("\n  ")
    // Should still parse as valid JSON
    const parsed = JSON.parse(output)
    expect(parsed).toHaveProperty("count")
  })

  test("compact JSON is default (no indentation)", async () => {
    const proc = run(["list", "--json"])
    const output = await new Response(proc.stdout).text()
    // Compact JSON is a single line
    const lines = output.trim().split("\n")
    expect(lines.length).toBe(1)
  })
})

describe("fetch source", () => {
  test("hackernews returns items", async () => {
    const handler = sources["hackernews"]
    const items = await handler()
    expect(items.length).toBeGreaterThan(0)
    expect(items[0]).toHaveProperty("title")
    expect(items[0]).toHaveProperty("id")
    expect(items[0]).toHaveProperty("url")
  }, 15000)

  test("--fields filters output fields", async () => {
    const proc = run(["hackernews", "--json", "--fields", "id,title", "--limit", "3"])
    const output = await new Response(proc.stdout).text()
    const envelope = JSON.parse(output)
    expect(envelope.source).toBe("hackernews")
    expect(envelope.count).toBeLessThanOrEqual(3)
    for (const item of envelope.items) {
      expect(item).toHaveProperty("id")
      expect(item).toHaveProperty("title")
      expect(item).not.toHaveProperty("url")
    }
  }, 15000)

  test("--limit caps item count", async () => {
    const proc = run(["hackernews", "--json", "--limit", "2"])
    const output = await new Response(proc.stdout).text()
    const envelope = JSON.parse(output)
    expect(envelope.count).toBeLessThanOrEqual(2)
    expect(envelope.items.length).toBeLessThanOrEqual(2)
  }, 15000)
})
