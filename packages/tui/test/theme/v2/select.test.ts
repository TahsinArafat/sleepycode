import { expect, test } from "bun:test"
import { selectTheme, selectThemeMode, supportsThemeMode, themeModes } from "@sleepy-ai/theme/tui"
import { getSleepyCodeTheme } from "../../../src/theme"

test("selects complete light and dark themes independently", () => {
  const light = selectTheme(getSleepyCodeTheme(), "light")
  const dark = selectTheme(getSleepyCodeTheme(), "dark")
  expect(selectTheme(getSleepyCodeTheme())).toEqual(light)
  expect(light.hue).toEqual(getSleepyCodeTheme().light.hue)
  expect(dark.text).toEqual(getSleepyCodeTheme().base.text)
  expect(dark.hue).toEqual(getSleepyCodeTheme().dark.hue)
  expect(selectThemeMode(getSleepyCodeTheme(), "dark")).toEqual({ theme: dark, mode: "dark" })
})

test("selects the available mode when the requested mode is missing", () => {
  const lightOnly = { base: getSleepyCodeTheme().base, light: getSleepyCodeTheme().light } as const
  const darkOnly = { base: getSleepyCodeTheme().base, dark: getSleepyCodeTheme().dark } as const

  expect(themeModes(lightOnly)).toEqual(["light"])
  expect(themeModes(darkOnly)).toEqual(["dark"])
  expect(supportsThemeMode(lightOnly, "light")).toBeTrue()
  expect(supportsThemeMode(lightOnly, "dark")).toBeFalse()
  expect(selectThemeMode(lightOnly, "dark")).toEqual({ theme: selectTheme(getSleepyCodeTheme(), "light"), mode: "light" })
  expect(selectThemeMode(darkOnly, "light")).toEqual({ theme: selectTheme(getSleepyCodeTheme(), "dark"), mode: "dark" })
})
