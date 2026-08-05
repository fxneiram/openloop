import { Effect } from "effect"
import type { DatabaseMigration } from "../migration"

export default {
  id: "20260805133638_white_champions",
  up(tx) {
    return Effect.gen(function* () {
      yield* tx.run(`
        CREATE TABLE \`loop_run\` (
          \`id\` text PRIMARY KEY,
          \`loop_name\` text NOT NULL,
          \`session_id\` text NOT NULL,
          \`cron_run_at\` integer NOT NULL,
          \`started_at\` integer NOT NULL,
          \`completed_at\` integer,
          \`status\` text NOT NULL,
          \`error\` text,
          \`iteration\` integer NOT NULL,
          CONSTRAINT \`fk_loop_run_session_id_session_id_fk\` FOREIGN KEY (\`session_id\`) REFERENCES \`session\`(\`id\`) ON DELETE CASCADE
        );
      `)
      yield* tx.run(`CREATE INDEX \`loop_run_name_started_idx\` ON \`loop_run\` (\`loop_name\`,\`started_at\`);`)
      yield* tx.run(`CREATE INDEX \`loop_run_name_status_idx\` ON \`loop_run\` (\`loop_name\`,\`status\`);`)
      yield* tx.run(`CREATE INDEX \`loop_run_session_idx\` ON \`loop_run\` (\`session_id\`);`)
    })
  },
} satisfies DatabaseMigration.Migration
