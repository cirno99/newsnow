import { load } from "cheerio"
import { myFetch } from "../fetch.js"
import { parseRelativeDate } from "../utils.js"
import type { NewsItem, SourceDef } from "../types.js"

const quick = async (): Promise<NewsItem[]> => {
  const baseURL = "https://www.36kr.com"
  const url = `${baseURL}/newsflashes`
  const response = await myFetch(url) as any
  const $ = load(response)
  const news: NewsItem[] = []
  const $items = $(".newsflash-item")
  $items.each((_, el) => {
    const $el = $(el)
    const $a = $el.find("a.item-title")
    const url = $a.attr("href")
    const title = $a.text()
    const relativeDate = $el.find(".time").text()
    if (url && title && relativeDate) {
      news.push({
        url: `${baseURL}${url}`,
        title,
        id: url,
        extra: { date: parseRelativeDate(relativeDate, "Asia/Shanghai").valueOf() },
      })
    }
  })
  return news
}

const renqi = async (): Promise<NewsItem[]> => {
  const url = "https://gateway.36kr.com/api/mis/nav/home/nav/rank/hot"
  const response = await myFetch<any>(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    },
    body: {
      partner_id: "wap",
      param: { siteId: 1, platformId: 2 },
      timestamp: Date.now(),
    },
  })
  const items = response?.data?.hotRankList ?? []
  return items.map((item: any) => {
    const m = item.templateMaterial ?? {}
    return {
      url: `https://36kr.com/p/${item.itemId}`,
      title: m.widgetTitle ?? "",
      id: String(item.itemId),
      extra: { info: m.authorName },
    }
  }).filter((item: NewsItem) => item.title)
}

export default {
  "36kr": quick,
  "36kr-quick": quick,
  "36kr-renqi": renqi,
} satisfies SourceDef
