export * as LoopScheduler from "./scheduler"

import { Cause, Clock, Context, Effect, Exit, Layer, Option, Queue, Scope } from "effect"
import { ConfigLoopV1 } from "../v1/config/loop"
import { LoopCron } from "./cron"
import { LoopState } from "./state"
import { LoopEvent } from "./event"
import { LoopRunProjection } from "./sql-projection"
import { SessionV2 } from "../session"
import { SessionSchema } from "../session/schema"
import { SessionMessage } from "../session/message"
import { Prompt } from "../session/prompt"
import { ModelV2 } from "../model"
import { AgentV2 } from "../agent"
import { Catalog } from "../catalog"
import { Database } from "../database/database"
import { EventV2 } from "../event"
import { LoopRun } from "@opencode-ai/schema/loop-run"
import { makeGlobalNode } from "../effect/app-node"
import { SessionExecution } from "../session/execution"

export interface Interface {
  readonly start: (loops?: Record<string, ConfigLoopV1.Info>) => Effect.Effect<void>
  readonly runNow: (name: string, loop: ConfigLoopV1.Info) => Effect.Effect<void>
  readonly stop: Effect.Effect<void>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/LoopScheduler") {}

type ValidatedLoop = {
  name: string
  loop: ConfigLoopV1.Info
  model?: { providerID: import("../provider").ProviderV2.ID; modelID: ModelV2.ID }
  agent?: AgentV2.ID
  directory: string
}

const defaults = {
  timezone: "local" as const,
  on_conflict: "skip" as const,
  max_queue_length: 10,
  timeout: 300,
  max_failures: 3,
}

export const make = Effect.gen(function* () {
  const state = yield* LoopState.Service
  const events = yield* EventV2.Service
  const database = yield* Database.Service
  const sessions = yield* SessionV2.Service
  const execution = yield* SessionExecution.Service
  const agents = yield* AgentV2.Service
  const catalog = yield* Catalog.Service

  const db = database.db

  const validateLoop = (name: string, loop: ConfigLoopV1.Info) =>
    Effect.gen(function* () {
      const timezone = loop.timezone ?? defaults.timezone
      if (!LoopCron.isValid({ cron: loop.cron, timezone })) {
        return `Loop "${name}" has invalid cron expression`
      }
      if (loop.agent) {
        const resolved = yield* agents.resolve(loop.agent)
        if (resolved === undefined) return `Loop "${name}" references unavailable agent ${loop.agent}`
      }
      if (loop.model) {
        const parsed = ModelV2.parse(loop.model)
        const resolved = yield* catalog.model.get(parsed.providerID, parsed.modelID)
        if (resolved === undefined) {
          return `Loop "${name}" references unavailable model ${loop.model}`
        }
      }
      return undefined
    })

  const validatedLoop = (name: string, loop: ConfigLoopV1.Info): ValidatedLoop => ({
    name,
    loop,
    directory: loop.directory ?? process.cwd(),
    agent: loop.agent ? AgentV2.ID.make(loop.agent) : undefined,
    model: loop.model ? ModelV2.parse(loop.model) : undefined,
  })

  const resolveLoopSession = (loop: ValidatedLoop) =>
    Effect.gen(function* () {
      const model = loop.model
        ? ModelV2.Ref.make({ id: loop.model.modelID, providerID: loop.model.providerID })
        : undefined
      return yield* sessions.getOrCreateByName({
        name: loop.name,
        directory: loop.directory,
        agent: loop.agent,
        model,
      })
    })

  const waitForSession = (sessionID: SessionSchema.ID, timeout: number) =>
    Effect.gen(function* () {
      const deadline = (yield* Clock.currentTimeMillis) + timeout
      while ((yield* execution.active).has(sessionID)) {
        if ((yield* Clock.currentTimeMillis) >= deadline) return false
        yield* Effect.sleep(500)
      }
      return true
    })

  const runIteration = (loop: ValidatedLoop) =>
    Effect.gen(function* () {
      const cfg = loop.loop
      yield* state.setStatus(loop.name, "running")
      const iteration = yield* state.nextIteration(loop.name)
      const cronRunAt = yield* Clock.currentTimeMillis
      const runID = LoopRun.ID.create()

      const run = Effect.gen(function* () {
        const session = yield* resolveLoopSession(loop)
        yield* state.setActiveSession(loop.name, session.id)
        const startedAt = yield* Clock.currentTimeMillis
        yield* LoopRunProjection.insert(db, {
          id: runID,
          loopName: loop.name,
          sessionID: session.id,
          cronRunAt,
          startedAt,
          status: "running",
          iteration,
        })
        yield* events.publish(LoopEvent.LoopStarted, {
          loopName: loop.name,
          sessionID: session.id,
          iteration,
        })

        const messageID = SessionMessage.ID.create()
        yield* sessions.prompt({
          id: messageID,
          sessionID: session.id,
          prompt: Prompt.make({ text: cfg.prompt }),
          delivery: "queue",
          resume: true,
        })

        const timeout = (cfg.timeout ?? defaults.timeout) * 1000
        const idle = yield* waitForSession(session.id, timeout).pipe(
          Effect.timeout(timeout),
          Effect.matchEffect({
            onSuccess: (value) => Effect.succeed(value),
            onFailure: () => Effect.succeed(false),
          }),
        )
        if (!idle) {
          yield* sessions.interrupt(session.id)
          return yield* Effect.fail("Iteration timed out")
        }

        const completedAt = yield* Clock.currentTimeMillis
        yield* LoopRunProjection.complete(db, runID, "completed", completedAt)
        yield* state.resetFailures(loop.name)
        yield* state.setActiveSession(loop.name)
        yield* state.setStatus(loop.name, "idle")
        yield* events.publish(LoopEvent.LoopIterationCompleted, {
          loopName: loop.name,
          sessionID: session.id,
          iteration,
          duration: completedAt - startedAt,
        })
      })

      yield* run.pipe(
        Effect.matchCauseEffect({
          onSuccess: () => Effect.void,
          onFailure: (cause) =>
            Effect.gen(function* () {
              const error = Cause.hasInterruptsOnly(cause) ? "Iteration timed out" : String(Cause.squash(cause))
              const completedAt = yield* Clock.currentTimeMillis
              yield* LoopRunProjection.complete(db, runID, "error", completedAt, error)
              yield* state.incrementFailures(loop.name)
              yield* state.setActiveSession(loop.name)
              yield* state.setStatus(loop.name, "idle")
              const errorSessionID = (yield* state.snapshot(loop.name))?.activeSessionID
              yield* events.publish(LoopEvent.LoopError, {
                loopName: loop.name,
                sessionID: errorSessionID ? SessionSchema.ID.make(errorSessionID) : SessionSchema.ID.make(""),
                iteration,
                error,
              })
              const entry = yield* state.snapshot(loop.name)
              const maxFailures = cfg.max_failures ?? defaults.max_failures
              if (maxFailures > 0 && (entry?.consecutiveFailures ?? 0) >= maxFailures) {
                yield* state.setStatus(loop.name, "disabled_by_failures")
                yield* events.publish(LoopEvent.LoopDisabledByFailures, {
                  loopName: loop.name,
                  consecutiveFailures: entry?.consecutiveFailures ?? 0,
                })
              }
            }),
        }),
      )
    })

  const handleSkip = (loop: ValidatedLoop, iteration: number) =>
    Effect.gen(function* () {
      yield* events.publish(LoopEvent.LoopConflictSkipped, { loopName: loop.name, iteration })
        yield* LoopRunProjection.insert(db, {
          id: LoopRun.ID.create(),
          loopName: loop.name,
          sessionID: SessionSchema.ID.make(""),
          cronRunAt: Date.now(),
          startedAt: Date.now(),
          status: "skipped",
          iteration,
        })
    })

  const handleQueueFull = (loop: ValidatedLoop, iteration: number, queueLength: number) =>
    Effect.gen(function* () {
      yield* events.publish(LoopEvent.LoopQueueFull, { loopName: loop.name, iteration, queueLength })
      yield* LoopRunProjection.insert(db, {
        id: LoopRun.ID.create(),
        loopName: loop.name,
        sessionID: SessionSchema.ID.make(""),
        cronRunAt: Date.now(),
        startedAt: Date.now(),
        status: "discarded",
        iteration,
      })
    })

  const drainQueue = (loop: ValidatedLoop) =>
    Effect.gen(function* () {
      if (loop.loop.on_conflict !== "queue") return
      const entry = yield* state.snapshot(loop.name)
      if (!entry) return
      while (Queue.sizeUnsafe(entry.queue) > 0) {
        yield* state.takeQueue(loop.name)
        yield* runIteration(loop)
      }
    })

  const handleTick = (loop: ValidatedLoop) =>
    Effect.gen(function* () {
      const cfg = loop.loop
      const entry = yield* state.snapshot(loop.name)
      if (entry?.status === "disabled_by_failures" || entry?.status === "invalid") return

      if (entry?.status === "running") {
        const iteration = yield* state.nextIteration(loop.name)
        if (cfg.on_conflict === "skip") {
          yield* handleSkip(loop, iteration)
          return
        }
        if (cfg.on_conflict === "stop_and_restart") {
          if (entry.activeSessionID) {
            yield* sessions.interrupt(SessionSchema.ID.make(entry.activeSessionID))
          }
          yield* state.setActiveSession(loop.name)
          yield* runIteration(loop)
          yield* drainQueue(loop)
          return
        }
        if (cfg.on_conflict === "queue") {
          const offered = yield* state.offerQueue(loop.name)
          if (!offered) {
            yield* handleQueueFull(loop, iteration, cfg.max_queue_length ?? defaults.max_queue_length)
          }
          return
        }
      }

      yield* runIteration(loop)
      yield* drainQueue(loop)
    })

  const loopFiber = (loop: ValidatedLoop) =>
    Effect.forever(
      Effect.gen(function* () {
        const cfg = loop.loop
        const now = new Date(yield* Clock.currentTimeMillis)
        const next = LoopCron.nextRunAt({
          cron: cfg.cron,
          timezone: cfg.timezone ?? defaults.timezone,
          now,
        })
        const delay = next - now.getTime()
        if (delay > 0) yield* Effect.sleep(delay)
        yield* handleTick(loop)
      }),
    )

  let schedulerScope: Scope.Scope | undefined

  const parentScope = yield* Scope.Scope

  const start = (loops?: Record<string, ConfigLoopV1.Info>) =>
    Effect.gen(function* () {
      if (schedulerScope) return
      const definitions = loops ?? {}
      const names = Object.keys(definitions)
      if (names.length === 0) return
      schedulerScope = yield* Scope.fork(parentScope, "parallel")
      for (const name of names) {
        const loop = definitions[name]
        if (loop.enabled === false) continue
        const error = yield* validateLoop(name, loop)
        yield* state.ensureQueue(name, loop.max_queue_length ?? defaults.max_queue_length)
        if (error) {
          yield* Effect.logError(error)
          yield* state.setStatus(name, "invalid")
          continue
        }
        yield* state.setStatus(name, "idle")
        yield* loopFiber(validatedLoop(name, loop)).pipe(Effect.forkIn(schedulerScope, { startImmediately: true }))
      }
      yield* Effect.logInfo("Loop scheduler started", { activeLoops: names.length })
    })

  const runNow = (name: string, loop: ConfigLoopV1.Info) =>
    Effect.gen(function* () {
      const error = yield* validateLoop(name, loop)
      if (error) return yield* Effect.die(error)
      yield* state.ensureQueue(name, loop.max_queue_length ?? defaults.max_queue_length)
      yield* handleTick(validatedLoop(name, loop))
    })

  const stop = Effect.gen(function* () {
    if (!schedulerScope) return
    yield* Scope.close(schedulerScope, Exit.void)
    schedulerScope = undefined
  })

  return Service.of({ start, runNow, stop })
})

export const layer = Layer.effect(Service, make)

export const node = makeGlobalNode({
  service: Service,
  layer,
  deps: [
    Database.node,
    EventV2.node,
    SessionV2.node,
    SessionExecution.node,
    AgentV2.node,
    Catalog.node,
    LoopState.node,
  ] as never,
})
