import { Effect } from "effect"
import { define } from "@sleepy-ai/plugin/effect/plugin"
import { Npm } from "@sleepy-ai/util/npm"
import { loadSDKFactory } from "./sdk-factory.js"

export const DynamicProviderPlugin = define({
  id: "sleepycode.provider.dynamic",
  effect: Effect.fn(function* (ctx) {
    const npm = yield* Npm.Service
    yield* ctx.aisdk.hook(
      "sdk",
      Effect.fn(function* (evt) {
        if (evt.sdk) return

        evt.sdk = ((yield* loadSDKFactory(npm, evt.package)) as (options: any) => any)(evt.options)
      }),
    )
  }),
})
