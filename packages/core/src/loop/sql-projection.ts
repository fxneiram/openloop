export * as LoopRunProjection from "./sql-projection"

import { and, desc, eq } from "drizzle-orm"
import { Effect, Schema } from "effect"
import type { Database } from "../database/database"
import { LoopRunTable } from "./sql"
import { LoopRun } from "@opencode-ai/schema/loop-run"

const decode = Schema.decodeUnknownEffect(LoopRun.Info)

export const insert = Effect.fn("LoopRunProjection.insert")(function* (
  db: Database.Interface["db"],
  input: LoopRun.Info,
) {
  yield* db
    .insert(LoopRunTable)
    .values({
      id: input.id,
      loop_name: input.loopName,
      session_id: input.sessionID,
      cron_run_at: input.cronRunAt,
      started_at: input.startedAt,
      completed_at: input.completedAt ?? null,
      status: input.status,
      error: input.error ?? null,
      iteration: input.iteration,
    })
    .run()
    .pipe(Effect.orDie)
  return input
})

export const complete = Effect.fn("LoopRunProjection.complete")(function* (
  db: Database.Interface["db"],
  id: LoopRun.ID,
  status: LoopRun.Status,
  completedAt: number,
  error?: string,
) {
  yield* db
    .update(LoopRunTable)
    .set({
      status,
      completed_at: completedAt,
      ...(error === undefined ? {} : { error }),
    })
    .where(eq(LoopRunTable.id, id))
    .run()
    .pipe(Effect.orDie)
})

export const findByLoop = Effect.fn("LoopRunProjection.findByLoop")(function* (
  db: Database.Interface["db"],
  input: { loopName: string; limit: number },
) {
  const rows = yield* db
    .select()
    .from(LoopRunTable)
    .where(eq(LoopRunTable.loop_name, input.loopName))
    .orderBy(desc(LoopRunTable.started_at))
    .limit(input.limit)
    .all()
    .pipe(Effect.orDie)
  return yield* Effect.forEach(rows, (row) =>
    decode({
      id: row.id,
      loopName: row.loop_name,
      sessionID: row.session_id,
      cronRunAt: row.cron_run_at,
      startedAt: row.started_at,
      completedAt: row.completed_at ?? undefined,
      status: row.status,
      error: row.error ?? undefined,
      iteration: row.iteration,
    }),
  )
})

export const latestByLoop = Effect.fn("LoopRunProjection.latestByLoop")(function* (
  db: Database.Interface["db"],
  loopName: string,
) {
  const row = yield* db
    .select()
    .from(LoopRunTable)
    .where(eq(LoopRunTable.loop_name, loopName))
    .orderBy(desc(LoopRunTable.started_at))
    .limit(1)
    .get()
    .pipe(Effect.orDie)
  if (!row) return undefined
  return yield* decode({
    id: row.id,
    loopName: row.loop_name,
    sessionID: row.session_id,
    cronRunAt: row.cron_run_at,
    startedAt: row.started_at,
    completedAt: row.completed_at ?? undefined,
    status: row.status,
    error: row.error ?? undefined,
    iteration: row.iteration,
  })
})

export const hasRunning = Effect.fn("LoopRunProjection.hasRunning")(function* (
  db: Database.Interface["db"],
  loopName: string,
) {
  const row = yield* db
    .select({ id: LoopRunTable.id })
    .from(LoopRunTable)
    .where(and(eq(LoopRunTable.loop_name, loopName), eq(LoopRunTable.status, "running")))
    .limit(1)
    .get()
    .pipe(Effect.orDie)
  return row !== undefined
})
