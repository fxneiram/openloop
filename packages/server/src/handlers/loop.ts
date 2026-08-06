import { FSUtil } from "@opencode-ai/core/fs-util"
import { Location } from "@opencode-ai/core/location"
import { LoopScheduler } from "@opencode-ai/core/loop/scheduler"
import { ConfigV1 } from "@opencode-ai/core/v1/config/config"
import { ConfigMigrateV1 } from "@opencode-ai/core/v1/config/migrate"
import { LoopConfig } from "@opencode-ai/schema/loop-config"
import { Effect, Option, Schema } from "effect"
import { HttpApiBuilder, HttpApiSchema } from "effect/unstable/httpapi"
import { parse } from "jsonc-parser"
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
