import { LoopConfig } from "@opencode-ai/schema/loop-config"
import { Schema } from "effect"
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema, OpenApi } from "effect/unstable/httpapi"
import { LocationQuery, locationQueryOpenApi } from "./location"

const LoopList = Schema.Record(Schema.String, LoopConfig.Info)

const LoopRunInput = Schema.Struct({
  name: Schema.String,
})

export class LoopError extends Schema.ErrorClass<LoopError>("LoopError")(
  {
    name: Schema.Literal("LoopError"),
    data: Schema.Struct({ message: Schema.String }),
  },
  { httpApiStatus: 400 },
) {}

export const LoopGroup = HttpApiGroup.make("server.loop")
  .add(
    HttpApiEndpoint.get("loop.list", "/experimental/loop", {
      query: LocationQuery,
      success: LoopList,
      error: LoopError,
    })
      .annotateMerge(locationQueryOpenApi)
      .annotateMerge(OpenApi.annotations({ identifier: "v2.loop.list" })),
  )
  .add(
    HttpApiEndpoint.post("loop.run", "/experimental/loop/run", {
      query: LocationQuery,
      payload: LoopRunInput,
      success: HttpApiSchema.NoContent,
      error: LoopError,
    })
      .annotateMerge(locationQueryOpenApi)
      .annotateMerge(OpenApi.annotations({ identifier: "v2.loop.run" })),
  )
  .annotateMerge(OpenApi.annotations({ title: "loop", description: "Loop scheduler management routes." }))
