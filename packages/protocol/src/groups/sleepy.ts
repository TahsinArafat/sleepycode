import { Schema } from "effect"
import { HttpApiEndpoint, HttpApiGroup, OpenApi } from "effect/http-api"

export const SleepyGroup = HttpApiGroup.make("server.sleepy")
  .add(
    HttpApiEndpoint.post("sleepy.logout", "/api/sleepy/logout", {
      success: Schema.Struct({
        data: Schema.Struct({
          removed: Schema.Array(Schema.String),
          email: Schema.optional(Schema.String),
        }),
      }),
    }).annotateMerge(
      OpenApi.annotations({
        identifier: "sleepy.logout",
        summary: "Log out of Sleepy",
        description: "Clear every stored Sleepy session so the CLI is signed out. Idempotent.",
      }),
    ),
  )
  .annotateMerge(OpenApi.annotations({ title: "sleepy" }))
