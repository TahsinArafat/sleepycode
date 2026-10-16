import { SleepyUsage } from "@sleepy-ai/schema/sleepy-usage"
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
  .add(
    HttpApiEndpoint.get("sleepy.usage", "/api/sleepy/usage", {
      // `null` means signed out, which the sidebar renders as "no plan"; a gateway that is
      // signed in but does not meter windows returns an object carrying the windows it sets.
      success: Schema.Struct({ data: Schema.NullOr(SleepyUsage.Info) }),
    }).annotateMerge(
      OpenApi.annotations({
        identifier: "sleepy.usage",
        summary: "Get Sleepy plan usage",
        description:
          "Retrieve the active subscription's spend and allowance per rolling window so clients can show plan and limit progress. Returns null when signed out.",
      }),
    ),
  )
  .add(
    HttpApiEndpoint.get("sleepy.status", "/api/sleepy/status", {
      success: Schema.Struct({ data: SleepyUsage.Status }),
    }).annotateMerge(
      OpenApi.annotations({
        identifier: "sleepy.status",
        summary: "Get Sleepy sign-in status",
        description:
          "Report whether a Sleepy gateway session is present, and the account email when it is. A local read, so clients can decide what to surface at startup without waiting on the gateway.",
      }),
    ),
  )
  .annotateMerge(OpenApi.annotations({ title: "sleepy" }))
