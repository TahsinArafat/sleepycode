import { Duration, Effect, Schema } from "effect"
import path from "node:path"
import os from "node:os"
import fs from "node:fs/promises"
import { define } from "@sleepy-ai/plugin/effect/plugin"
import { Provider } from "@sleepy-ai/schema/provider"
import { Money } from "@sleepy-ai/schema/money"
import { Integration } from "@sleepy-ai/schema/integration"
import { Credential } from "../../credential.js"
import { Model } from "../../model.js"

const CLIENT_ID = "sleepy-cli"
const DEVICE_METHOD = Integration.MethodID.make("device")

const Device = Schema.Struct({
  device_code: Schema.String,
  user_code: Schema.String,
  verification_uri: Schema.optional(Schema.String),
  verification_uri_complete: Schema.optional(Schema.String),
  expires_in: Schema.Number,
  interval: Schema.Number,
})
const Token = Schema.Struct({
  access_token: Schema.String,
  refresh_token: Schema.String,
  expires_in: Schema.Number,
  endpoint: Schema.optional(Schema.NullOr(Schema.String)),
  tier: Schema.optional(Schema.NullOr(Schema.String)),
  email: Schema.optional(Schema.NullOr(Schema.String)),
})
const TokenPending = Schema.Struct({ error: Schema.String })
const DeviceToken = Schema.Union([Token, TokenPending])

export interface GatewayConfig {
  access_token?: string
  refresh_token?: string
  expires_at?: number
  endpoint?: string
  dashboard_url?: string
  email?: string
  tier?: string
}

const GATEWAY_PATHS = [
  path.join(os.homedir(), ".config", "sleepy", "gateway.json"),
  path.join(os.homedir(), ".config", "sleepycode", "gateway.json"),
  path.join(os.homedir(), ".sleepy", "gateway.json"),
]

const DEFAULT_PLATFORM_URL = "https://www.sleepyai.org"

export async function findGatewayConfigPath(): Promise<string | null> {
  const envPath = process.env.SLEEPY_GATEWAY_CONFIG
  if (envPath) {
    try {
      await fs.access(envPath)
      return envPath
    } catch {}
  }
  for (const candidate of GATEWAY_PATHS) {
    try {
      await fs.access(candidate)
      return candidate
    } catch {}
  }
  return null
}

export async function readGatewayConfig(): Promise<{ path: string; config: GatewayConfig } | null> {
  const configPath = await findGatewayConfigPath()
  if (!configPath) return null
  try {
    const raw = await fs.readFile(configPath, "utf-8")
    const config = JSON.parse(raw) as GatewayConfig
    return { path: configPath, config }
  } catch {
    return null
  }
}

async function writeGatewayConfig(configPath: string, config: GatewayConfig): Promise<void> {
  try {
    const tmp = `${configPath}.tmp.${Date.now()}`
    await fs.writeFile(tmp, JSON.stringify(config, null, 2), "utf-8")
    await fs.rename(tmp, configPath)
  } catch {}
}

