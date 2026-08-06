import { FSUtil } from "@opencode-ai/core/fs-util"
import { Location } from "@opencode-ai/core/location"
import { LoopScheduler } from "@opencode-ai/core/loop/scheduler"
import { ConfigV1 } from "@opencode-ai/core/v1/config/config"
import { ConfigMigrateV1 } from "@opencode-ai/core/v1/config/migrate"
import { LoopConfig } from "@opencode-ai/schema/loop-config"
import { Effect, Option, Schema } from "effect"
import { HttpApiBuilder, HttpApiSchema } from "effect/unstable/httpapi"
import { parse, modify, applyEdits } from "jsonc-parser"
import { Api } from "../api"
import { LoopError } from "@opencode-ai/protocol/groups/loop"

export const LoopHandler = HttpApiBuilder.group(Api, "server.loop", (handlers) =>
  Effect.gen(function* () {
    return handlers
      .handle("loop.list", () =>
        Effect.gen(function* () {
          const location = yield* Location.Service
          const fs = yield* FSUtil.Service
          const directory = location.project.directory
          const loops = yield* loadLoops(fs, directory)
          return loops
        }),
      )
      .handle("loop.run", (ctx) =>
        Effect.gen(function* () {
          const location = yield* Location.Service
          const fs = yield* FSUtil.Service
          const scheduler = yield* LoopScheduler.Service
          const directory = location.project.directory
          const loops = yield* loadLoops(fs, directory)
          const cfg = loops[ctx.payload.name]
          if (!cfg) {
            return yield* Effect.fail(
              new LoopError({
                name: "LoopError",
                data: { message: `Loop not found: ${ctx.payload.name}` },
              }),
            )
          }
          yield* scheduler.runNow(ctx.payload.name, cfg)
          return HttpApiSchema.NoContent.make()
        }),
      )
      .handle("loop.create", (ctx) =>
        Effect.gen(function* () {
          const location = yield* Location.Service
          const fs = yield* FSUtil.Service
          const directory = location.project.directory
          const loops = yield* loadLoops(fs, directory)
          if (loops[ctx.payload.name]) {
            return yield* Effect.fail(
              new LoopError({
                name: "LoopError",
                data: { message: `Loop already exists: ${ctx.payload.name}` },
              }),
            )
          }
          yield* saveLoopConfig(fs, directory, ctx.payload.name, ctx.payload.config)
          return HttpApiSchema.NoContent.make()
        }),
      )
      .handle("loop.update", (ctx) =>
        Effect.gen(function* () {
          const location = yield* Location.Service
          const fs = yield* FSUtil.Service
          const directory = location.project.directory
          const loops = yield* loadLoops(fs, directory)
          if (!loops[ctx.params.name]) {
            return yield* Effect.fail(
              new LoopError({
                name: "LoopError",
                data: { message: `Loop not found: ${ctx.params.name}` },
              }),
            )
          }
          yield* saveLoopConfig(fs, directory, ctx.params.name, ctx.payload.config)
          return HttpApiSchema.NoContent.make()
        }),
      )
      .handle("loop.delete", (ctx) =>
        Effect.gen(function* () {
          const location = yield* Location.Service
          const fs = yield* FSUtil.Service
          const directory = location.project.directory
          const loops = yield* loadLoops(fs, directory)
          if (!loops[ctx.params.name]) {
            return yield* Effect.fail(
              new LoopError({
                name: "LoopError",
                data: { message: `Loop not found: ${ctx.params.name}` },
              }),
            )
          }
          yield* deleteLoopConfig(fs, directory, ctx.params.name)
          return HttpApiSchema.NoContent.make()
        }),
      )
      .handle("loop.enable", (ctx) =>
        Effect.gen(function* () {
          const location = yield* Location.Service
          const fs = yield* FSUtil.Service
          const scheduler = yield* LoopScheduler.Service
          const directory = location.project.directory
          const loops = yield* loadLoops(fs, directory)
          if (!loops[ctx.params.name]) {
            return yield* Effect.fail(
              new LoopError({
                name: "LoopError",
                data: { message: `Loop not found: ${ctx.params.name}` },
              }),
            )
          }
          const cfg = loops[ctx.params.name]
          yield* scheduler.runNow(ctx.params.name, { ...cfg, enabled: true })
          yield* updateLoopEnabled(fs, directory, ctx.params.name, true)
          return HttpApiSchema.NoContent.make()
        }),
      )
      .handle("loop.disable", (ctx) =>
        Effect.gen(function* () {
          const location = yield* Location.Service
          const fs = yield* FSUtil.Service
          const directory = location.project.directory
          const loops = yield* loadLoops(fs, directory)
          if (!loops[ctx.params.name]) {
            return yield* Effect.fail(
              new LoopError({
                name: "LoopError",
                data: { message: `Loop not found: ${ctx.params.name}` },
              }),
            )
          }
          yield* updateLoopEnabled(fs, directory, ctx.params.name, false)
          return HttpApiSchema.NoContent.make()
        }),
      )
  }),
)

