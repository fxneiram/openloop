import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core"
import { SessionSchema } from "../session/schema"
import { SessionTable } from "../session/sql"
import { LoopRun } from "@opencode-ai/schema/loop-run"

export const LoopRunTable = sqliteTable(
  "loop_run",
  {
    id: text().primaryKey(),
    loop_name: text().notNull(),
    session_id: text()
      .notNull()
      .references(() => SessionTable.id, { onDelete: "cascade" })
      .$type<SessionSchema.ID>(),
    cron_run_at: integer().notNull(),
    started_at: integer().notNull(),
    completed_at: integer(),
    status: text().notNull(),
    error: text(),
    iteration: integer().notNull(),
  },
  (table) => [
    index("loop_run_name_started_idx").on(table.loop_name, table.started_at),
    index("loop_run_name_status_idx").on(table.loop_name, table.status),
    index("loop_run_session_idx").on(table.session_id),
  ],
)
