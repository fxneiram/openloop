import { Effect } from "effect"
import { LoopScheduler } from "@opencode-ai/core/loop/scheduler"

export const startScheduler = Effect.fn("Loop.startScheduler")(function* () {
  const scheduler = yield* LoopScheduler.Service
  const { Config } = yield* Effect.promise(() => import("@/config/config"))
  const config = yield* Config.Service
  const info = yield* config.get()
  const loops = info.loop
  if (!loops || Object.keys(loops).length === 0) return
  yield* scheduler.start(loops)
})
