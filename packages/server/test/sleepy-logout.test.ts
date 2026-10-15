import { expect } from "bun:test"
import path from "node:path"
import fs from "node:fs/promises"
import { Effect } from "effect"
import { it } from "../../core/test/lib/effect"
import { tmpdir } from "../../core/test/fixture/tmpdir"
import { startServer } from "./fixture/server"
import { writeGatewayConfig } from "@sleepy-ai/util/gateway"
import { SleepyCode } from "@sleepy-ai/client"

it.live("POST /api/sleepy/logout clears gateway session and returns removed file and email", () =>
  Effect.gen(function* () {
    const tmp = yield* Effect.acquireDisposable(Effect.promise(() => tmpdir("sleepy-logout-endpoint-")))
    const configDir = path.join(tmp.path, "config")
    const gatewayFile = path.join(configDir, "gateway.json")

    yield* Effect.promise(() =>
      writeGatewayConfig(gatewayFile, {
        access_token: "test-access-token",
        refresh_token: "test-refresh-token",
        email: "user@example.com",
      }),
    )

    const prevEnv = process.env.SLEEPY_GATEWAY_CONFIG
    process.env.SLEEPY_GATEWAY_CONFIG = gatewayFile

    try {
      const server = yield* startServer(configDir)

      // Verify the gateway file exists before logout
      const existsBefore = yield* Effect.promise(() =>
        fs
          .access(gatewayFile)
          .then(() => true)
          .catch(() => false),
      )
      expect(existsBefore).toBe(true)

      // Call client.sleepy.logout() via generated client SDK
      const client = SleepyCode.make({ baseUrl: server.base, headers: server.headers })
      const clientResult = yield* Effect.promise(() => client.sleepy.logout())

      expect(clientResult.email).toBe("user@example.com")
      expect(clientResult.removed).toContain(gatewayFile)

      // Verify the gateway file was deleted
      const existsAfter = yield* Effect.promise(() =>
        fs
          .access(gatewayFile)
          .then(() => true)
          .catch(() => false),
      )
      expect(existsAfter).toBe(false)

      // Calling again via raw HTTP is idempotent
      const response2 = yield* Effect.promise(() =>
        fetch(new URL("/api/sleepy/logout", server.base), {
          method: "POST",
          headers: server.headers,
        }),
      )
      expect(response2.status).toBe(200)
      const json2 = (yield* Effect.promise(() => response2.json())) as {
        data: { removed: string[]; email?: string }
      }
      expect(json2.data.removed).toEqual([])
      expect(json2.data.email == null).toBe(true)
    } finally {
      if (prevEnv !== undefined) {
        process.env.SLEEPY_GATEWAY_CONFIG = prevEnv
      } else {
        delete process.env.SLEEPY_GATEWAY_CONFIG
      }
    }
  }),
)
