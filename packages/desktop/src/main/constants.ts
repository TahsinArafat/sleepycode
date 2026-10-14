import { app } from "electron"

type Channel = "local" | "dev" | "beta" | "prod"

const raw = import.meta.env.SLEEPYCODE_CHANNEL

export const CHANNEL: Channel = raw === "local" || raw === "dev" || raw === "beta" || raw === "prod" ? raw : "dev"

export const VERSION = app.isPackaged ? app.getVersion() : (process.env.SLEEPYCODE_VERSION ?? app.getVersion())

const appNames: Record<string, string> = {
  dev: "SleepyCode Dev",
  beta: "SleepyCode Beta",
  prod: "SleepyCode",
}

const appIDs: Record<string, string> = {
  dev: "ai.sleepycode.desktop.dev",
  beta: "ai.sleepycode.desktop.beta",
  prod: "ai.sleepycode.desktop",
}

// Local renderer/server mode keeps the dev application identity.
export const APP_NAME = app.isPackaged ? appNames[CHANNEL] : "SleepyCode Dev"

export const APP_ID = app.isPackaged ? appIDs[CHANNEL] : "ai.sleepycode.desktop.dev"
