import { expect } from "bun:test"
import path from "node:path"
import http from "node:http"
import { Effect } from "effect"
import { it } from "../../core/test/lib/effect"
import { tmpdir } from "../../core/test/fixture/tmpdir"
import { startServer } from "./fixture/server"
import { writeGatewayConfig } from "@sleepy-ai/util/gateway"
import { SleepyCode } from "@sleepy-ai/client"

it.live("dynamically loads models when gateway.json is created, and unloads on logout", () =>
  Effect.gen(function* () {
    // Start a mock platform/gateway server
    let requestCount = 0
    const mockServer = http.createServer((req, res) => {
      requestCount++
      if (req.url === "/api/v1/models" || req.url === "/api/models") {
        res.writeHead(200, { "Content-Type": "application/json" })
        res.end(
          JSON.stringify({
            data: [
              {
                id: "sleepy-mock-v1",
                name: "Sleepy Mock V1",
                runnable: true,
                contextWindow: 128000,
                maxOutputLimit: 8192,
              },
            ],
          }),
        )
        return
      }
      res.writeHead(404)
      res.end()
    })

    const port = yield* Effect.promise<number>(
      () =>
        new Promise((resolve, reject) => {
          mockServer.listen(0, "127.0.0.1", () => {
            const addr = mockServer.address()
            if (addr && typeof addr === "object") {
              resolve(addr.port)
            } else {
              reject(new Error("Failed to get port"))
            }
          })
        }),
    )

    yield* Effect.addFinalizer(() =>
      Effect.sync(() => {
        mockServer.close()
      }),
    )

    const tmp = yield* Effect.acquireDisposable(Effect.promise(() => tmpdir("sleepy-models-dynamic-")))
    const configDir = path.join(tmp.path, "config")
    const gatewayFile = path.join(configDir, "gateway.json")

    const prevEnv = process.env.SLEEPY_GATEWAY_CONFIG
    process.env.SLEEPY_GATEWAY_CONFIG = gatewayFile

    try {
      // 1. Boot server with no gateway.json present
      const server = yield* startServer(configDir)
      const client = SleepyCode.make({ baseUrl: server.base, headers: server.headers })

      // Helper to query /api/model
      const fetchModels = async () => {
        const res = await fetch(new URL("/api/model", server.base), { headers: server.headers })
        const json = (await res.json()) as { data: Array<{ id: string; name: string; providerID: string }> }
        return json.data ?? []
      }

      // Initial model list should not have sleepy-mock-v1
      const initialModels = yield* Effect.promise(fetchModels)
      const initialSleepy = initialModels.filter((m) => m.providerID === "sleepy")
      expect(initialSleepy.length).toBe(0)

      // 2. User logs in: gateway.json is written
      yield* Effect.promise(() =>
        writeGatewayConfig(gatewayFile, {
          access_token: "test-dynamic-token",
          endpoint: `http://127.0.0.1:${port}`,
          dashboard_url: `http://127.0.0.1:${port}`,
          email: "dynamic@example.com",
        }),
      )

      // Wait for file watcher debounce (150ms) to reload provider
      yield* Effect.sleep("300 millis")

      // Model list should now contain sleepy-mock-v1
      const modelsAfterLogin = yield* Effect.promise(fetchModels)
      const sleepyAfterLogin = modelsAfterLogin.filter((m) => m.providerID === "sleepy")
      expect(sleepyAfterLogin.length).toBe(1)
      expect(sleepyAfterLogin[0]?.name).toBe("Sleepy Mock V1")
      expect(sleepyAfterLogin[0]?.id).toBe("sleepy-mock-v1")

      // 3. User logs out via client.sleepy.logout()
      const logoutResult = yield* Effect.promise(() => client.sleepy.logout())
      expect(logoutResult.email).toBe("dynamic@example.com")

      // Wait for file watcher debounce
      yield* Effect.sleep("300 millis")

      // Model list should no longer contain sleepy-mock-v1
      const modelsAfterLogout = yield* Effect.promise(fetchModels)
      const sleepyAfterLogout = modelsAfterLogout.filter((m) => m.providerID === "sleepy")
      expect(sleepyAfterLogout.length).toBe(0)
    } finally {
      if (prevEnv !== undefined) {
        process.env.SLEEPY_GATEWAY_CONFIG = prevEnv
      } else {
        delete process.env.SLEEPY_GATEWAY_CONFIG
      }
    }
  }),
)
