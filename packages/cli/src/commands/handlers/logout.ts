import { intro, outro, log } from "@clack/prompts"
import { Effect } from "effect"
import { Global } from "@sleepy-ai/util/global"
import { clearGatewayConfig } from "@sleepy-ai/util/gateway"
import { Commands } from "../commands"
import { Runtime } from "../../framework/runtime"
import { handlePromptErrors } from "../../ui/prompt"

export default Runtime.handler(
  Commands.commands.logout,
  Effect.fn("cli.logout")(() =>
    Effect.gen(function* () {
      intro("Sleepy Logout")

      const global = yield* Global.Service
      const result = yield* Effect.promise(() => clearGatewayConfig(global.config))

      if (result.removed.length === 0) {
        log.warn("No stored Sleepy session was found.")
        outro("Already signed out")
        return
      }

      for (const file of result.removed) {
        log.success(`Removed ${file}`)
      }

      outro(result.email ? `Signed out ${result.email}` : "Signed out")
    }).pipe(handlePromptErrors),
  ),
)
