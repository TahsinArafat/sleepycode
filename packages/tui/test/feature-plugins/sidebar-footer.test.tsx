/** @jsxImportSource @opentui/solid */
import { expect, test } from "bun:test"
import { RGBA } from "@opentui/core"
import { testRender } from "@opentui/solid"
import type { Context } from "@sleepy-ai/plugin/tui/context"
import { createStore, produce } from "solid-js/store"
import { SidebarOnboarding, SidebarSignIn } from "../../src/feature-plugins/sidebar/footer"

function context(options?: {
  dismissed?: boolean
  integrations?: Array<{ connections: unknown[] }>
  dispatched?: string[]
}) {
  const color = RGBA.fromInts(200, 200, 200)
  const [onboarding, setOnboarding] = createStore({ dismissed: options?.dismissed ?? false })
  const location = { directory: "/workspace" }
  return {
    location,
    theme: {
      background: { raised: { high: color } },
      text: { base: color, muted: color },
    },
    storage: {
      store: () => [
        onboarding,
        (mutation: (draft: { dismissed: boolean }) => void) => {
          setOnboarding(produce(mutation))
          return Promise.resolve()
        },
      ],
    },
    keymap: {
      dispatch: (id: string) => options?.dispatched?.push(id),
    },
    ui: {
      format: { path: (value: string) => value },
    },
    data: {
      session: {
        get: () => ({ location }),
      },
      location: {
        integration: { list: () => options?.integrations },
        vcs: { info: () => undefined },
      },
    },
  } as unknown as Context
}

async function render(input: Context, height = 22) {
  const app = await testRender(
    () => (
      <box width={38}>
        <SidebarOnboarding context={input} sessionID="session" />
      </box>
    ),
    { width: 38, height },
  )
  await app.renderOnce()
  return app
}

test("sidebar waits for integrations before showing onboarding", async () => {
  const app = await render(context())

  try {
    expect(app.captureCharFrame()).not.toContain("Getting started")
  } finally {
    app.renderer.destroy()
  }
})

test("sidebar preserves the compact layout when the onboarding card cannot fit", async () => {
  const app = await render(context({ integrations: [] }), 21)

  try {
    expect(app.captureCharFrame()).not.toContain("Getting started")
  } finally {
    app.renderer.destroy()
  }
})

test("sidebar shows onboarding without a connected integration", async () => {
  const app = await render(context({ integrations: [] }))

  try {
    const frame = app.captureCharFrame()
    expect(frame).toContain("Getting started")
    expect(frame).toContain("SleepyCode includes free models")
    expect(frame).toContain("Connect provider")
    expect(frame).toContain("/connect")
  } finally {
    app.renderer.destroy()
  }
})

test("sidebar hides onboarding after an integration is connected or the card is dismissed", async () => {
  const connected = await render(context({ integrations: [{ connections: [{}] }] }))
  const dismissed = await render(context({ integrations: [], dismissed: true }))

  try {
    expect(connected.captureCharFrame()).not.toContain("Getting started")
    expect(dismissed.captureCharFrame()).not.toContain("Getting started")
  } finally {
    connected.renderer.destroy()
    dismissed.renderer.destroy()
  }
})

test("sidebar onboarding opens integrations and can be dismissed", async () => {
  const dispatched: string[] = []
  const app = await render(context({ integrations: [], dispatched }))

  try {
    const connect = app.renderer.root.findDescendantById("sidebar.footer.getting-started.connect")!
    await app.mockMouse.click(connect.x, connect.y)
    expect(dispatched).toEqual(["provider.connect"])

    const dismiss = app.renderer.root.findDescendantById("sidebar.footer.getting-started.dismiss")!
    await app.mockMouse.click(dismiss.x, dismiss.y)
    await app.renderOnce()
    expect(app.captureCharFrame()).not.toContain("Getting started")
  } finally {
    app.renderer.destroy()
  }
})

function signInContext(options: { signedIn: boolean; email?: string; dispatched?: string[] }) {
  const color = RGBA.fromInts(200, 200, 200)
  return {
    theme: {
      background: { raised: { high: color } },
      text: { base: color, muted: color },
    },
    client: {
      sleepy: {
        status: () =>
          Promise.resolve({
            signedIn: options.signedIn,
            ...(options.email ? { email: options.email } : {}),
          }),
      },
    },
    keymap: {
      dispatch: (id: string) => options.dispatched?.push(id),
    },
  } as unknown as Context
}

async function renderSignIn(input: Context, height = 12) {
  const app = await testRender(
    () => (
      <box width={44}>
        <SidebarSignIn context={input} />
      </box>
    ),
    { width: 44, height },
  )
  await app.renderOnce()
  return app
}

test("sidebar nags for sign-in when the gateway session is absent", async () => {
  const dispatched: string[] = []
  const app = await renderSignIn(signInContext({ signedIn: false, dispatched }))

  try {
    const frame = app.captureCharFrame()
    expect(frame).toContain("Sign in to Sleepy")
    expect(frame).toContain("/connect")

    const action = app.renderer.root.findDescendantById("sidebar.sign-in.action")!
    await app.mockMouse.click(action.x, action.y)
    expect(dispatched).toEqual(["provider.connect"])
  } finally {
    app.renderer.destroy()
  }
})

test("sidebar nags do not block: the rest of the sidebar still renders", async () => {
  // The enforcement decision is nag, not block. A signed-out session must not remove sibling
  // sidebar content, which a hard block would.
  const input = signInContext({ signedIn: false })
  const app = await testRender(
    () => (
      <box width={44} flexDirection="column">
        <SidebarSignIn context={input} />
        <text>Sibling content</text>
      </box>
    ),
    { width: 44, height: 12 },
  )

  try {
    await app.renderOnce()
    const frame = app.captureCharFrame()
    expect(frame).toContain("Sign in to Sleepy")
    expect(frame).toContain("Sibling content")
  } finally {
    app.renderer.destroy()
  }
})

test("sidebar drops the sign-in nag once a session is present", async () => {
  const app = await renderSignIn(signInContext({ signedIn: true, email: "user@example.com" }))

  try {
    expect(app.captureCharFrame()).not.toContain("Sign in to Sleepy")
  } finally {
    app.renderer.destroy()
  }
})
