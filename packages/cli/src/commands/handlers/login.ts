import { createServer, type IncomingMessage, type ServerResponse } from "node:http"
import fs from "node:fs/promises"
import path from "node:path"
import { intro, outro, log, spinner, select, isCancel } from "@clack/prompts"
import { Effect } from "effect"
import { Global } from "@sleepy-ai/util/global"
import { Commands } from "../commands"
import { Runtime } from "../../framework/runtime"
import { handlePromptErrors, openUrl } from "../../ui/prompt"

const PORT = 40821

export const getDashboardUrl = (): string =>
  process.env.SLEEPY_DASHBOARD_URL || process.env.SLEEPY_PLATFORM_URL || "https://www.sleepyai.org"

export const buildAuthorizeUrl = (dashboardUrl: string): string => {
  const params = new URLSearchParams({
    client_id: "sleepy-cli",
    redirect_uri: `http://localhost:${PORT}/callback`,
    response_type: "code",
  })
  return `${dashboardUrl}/api/auth/oauth/authorize?${params.toString()}`
}

export const exchangeCodeForToken = async (code: string, dashboardUrl: string) => {
  const response = await fetch(`${dashboardUrl}/api/auth/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, client_id: "sleepy-cli" }),
  })

  if (!response.ok) {
    throw new Error(`Token exchange failed: ${response.statusText}`)
  }

  return response.json() as Promise<{
    access_token: string
    refresh_token: string
    expires_in: number
    endpoint: string
    tier: string
    email: string
  }>
}

export const writeConfig = async (
  configPath: string,
  data: {
    access_token: string
    refresh_token?: string
    expires_at?: number
    endpoint: string
    tier: string
    email: string
    dashboard_url?: string
  },
) => {
  await fs.mkdir(path.dirname(configPath), { recursive: true })
  await fs.writeFile(configPath, JSON.stringify(data, null, 2), "utf-8")
}

let codeResolver: ((code: string) => void) | null = null
let codePromise: Promise<string> | null = null

export const waitForCode = (): Promise<string> => {
  if (!codePromise) {
    codePromise = new Promise<string>((resolve) => {
      codeResolver = resolve
    })
  }
  return codePromise
}

export const startLoginServer = (): Promise<import("node:http").Server> => {
  return new Promise((resolve) => {
    const server = createServer((req: IncomingMessage, res: ServerResponse) => {
      const url = new URL(req.url || "/", `http://localhost:${PORT}`)

      if (url.pathname === "/callback") {
        const code = url.searchParams.get("code")

        if (code) {
          res.writeHead(200, { "Content-Type": "text/html" })
          res.end(`
            <!DOCTYPE html>
            <html>
            <head>
              <title>Sleepy CLI - Login Successful</title>
              <style>
                body {
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                  display: flex;
                  justify-content: center;
                  align-items: center;
                  min-height: 100vh;
                  margin: 0;
                  background: linear-gradient(135deg, #FF6700 0%, #1A1A1A 100%);
                }
                .card {
                  background: #242424;
                  color: #FFFFFF;
                  padding: 40px;
                  border-radius: 12px;
                  box-shadow: 0 20px 60px rgba(0,0,0,0.5);
                  text-align: center;
                  border: 1px solid #333333;
                }
                .success {
                  color: #39FF14;
                  font-size: 48px;
                  margin-bottom: 20px;
                }
                h1 {
                  color: #FFFFFF;
                  margin: 0 0 10px 0;
                }
                p {
                  color: #888888;
                  margin: 0;
                }
              </style>
            </head>
            <body>
              <div class="card">
                <div class="success">✓</div>
                <h1>Login Successful!</h1>
                <p>You can close this window and return to Sleepy CLI.</p>
              </div>
            </body>
            </html>
          `)

          if (codeResolver) {
            codeResolver(code)
            codeResolver = null
            codePromise = null
          }
        } else {
          res.writeHead(400, { "Content-Type": "text/html" })
          res.end(`
            <!DOCTYPE html>
            <html>
            <head>
              <title>Sleepy CLI - Login Failed</title>
              <style>
                body {
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                  display: flex;
                  justify-content: center;
                  align-items: center;
                  min-height: 100vh;
                  margin: 0;
                  background: #1A1A1A;
                }
                .card {
                  background: #242424;
                  color: #FFFFFF;
                  padding: 40px;
                  border-radius: 12px;
                  text-align: center;
                }
                .error {
                  color: #FB7185;
                  font-size: 48px;
                  margin-bottom: 20px;
                }
              </style>
            </head>
            <body>
              <div class="card">
                <div class="error">✗</div>
                <h1>Login Failed</h1>
                <p>No authorization code received. Please try again.</p>
              </div>
            </body>
            </html>
          `)
        }
      } else {
        res.writeHead(404, { "Content-Type": "text/plain" })
        res.end("Not Found")
      }
    })

    server.listen(PORT, () => {
      resolve(server)
    })
  })
}

export interface DeviceCodeResponse {
  device_code: string
  user_code: string
  verification_uri: string
  verification_uri_complete: string
  interval: number
}

export interface DeviceTokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number
  endpoint: string
  tier: string
  email: string
}

export const startDeviceFlow = async (dashboardUrl: string): Promise<DeviceCodeResponse> => {
  const res = await fetch(`${dashboardUrl}/api/auth/oauth/device`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: "sleepy-cli" }),
  })
  if (!res.ok) throw new Error("Failed to start device login")
  return res.json()
}

