import { SleepyUsage } from "@sleepy-ai/schema/sleepy-usage"

export type Window = {
  readonly key: string
  readonly label: string
  readonly limit: number
  readonly spent: number
  readonly ratio: number
}

/**
 * The windows a usage payload actually meters, with their fill ratio.
 *
 * A window is shown only when the gateway reports both a limit and a spend for it: an
 * absent limit means the plan is not metered there, and rendering 0/0 as an empty bar would
 * claim a limit that does not exist. `ratio` is clamped at 1 for the bar and left
 * unclamped in `spent`/`limit` so the caller can still print an overrun.
 */
export function usageWindows(usage: SleepyUsage.Info | null): Window[] {
  if (!usage) return []
  return SleepyUsage.windows.flatMap((window) => {
    const limit = usage.limits?.[window.limit]
    if (limit === undefined || limit <= 0) return []
    const spent = usage.usageByWindow?.[window.spent] ?? 0
    return [{ key: window.key, label: window.label, limit, spent, ratio: Math.min(1, spent / limit) }]
  })
}

/** Whether a plan is metered on any window, so the panel has something to show. */
export function hasMeteredWindow(usage: SleepyUsage.Info | null): boolean {
  return usageWindows(usage).length > 0
}

/**
 * Remaining credit when the plan is credit-based rather than window-based.
 *
 * `creditUSD` is the gateway's remaining balance, so it is only meaningful when positive;
 * `monthlyAllowanceUSD` is the fallback for a plan that reports an allowance without a
 * credit balance.
 */
export function creditBalance(usage: SleepyUsage.Info | null): number | undefined {
  if (!usage) return undefined
  const credit = usage.limits?.creditUSD
  if (credit !== undefined && credit > 0) return credit
  const allowance = usage.monthlyAllowanceUSD
  if (allowance !== undefined && allowance > 0) return allowance
  return undefined
}

/**
 * Theme role for a window's fill: `success` under 75%, `warning` from 75%, `error` at or
 * over the limit. Chosen by meaning (proximity to a limit) rather than by colour.
 */
export function ratioRole(ratio: number): "success" | "warning" | "error" {
  if (ratio >= 1) return "error"
  if (ratio >= 0.75) return "warning"
  return "success"
}

/** A fixed-width bar using block glyphs, plus the percentage it represents. */
export function progressBar(ratio: number, width = 10): string {
  const filled = Math.round(Math.min(1, Math.max(0, ratio)) * width)
  return "█".repeat(filled) + "░".repeat(width - filled)
}
