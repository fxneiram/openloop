import { describe, expect } from "bun:test"
import { Effect } from "effect"
import path from "path"
import { FilePaths } from "../../src/server/routes/instance/httpapi/groups/file"
import { TestInstance } from "../fixture/fixture"
import { pollWithTimeout, testEffect } from "../lib/effect"
import { describeRg } from "../lib/skip"
import { httpApiLayer, requestInDirectory } from "./httpapi-layer"

const it = testEffect(httpApiLayer)

describe("file HttpApi", () => {
  it.instance("serves read endpoints", () =>
    Effect.gen(function* () {
      const dir = yield* TestInstance
      yield* Effect.promise(() => Bun.write(path.join(dir.directory, "hello.txt"), "hello"))

      const [list, content, status] = yield* Effect.all([
        requestInDirectory(FilePaths.list, dir.directory, { method: "GET" }, { path: "." }),
        requestInDirectory(FilePaths.content, dir.directory, { method: "GET" }, { path: "hello.txt" }),
        requestInDirectory(FilePaths.status, dir.directory, { method: "GET" }),
      ])

      expect(list.status).toBe(200)
      expect(yield* list.json).toContainEqual(
        expect.objectContaining({ name: "hello.txt", path: "hello.txt", type: "file" }),
      )

      expect(content.status).toBe(200)
      expect(yield* content.json).toMatchObject({ type: "text", content: "hello" })

      expect(status.status).toBe(200)
      expect(yield* status.json).toEqual([])
    }),
    { git: true },
  )
})

describeRg("file HttpApi search", () => {
  it.instance("serves search endpoints", () =>
    Effect.gen(function* () {
      const dir = yield* TestInstance
      yield* Effect.promise(() => Bun.write(path.join(dir.directory, "hello.txt"), "needle"))

      const [text, symbols] = yield* Effect.all([
        requestInDirectory(FilePaths.findText, dir.directory, { method: "GET" }, { pattern: "needle" }),
        requestInDirectory(FilePaths.findSymbol, dir.directory, { method: "GET" }, { query: "hello" }),
      ])

      const files = yield* pollWithTimeout(
        Effect.gen(function* () {
          const response = yield* requestInDirectory(FilePaths.findFile, dir.directory, { method: "GET" }, { query: "hello", type: "file" })
          const body = yield* response.json
          return (body as string[]).includes("hello.txt") ? { response, body } : undefined
        }),
        "file search index was not ready",
      )

      expect(text.status).toBe(200)
      expect(yield* text.json).toContainEqual(expect.objectContaining({ line_number: 1 }))

      expect(files.response.status).toBe(200)
      expect(files.body).toContain("hello.txt")

      expect(symbols.status).toBe(200)
      expect(yield* symbols.json).toEqual([])
    }),
    { git: true },
  )
})
