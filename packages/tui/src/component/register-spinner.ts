import { getComponentCatalogue } from "@opentui/solid/components"
import { registerSpinner } from "opentui-spinner/solid"

export function registerSleepycodeSpinner() {
  if (!getComponentCatalogue().spinner) registerSpinner()
}
