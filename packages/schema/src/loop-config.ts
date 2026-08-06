export * as LoopConfig from "./loop-config"

import { Schema } from "effect"
import { NonNegativeInt } from "./schema"

export const OnConflict = Schema.Literals(["skip", "stop_and_restart", "queue"])
export type OnConflict = typeof OnConflict.Type

export const Timezone = Schema.Literals(["local", "UTC"])
export type Timezone = typeof Timezone.Type

export const Info = Schema.Struct({
  group: Schema.optional(Schema.String),
  model: Schema.optional(Schema.String),
  agent: Schema.optional(Schema.String),
  prompt: Schema.String,
  directory: Schema.optional(Schema.String),
  cron: Schema.String,
  timezone: Schema.optional(Timezone),
  on_conflict: Schema.optional(OnConflict),
  enabled: Schema.optional(Schema.Boolean),
  max_queue_length: Schema.optional(NonNegativeInt),
  timeout: Schema.optional(NonNegativeInt),
  max_failures: Schema.optional(NonNegativeInt),
}).annotate({ identifier: "LoopConfig" })
export type Info = Schema.Schema.Type<typeof Info>
