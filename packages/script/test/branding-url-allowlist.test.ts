import { describe, expect, test } from "bun:test"
import {
  INTENTIONALLY_UPSTREAM,
  isIntentionallyUpstream,
  unclassifiedUpstreamUrls,
} from "../../../script/lib/branding"

describe("branding url allowlist", () => {
  test("every allowlist entry carries a reason", () => {
    expect(INTENTIONALLY_UPSTREAM.length).toBeGreaterThan(0)
    for (const entry of INTENTIONALLY_UPSTREAM) {
      expect(entry.host.length).toBeGreaterThan(0)
      expect(entry.reason.length).toBeGreaterThan(20)
    }
  })

  test("allowlisted hosts are recognised, and extended hosts are not swallowed", () => {
    expect(isIntentionallyUpstream("https://models.opencode.ai/api.json")).toBe(true)
    expect(isIntentionallyUpstream("https://opencode.ai/v2/docs/cli")).toBe(true)
    expect(isIntentionallyUpstream("https://www.sleepyai.org/update/api/latest")).toBe(false)
    // A subdomain of an allowlisted host is a different endpoint and must be reported.
    const found = unclassifiedUpstreamUrls('const a = "https://evil.opencode.ai/x"')
    expect(found).toEqual(["https://evil.opencode.ai/x (1)"])
  })

  test("unclassified urls reports counts and drops allowlisted ones", () => {
    const text = [
      'const ok = "https://models.opencode.ai/api.json"',
      'const bad = "https://opencode.ai/auth"',
      'const bad2 = "https://opencode.ai/auth"',
      'const ours = "https://www.sleepyai.org/install"',
    ].join("\n")
    expect(unclassifiedUpstreamUrls(text)).toEqual(["https://opencode.ai/auth (2)"])
  })

  test("the upstream update service is not what a shipped binary calls", async () => {
    // The defect this guards: the updater asked upstream's release service about `sleepycode`,
    // which upstream does not publish, so `sleepycode upgrade` could never report an update.
    const updater = await Bun.file(new URL("../../../packages/cli/src/services/updater.ts", import.meta.url)).text()
    expect(updater).not.toContain("opencode.ai/update")
    expect(updater).toContain("SLEEPYCODE_UPDATE_URL}/update/api/")
    expect(updater).toContain("SLEEPYCODE_UPDATE_URL}/install")
  })

  test("the shipped installer resolves releases from the Sleepy host", async () => {
    const installer = await Bun.file(new URL("../../../install", import.meta.url)).text()
    expect(installer).not.toContain("opencode.ai/update")
    expect(installer).toContain("www.sleepyai.org}/update/api/")
  })

  test("the desktop auto-update feed is the Sleepy host", async () => {
    const config = await Bun.file(
      new URL("../../../packages/desktop/electron-builder.config.ts", import.meta.url),
    ).text()
    expect(config).not.toContain("opencode.ai/update")
  })

  test("mcp client metadata is served by the Sleepy host", async () => {
    const oauth = await Bun.file(new URL("../../../packages/core/src/mcp/oauth.ts", import.meta.url)).text()
    expect(oauth).toContain('CLIENT_METADATA_URL = "https://www.sleepyai.org/oauth/sleepycode/client.json"')
  })
})
