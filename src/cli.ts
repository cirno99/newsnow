#!/usr/bin/env bun
import { suggestSimilar } from "./fetchnews.js"
import { sources } from "./sources/index.js"
import ansis, { red, blue, green, bold, fg, hex, rgb } from "ansis"

const args = process.argv.slice(2)
const jsonFlag = args.includes("--json")
const filteredArgs = args.filter(a => a !== "--json")
const command = filteredArgs[0]

function printHelp() {
  console.log(`Usage: newsnow <source> [--json]
       newsnow list [--json]

Commands:
  list          List all available sources
  <source>      Fetch news from the given source

Options:
  --json        Output as JSON

Sources: ${Object.keys(sources).length} available. Run "newsnow list" to see all.`)
}

function printList() {
  const names = Object.keys(sources).sort()
  if (jsonFlag) {
    console.log(JSON.stringify(names, null, 2))
  } else {
    console.log(`Available sources (${names.length}):\n`)
    const groups: Record<string, string[]> = {}
    for (const name of names) {
      const base = name.split("-")[0]
      if (!groups[base]) groups[base] = []
      groups[base].push(name)
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

async function fetchSource(name: string) {
  const handler = sources[name]
  if (!handler) {
    const similar = suggestSimilar(name)
    console.error(`Error: Unknown source "${name}"`)
    if (similar.length) {
      console.error(`Did you mean: ${similar.join(", ")}?`)
    }
    process.exit(1)
  }

  try {
    const items = await handler()
    if (jsonFlag) {
      console.log(JSON.stringify(items, null, 2))
    } else {
      if (!items.length) {
        console.log("No items found.")
        return
      }
      // console.log(`\n${red(name)} (${bold.cyan(items.length)} items)\n${"─".repeat(60)}`)
      for (const [i, item] of items.entries()) {
        const parts = [`${bold(String(i + 1).padStart(3))}. ${bold.blue(item.title)}`]
        if (item.url) parts.push(` ${green(item.url)}`)
        if (item.extra?.info && typeof item.extra.info === "string") parts.push(` ${item.extra.info}`)
        console.log(parts.join(" |"))
      }
    }
  } catch (err: any) {
    console.error(`Error fetching "${name}": ${err.message}`)
    process.exit(1)
  }
}

if (!command || command === "help" || command === "--help" || command === "-h") {
  printHelp()
} else if (command === "list") {
  printList()
} else {
  fetchSource(command)
}
