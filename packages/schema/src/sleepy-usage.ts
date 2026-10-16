export * as SleepyUsage from "./sleepy-usage.js"

import { Schema } from "effect"

/**
 * Spend and allowance across the rolling windows the Sleepy gateway meters.
 *
 * This is the gateway's shape, not a contract we own, so every window is optional: a plan
 * that is not metered on a window omits it rather than reporting zero, and the UI can then
 * tell "no limit set" from "limit unused". `creditUSD` is the remaining balance when the
 * plan is credit-based instead of window-based.
 *
 * Lives in `schema` rather than `protocol` because both the protocol group and the core
 * gateway plugin decode it, and core must not depend on protocol.
 */
export const Limits = Schema.Struct({
  creditUSD: Schema.optional(Schema.Number),
  limit5h: Schema.optional(Schema.Number),
  limit24h: Schema.optional(Schema.Number),
  limitWeekly: Schema.optional(Schema.Number),
  limitMonthly: Schema.optional(Schema.Number),
  rpmLimit: Schema.optional(Schema.Number),
}).annotate({ identifier: "SleepyUsage.Limits" })
export type Limits = typeof Limits.Type

export const UsageByWindow = Schema.Struct({
  cost5h: Schema.optional(Schema.Number),
  cost24h: Schema.optional(Schema.Number),
  costWeekly: Schema.optional(Schema.Number),
  costMonthly: Schema.optional(Schema.Number),
}).annotate({ identifier: "SleepyUsage.UsageByWindow" })
export type UsageByWindow = typeof UsageByWindow.Type

export const Info = Schema.Struct({
  limits: Schema.optional(Limits),
  usageByWindow: Schema.optional(UsageByWindow),
  monthlyUsageUSD: Schema.optional(Schema.Number),
  monthlyAllowanceUSD: Schema.optional(Schema.Number),
}).annotate({ identifier: "SleepyUsage.Info" })
export type Info = typeof Info.Type

/**
 * The rolling windows the sidebar shows, in display order, paired with the limit and spend
 * fields each one reads. Kept here beside the schema so a new window is added once.
 */
export const windows = [
  { key: "5h", limit: "limit5h", spent: "cost5h", label: "5 hours" },
  { key: "24h", limit: "limit24h", spent: "cost24h", label: "24 hours" },
  { key: "weekly", limit: "limitWeekly", spent: "costWeekly", label: "This week" },
  { key: "monthly", limit: "limitMonthly", spent: "costMonthly", label: "This month" },
] as const satisfies ReadonlyArray<{
  key: string
  limit: keyof Limits
  spent: keyof UsageByWindow
  label: string
}>

/**
 * Whether the Sleepy gateway is signed in, and what to call the account.
 *
 * Separate from {@link Info} because they answer different questions with different failure
 * modes: `Info` is "what does the plan allow" and sits behind a network call that degrades to
 * null, while this is "is a session present" and is a local read. The TUI leans on this at
 * startup, where it must not block on the gateway.
 */
export const Status = Schema.Struct({
  signedIn: Schema.Boolean,
  email: Schema.optional(Schema.String),
}).annotate({ identifier: "SleepyUsage.Status" })
export type Status = typeof Status.Type
