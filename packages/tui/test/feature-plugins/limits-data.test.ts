import { describe, expect, test } from "bun:test"
import { creditBalance, hasMeteredWindow, progressBar, ratioRole, usageWindows } from "../../src/feature-plugins/sidebar/limits-data"

describe("usage windows", () => {
  test("signed out has nothing to show", () => {
    expect(usageWindows(null)).toEqual([])
    expect(hasMeteredWindow(null)).toBe(false)
    expect(creditBalance(null)).toBeUndefined()
  })

  test("a window needs both a limit and a spend to be metered", () => {
    // No limits at all: nothing is metered, so no bar may claim a limit of zero.
    expect(usageWindows({ usageByWindow: { cost5h: 1 } })).toEqual([])
    // A limit without a spend is metered at zero spend, and is shown.
    expect(usageWindows({ limits: { limit5h: 2 } })).toEqual([
      { key: "5h", label: "5 hours", limit: 2, spent: 0, ratio: 0 },
    ])
    expect(hasMeteredWindow({ limits: { limit5h: 2 } })).toBe(true)
  })

  test("windows are ordered and carry a clamped ratio", () => {
    const windows = usageWindows({
      limits: { limit5h: 1, limit24h: 2, limitWeekly: 4, limitMonthly: 8 },
      usageByWindow: { cost5h: 0.5, cost24h: 3, costWeekly: 2, costMonthly: 0 },
    })
    expect(windows.map((window) => window.key)).toEqual(["5h", "24h", "weekly", "monthly"])
    // 3/2 overshoots: the bar clamps, the reported numbers do not.
    expect(windows[1]).toEqual({ key: "24h", label: "24 hours", limit: 2, spent: 3, ratio: 1 })
    expect(windows[0].ratio).toBe(0.5)
    expect(windows[3].spent).toBe(0)
  })

  test("a zero or negative limit is not a metered window", () => {
    expect(usageWindows({ limits: { limit5h: 0, limit24h: -1 } })).toEqual([])
  })

  test("credit prefers a positive creditUSD, then the monthly allowance", () => {
    expect(creditBalance({ limits: { creditUSD: 3 } })).toBe(3)
    expect(creditBalance({ limits: { creditUSD: 0 }, monthlyAllowanceUSD: 5 })).toBe(5)
    expect(creditBalance({ monthlyAllowanceUSD: 5 })).toBe(5)
    expect(creditBalance({ limits: { creditUSD: 0 }, monthlyAllowanceUSD: 0 })).toBeUndefined()
  })
})

describe("ratio role and bar", () => {
  test("role is chosen by proximity to the limit", () => {
    expect(ratioRole(0)).toBe("success")
    expect(ratioRole(0.74)).toBe("success")
    expect(ratioRole(0.75)).toBe("warning")
    expect(ratioRole(1)).toBe("error")
    expect(ratioRole(1.5)).toBe("error")
  })

  test("bar is fixed width and clamps out-of-range ratios", () => {
    expect(progressBar(0)).toBe("░".repeat(10))
    expect(progressBar(1)).toBe("█".repeat(10))
    expect(progressBar(0.5)).toBe("█".repeat(5) + "░".repeat(5))
    expect(progressBar(-1)).toBe("░".repeat(10))
    expect(progressBar(9)).toBe("█".repeat(10))
    expect(progressBar(0.5, 4)).toHaveLength(4)
  })
})
