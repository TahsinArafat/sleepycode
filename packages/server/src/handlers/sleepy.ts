import { clearGatewayConfig } from "@sleepy-ai/core/plugin/provider/sleepy"
import { Effect } from "effect"
import { HttpApiBuilder } from "effect/http-api"
import { Api } from "../api"

export const SleepyHandler = HttpApiBuilder.group(Api, "server.sleepy", (handlers) =>
  handlers.handle(
    "sleepy.logout",
    Effect.fn(function* () {
      return { data: yield* Effect.promise(() => clearGatewayConfig()) }
    }),
  ),
)
