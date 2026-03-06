import { sources } from "./sources"
import { NewsItem } from "./types"

export function suggestSimilar(input: string): string[] {
  const names = Object.keys(sources)
  return names.filter(n => n.includes(input) || input.includes(n) || levenshtein(n, input) <= 3).slice(0, 5)
}

export function levenshtein(a: string, b: string): number {
  const m = a.length,
    n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))
  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] !== b[j - 1] ? 1 : 0))
  return dp[m][n]
}

export async function fetchNews(name: string): Promise<Array<NewsItem>> {
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
    if (!items.length) {
      return []
    }
    for (const [i, item] of items.entries()) {
      item.id = i + 1
    }
    return items
  } catch (err: any) {
    console.error(`Error fetching "${name}": ${err.message}`)
    process.exit(1)
  }
}
