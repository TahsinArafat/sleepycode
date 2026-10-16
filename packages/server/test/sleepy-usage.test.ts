import { expect } from "bun:test"
import path from "node:path"
import { Effect } from "effect"
import { it } from "../../core/test/lib/effect"
import { tmpdir } from "../../core/test/fixture/tmpdir"
import { startServer } from "./fixture/server"
import { writeGatewayConfig } from "@sleepy-ai/util/gateway"
import { SleepyCode } from "@sleepy-ai/client"

/**
 * A stand-in for the Sleepy gateway, so the test drives the real fetch path rather than a
 * stubbed `fetchGatewayUsage`. `dashboard_url` in the gateway session is what points the
 * plugin at it, which is also how a self-hosted deployment is configured.
 */
function gateway(respond: (url: URL) => Response) {
  const server = Bun.serve({ port: 0, fetch: (request) => respond(new URL(request.url)) })
  return { url: `http://127.0.0.1:${server.port}`, stop: () => server.stop(true) }
}

function withGateway(configDir: string, gatewayUrl: string, token = "test-access-token") {
  return writeGatewayConfig(path.join(configDir, "gateway.json"), {
    access_token: token,
    dashboard_url: gatewayUrl,
  })
}

it.live("GET /api/sleepy/usage returns the metered windows and credit", () =>
  Effect.gen(function* () {
    const tmp = yield* Effect.acquireDisposable(Effect.promise(() => tmpdir("sleepy-usage-endpoint-")))
    const configDir = path.join(tmp.path, "config")
    const received: string[] = []
    const gw = gateway((url) => {
      received.push(url.pathname + url.search)
      return Response.json({
        limits: { creditUSD: 4.5, limit5h: 0.5, limit24h: 1.5, limitWeekly: 3.5, limitMonthly: 5, rpmLimit: 15 },
        usageByWindow: { cost5h: 0.25, cost24h: 1, costWeekly: 2, costMonthly: 3 },
        monthlyUsageUSD: 3,
        monthlyAllowanceUSD: 5,
      })
    })
    const prevEnv = process.env.SLEEPY_GATEWAY_CONFIG
    process.env.SLEEPY_GATEWAY_CONFIG = path.join(configDir, "gateway.json")

    try {
      yield* Effect.promise(() => withGateway(configDir, gw.url))
      const server = yield* startServer(configDir)
      const client = SleepyCode.make({ baseUrl: server.base, headers: server.headers })

      const usage = yield* Effect.promise(() => client.sleepy.usage())
      expect(usage?.limits?.creditUSD).toBe(4.5)
      expect(usage?.limits?.limit5h).toBe(0.5)
      expect(usage?.usageByWindow?.costMonthly).toBe(3)
      expect(usage?.monthlyAllowanceUSD).toBe(5)
      // The endpoint asks the gateway for a 30-day window, matching v1's limits panel.
      expect(received).toEqual(["/api/usage?days=30"])
    } finally {
      gw.stop()
      if (prevEnv !== undefined) process.env.SLEEPY_GATEWAY_CONFIG = prevEnv
      else delete process.env.SLEEPY_GATEWAY_CONFIG
    }
  }),
)

it.live("GET /api/sleepy/usage is null when signed out", () =>
  Effect.gen(function* () {
    const tmp = yield* Effect.acquireDisposable(Effect.promise(() => tmpdir("sleepy-usage-signed-out-")))
    const configDir = path.join(tmp.path, "config")
    const prevEnv = process.env.SLEEPY_GATEWAY_CONFIG
    // Point at a path that does not exist: no session, so no usage.
    process.env.SLEEPY_GATEWAY_CONFIG = path.join(configDir, "absent-gateway.json")

    try {
      const server = yield* startServer(configDir)
      const client = SleepyCode.make({ baseUrl: server.base, headers: server.headers })
      expect(yield* Effect.promise(() => client.sleepy.usage())).toBe(null)
    } finally {
      if (prevEnv !== undefined) process.env.SLEEPY_GATEWAY_CONFIG = prevEnv
      else delete process.env.SLEEPY_GATEWAY_CONFIG
    }
  }),
)

it.live("GET /api/sleepy/usage degrades to null when the gateway fails", () =>
  Effect.gen(function* () {
    const tmp = yield* Effect.acquireDisposable(Effect.promise(() => tmpdir("sleepy-usage-gateway-down-")))
    const configDir = path.join(tmp.path, "config")
    const gw = gateway(() => new Response("nope", { status: 502 }))
    const prevEnv = process.env.SLEEPY_GATEWAY_CONFIG
    process.env.SLEEPY_GATEWAY_CONFIG = path.join(configDir, "gateway.json")

    try {
      yield* Effect.promise(() => withGateway(configDir, gw.url))
      const server = yield* startServer(configDir)
      const client = SleepyCode.make({ baseUrl: server.base, headers: server.headers })
      // A gateway error must not surface as an endpoint error: the panel just shows nothing.
      expect(yield* Effect.promise(() => client.sleepy.usage())).toBe(null)
    } finally {
      gw.stop()
      if (prevEnv !== undefined) process.env.SLEEPY_GATEWAY_CONFIG = prevEnv
      else delete process.env.SLEEPY_GATEWAY_CONFIG
    }
  }),
)
