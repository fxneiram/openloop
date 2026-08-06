export * as LoopRun from "./loop-run"

import { Schema } from "effect"
import { statics, optional } from "./schema"
import { ascending } from "./identifier"
import { SessionID } from "./session-id"

export const ID = Schema.String.check(Schema.isStartsWith("lrun_")).pipe(
  Schema.brand("LoopRun.ID"),
  statics((schema) => ({ create: () => schema.make("lrun_" + ascending()) })),
)
export type ID = typeof ID.Type

export const Status = Schema.Literals(["running", "completed", "error", "skipped", "discarded"])
export type Status = typeof Status.Type

export const Info = Schema.Struct({
  id: ID,
  loopName: Schema.String,
  sessionID: SessionID,
  cronRunAt: Schema.Number,
  startedAt: Schema.Number,
  completedAt: Schema.optional(Schema.Number),
  status: Status,
  error: Schema.optional(Schema.String),
  iteration: Schema.Number,
}).annotate({ identifier: "LoopRun.Info" })
export type Info = Schema.Schema.Type<typeof Info>
