import { Effect } from "effect"
import { define } from "@sleepy-ai/plugin/effect/plugin"

export const ZenmuxPlugin = define({
  id: "sleepycode.provider.zenmux",
  effect: Effect.fn(function* (ctx) {
    yield* ctx.provider.transform((evt) => {
      for (const item of evt.list()) {
        if (item.provider.package !== "@sleepy-ai/ai/providers/openai-compatible") continue
        if (item.provider.settings?.baseURL !== "https://zenmux.ai/api/v1") continue
        evt.update(item.provider.id, (provider) => {
          provider.headers = {
            "HTTP-Referer": "https://www.sleepyai.org/",
            "X-Title": "sleepycode",
            ...provider.headers,
          }
        })
      }
    })
  }),
})