function loadLoops(
  fs: FSUtil.Interface,
  directory: string,
): Effect.Effect<Record<string, LoopConfig.Info>, LoopError> {
  const names = ["openloop.json", "openloop.jsonc", "opencode.json", "opencode.jsonc"]
  return Effect.gen(function* () {
    for (const name of names) {
      const filepath = `${directory}/${name}`
      const exists = yield* fs.existsSafe(filepath)
      if (!exists) continue
      const text = yield* fs.readFileStringSafe(filepath)
      if (text === undefined) continue
      const errors: Array<import("jsonc-parser").ParseError> = []
      const input = parse(text, errors, { allowTrailingComma: true })
      if (errors.length) continue
      if (ConfigMigrateV1.isV1(input)) {
        const decoded = Schema.decodeUnknownOption(ConfigV1.Info)(input)
        if (Option.isSome(decoded)) {
          const migrated = ConfigMigrateV1.migrate(decoded.value)
          return (migrated.loop as Record<string, LoopConfig.Info> | undefined) ?? {}
        }
      }
      if (input && typeof input === "object" && "loop" in input) {
        return (input as { loop?: Record<string, LoopConfig.Info> }).loop ?? {}
      }
    }
    return {}
  }).pipe(
    Effect.mapError(
      (error) =>
        new LoopError({
          name: "LoopError",
          data: { message: error instanceof Error ? error.message : String(error) },
        }),
    ),
  )
}

function findConfigPath(
  fs: FSUtil.Interface,
  directory: string,
): Effect.Effect<string, LoopError> {
  const names = ["openloop.json", "openloop.jsonc", "opencode.json", "opencode.jsonc"]
  return Effect.gen(function* () {
    for (const name of names) {
      const filepath = `${directory}/${name}`
      const exists = yield* fs.existsSafe(filepath)
      if (exists) return filepath
    }
    return `${directory}/openloop.json`
  })
}

function saveLoopConfig(
  fs: FSUtil.Interface,
  directory: string,
  name: string,
  config: LoopConfig.Info,
): Effect.Effect<void, LoopError> {
  return Effect.gen(function* () {
    const configPath = yield* findConfigPath(fs, directory)
    let text = "{}"
    const exists = yield* fs.existsSafe(configPath)
    if (exists) {
      const content = yield* fs.readFileStringSafe(configPath)
      if (content !== undefined) {
        text = content
      }
    }
    const edits = modify(text, ["loop", name], config, {
      formattingOptions: { tabSize: 2, insertSpaces: true },
    })
    const updated = applyEdits(text, edits)
    yield* fs.writeWithDirs(configPath, updated)
  }).pipe(
    Effect.mapError(
      (error) =>
        new LoopError({
          name: "LoopError",
          data: { message: error instanceof Error ? error.message : String(error) },
        }),
    ),
  )
}

function deleteLoopConfig(
  fs: FSUtil.Interface,
  directory: string,
  name: string,
): Effect.Effect<void, LoopError> {
  return Effect.gen(function* () {
    const configPath = yield* findConfigPath(fs, directory)
    const exists = yield* fs.existsSafe(configPath)
    if (!exists) return
    const text = yield* fs.readFileStringSafe(configPath)
    if (text === undefined) return
    const errors: Array<import("jsonc-parser").ParseError> = []
    const input = parse(text, errors, { allowTrailingComma: true })
    if (errors.length) return
    if (!input || typeof input !== "object" || !("loop" in input)) return
    const loopObj = (input as { loop?: Record<string, unknown> }).loop
    if (!loopObj || typeof loopObj !== "object" || !(name in loopObj)) return
    const edits = modify(text, ["loop", name], undefined, {
      formattingOptions: { tabSize: 2, insertSpaces: true },
    })
    const updated = applyEdits(text, edits)
    yield* fs.writeWithDirs(configPath, updated)
  }).pipe(
    Effect.mapError(
      (error) =>
        new LoopError({
          name: "LoopError",
          data: { message: error instanceof Error ? error.message : String(error) },
        }),
    ),
  )
}

function updateLoopEnabled(
  fs: FSUtil.Interface,
  directory: string,
  name: string,
  enabled: boolean,
): Effect.Effect<void, LoopError> {
  return Effect.gen(function* () {
    const configPath = yield* findConfigPath(fs, directory)
    const exists = yield* fs.existsSafe(configPath)
    if (!exists) return
    const text = yield* fs.readFileStringSafe(configPath)
    if (text === undefined) return
    const edits = modify(text, ["loop", name, "enabled"], enabled, {
      formattingOptions: { tabSize: 2, insertSpaces: true },
    })
    const updated = applyEdits(text, edits)
    yield* fs.writeWithDirs(configPath, updated)
  }).pipe(
    Effect.mapError(
      (error) =>
        new LoopError({
          name: "LoopError",
          data: { message: error instanceof Error ? error.message : String(error) },
        }),
    ),
  )
}
