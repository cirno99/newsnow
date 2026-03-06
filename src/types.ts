export interface NewsItem {
  id: string | number
  title: string
  url?: string
  mobileUrl?: string
  pubDate?: string | number
  extra?: {
    info?: string | boolean
    hover?: string
    icon?: string | { url: string; scale: number }
    date?: string | number
    [key: string]: any
  }
}

export type SourceHandler = () => Promise<NewsItem[]>
export type SourceDef = Record<string, SourceHandler>

export interface FetchEnvelope {
  source: string
  count: number
  items: Partial<NewsItem>[]
}

export interface SourceMeta {
  name: string
  category: string
  envVars: string[]
}

export interface ListEnvelope {
  count: number
  sources: SourceMeta[]
}

export interface ErrorEnvelope {
  error: string
  code: string
  suggestions?: string[]
}

export const NEWS_ITEM_FIELDS = ["id", "title", "url", "mobileUrl", "pubDate", "extra"] as const
