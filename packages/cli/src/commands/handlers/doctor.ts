import { existsSync } from "node:fs"
import path from "node:path"
import { intro, outro, log, spinner } from "@clack/prompts"
import { Effect } from "effect"
import { Global } from "@sleepy-ai/util/global"
import { defaultGatewayConfigPath, readGatewayConfig } from "@sleepy-ai/util/gateway"
import { Commands } from "../commands"
import { Runtime } from "../../framework/runtime"
import { handlePromptErrors } from "../../ui/prompt"

const maskToken = (token: string): string => {
  if (token.length <= 12) return token
  return token.slice(0, 12) + "..." + token.slice(-4)
}

const checkCredentials = (configDir: string) =>
  Effect.gen(function* () {
    const loaded = yield* Effect.promise(() => readGatewayConfig(configDir))

    if (!loaded) {
      log.error(`Credentials config missing at ${defaultGatewayConfigPath(configDir)}`)
      log.message("Please authenticate first by running 'sleepy login'.")
      return null
    }

    const { config } = loaded
    const isExpired = config.expires_at ? Date.now() > config.expires_at : false
    const hasRefresh = !!config.refresh_token

    log.success("Credentials found")
    log.message(
      [
        `  Path:     ${loaded.path}`,
        `  Endpoint: ${config.endpoint || "default"}`,
        `  Email:    ${config.email || "unknown"}`,
        `  Tier:     ${config.tier || "standard"}`,
        `  Token:    ${maskToken(config.access_token || config.api_key || "")}`,
        `  Expires:  ${isExpired ? "EXPIRED" : "valid"}`,
        ...(hasRefresh ? [`  Refresh:  available${isExpired ? " (will auto-refresh)" : ""}`] : []),
      ].join("\n"),
    )

    return {
      endpoint: config.endpoint || config.dashboard_url || "https://www.sleepyai.org",
      email: config.email,
      tier: config.tier,
    }
  })

const testGatewayLatency = (endpoint: string) =>
  Effect.gen(function* () {
    const healthUrls = [`${endpoint}/api/healthz`, `${endpoint}/api/status`, `${endpoint}/api/monitoring/health`]
    const s = spinner()
    s.start(`Testing Sleepy Gateway connectivity...`)

    let connected = false
    let latency = 0
    let lastStatus = 0
    let testedUrl = healthUrls[0]

    for (const url of healthUrls) {
      testedUrl = url
      const start = Date.now()
      try {
        const response = yield* Effect.promise(() =>
          fetch(url, { signal: AbortSignal.timeout(5000) }).catch(() => null),
        )
        if (response?.ok) {
          latency = Date.now() - start
          connected = true
          break
        }
        if (response) lastStatus = response.status
      } catch {}
    }

    if (connected) {
      s.stop(`Sleepy Gateway is responsive (${latency}ms latency)`)
      return true
    }

    s.stop(`Failed to connect to Sleepy Gateway at ${testedUrl} (HTTP ${lastStatus})`, 1)
    return false
  })

const checkWorkspace = () => {
  const cwd = process.cwd()
  const sleepyJson = path.join(cwd, "sleepy.json")
  const sleepyJsonc = path.join(cwd, "sleepy.jsonc")
  const sleepyCodeJson = path.join(cwd, "sleepycode.json")
  const agentsMd = path.join(cwd, "AGENTS.md")

  log.info("Project workspace:")

  const hasConfig = existsSync(sleepyJson) || existsSync(sleepyJsonc) || existsSync(sleepyCodeJson)
  if (hasConfig) {
    log.success("  Configuration file found")
  } else {
    log.warn("  Configuration file not found — run 'sleepy init' to create one")
  }

  const hasAgentsMd = existsSync(agentsMd)
  if (hasAgentsMd) {
    log.success("  AGENTS.md found")
  } else {
    log.warn("  AGENTS.md not found — run 'sleepy init' to create one")
  }
}

export default Runtime.handler(
  Commands.commands.doctor,
  Effect.fn("cli.doctor")(() =>
    Effect.gen(function* () {
      intro("Sleepy Doctor")

      const global = yield* Global.Service

      // 1. Credentials check
      const credentials = yield* checkCredentials(global.config)

      // 2. Gateway latency check
      if (credentials) {
        yield* testGatewayLatency(credentials.endpoint)
      }

      // 3. Workspace check
      checkWorkspace()

      outro("Diagnostics complete.")
    }).pipe(handlePromptErrors),
  ),
)
