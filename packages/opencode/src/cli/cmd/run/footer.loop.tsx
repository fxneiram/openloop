/** @jsxImportSource @opentui/solid */
import { type InputRenderable, type KeyEvent } from "@opentui/core"
import { useKeyboard } from "@opentui/solid"
import fuzzysort from "fuzzysort"
import { createEffect, createMemo, createSignal, type Accessor } from "solid-js"
import { RunFooterMenu, createFooterMenuState, type RunFooterMenuItem } from "./footer.menu"
import { PanelShell } from "./footer.command"
import type { RunFooterTheme } from "./theme"

type LoopEntry = RunFooterMenuItem & {
  kind: "loop"
  name: string
  cron: string
  enabled: boolean
  group?: string
  prompt?: string
}

type LoopPanelProps = {
  theme: Accessor<RunFooterTheme>
  loops: Accessor<RunLoopInfo[]>
  onClose: () => void
  onRun: (name: string) => void
}

export type RunLoopInfo = {
  name: string
  cron: string
  enabled: boolean
  group?: string
  prompt?: string
}

const PANEL_PAD = 2
const PANEL_LIST_ROWS = 10

function match<T extends RunFooterMenuItem>(query: string, entries: T[]) {
  const text = query.trim()
  if (!text) {
    return entries
  }

  return fuzzysort
    .go(text, entries, { keys: ["display", "description", "name"] })
    .map((item) => item.obj)
}

function handleKey(input: {
  event: KeyEvent
  menu: ReturnType<typeof createFooterMenuState>
  field: () => InputRenderable | undefined
  setQuery: (value: string) => void
  select: () => void
  close: () => void
}) {
  const name = input.event.name.toLowerCase()
  const ctrl = input.event.ctrl && !input.event.meta && !input.event.shift && !input.event.super

  if (name === "escape" || (ctrl && name === "c")) {
    input.event.preventDefault()
    input.close()
    return
  }

  if (name === "up" || (ctrl && name === "p")) {
    input.event.preventDefault()
    input.menu.move(-1)
    return
  }

  if (name === "down" || (ctrl && name === "n")) {
    input.event.preventDefault()
    input.menu.move(1)
    return
  }

  if (name === "return") {
    input.event.preventDefault()
    input.select()
    return
  }

  if (ctrl && name === "u") {
    input.event.preventDefault()
    input.setQuery("")
    input.field()?.setText("")
  }
}

export function RunLoopSelectBody(props: LoopPanelProps) {
  let field: InputRenderable | undefined
  const [query, setQuery] = createSignal("")
  const entries = createMemo<LoopEntry[]>(() =>
    props.loops().map((item) => ({
      kind: "loop",
      category: item.group ?? "Loops",
      display: item.name,
      description: item.enabled ? `cron: ${item.cron}` : `cron: ${item.cron} (disabled)`,
      footer: item.enabled ? "enabled" : "disabled",
      keywords: `loop ${item.name} ${item.cron} ${item.group ?? ""} ${item.prompt ?? ""}`,
      name: item.name,
      cron: item.cron,
      enabled: item.enabled,
      group: item.group,
      prompt: item.prompt,
    })),
  )
  const items = createMemo<LoopEntry[]>(() => match(query(), entries()))
  const menu = createFooterMenuState({ count: () => items().length, limit: PANEL_LIST_ROWS })
  const select = () => {
    const item = items()[menu.selected()]
    if (!item) {
      return
    }

    props.onRun(item.name)
  }

  createEffect(() => {
    query()
    menu.reset()
  })

  useKeyboard((event) => {
    if (event.defaultPrevented) {
      return
    }

    handleKey({ event, menu, field: () => field, setQuery, select, close: props.onClose })
  })

  return (
    <PanelShell
      title="Loops"
      query={query()}
      count={items().length}
      total={entries().length}
      placeholder="Search loops"
      theme={props.theme}
      inputRef={(input) => {
        field = input
      }}
      onQuery={setQuery}
      dark
      chrome="minimal"
    >
      <RunFooterMenu
        theme={props.theme}
        items={items}
        selected={menu.selected}
        offset={menu.offset}
        rows={() => PANEL_LIST_ROWS}
        limit={PANEL_LIST_ROWS}
        empty={props.loops().length === 0 ? "No loops configured" : "No loops found"}
        border={false}
        paddingLeft={PANEL_PAD}
        paddingRight={PANEL_PAD}
        grouped={!query().trim()}
        background
      />
    </PanelShell>
  )
}
