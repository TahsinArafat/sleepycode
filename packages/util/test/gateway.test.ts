import { describe, expect, test } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { Path } from "../src/global.js"
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

  test("the write path is owned by the gateway util", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "sleepy-gateway-resolve-"))
    const configDir = path.join(dir, "config")
    await fs.mkdir(configDir)
    const envPath = path.join(dir, "from-env", "gateway.json")
    const configPath = path.join(configDir, "gateway.json")
    // Loaded through the module namespace so a regression in the resolver
    // surfaces as a failed expectation rather than a module-load error.
    const { defaultGatewayConfigPath, resolveGatewayConfigPath } = await import("../src/gateway.js")

    expect(defaultGatewayConfigPath(configDir)).toBe(configPath)
    expect(defaultGatewayConfigPath()).toBe(path.join(Path.config, "gateway.json"))

    process.env.SLEEPY_GATEWAY_CONFIG = envPath
    try {
      // First login writes to a path that does not exist yet, so the override
      // has to win on its own rather than through a file that is already there.
      expect(await resolveGatewayConfigPath(configDir)).toBe(envPath)

      delete process.env.SLEEPY_GATEWAY_CONFIG
      // With no override a session in the config dir keeps its own location.
      await writeGatewayConfig(configPath, { access_token: "token-for-resolve" })
      expect(await resolveGatewayConfigPath(configDir)).toBe(configPath)
      expect(gatewayPaths(configDir)[0]).toBe(configPath)
    } finally {
      delete process.env.SLEEPY_GATEWAY_CONFIG
      await fs.rm(dir, { recursive: true, force: true })
    }
  })
})
