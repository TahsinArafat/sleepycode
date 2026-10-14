import { ensurePluginRuntime, provides } from "@sleepy-ai/plugin/runtime"
import { Plugin, PluginContextProvider, usePlugin } from "@sleepy-ai/plugin/tui"
import { ensureRuntimePluginSupport } from "@opentui/solid/runtime-plugin-support/configure"

ensurePluginRuntime()
ensureRuntimePluginSupport({
  additional: {
    "@sleepy-ai/plugin/tui": { Plugin, PluginContextProvider, usePlugin },
  },
  preserve: provides,
})
