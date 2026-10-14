import { registerCustomTheme } from "@pierre/diffs"
import { SleepyCodeTheme } from "./marked-theme"

let registered = false

export function registerSleepyCodeTheme() {
  if (registered) return
  registered = true
  registerCustomTheme("SleepyCode", () => Promise.resolve(SleepyCodeTheme))
}
