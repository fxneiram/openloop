import { TextAttributes, type TextareaRenderable } from "@opentui/core"
import { useDialog } from "../ui/dialog"
import { useSDK } from "../context/sdk"
import { useTheme } from "../context/theme"
import { createSignal } from "solid-js"
import { errorMessage } from "../util/error"
import type { ConfigLoopV1 } from "@opencode-ai/core/v1/config/loop"

export type DialogLoopCreateProps = {
  onCreated?: (name: string, config: ConfigLoopV1.Info) => void
}

export function DialogLoopCreate(props: DialogLoopCreateProps) {
  const dialog = useDialog()
  const sdk = useSDK()
  const { theme } = useTheme()
  dialog.setSize("large")

  const [busy, setBusy] = createSignal(false)
  const [error, setError] = createSignal<string | undefined>()

  let nameRef: TextareaRenderable
  let promptRef: TextareaRenderable
  let cronRef: TextareaRenderable
  let modelRef: TextareaRenderable
  let agentRef: TextareaRenderable
  let groupRef: TextareaRenderable

  async function handleCreate() {
    const loopName = nameRef?.plainText?.trim() ?? ""
    const loopPrompt = promptRef?.plainText?.trim() ?? ""
    const loopCron = cronRef?.plainText?.trim() ?? ""

    if (!loopName || !loopPrompt || !loopCron) {
      setError("Name, prompt, and cron are required")
      return
    }

    setBusy(true)
    setError(undefined)

    try {
      const config: ConfigLoopV1.Info = {
        prompt: loopPrompt,
        cron: loopCron,
        ...(modelRef?.plainText?.trim() && { model: modelRef.plainText.trim() }),
        ...(agentRef?.plainText?.trim() && { agent: agentRef.plainText.trim() }),
        ...(groupRef?.plainText?.trim() && { group: groupRef.plainText.trim() }),
      }

      await sdk.client.v2.loop.create({ name: loopName, config }, { throwOnError: true })
      props.onCreated?.(loopName, config)
      dialog.clear()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <box paddingLeft={2} paddingRight={2} gap={1}>
      <box flexDirection="row" justifyContent="space-between">
        <text attributes={TextAttributes.BOLD} fg={theme.text}>
          Create Loop
        </text>
        <text fg={theme.textMuted} onMouseUp={() => dialog.clear()}>
          esc
        </text>
      </box>

      <box gap={1}>
        <text fg={theme.text}>
          Name: <span style={{ fg: theme.textMuted }}>(required)</span>
        </text>
        <textarea
          height={1}
          ref={(val: TextareaRenderable) => { nameRef = val }}
          placeholder="my-loop"
          placeholderColor={theme.textMuted}
          textColor={theme.text}
          focusedTextColor={theme.text}
          cursorColor={theme.text}
        />

        <text fg={theme.text}>
          Prompt: <span style={{ fg: theme.textMuted }}>(required)</span>
        </text>
        <textarea
          height={3}
          ref={(val: TextareaRenderable) => { promptRef = val }}
          placeholder="What should the loop do?"
          placeholderColor={theme.textMuted}
          textColor={theme.text}
          focusedTextColor={theme.text}
          cursorColor={theme.text}
        />

        <text fg={theme.text}>
          Cron: <span style={{ fg: theme.textMuted }}>(required, e.g. "0 9 * * *")</span>
        </text>
        <textarea
          height={1}
          ref={(val: TextareaRenderable) => { cronRef = val }}
          placeholder="0 9 * * *"
          placeholderColor={theme.textMuted}
          textColor={theme.text}
          focusedTextColor={theme.text}
          cursorColor={theme.text}
        />

        <text fg={theme.text}>Model: <span style={{ fg: theme.textMuted }}>(optional)</span></text>
        <textarea
          height={1}
          ref={(val: TextareaRenderable) => { modelRef = val }}
          placeholder="anthropic/claude-sonnet-4-20250514"
          placeholderColor={theme.textMuted}
          textColor={theme.text}
          focusedTextColor={theme.text}
          cursorColor={theme.text}
        />

        <text fg={theme.text}>Agent: <span style={{ fg: theme.textMuted }}>(optional)</span></text>
        <textarea
          height={1}
          ref={(val: TextareaRenderable) => { agentRef = val }}
          placeholder="default"
          placeholderColor={theme.textMuted}
          textColor={theme.text}
          focusedTextColor={theme.text}
          cursorColor={theme.text}
        />

        <text fg={theme.text}>Group: <span style={{ fg: theme.textMuted }}>(optional)</span></text>
        <textarea
          height={1}
          ref={(val: TextareaRenderable) => { groupRef = val }}
          placeholder="daily"
          placeholderColor={theme.textMuted}
          textColor={theme.text}
          focusedTextColor={theme.text}
          cursorColor={theme.text}
        />
      </box>

      {error() && (
        <text fg={theme.error}>{error()}</text>
      )}

      <box gap={1} flexDirection="row">
        {busy() ? (
          <text fg={theme.textMuted}>Creating...</text>
        ) : (
          <text fg={theme.text} onMouseUp={handleCreate}>
            <span style={{ fg: theme.success, attributes: TextAttributes.BOLD }}>enter</span>
            <span style={{ fg: theme.textMuted }}> create</span>
          </text>
        )}
      </box>
    </box>
  )
}

DialogLoopCreate.show = (
  dialog: ReturnType<typeof useDialog>,
  options?: Omit<DialogLoopCreateProps, "title">,
) => {
  return new Promise<{ name: string; config: ConfigLoopV1.Info } | null>((resolve) => {
    dialog.replace(
      () => (
        <DialogLoopCreate
          onCreated={(name, config) => resolve({ name, config })}
          {...options}
        />
      ),
      () => resolve(null),
    )
  })
}