async function refreshGatewayToken(dashboardUrl: string, refreshToken: string): Promise<GatewayConfig | null> {
  try {
    const res = await fetch(`${dashboardUrl}/api/auth/token/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    })
    if (!res.ok) return null
    const data = (await res.json()) as any
    const payload = data?.data ?? data
    if (!payload?.access_token) return null
    return {
      access_token: payload.access_token,
      refresh_token: payload.refresh_token ?? refreshToken,
      expires_at: payload.expires_at ? Number(payload.expires_at) : Date.now() + 3600 * 1000,
    }
  } catch {
    return null
  }
}

interface RawModelItem {
  id?: string
  name?: string
  context_length?: number
  context_window?: number
  max_tokens?: number
  max_output_tokens?: number
  pricing?: {
    prompt?: number
    completion?: number
    input?: number
    output?: number
  }
}

function parseGatewayModels(items: RawModelItem[], providerID: Provider.ID): Model.Info[] {
  const now = Date.now()
  return items.map((raw) => {
    const modelID = Model.ID.make(raw.id ?? "sleepy-auto")
    const id = modelID
    const context = raw.context_window ?? raw.context_length ?? 128000
    const output = raw.max_output_tokens ?? raw.max_tokens ?? 8192
    const inputCost = raw.pricing?.input ?? raw.pricing?.prompt ?? 0
    const outputCost = raw.pricing?.output ?? raw.pricing?.completion ?? 0

    return {
      id,
      modelID,
      providerID,
      name: raw.name ?? raw.id ?? "Sleepy Model",
      capabilities: {
        tools: true,
        input: ["text", "image"],
        output: ["text"],
      },
      variants: [],
      time: { released: now },
      cost: [
        {
          input: Money.USDPerMillionTokens.make(inputCost),
          output: Money.USDPerMillionTokens.make(outputCost),
          cache: { read: Money.USDPerMillionTokens.zero, write: Money.USDPerMillionTokens.zero },
        },
      ],
      status: "active" as const,
      enabled: true,
      limit: {
        context,
        output,
      },
    }
  })
}

async function fetchGatewayModels(dashboardUrl: string, token: string): Promise<RawModelItem[]> {
  const endpoints = [`${dashboardUrl}/api/v1/models`, `${dashboardUrl}/api/models`]
  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          "X-Sleepy-Source": "sleepycode-cli",
        },
      })
      if (!res.ok) continue
      const data = (await res.json()) as any
      const list = Array.isArray(data) ? data : data?.data ?? data?.models
      if (Array.isArray(list) && list.length > 0) {
        return list
      }
    } catch {}
  }
  return []
}

const postJSON = async (url: string, body: Record<string, string>) => {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Sleepy-Source": "sleepycode-cli" },
    body: JSON.stringify(body),
  })
  const json = (await res.json().catch(() => null)) as Record<string, unknown> | null
  if (!res.ok && json == null) throw new Error(`Request failed: HTTP ${res.status} ${url}`)
  return { status: res.status, body: json ?? {} }
}

const parseDevice = (raw: Record<string, unknown>) =>
  Schema.decodeUnknownSync(Device)(raw, { errors: "all" })

const parseDeviceToken = (raw: Record<string, unknown>) =>
  Schema.decodeUnknownSync(DeviceToken)(raw, { errors: "all" })

function startDeviceFlow(server: string) {
  return Effect.gen(function* () {
    const start = yield* Effect.promise(() =>
      postJSON(`${server}/api/auth/oauth/device`, { client_id: CLIENT_ID }),
    )
    const device = parseDevice(start.body)
    const url =
      device.verification_uri_complete ??
      (device.verification_uri
        ? `${device.verification_uri}?code=${encodeURIComponent(device.user_code)}`
        : `${server}/auth/device?code=${encodeURIComponent(device.user_code)}`)

    return {
      mode: "auto" as const,
      url,
      instructions: `Enter code: ${device.user_code}`,
      callback: pollDeviceToken(server, device.device_code, Duration.seconds(device.interval || 5)),
    }
  })
}

function pollDeviceToken(server: string, deviceCode: string, interval: Duration.Duration) {
  const loop = (wait: Duration.Duration): Effect.Effect<Credential.OAuth, unknown> =>
    Effect.gen(function* () {
      yield* Effect.sleep(wait)
      const result = parseDeviceToken(
        (
          yield* Effect.promise(() =>
            postJSON(`${server}/api/auth/oauth/device/token`, {
              client_id: CLIENT_ID,
              device_code: deviceCode,
            }),
          )
        ).body,
      )
      if ("access_token" in result) return yield* storeCredential(server, result)
      if (result.error === "authorization_pending") return yield* loop(wait)
      if (result.error === "slow_down") return yield* loop(Duration.sum(wait, Duration.seconds(5)))
      return yield* Effect.fail(new Error(`Device authorization failed: ${result.error}`))
    })
  return loop(interval)
}

function storeCredential(server: string, token: typeof Token.Type) {
  return Effect.gen(function* () {
    const configPath = path.join(os.homedir(), ".config", "sleepy", "gateway.json")
    const expires = Date.now() + token.expires_in * 1000
    yield* Effect.promise(async () => {
      await fs.mkdir(path.dirname(configPath), { recursive: true })
      await writeGatewayConfig(configPath, {
        access_token: token.access_token,
        refresh_token: token.refresh_token,
        expires_at: expires,
        endpoint: token.endpoint ?? server,
        dashboard_url: server,
        email: token.email ?? undefined,
        tier: token.tier ?? undefined,
      })
    })
    return Credential.OAuth.make({
      type: "oauth" as const,
      methodID: DEVICE_METHOD,
      access: token.access_token,
      refresh: token.refresh_token,
      expires,
      metadata: {
        server,
        email: token.email ?? undefined,
        tier: token.tier ?? undefined,
      },
    })
  })
}

function refreshCredential(credential: Credential.OAuth) {
  return Effect.gen(function* () {
    const server = typeof credential.metadata?.server === "string" ? credential.metadata.server : DEFAULT_PLATFORM_URL
    const result = yield* Effect.promise(() =>
      postJSON(`${server}/api/auth/token/refresh`, { refresh_token: credential.refresh }),
    )
    if (result.status === 400 || result.status === 401) {
      return yield* Effect.fail(new Error("Sleepy AI session expired, run `sleepy login` again"))
    }
    const token = Schema.decodeUnknownSync(Token)(result.body, { errors: "all" })
    const configPath = yield* Effect.promise(findGatewayConfigPath)
    if (configPath) {
      yield* Effect.promise(() =>
        writeGatewayConfig(configPath, {
          ...(typeof credential.metadata?.email === "string" ? { email: credential.metadata.email } : {}),
          ...(typeof credential.metadata?.tier === "string" ? { tier: credential.metadata.tier } : {}),
          access_token: token.access_token,
          refresh_token: token.refresh_token ?? credential.refresh,
          expires_at: Date.now() + token.expires_in * 1000,
        }),
      )
    }
    return {
      ...credential,
      access: token.access_token,
      refresh: token.refresh_token ?? credential.refresh,
      expires: Date.now() + token.expires_in * 1000,
    }
  })
}

let sessionCheckInterval: ReturnType<typeof setInterval> | null = null

function setupSessionChecker(dashboardUrl: string, configPath: string, initialRefreshToken: string) {
  if (sessionCheckInterval) return
  let currentRefreshToken = initialRefreshToken
  sessionCheckInterval = setInterval(async () => {
    try {
      const current = await readGatewayConfig()
      if (!current) return
      const exp = current.config.expires_at
      const refresh = current.config.refresh_token ?? currentRefreshToken

      // Refresh if within 10 minutes of expiry
      if (exp && exp - Date.now() < 10 * 60 * 1000 && refresh) {
        const refreshed = await refreshGatewayToken(dashboardUrl, refresh)
        if (refreshed?.access_token) {
          const updated: GatewayConfig = {
            ...current.config,
            access_token: refreshed.access_token,
            refresh_token: refreshed.refresh_token,
            expires_at: refreshed.expires_at,
          }
          currentRefreshToken = refreshed.refresh_token ?? currentRefreshToken
          await writeGatewayConfig(configPath, updated)
        }
      }
    } catch {}
  }, 10 * 60 * 1000)
}

export const SleepyGatewayPlugin = define({
  id: "sleepycode.provider.sleepy",
  effect: Effect.fn(function* (ctx) {
    yield* ctx.integration.transform((editor) => {
      editor.update("sleepy", (integration) => {
        integration.name = "Sleepy AI"
      })
      editor.method.update({
        integrationID: Integration.ID.make("sleepy"),
        method: {
          id: DEVICE_METHOD,
          type: "oauth",
          label: "Sleepy AI account",
          form: [
            {
              key: "server",
              type: "string",
              format: "uri",
              hidden: true,
              default: DEFAULT_PLATFORM_URL,
            },
          ],
        },
        authorize: (answer) =>
          startDeviceFlow(typeof answer?.server === "string" ? answer.server.replace(/\/+$/, "") : DEFAULT_PLATFORM_URL),
        refresh: refreshCredential,
      })
    })

    const loaded = yield* Effect.promise(() => readGatewayConfig())
    if (!loaded) return

    let { path: configPath, config } = loaded
    const dashboardUrl =
      config.endpoint ??
      config.dashboard_url ??
      process.env.SLEEPY_PLATFORM_URL ??
      process.env.SLEEPY_DASHBOARD_URL ??
      DEFAULT_PLATFORM_URL

    // Check expiry on startup and refresh if needed
    if (config.expires_at && config.expires_at - Date.now() < 5 * 60 * 1000 && config.refresh_token) {
      const refreshed = yield* Effect.promise(() => refreshGatewayToken(dashboardUrl, config.refresh_token!))
      if (refreshed?.access_token) {
        config = {
          ...config,
          access_token: refreshed.access_token,
          refresh_token: refreshed.refresh_token ?? config.refresh_token,
          expires_at: refreshed.expires_at,
        }
        yield* Effect.promise(() => writeGatewayConfig(configPath, config))
      }
    }

    const token = config.access_token
    if (!token) return

    if (config.refresh_token) {
      setupSessionChecker(dashboardUrl, configPath, config.refresh_token)
    }

    const rawModels = yield* Effect.promise(() => fetchGatewayModels(dashboardUrl, token))
    const providerID = Provider.ID.make("sleepy")

    // If API returned models, parse them; otherwise provide default sleepy-auto
    const models =
      rawModels.length > 0
        ? parseGatewayModels(rawModels, providerID)
        : parseGatewayModels([{ id: "sleepy-auto", name: "Sleepy Auto" }], providerID)

    yield* ctx.provider.transform((providers: any) => {
      providers.add({
        info: {
          id: providerID,
          name: "Sleepy Gateway",
          activation: "enabled",
          package: "@sleepy-ai/ai/providers/openai-compatible",
          integrationID: Integration.ID.make("sleepy"),
          headers: {
            Authorization: `Bearer ${token}`,
            "X-Sleepy-Source": "sleepycode-cli",
          },
          settings: {
            baseURL: `${dashboardUrl}/api/v1`,
          },
        },
        models,
      })
    })
  }),
})
