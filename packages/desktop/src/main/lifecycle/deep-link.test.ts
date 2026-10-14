import { describe, expect, test } from "bun:test"
import { consoleReturnWindow } from "./deep-link"

describe("Console return deep links", () => {
  test("reads the originating Desktop window", () => {
    expect(consoleReturnWindow("sleepycode://console/authorized?window=window-a")).toBe("window-a")
    expect(consoleReturnWindow("sleepycode://console/authorized?window=window%20b")).toBe("window b")
  })

  test("rejects unrelated and malformed links", () => {
    expect(consoleReturnWindow("sleepycode://console/other?window=window-a")).toBeUndefined()
    expect(consoleReturnWindow("sleepycode://other/authorized?window=window-a")).toBeUndefined()
    expect(consoleReturnWindow("https://console/authorized?window=window-a")).toBeUndefined()
    expect(consoleReturnWindow("not a url")).toBeUndefined()
    expect(consoleReturnWindow("sleepycode://console/authorized")).toBeUndefined()
  })
})
