import { defineWidget, ui, useTable, VNode } from "@rezi-ui/core"
import { NewsItem } from "../types"
import { spawn } from "bun"
import { exec } from "node:child_process"

const NewsScrollList = defineWidget<{
  rows: readonly NewsItem[]
  tableId?: string
}>((props, ctx) => {
  const tableId = props.tableId ?? `news-scroll-${Math.random().toString(36).substr(2, 9)}`
  const customRows: NewsItem[] = props.rows.map(item => ({
    id: item.id,
    title: item.title,
  }))
  const table = useTable(ctx, {
    id: tableId,
    rows: customRows,
    columns: [
      { key: "id", header: "ID", width: 3 },
      {
        key: "title",
        header: "标题",
        minWidth: 20,
      },
    ],
    onRowPress: row => {
      const item = props.rows.find(r => r.id === row.id)
      if (item?.url && item.url.startsWith("http")) {
        const platform = process.platform
        let command = ""

        if (platform === "darwin") {
          command = `open`
          spawn([command, item.url])
        } else if (platform === "win32") {
          command = `start ${item.url}`
          exec(command)
        } else {
          command = `xdg-open` // Linux
          spawn([command, item.url])
        }
      }
    },
    selectable: "single",
    sortable: true,
    border: "none",
  })

  return ui.table(table.props)
})

export default NewsScrollList
