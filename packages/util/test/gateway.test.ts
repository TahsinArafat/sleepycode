import { describe, expect, test } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import {
  clearGatewayConfig,
  findGatewayConfigPath,
  gatewayPaths,
  readGatewayConfig,
  readGatewayEmail,
  writeGatewayConfig,
  DEFAULT_PLATFORM_URL,
} from "../src/gateway.js"

describe("gateway config util", () => {
  test("default platform url is https://www.sleepyai.org", () => {
    expect(DEFAULT_PLATFORM_URL).toBe("https://www.sleepyai.org")
  })

  test("gatewayPaths returns candidate locations", () => {
    const tmp = path.join(os.tmpdir(), `gateway-paths-test-${Date.now()}`)
    const paths = gatewayPaths(tmp)
    expect(paths).toContain(path.join(tmp, "gateway.json"))
  })

  test("write, read, find, and clear lifecycle", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "sleepy-gateway-test-"))
    const configPath = path.join(dir, "gateway.json")
    process.env.SLEEPY_GATEWAY_CONFIG = configPath

    try {
      // Write config
      await writeGatewayConfig(configPath, {
        access_token: "test_access_token_123",
        refresh_token: "test_refresh_token_456",
        email: "engineer@sleepyai.org",
        tier: "enterprise",
        endpoint: "https://www.sleepyai.org",
      })

      // Find and read
      expect(await findGatewayConfigPath(dir)).toBe(configPath)
      const loaded = await readGatewayConfig(dir)
      expect(loaded).not.toBe(null)
      expect(loaded!.config.email).toBe("engineer@sleepyai.org")
      expect(loaded!.config.access_token).toBe("test_access_token_123")
      expect(await readGatewayEmail(configPath)).toBe("engineer@sleepyai.org")

      // Clear removes the file
      const cleared = await clearGatewayConfig(dir)
      expect(cleared.removed).toContain(configPath)
      expect(await fs.readFile(configPath, "utf-8").catch(() => null)).toBe(null)
    } finally {
      delete process.env.SLEEPY_GATEWAY_CONFIG
      await fs.rm(dir, { recursive: true, force: true })
    }
  })
})
