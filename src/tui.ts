import { ui, useAsync } from "@rezi-ui/core"
import { createNodeApp } from "@rezi-ui/node"
import NewsScrollList from "./comp/scroll-list"
import { NewsItem } from "./types"
import { fetchNews } from "./fetchnews"
import dayjs from "dayjs"

type State = {
  fetchTime: string
  jin10Items: NewsItem[]
  clsItems: NewsItem[]
  glhItems: NewsItem[]
  wallstreetItems: NewsItem[]
}
type Action = {
  type: "updateNews"
  payload: {
    jin10Items: NewsItem[]
    clsItems: NewsItem[]
    glhItems: NewsItem[]
    wallstreetItems: NewsItem[]
    fetchTime: string
  }
}

const app = createNodeApp<State>({
  initialState: {
    jin10Items: [],
    clsItems: [],
    glhItems: [],
    wallstreetItems: [],
    fetchTime: "",
  },
})

// --- 更新新闻 ---
function updateNewsFn(state: State, action: Action): State {
  switch (action.type) {
    case "updateNews":
      return {
        jin10Items: action.payload.jin10Items,
        clsItems: action.payload.clsItems,
        glhItems: action.payload.glhItems,
        wallstreetItems: action.payload.wallstreetItems,
        fetchTime: action.payload.fetchTime,
      }
  }
}

function dispatch(action: Action) {
  app.update((s: State) => updateNewsFn(s, action))
}
// 首次获取新闻数据
;(async () => {
  const jin10Items: NewsItem[] = await fetchNews("jin10")
  const clsItems: NewsItem[] = await fetchNews("cls")
  const glhItems: NewsItem[] = await fetchNews("gelonghui")
  const wallstreetItems: NewsItem[] = await fetchNews("wallstreetcn")
  const fetchTime = dayjs().format("HH:mm:ss")
  dispatch({
    type: "updateNews",
    payload: {
      jin10Items,
      clsItems,
      glhItems,
      wallstreetItems,
      fetchTime,
    },
  })
})()

// 每 60 秒刷新一次
setInterval(async () => {
  const jin10Items: NewsItem[] = await fetchNews("jin10")
  const clsItems: NewsItem[] = await fetchNews("cls")
  const glhItems: NewsItem[] = await fetchNews("gelonghui")
  const wallstreetItems: NewsItem[] = await fetchNews("wallstreetcn")
  const fetchTime = dayjs().format("HH:mm:ss")
  dispatch({
    type: "updateNews",
    payload: {
      jin10Items,
      clsItems,
      glhItems,
      wallstreetItems,
      fetchTime,
    },
  })
}, 60000)

app.view((state: State) => {
  const ls1 = NewsScrollList({
    rows: state.jin10Items,
    tableId: "news-scroll-jin10",
  })
  const ls2 = NewsScrollList({
    rows: state.clsItems,
    tableId: "news-scroll-cls",
  })
  const ls3 = NewsScrollList({
    rows: state.glhItems,
    tableId: "news-scroll-glh",
  })
  const ls4 = NewsScrollList({
    rows: state.wallstreetItems,
    tableId: "news-scroll-wallstreet",
  })

  return ui.box({ border: "none" }, [
    ui.text(" 财经新闻实时播报 | 刷新时间(60s): " + state.fetchTime),
    ui.grid({ columns: 4 }, [
      ui.box({ title: "金十数据", gap: 0, minWidth: 50, border: "rounded" }, [ls1]),
      ui.box({ title: "财联社", gap: 0, minWidth: 50, border: "rounded" }, [ls2]),
      ui.box({ title: "格隆汇", gap: 0, minWidth: 50, border: "rounded" }, [ls3]),
      ui.box({ title: "华尔街见闻", gap: 0, minWidth: 50, border: "rounded" }, [ls4]),
    ]),
  ])
})

app.keys({ q: () => app.stop() })
;(async () => {
  await app.run()
})()