export const pollDeviceToken = async (
  dashboardUrl: string,
  deviceCode: string,
): Promise<DeviceTokenResponse> => {
  const res = await fetch(`${dashboardUrl}/api/auth/oauth/device/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      device_code: deviceCode,
      client_id: "sleepy-cli",
    }),
  })

  if (res.ok) return res.json()

  let body: Record<string, unknown> | null = null
  try {
    body = await res.json()
  } catch {
    const text = await res.text().catch(() => "")
    throw Object.assign(new Error(text ? `Server error: ${text.substring(0, 200)}` : `HTTP ${res.status}`), {
      code: "server_error",
    })
  }

  const err: any = new Error((body?.error as string) || "Unknown error")
  err.code = body?.error ?? "server_error"
  throw err
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const runAuthCodeFlow = Effect.fn("cli.login.browser")(function* () {
  const global = yield* Global.Service
  const dashboardUrl = getDashboardUrl()
  const authorizeUrl = buildAuthorizeUrl(dashboardUrl)

  const server = yield* Effect.promise(() => startLoginServer())

  log.info(`Waiting for authorization at:\n  ${authorizeUrl}`)
  yield* openUrl(authorizeUrl).pipe(Effect.ignore)

  const s = spinner()
  s.start("Waiting for browser authorization...")

  const code = yield* Effect.promise(() => waitForCode())
  server.close()

  s.message("Exchanging code for credentials...")
  const tokenData = yield* Effect.promise(() => exchangeCodeForToken(code, dashboardUrl))

  const configPath = path.join(global.config, "gateway.json")
  yield* Effect.promise(() =>
    writeConfig(configPath, {
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: Date.now() + (tokenData.expires_in ?? 3600) * 1000,
      endpoint: tokenData.endpoint,
      tier: tokenData.tier,
      email: tokenData.email,
      dashboard_url: dashboardUrl,
    }),
  )

  s.stop("Login successful!")
  log.success(`Logged in as ${tokenData.email} (${tokenData.tier} tier)`)
  log.info(`Credentials saved to ${configPath}`)
})

const runDeviceFlow = Effect.fn("cli.login.device")(function* () {
  const global = yield* Global.Service
  const dashboardUrl = getDashboardUrl()

  const s = spinner()
  s.start("Starting device login flow...")

  const deviceData = yield* Effect.tryPromise({
    try: () => startDeviceFlow(dashboardUrl),
    catch: (cause) => new Error(`Failed to start device login: ${cause}`),
  })
  s.stop("Device code received")

  const { device_code, user_code, verification_uri_complete, interval } = deviceData

  log.info(`Open this URL in your browser:\n  ${verification_uri_complete}`)
  log.info(`Enter user code: ${user_code}`)

  yield* openUrl(verification_uri_complete).pipe(Effect.ignore)

  const pollSpinner = spinner()
  pollSpinner.start("Waiting for authorization on device...")

  const pollMs = (interval ?? 5) * 1000
  let tokenData: DeviceTokenResponse | null = null

  while (true) {
    yield* Effect.promise(() => sleep(pollMs))

    try {
      tokenData = yield* Effect.promise(() => pollDeviceToken(dashboardUrl, device_code))
      break
    } catch (err: any) {
      if (err.code === "authorization_pending" || err.code === "slow_down") continue
      if (err.code === "expired_token") {
        pollSpinner.stop("Device code expired", 1)
        return yield* Effect.fail(new Error("Login expired. Please try again."))
      }
      if (err.code === "access_denied") {
        pollSpinner.stop("Login denied", 1)
        return yield* Effect.fail(new Error("Login denied by user."))
      }
      pollSpinner.stop("Login failed", 1)
      return yield* Effect.fail(new Error(`Login failed: ${err.message || "Unknown error"}`))
    }
  }

  pollSpinner.stop("Authorized!")

  const configPath = path.join(global.config, "gateway.json")
  yield* Effect.promise(() =>
    writeConfig(configPath, {
      access_token: tokenData!.access_token,
      refresh_token: tokenData!.refresh_token,
      expires_at: Date.now() + (tokenData!.expires_in ?? 3600) * 1000,
      endpoint: tokenData!.endpoint,
      tier: tokenData!.tier,
      email: tokenData!.email,
      dashboard_url: dashboardUrl,
    }),
  )

  log.success(`Logged in as ${tokenData!.email} (${tokenData!.tier} tier)`)
  log.info(`Credentials saved to ${configPath}`)
})

export default Runtime.handler(
  Commands.commands.login,
  Effect.fn("cli.login")((input) =>
    Effect.gen(function* () {
      intro("Sleepy Login")

      if (input.device || !process.stdin.isTTY) {
        yield* runDeviceFlow()
        outro("Done")
        return
      }

      const method = yield* Effect.promise(() =>
        select({
          message: "How would you like to log in?",
          options: [
            { value: "browser", label: "Open in Browser", hint: "recommended" },
            { value: "device", label: "Use Activation Code" },
            { value: "exit", label: "Exit" },
          ],
        }),
      )

      if (isCancel(method) || method === "exit") {
        outro("Cancelled")
        return
      }

      if (method === "device") {
        yield* runDeviceFlow()
      } else {
        yield* runAuthCodeFlow()
      }

      outro("Done")
    }).pipe(handlePromptErrors),
  ),
)
