import { Plugin } from "@sleepy-ai/plugin/tui"
import { createMermaidCodeBlockRenderer } from "./markdown.js"
import { resolveSleepyCodeDiagramPalette } from "./palette.js"

export default Plugin.define({
  id: "sleepycode.merman",
  setup(context) {
    context.markdown.registerCodeBlockRenderer(
      "mermaid",
      createMermaidCodeBlockRenderer(context.renderer, () => ({
        colors: resolveSleepyCodeDiagramPalette(context.theme, context.themeMode),
      })),
    )
  },
})
