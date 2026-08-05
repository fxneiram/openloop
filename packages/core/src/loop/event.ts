export * as LoopEvent from "./event"

import { Schema } from "effect"
import { EventV2 } from "../event"
import { SessionSchema } from "../session/schema"

export const LoopStarted = EventV2.define({
  type: "loop.started",
  schema: {
    loopName: Schema.String,
    sessionID: SessionSchema.ID,
    iteration: Schema.Number,
  },
})

export const LoopIterationCompleted = EventV2.define({
  type: "loop.iteration.completed",
  schema: {
    loopName: Schema.String,
    sessionID: SessionSchema.ID,
    iteration: Schema.Number,
    duration: Schema.Number,
  },
})

export const LoopError = EventV2.define({
  type: "loop.error",
  schema: {
    loopName: Schema.String,
    sessionID: SessionSchema.ID,
    iteration: Schema.Number,
    error: Schema.String,
  },
})

export const LoopConflictSkipped = EventV2.define({
  type: "loop.conflict.skipped",
  schema: {
    loopName: Schema.String,
    iteration: Schema.Number,
  },
})

export const LoopQueueFull = EventV2.define({
  type: "loop.queue.full",
  schema: {
    loopName: Schema.String,
    iteration: Schema.Number,
    queueLength: Schema.Number,
  },
})

export const LoopDisabledByFailures = EventV2.define({
  type: "loop.disabled_by_failures",
  schema: {
    loopName: Schema.String,
    consecutiveFailures: Schema.Number,
  },
})
