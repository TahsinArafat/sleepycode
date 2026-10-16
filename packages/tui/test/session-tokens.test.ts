import { describe, expect, test } from "bun:test"
import type { SessionMessageInfo } from "@sleepy-ai/client"
import { hasSessionTokens, sessionTokens } from "../src/util/session"

const assistant = (id: string, input: number, output: number, reasoning = 0) =>
  ({
    id,
    type: "assistant",
    agent: "build",
    model: { providerID: "provider", id: "model" },
    time: { created: 0, completed: 1 },
    content: [],
    tokens: { input, output, reasoning, cache: { read: 0, write: 0 } },
  }) as unknown as SessionMessageInfo

const user = (id: string) =>
  ({
    id,
    type: "user",
    time: { created: 0 },
    content: [],
  }) as unknown as SessionMessageInfo

describe("session tokens", () => {
  test("sums input and output across every assistant message", () => {
    expect(sessionTokens([assistant("a", 10, 2), assistant("b", 5, 3)])).toEqual({ input: 15, output: 5 })
  })

  test("folds reasoning into output, because providers bill it as generated", () => {
    expect(sessionTokens([assistant("a", 10, 2, 7)])).toEqual({ input: 10, output: 9 })
  })

  test("ignores non-assistant messages and assistant messages without usage", () => {
    const bare = { id: "c", type: "assistant", content: [] } as unknown as SessionMessageInfo
    expect(sessionTokens([user("u"), bare, assistant("a", 1, 1)])).toEqual({ input: 1, output: 1 })
  })

  test("an empty or usage-free session reports zero, and stays hidden", () => {
    const empty = sessionTokens([user("u")])
    expect(empty).toEqual({ input: 0, output: 0 })
    expect(hasSessionTokens(empty)).toBe(false)
    expect(hasSessionTokens({ input: 1, output: 0 })).toBe(true)
  })

  test("respects a revert boundary without approximating it", () => {
    // A boundary id that is not present must fall back to the whole session, not slice(0, -1)
    // and silently drop the last message, which is the classic off-by-one here.
    const messages = [assistant("a", 10, 1), assistant("b", 2, 2)]
    expect(sessionTokens(messages, "missing")).toEqual({ input: 12, output: 3 })
    // A present boundary excludes that message and everything after it.
    expect(sessionTokens(messages, "b")).toEqual({ input: 10, output: 1 })
    expect(sessionTokens(messages, "a")).toEqual({ input: 0, output: 0 })
  })
})
