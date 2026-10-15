import { existsSync } from "node:fs"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { Path } from "./global.js"

export interface GatewayConfig {
  access_token?: string
  refresh_token?: string
  api_key?: string
  expires_at?: number
  endpoint?: string
  dashboard_url?: string
  email?: string
  tier?: string
}

export const DEFAULT_PLATFORM_URL = "https://www.sleepyai.org"

/**
 * Returns every known file path where a Sleepy gateway session may be stored,
 * ordered by preference.
 */
export function gatewayPaths(configDir?: string): string[] {
  const envPath = process.env.SLEEPY_GATEWAY_CONFIG
  return [
    ...new Set(
      [
        envPath,
        configDir ? path.join(configDir, "gateway.json") : undefined,
        path.join(Path.config, "gateway.json"),
        path.join(os.homedir(), ".config", "sleepy", "gateway.json"),
        path.join(os.homedir(), ".config", "sleepycode", "gateway.json"),
        path.join(os.homedir(), ".sleepy", "gateway.json"),
      ].filter((item): item is string => Boolean(item)),
    ),
  ]
}

export async function findGatewayConfigPath(configDir?: string): Promise<string | null> {
  const candidates = gatewayPaths(configDir)
  const accessible = await Promise.all(
    candidates.map(async (candidate) => {
      try {
        await fs.access(candidate)
        return candidate
      } catch {
        return undefined
      }
    }),
  )
  return accessible.find((item): item is string => item !== undefined) ?? null
}

export async function readGatewayConfig(configDir?: string): Promise<{ path: string; config: GatewayConfig } | null> {
  const configPath = await findGatewayConfigPath(configDir)
  if (!configPath) return null
  try {
    return { path: configPath, config: JSON.parse(await fs.readFile(configPath, "utf-8")) as GatewayConfig }
  } catch {
    return null
  }
}

export async function readGatewayEmail(configPath: string): Promise<string | undefined> {
  try {
    return (JSON.parse(await fs.readFile(configPath, "utf-8")) as GatewayConfig).email
  } catch {
    return undefined
  }
}

export async function writeGatewayConfig(configPath: string, config: GatewayConfig): Promise<void> {
  await fs.mkdir(path.dirname(configPath), { recursive: true })
  const tmp = `${configPath}.tmp.${Date.now()}`
  await fs.writeFile(tmp, JSON.stringify(config, null, 2), "utf-8")
  await fs.rename(tmp, configPath)
}

/**
 * Sweeps all candidate gateway locations so that a stale fallback config
 * cannot keep a signed-out user authenticated.
 */
export async function clearGatewayConfig(configDir?: string): Promise<{ removed: string[]; email?: string }> {
  const candidates = gatewayPaths(configDir)
  const existing = candidates.filter((candidate) => existsSync(candidate))
  const email = existing[0] ? await readGatewayEmail(existing[0]) : undefined
  await Promise.all(existing.map((candidate) => fs.rm(candidate, { force: true })))
  return { removed: existing, email }
}
