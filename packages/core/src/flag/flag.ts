import { Config } from "effect"

export function truthy(key: string) {
  const value = process.env[key]?.toLowerCase()
  return value === "true" || value === "1"
}

const copy = process.env["OPENLOOP_EXPERIMENTAL_DISABLE_COPY_ON_SELECT"]
const fff = process.env["OPENLOOP_DISABLE_FFF"]

function enabledByExperimental(key: string) {
  return process.env[key] === undefined ? truthy("OPENLOOP_EXPERIMENTAL") : truthy(key)
}

export const Flag = {
  OTEL_EXPORTER_OTLP_ENDPOINT: process.env["OTEL_EXPORTER_OTLP_ENDPOINT"],
  OTEL_EXPORTER_OTLP_HEADERS: process.env["OTEL_EXPORTER_OTLP_HEADERS"],

  OPENLOOP_AUTO_HEAP_SNAPSHOT: truthy("OPENLOOP_AUTO_HEAP_SNAPSHOT"),
  OPENLOOP_GIT_BASH_PATH: process.env["OPENLOOP_GIT_BASH_PATH"],
  OPENLOOP_CONFIG: process.env["OPENLOOP_CONFIG"],
  OPENLOOP_CONFIG_CONTENT: process.env["OPENLOOP_CONFIG_CONTENT"],
  OPENLOOP_DISABLE_AUTOUPDATE: truthy("OPENLOOP_DISABLE_AUTOUPDATE"),
  OPENLOOP_ALWAYS_NOTIFY_UPDATE: truthy("OPENLOOP_ALWAYS_NOTIFY_UPDATE"),
  OPENLOOP_DISABLE_PRUNE: truthy("OPENLOOP_DISABLE_PRUNE"),
  OPENLOOP_DISABLE_TERMINAL_TITLE: truthy("OPENLOOP_DISABLE_TERMINAL_TITLE"),
  OPENLOOP_SHOW_TTFD: truthy("OPENLOOP_SHOW_TTFD"),
  OPENLOOP_DISABLE_AUTOCOMPACT: truthy("OPENLOOP_DISABLE_AUTOCOMPACT"),
  OPENLOOP_DISABLE_MODELS_FETCH: truthy("OPENLOOP_DISABLE_MODELS_FETCH"),
  OPENLOOP_DISABLE_MOUSE: truthy("OPENLOOP_DISABLE_MOUSE"),
  OPENLOOP_FAKE_VCS: process.env["OPENLOOP_FAKE_VCS"],
  OPENLOOP_SERVER_PASSWORD: process.env["OPENLOOP_SERVER_PASSWORD"],
  OPENLOOP_SERVER_USERNAME: process.env["OPENLOOP_SERVER_USERNAME"],
  OPENLOOP_DISABLE_FFF: fff === undefined ? process.platform === "win32" : truthy("OPENLOOP_DISABLE_FFF"),

  // Experimental
  OPENLOOP_EXPERIMENTAL_FILEWATCHER: Config.boolean("OPENLOOP_EXPERIMENTAL_FILEWATCHER").pipe(
    Config.withDefault(false),
  ),
  OPENLOOP_EXPERIMENTAL_DISABLE_FILEWATCHER: Config.boolean("OPENLOOP_EXPERIMENTAL_DISABLE_FILEWATCHER").pipe(
    Config.withDefault(false),
  ),
  OPENLOOP_EXPERIMENTAL_DISABLE_COPY_ON_SELECT:
    copy === undefined ? process.platform === "win32" : truthy("OPENLOOP_EXPERIMENTAL_DISABLE_COPY_ON_SELECT"),
  OPENLOOP_MODELS_URL: process.env["OPENLOOP_MODELS_URL"],
  OPENLOOP_MODELS_PATH: process.env["OPENLOOP_MODELS_PATH"],
  OPENLOOP_DB: process.env["OPENLOOP_DB"],

  OPENLOOP_WORKSPACE_ID: process.env["OPENLOOP_WORKSPACE_ID"],
  OPENLOOP_EXPERIMENTAL_WORKSPACES: enabledByExperimental("OPENLOOP_EXPERIMENTAL_WORKSPACES"),

  // Evaluated at access time (not module load) because tests, the CLI, and
  // external tooling set these env vars at runtime.
  get OPENLOOP_DISABLE_PROJECT_CONFIG() {
    return truthy("OPENLOOP_DISABLE_PROJECT_CONFIG")
  },
  get OPENLOOP_EXPERIMENTAL_REFERENCES() {
    return enabledByExperimental("OPENLOOP_EXPERIMENTAL_REFERENCES")
  },
  get OPENLOOP_TUI_CONFIG() {
    return process.env["OPENLOOP_TUI_CONFIG"]
  },
  get OPENLOOP_CONFIG_DIR() {
    return process.env["OPENLOOP_CONFIG_DIR"]
  },
  get OPENLOOP_PURE() {
    return truthy("OPENLOOP_PURE")
  },
  get OPENLOOP_PERMISSION() {
    return process.env["OPENLOOP_PERMISSION"]
  },
  get OPENLOOP_PLUGIN_META_FILE() {
    return process.env["OPENLOOP_PLUGIN_META_FILE"]
  },
  get OPENLOOP_CLIENT() {
    return process.env["OPENLOOP_CLIENT"] ?? "cli"
  },
}
