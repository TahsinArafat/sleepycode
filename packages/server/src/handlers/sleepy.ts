import { clearGatewayConfig } from "@sleepy-ai/util/gateway"
import { fetchGatewayUsage } from "@sleepy-ai/core/plugin/provider/sleepy"
import { Effect } from "effect"
import { HttpApiBuilder } from "effect/http-api"
import { Api } from "../api"

export const SleepyHandler = HttpApiBuilder.group(Api, "server.sleepy", (handlers) =>
  handlers
    .handle(
      "sleepy.logout",
      Effect.fn(function* () {
        return { data: yield* Effect.promise(() => clearGatewayConfig()) }
      }),
    )
    .handle(
      "sleepy.usage",
      // A gateway that is unreachable or answers something unexpected is "no plan", not an
      // error: the panel degrades and the rest of the session is unaffected.
      Effect.fn(function* () {
        return { data: yield* Effect.promise(() => fetchGatewayUsage()) }
      }),
    ),
)
