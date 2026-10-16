/** @jsxImportSource @opentui/solid */
import { expect, test } from "bun:test"
import { RGBA } from "@opentui/core"
import { testRender } from "@opentui/solid"
import type { Context } from "@sleepy-ai/plugin/tui/context"
import type { SleepyUsageInfo } from "@sleepy-ai/client"
import { createStore, produce } from "solid-js/store"
import { SidebarContext } from "../../src/feature-plugins/sidebar/context"

function context(options?: { cost?: number; tokens?: number; usage?: SleepyUsageInfo | null }) {
  const color = RGBA.fromInts(200, 200, 200)
  const [view, setView] = createStore({ open: true })
  return {
    theme: {
      text: {
        base: color,
        muted: color,
        feedback: {
          success: { base: color },
          warning: { base: color },
          error: { base: color },
        },
      },
    },
    storage: {
      store: () => [
        view,
        (mutation: (draft: { open: boolean }) => void) => {
          setView(produce(mutation))
          return Promise.resolve()
        },
      ],
    },
    client: {
      sleepy: {
        usage: () => Promise.resolve(options?.usage ?? null),
      },
    },
    data: {
      session: {
        get: () => ({ location: { directory: "/workspace" } }),
        cost: () => options?.cost ?? 0,
        message: {
          list: () =>
            options?.tokens
              ? [
                  {
                    id: "message",
                    type: "assistant",
                    model: { providerID: "provider", id: "model" },
                    tokens: {
                      input: options.tokens,
                      output: 0,
                      reasoning: 0,
                      cache: { read: 0, write: 0 },
                    },
                  },
                ]
              : [],
        },
      },
      location: {
        model: { list: () => [] },
      },
    },
  } as unknown as Context
}

test("sidebar omits context before usage is available", async () => {
  const app = await testRender(() => <SidebarContext context={context()} sessionID="session" />, {
    width: 42,
    height: 8,
  })

  try {
    await app.renderOnce()
    expect(app.captureCharFrame()).not.toContain("Context")
    expect(app.captureCharFrame()).not.toContain("Not measured")
  } finally {
    app.renderer.destroy()
  }
})

test("sidebar shows available context usage", async () => {
  const app = await testRender(() => <SidebarContext context={context({ tokens: 1234 })} sessionID="session" />, {
    width: 42,
    height: 8,
  })

  try {
    await app.renderOnce()
    expect(app.captureCharFrame()).toContain("Context")
    expect(app.captureCharFrame()).toContain("1,234 tokens")
  } finally {
    app.renderer.destroy()
  }
})

test("sidebar omits plan and limits when signed out", async () => {
  const app = await testRender(() => <SidebarContext context={context()} sessionID="session" />, {
    width: 42,
    height: 12,
  })

  try {
    await app.renderOnce()
    expect(app.captureCharFrame()).not.toContain("Plan & Limits")
  } finally {
    app.renderer.destroy()
  }
})

test("sidebar shows a bar per metered window and the credit balance", async () => {
  const app = await testRender(
    () => (
      <SidebarContext
        context={context({
          usage: {
            limits: { creditUSD: 4.5, limit5h: 0.5, limit24h: 1.5, limitWeekly: 3.5, limitMonthly: 5 },
            usageByWindow: { cost5h: 0.25, cost24h: 1.5, costWeekly: 1, costMonthly: 2 },
          },
        })}
        sessionID="session"
      />
    ),
    { width: 42, height: 14 },
  )

  try {
    await app.renderOnce()
    const frame = app.captureCharFrame()
    expect(frame).toContain("Plan & Limits")
    expect(frame).toContain("Credit: $4.50")
    // All four metered windows render with their spend/limit pair.
    expect(frame).toContain("5 hours ($0.25/$0.50)")
    // 24h is exactly at its limit, so it renders the full bar and an overrun-free pair.
    expect(frame).toContain("24 hours ($1.50/$1.50)")
    expect(frame).toContain("This week ($1.00/$3.50)")
    expect(frame).toContain("This month ($2.00/$5.00)")
  } finally {
    app.renderer.destroy()
  }
})

test("sidebar shows credit alone when the plan meters no window", async () => {
  const app = await testRender(
    () => <SidebarContext context={context({ usage: { limits: { creditUSD: 12 } } })} sessionID="session" />,
    { width: 42, height: 8 },
  )

  try {
    await app.renderOnce()
    const frame = app.captureCharFrame()
    expect(frame).toContain("Plan & Limits")
    expect(frame).toContain("Credit: $12.00")
    expect(frame).not.toContain("5 hours")
  } finally {
    app.renderer.destroy()
  }
})
