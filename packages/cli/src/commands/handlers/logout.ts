import fs from "node:fs/promises"
import { existsSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { intro, outro, log } from "@clack/prompts"
import { Effect } from "effect"
import { Global } from "@sleepy-ai/util/global"
import { Commands } from "../commands"
import { Runtime } from "../../framework/runtime"
import { handlePromptErrors } from "../../ui/prompt"

/**
 * Every location the Sleepy provider looks in, in its own order. Clearing only the
 * primary path would leave an older copy behind and the user still signed in.
 */
const stores = (configDir: string) =>
  [
    ...new Set([
      path.join(configDir, "gateway.json"),
      path.join(os.homedir(), ".config", "sleepy", "gateway.json"),
      path.join(os.homedir(), ".config", "sleepycode", "gateway.json"),
      path.join(os.homedir(), ".sleepy", "gateway.json"),
    ]),
  ].filter(existsSync)

const readEmail = (file: string) =>
  Effect.promise(async () => {
    const parsed = JSON.parse(await fs.readFile(file, "utf-8")) as { email?: string }
    return parsed.email
  }).pipe(Effect.catch(() => Effect.succeed(undefined)))

export default Runtime.handler(
  Commands.commands.logout,
  Effect.fn("cli.logout")(() =>
    Effect.gen(function* () {
      intro("Sleepy Logout")

      const global = yield* Global.Service
      const files = stores(global.config)

      if (files.length === 0) {
        log.warn("No stored Sleepy session was found.")
        outro("Already signed out")
        return
      }

      const email = yield* readEmail(files[0])

      yield* Effect.forEach(files, (file) =>
        Effect.promise(async () => {
          await fs.rm(file, { force: true })
          log.success(`Removed ${file}`)
        }),
      )

      outro(email ? `Signed out ${email}` : "Signed out")
    }).pipe(handlePromptErrors),
  ),
)
