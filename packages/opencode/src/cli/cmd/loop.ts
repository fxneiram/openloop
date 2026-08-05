import type { Argv } from "yargs"
import { Effect } from "effect"
import { cmd } from "./cmd"
import { effectCmd, fail } from "../effect-cmd"
import { UI } from "../ui"
import { EOL } from "os"
import { ConfigV1 } from "@opencode-ai/core/v1/config/config"
import { ConfigMigrateV1 } from "@opencode-ai/core/v1/config/migrate"
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

function findConfigPath(): string | undefined {
  const fs = require("fs") as typeof import("fs")
  const path = require("path") as typeof import("path")
  const names = ["openloop.json", "openloop.jsonc", "opencode.json", "opencode.jsonc"]
  const cwd = process.cwd()
  for (const name of names) {
    const filepath = path.join(cwd, name)
    if (fs.existsSync(filepath)) return filepath
  }
  return undefined
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
    const { LoopState } = yield* Effect.promise(() => import("@opencode-ai/core/loop/state"))
    const state = yield* LoopState.Service
    const entries: Array<{
      name: string
      group: string
      enabled: boolean
      cron: string
      status: string
      failures: number
    }> = []
    for (const [name, cfg] of Object.entries(loops)) {
      const snapshot = yield* state.snapshot(name).pipe(
        Effect.matchEffect({
          onSuccess: (entry) => Effect.succeed(entry),
          onFailure: () => Effect.succeed(undefined),
        }),
      )
      entries.push({
        name,
        group: cfg.group ?? "",
        enabled: cfg.enabled ?? true,
        cron: cfg.cron,
        status: snapshot?.status ?? (cfg.enabled === false ? "disabled" : "unknown"),
        failures: snapshot?.consecutiveFailures ?? 0,
      })
    }
    const filtered = args.group ? entries.filter((e) => e.group === args.group) : entries

    if (filtered.length === 0) {
      UI.println("No loops configured")
      return
    }

    const maxName = Math.max(15, ...filtered.map((e) => e.name.length))
    const maxGroup = Math.max(15, ...filtered.map((e) => e.group.length))
    const maxStatus = Math.max(10, ...filtered.map((e) => e.status.length))
    const header = `${"Name".padEnd(maxName)}  ${"Group".padEnd(maxGroup)}  ${"Status".padEnd(maxStatus)}  Cron`
    const lines = [header, "─".repeat(header.length)]
    for (const entry of filtered) {
      const statusDisplay =
        entry.failures > 0 ? `${entry.status} (${entry.failures})` : entry.status
      lines.push(
        `${entry.name.padEnd(maxName)}  ${entry.group.padEnd(maxGroup)}  ${statusDisplay.padEnd(maxStatus)}  ${entry.cron}`,
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
    const { LoopState } = yield* Effect.promise(() => import("@opencode-ai/core/loop/state"))
    const state = yield* LoopState.Service
    const entry = yield* state.snapshot(args.name).pipe(
      Effect.matchEffect({
        onSuccess: (e) => Effect.succeed(e),
        onFailure: () => Effect.succeed(undefined),
      }),
    )
    const output: Record<string, unknown> = {
      name: args.name,
      enabled: cfg.enabled ?? true,
      cron: cfg.cron,
      timezone: cfg.timezone ?? "local",
      on_conflict: cfg.on_conflict ?? "skip",
      timeout: cfg.timeout ?? 300,
      max_failures: cfg.max_failures ?? 3,
    }
    if (entry) {
      output.runtime_status = entry.status
      output.consecutive_failures = entry.consecutiveFailures
      output.current_iteration = entry.iteration
      if (entry.activeSessionID) output.active_session_id = entry.activeSessionID
    }
    UI.println(JSON.stringify(output, null, 2))
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
    const { LoopRunProjection } = yield* Effect.promise(() =>
      import("@opencode-ai/core/loop/sql-projection"),
    )
    const { Database } = yield* Effect.promise(() =>
      import("@opencode-ai/core/database/database"),
    )
    const database = yield* Database.Service
    const runs = yield* LoopRunProjection.findByLoop(database.db, {
      loopName: args.name,
      limit: args.limit,
    }).pipe(
      Effect.matchEffect({
        onSuccess: (r) => Effect.succeed(r),
        onFailure: () => Effect.succeed([]),
      }),
    )

    if (runs.length === 0) {
      UI.println(`No execution history for loop "${args.name}"`)
      return
    }

    const header = `${"Iteration".padEnd(10)}  ${"Status".padEnd(10)}  ${"Started".padEnd(20)}  ${"Duration".padEnd(10)}  Error`
    const lines = [header, "─".repeat(header.length)]
    for (const run of runs) {
      const started = new Date(run.startedAt).toISOString().replace("T", " ").slice(0, 19)
      const duration = run.completedAt
        ? `${((run.completedAt - run.startedAt) / 1000).toFixed(1)}s`
        : "running"
      const error = run.error ? run.error.slice(0, 40) : ""
      lines.push(
        `${String(run.iteration).padEnd(10)}  ${run.status.padEnd(10)}  ${started.padEnd(20)}  ${duration.padEnd(10)}  ${error}`,
      )
    }
    UI.println(lines.join(EOL))
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
      UI.println(`Would run loop "${args.name}":`)
      UI.println(`  prompt: ${cfg.prompt}`)
      UI.println(`  model: ${cfg.model ?? "(default)"}`)
      UI.println(`  agent: ${cfg.agent ?? "(default)"}`)
      UI.println(`  directory: ${cfg.directory ?? process.cwd()}`)
      UI.println(`  timeout: ${cfg.timeout ?? 300}s`)
      return
    }
    const { LoopScheduler } = yield* Effect.promise(() =>
      import("@opencode-ai/core/loop/scheduler"),
    )
    const scheduler = yield* LoopScheduler.Service
    yield* scheduler.runNow(args.name, cfg)
    UI.println(
      UI.Style.TEXT_SUCCESS_BOLD +
        `Loop "${args.name}" iteration started.` +
        UI.Style.TEXT_NORMAL,
    )
    if (args.wait) {
      UI.println("Waiting for iteration to complete...")
      const { LoopRunProjection } = yield* Effect.promise(() =>
        import("@opencode-ai/core/loop/sql-projection"),
      )
      const { Database } = yield* Effect.promise(() =>
        import("@opencode-ai/core/database/database"),
      )
      const { Clock } = yield* Effect.promise(() => import("effect"))
      const database = yield* Database.Service
      const deadline = (yield* Clock.currentTimeMillis) + (cfg.timeout ?? 300) * 1000
      while ((yield* Clock.currentTimeMillis) < deadline) {
        yield* Effect.sleep(1000)
        const latest = yield* LoopRunProjection.latestByLoop(database.db, args.name).pipe(
          Effect.matchEffect({
            onSuccess: (r) => Effect.succeed(r),
            onFailure: () => Effect.succeed(undefined),
          }),
        )
        if (latest && latest.status !== "running") {
          if (latest.status === "completed") {
            UI.println(UI.Style.TEXT_SUCCESS_BOLD + "Completed" + UI.Style.TEXT_NORMAL)
          } else {
            UI.println(UI.Style.TEXT_DANGER_BOLD + `Failed: ${latest.error ?? "unknown"}` + UI.Style.TEXT_NORMAL)
          }
          return
        }
      }
      UI.println(UI.Style.TEXT_WARNING_BOLD + "Timed out waiting for completion" + UI.Style.TEXT_NORMAL)
    }
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

    const { LoopState } = yield* Effect.promise(() => import("@opencode-ai/core/loop/state"))
    const state = yield* LoopState.Service
    const entry = yield* state.snapshot(args.name).pipe(
      Effect.matchEffect({
        onSuccess: (e) => Effect.succeed(e),
        onFailure: () => Effect.succeed(undefined),
      }),
    )

    if (entry?.status !== "disabled_by_failures") {
      UI.println(`Loop "${args.name}" is not disabled by failures (status: ${entry?.status ?? "unknown"})`)
      return
    }

    yield* state.resetFailures(args.name)
    yield* state.setStatus(args.name, "idle")

    const configPath = findConfigPath()
    if (configPath) {
      yield* Effect.promise(async () => {
        const fs = await import("fs")
        const text = fs.readFileSync(configPath, "utf-8")
        const { parse, modify, applyEdits } = await import("jsonc-parser")
        const errors: any[] = []
        const input = parse(text, errors, { allowTrailingComma: true })
        if (!errors.length && input && typeof input === "object") {
          const loopKey = "loop" in input ? "loop" : undefined
          if (loopKey) {
            const loopObj = (input as Record<string, unknown>)[loopKey]
            if (loopObj && typeof loopObj === "object" && args.name in (loopObj as Record<string, unknown>)) {
              const loopEntry = (loopObj as Record<string, Record<string, unknown>>)[args.name]
              if (loopEntry && typeof loopEntry === "object" && "enabled" in loopEntry) {
                const edits = modify(text, [loopKey, args.name, "enabled"], true, {})
                const updated = applyEdits(text, edits)
                fs.writeFileSync(configPath, updated, "utf-8")
              }
            }
          }
        }
      })
    }

    UI.println(
      UI.Style.TEXT_SUCCESS_BOLD +
        `Loop "${args.name}" re-enabled. Failures reset to 0.` +
        UI.Style.TEXT_NORMAL,
    )
  }) as any,
})
