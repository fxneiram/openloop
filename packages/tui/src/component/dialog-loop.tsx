import { TextAttributes } from "@opentui/core"
import { DialogSelect, type DialogSelectOption } from "../ui/dialog-select"
import { createResource, createMemo, createSignal } from "solid-js"
import { useDialog } from "../ui/dialog"
import { useSDK } from "../context/sdk"
import { useTheme } from "../context/theme"
import { errorMessage } from "../util/error"
import type { ConfigLoopV1 } from "@opencode-ai/core/v1/config/loop"

export type DialogLoopProps = {
  onRun?: (name: string, loop: ConfigLoopV1.Info) => void
}

export function DialogLoop(props: DialogLoopProps) {
  const dialog = useDialog()
  const sdk = useSDK()
  const { theme } = useTheme()
  dialog.setSize("large")

  const [loadError, setLoadError] = createSignal<unknown>()
  const [running, setRunning] = createSignal<string>()

  const [loops] = createResource(() =>
    sdk.client.v2.loop
      .list({}, { throwOnError: true })
      .then((result) => result.data)
      .catch((error) => {
        setLoadError(error)
        return undefined
      }),
  )

  const showError = createMemo(() => Boolean(loadError()))

  const entries = createMemo(() => {
    const data = loops()
    if (!data) return []
    return Object.entries(data)
  })

  const options = createMemo<DialogSelectOption<string>[]>(() => {
    if (showError()) return []
    const list = entries()
    const maxWidth = Math.max(0, ...list.map(([name]) => name.length))
    return list.map(([name, loop]) => ({
      title: name.padEnd(maxWidth),
      description: loop.prompt.replace(/\s+/g, " ").trim(),
      value: name,
      category: "Loops",
      onSelect: () => {
        void runLoop(name, loop)
      },
    }))
  })

  async function runLoop(name: string, loop: ConfigLoopV1.Info) {
    if (running()) return
    setRunning(name)
    props.onRun?.(name, loop)
    try {
      await sdk.client.v2.loop.run({ name }, { throwOnError: true })
      dialog.clear()
    } catch (error) {
      setLoadError(error)
    } finally {
      setRunning(undefined)
    }
  }

  return (
    <DialogSelect
      title="Loops"
      placeholder="Search loops..."
      options={options()}
      renderFilter={!showError()}
      locked={showError() || running() !== undefined}
      emptyView={
        showError() ? (
          <box paddingLeft={4} paddingRight={4}>
            <text fg={theme.error} attributes={TextAttributes.BOLD}>
              Could not load loops
            </text>
            <text fg={theme.textMuted}>{errorMessage(loadError())}</text>
          </box>
        ) : undefined
      }
    />
  )
}
