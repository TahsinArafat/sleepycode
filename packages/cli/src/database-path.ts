import path from "node:path"
import { SLEEPYCODE_CHANNEL } from "./version"

export function databasePath(data: string) {
  const filename =
    process.env.SLEEPYCODE_DB ??
    (["latest", "dev", "beta", "next", "prod"].includes(SLEEPYCODE_CHANNEL) ||
    process.env.SLEEPYCODE_DISABLE_CHANNEL_DB === "1" ||
    process.env.SLEEPYCODE_DISABLE_CHANNEL_DB === "true"
      ? "sleepycode.db"
      : `sleepycode-${SLEEPYCODE_CHANNEL.replace(/[^a-zA-Z0-9._-]/g, "-")}.db`)
  return filename === ":memory:" ? filename : path.resolve(data, filename)
}
