import { describe, expect, test } from "bun:test"
import { Effect } from "effect"
import { Provider } from "@sleepy-ai/core/provider"

describe("Provider", () => {
  test("loads bundled native provider entrypoints", async () => {
    const packages = [
      "@sleepy-ai/ai/providers/baseten",
      "@sleepy-ai/ai/providers/cerebras",
      "@sleepy-ai/ai/providers/cloudflare-ai-gateway",
      "@sleepy-ai/ai/providers/cloudflare-workers-ai",
      "@sleepy-ai/ai/providers/cohere",
      "@sleepy-ai/ai/providers/cohere/chat",
      "@sleepy-ai/ai/providers/deepinfra",
      "@sleepy-ai/ai/providers/deepseek",
      "@sleepy-ai/ai/providers/fireworks",
      "@sleepy-ai/ai/providers/google-vertex",
      "@sleepy-ai/ai/providers/google-vertex/gemini",
      "@sleepy-ai/ai/providers/google-vertex/interactions",
      "@sleepy-ai/ai/providers/google-vertex/chat",
      "@sleepy-ai/ai/providers/google-vertex/responses",
      "@sleepy-ai/ai/providers/google-vertex/messages",
      "@sleepy-ai/ai/providers/groq",
      "@sleepy-ai/ai/providers/mistral",
      "@sleepy-ai/ai/providers/togetherai",
      "@sleepy-ai/ai/providers/vercel-ai-gateway",
    ]

    for (const specifier of packages) {
      const loaded = await Effect.runPromise(Provider.loadPackage(specifier))
      expect(loaded.model).toBeFunction()
    }
  })

  test("passes flat settings to native packages without Core settings", () => {
    expect(
      Provider.nativeSettings({
        apiKey: "secret",
        reasoningEffort: "high",
        chunkTimeout: 1000,
        compaction: { type: "native" },
        transport: "websocket",
      }),
    ).toEqual({
      apiKey: "secret",
      reasoningEffort: "high",
    })
  })

  test("inherits shared and loose settings without provider-only policies", () => {
    expect(
      Provider.modelSettings({
        timeout: 60_000,
        chunkTimeout: 30_000,
        transport: "websocket",
        compaction: { type: "native" },
        reasoningEffort: "high",
      }),
    ).toEqual({
      compaction: { type: "native" },
      reasoningEffort: "high",
    })
  })
})
