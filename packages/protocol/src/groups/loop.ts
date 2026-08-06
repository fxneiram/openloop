import { LoopConfig } from "@opencode-ai/schema/loop-config"
import { Schema } from "effect"
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema, OpenApi } from "effect/unstable/httpapi"
import { LocationQuery, locationQueryOpenApi } from "./location"

const LoopList = Schema.Record(Schema.String, LoopConfig.Info)

const LoopRunInput = Schema.Struct({
  name: Schema.String,
})

const LoopCreateInput = Schema.Struct({
  name: Schema.String,
  config: LoopConfig.Info,
})

const LoopUpdateInput = Schema.Struct({
  config: LoopConfig.Info,
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
  .add(
    HttpApiEndpoint.post("loop.create", "/experimental/loop", {
      query: LocationQuery,
      payload: LoopCreateInput,
      success: HttpApiSchema.NoContent,
      error: LoopError,
    })
      .annotateMerge(locationQueryOpenApi)
      .annotateMerge(OpenApi.annotations({ identifier: "v2.loop.create" })),
  )
  .add(
    HttpApiEndpoint.put("loop.update", "/experimental/loop/:name", {
      params: { name: Schema.String },
      query: LocationQuery,
      payload: LoopUpdateInput,
      success: HttpApiSchema.NoContent,
      error: LoopError,
    })
      .annotateMerge(locationQueryOpenApi)
      .annotateMerge(OpenApi.annotations({ identifier: "v2.loop.update" })),
  )
  .add(
    HttpApiEndpoint.delete("loop.delete", "/experimental/loop/:name", {
      params: { name: Schema.String },
      query: LocationQuery,
      success: HttpApiSchema.NoContent,
      error: LoopError,
    })
      .annotateMerge(locationQueryOpenApi)
      .annotateMerge(OpenApi.annotations({ identifier: "v2.loop.delete" })),
  )
  .add(
    HttpApiEndpoint.post("loop.enable", "/experimental/loop/:name/enable", {
      params: { name: Schema.String },
      query: LocationQuery,
      success: HttpApiSchema.NoContent,
      error: LoopError,
    })
      .annotateMerge(locationQueryOpenApi)
      .annotateMerge(OpenApi.annotations({ identifier: "v2.loop.enable" })),
  )
  .add(
    HttpApiEndpoint.post("loop.disable", "/experimental/loop/:name/disable", {
      params: { name: Schema.String },
      query: LocationQuery,
      success: HttpApiSchema.NoContent,
      error: LoopError,
    })
      .annotateMerge(locationQueryOpenApi)
      .annotateMerge(OpenApi.annotations({ identifier: "v2.loop.disable" })),
  )
  .annotateMerge(OpenApi.annotations({ title: "loop", description: "Loop scheduler management routes." }))
