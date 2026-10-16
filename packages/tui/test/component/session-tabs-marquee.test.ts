import { afterEach, describe, expect, jest, test } from "bun:test"
import { createRoot } from "solid-js"
import { createMarquee, createTabMarquee } from "../../src/component/session-tabs"
import { marqueeCycleWidth } from "../../src/util/marquee"

afterEach(() => jest.useRealTimers())

describe("session tab marquee", () => {
  test("starts for the hovered width and resets when the next tab fits", () => {
    jest.useFakeTimers()
    const scope = createRoot((dispose) => ({ marquee: createMarquee(() => false), dispose }))

    scope.marquee.enter("first", "sleepycode", 6)
    expect(scope.marquee.active()).toBe("first")
    expect(scope.marquee.offset()).toBe(0)

    jest.advanceTimersByTime(600)
    expect(scope.marquee.offset()).toBe(1)

    scope.marquee.enter("second", "short", 6)
    expect(scope.marquee.active()).toBeUndefined()
    expect(scope.marquee.offset()).toBe(0)
    expect(scope.marquee.leading()).toBe(0)
    scope.dispose()
  })

  test("stops after one cycle", () => {
    jest.useFakeTimers()
    const scope = createRoot((dispose) => ({ marquee: createMarquee(() => false), dispose }))

    scope.marquee.enter("first", "sleepycode", 6)
    // The cycle clears on the tick that reaches the full title plus its gap, so
    // the boundary moves with the title width.
    jest.advanceTimersByTime(600 + (marqueeCycleWidth("sleepycode") - 1) * 80)

    expect(scope.marquee.active()).toBe("first")
    expect(scope.marquee.offset()).toBe(0)
    expect(scope.marquee.leading()).toBe(0)
    scope.dispose()
  })

  test("resets immediately after leaving", () => {
    jest.useFakeTimers()
    const scope = createRoot((dispose) => ({ marquee: createMarquee(() => false), dispose }))

    scope.marquee.enter("first", "sleepycode", 6)
    jest.advanceTimersByTime(700)
    scope.marquee.leave("first")

    expect(scope.marquee.active()).toBeUndefined()
    expect(scope.marquee.offset()).toBe(0)
    expect(scope.marquee.leading()).toBe(0)
    scope.dispose()
  })

  test("resets when the pointer leaves the tab rail", () => {
    jest.useFakeTimers()
    const scope = createRoot((dispose) => ({ marquee: createTabMarquee(() => false), dispose }))

    scope.marquee.enter("first", "sleepycode", 6)
    jest.advanceTimersByTime(700)
    scope.marquee.leaveHovered()
    jest.advanceTimersByTime(0)

    expect(scope.marquee.hovered()).toBeUndefined()
    expect(scope.marquee.active()).toBeUndefined()
    expect(scope.marquee.offset()).toBe(0)
    scope.dispose()
  })
})
