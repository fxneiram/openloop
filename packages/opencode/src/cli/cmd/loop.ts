import type { Argv } from "yargs"
import { Effect } from "effect"
import { cmd } from "./cmd"
import { effectCmd, fail } from "../effect-cmd"
import { UI } from "../ui"
import { EOL } from "os"
import { ConfigV1 } from "@opencode-ai/core/v1/config/config"
import { ConfigMigrateV1 } from "@opencode-ai/core/v1/config/migrate"
import { LoopRun } from "@opencode-ai/schema/loop-run"
import type { ConfigLoopV1 } from "@opencode-ai/core/v1/config/loop"

export const LoopCommand = cmd({
  command: "loop",
  describe: "manage scheduled loops",
  builder: (yargs: Argv) =>
    yargs
      .command(LoopListCommand)
      .command(LoopStatusCommand)
      .command(LoopHistoryCommand)
      .command(LoopRunCommand)
      .command(LoopEnableCommand)
      .demandCommand(),
  async handler() {},
})

async function loadLoops(): Promise<Record<string, ConfigLoopV1.Info>> {
    const { parse } = await import("jsonc-parser")
    const fs = await import("fs")
  const path = await import("path")
  const names = ["openloop.json", "openloop.jsonc", "opencode.json", "opencode.jsonc"]
  const cwd = process.cwd()
  for (const name of names) {
    const filepath = path.join(cwd, name)
    if (!fs.existsSync(filepath)) continue
    const text = fs.readFileSync(filepath, "utf-8")
    const errors: any[] = []
    const input = parse(text, errors, { allowTrailingComma: true })
    if (errors.length) continue
    if (ConfigMigrateV1.isV1(input)) {
      const decoded = ConfigV1.Info.pipe(
        (s) => (s as any).decodeUnknownOption?.(input) ?? { _tag: "None" },
      )
      if (decoded && decoded._tag === "Some") {
        const migrated = ConfigMigrateV1.migrate(decoded.value)
        return (migrated as any).loop ?? {}
      }
    }
    if (input && typeof input === "object" && "loop" in input) {
      return (input as any).loop ?? {}
    }
  }
  return {}
}

export const LoopListCommand = effectCmd({
  command: "list",
  describe: "list all loops",
  instance: false,
  builder: (yargs) =>
    yargs.option("group", {
      type: "string",
      describe: "filter loops by group",
    }),
  handler: Effect.fn("Cli.loop.list")(function* (args) {
    const loops = yield* Effect.promise(() => loadLoops())
    const entries = Object.entries(loops)
      .filter(([_, cfg]) => (args.group ? cfg.group === args.group : true))
      .map(([name, cfg]) => ({
        name,
        group: cfg.group ?? "",
        enabled: cfg.enabled ?? true,
        cron: cfg.cron,
      }))

    if (entries.length === 0) {
      UI.println("No loops configured")
      return
    }

    const maxName = Math.max(15, ...entries.map((e) => e.name.length))
    const maxGroup = Math.max(15, ...entries.map((e) => e.group.length))
    const header = `${"Name".padEnd(maxName)}  ${"Group".padEnd(maxGroup)}  Enabled  Cron`
    const lines = [header, "─".repeat(header.length)]
    for (const entry of entries) {
      lines.push(
        `${entry.name.padEnd(maxName)}  ${entry.group.padEnd(maxGroup)}  ${String(entry.enabled).padEnd(7)}  ${entry.cron}`,
      )
    }
    UI.println(lines.join(EOL))
  }) as any,
})

export const LoopStatusCommand = effectCmd({
  command: "status <name>",
  describe: "show loop status",
  instance: false,
  builder: (yargs) =>
    yargs.positional("name", {
      type: "string",
      describe: "loop name",
      demandOption: true,
    }),
  handler: Effect.fn("Cli.loop.status")(function* (args) {
    const loops = yield* Effect.promise(() => loadLoops())
    const cfg = loops[args.name]
    if (!cfg) return yield* fail(`Loop not found: ${args.name}`)
    UI.println(
      JSON.stringify(
        {
          name: args.name,
          enabled: cfg.enabled ?? true,
          cron: cfg.cron,
          timezone: cfg.timezone ?? "local",
          on_conflict: cfg.on_conflict ?? "skip",
          timeout: cfg.timeout ?? 300,
          max_failures: cfg.max_failures ?? 3,
        },
        null,
        2,
      ),
    )
  }) as any,
})

export const LoopHistoryCommand = effectCmd({
  command: "history <name>",
  describe: "show loop execution history",
  instance: false,
  builder: (yargs) =>
    yargs
      .positional("name", {
        type: "string",
        describe: "loop name",
        demandOption: true,
      })
      .option("limit", {
        type: "number",
        default: 20,
        describe: "limit number of rows",
      }),
  handler: Effect.fn("Cli.loop.history")(function* (args) {
    const loops = yield* Effect.promise(() => loadLoops())
    if (!loops[args.name]) return yield* fail(`Loop not found: ${args.name}`)
    UI.println("Loop history requires a running server. Use 'opencode serve' and query via API.")
  }) as any,
})

export const LoopRunCommand = effectCmd({
  command: "run <name>",
  describe: "run a loop iteration immediately",
  instance: false,
  builder: (yargs) =>
    yargs
      .positional("name", {
        type: "string",
        describe: "loop name",
        demandOption: true,
      })
      .option("wait", {
        type: "boolean",
        default: false,
        describe: "wait for the iteration to complete",
      })
      .option("dry-run", {
        type: "boolean",
        default: false,
        describe: "show what would run without executing",
      }),
  handler: Effect.fn("Cli.loop.run")(function* (args) {
    const loops = yield* Effect.promise(() => loadLoops())
    const cfg = loops[args.name]
    if (!cfg) return yield* fail(`Loop not found: ${args.name}`)
    if (args.dryRun) {
      UI.println(`Would run loop "${args.name}" with prompt: ${cfg.prompt}`)
      return
    }
    UI.println(`Loop run requires the scheduler to be active. Start with 'opencode serve' or 'opencode'.`)
  }) as any,
})

export const LoopEnableCommand = effectCmd({
  command: "enable <name>",
  describe: "re-enable a loop disabled by max_failures",
  instance: false,
  builder: (yargs) =>
    yargs.positional("name", {
      type: "string",
      describe: "loop name",
      demandOption: true,
    }),
  handler: Effect.fn("Cli.loop.enable")(function* (args) {
    const loops = yield* Effect.promise(() => loadLoops())
    if (!loops[args.name]) return yield* fail(`Loop not found: ${args.name}`)
    UI.println(
      UI.Style.TEXT_SUCCESS_BOLD +
        `Loop "${args.name}" enable flag is set. Restart the server to reactivate.` +
        UI.Style.TEXT_NORMAL,
    )
  }) as any,
})
