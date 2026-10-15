import { describe, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"

describe("sleepy logout", () => {
  test("removes session files and reports email", async () => {
    const dir = path.join("/tmp", `sleepy-cli-logout-${Date.now()}`)
    await fs.mkdir(dir, { recursive: true })
    const configPath = path.join(dir, "gateway.json")
    await fs.writeFile(
      configPath,
      JSON.stringify({
        email: "alice@example.com",
        access_token: "test-token",
        refresh_token: "test-refresh",
      }),
      "utf-8",
    )

    const child = Bun.spawn([process.execPath, "run", "src/index.ts", "logout"], {
      cwd: path.join(import.meta.dir, ".."),
      env: {
        ...process.env,
        SLEEPY_GATEWAY_CONFIG: configPath,
      },
      stdout: "pipe",
      stderr: "pipe",
    })

    const [stdout, exitCode] = await Promise.all([new Response(child.stdout).text(), child.exited])

    expect(exitCode).toBe(0)
    expect(stdout).toContain("Signed out alice@example.com")
    expect(stdout).toContain(configPath)
    expect(await fs.exists(configPath)).toBe(false)

    await fs.rm(dir, { recursive: true, force: true })
  })

  test("is idempotent and handles absence gracefully", async () => {
    const nonexistentPath = path.join("/tmp", `sleepy-cli-nonexistent-${Date.now()}`, "gateway.json")

    const child = Bun.spawn([process.execPath, "run", "src/index.ts", "logout"], {
      cwd: path.join(import.meta.dir, ".."),
      env: {
        ...process.env,
        SLEEPY_GATEWAY_CONFIG: nonexistentPath,
      },
      stdout: "pipe",
      stderr: "pipe",
    })

    const [stdout, exitCode] = await Promise.all([new Response(child.stdout).text(), child.exited])

    expect(exitCode).toBe(0)
    expect(stdout).toContain("Already signed out")
  })
})
