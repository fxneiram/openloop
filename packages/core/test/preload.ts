import path from "path"

process.env.OPENLOOP_DB = ":memory:"
process.env.OPENLOOP_MODELS_PATH = path.join(import.meta.dir, "plugin", "fixtures", "models-dev.json")
process.env.OPENLOOP_DISABLE_MODELS_FETCH = "true"
