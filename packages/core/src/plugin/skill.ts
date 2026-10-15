/// <reference path="../markdown.d.ts" />

export * as SkillPlugin from "./skill.js"

import { define, type Context } from "@sleepy-ai/plugin/effect/plugin"
import { Document } from "@sleepy-ai/schema/config"
import { Effect } from "effect"
import { AbsolutePath } from "../schema.js"
import { Skill } from "../skill.js"
import { Config } from "../config.js"
import os from "os"
import sleepycodeContent from "./skill/sleepycode.md" with { type: "text" }
import reportContent from "./skill/report.md" with { type: "text" }
import designBlueprintContent from "./skill/design-blueprint.md" with { type: "text" }
import evolveContent from "./skill/evolve.md" with { type: "text" }
import frontendDesignContent from "./skill/frontend-design.md" with { type: "text" }
import { SkillFile } from "../config/plugin/skill-file.js"

export const SleepycodeContent = sleepycodeContent
export const ReportContent = reportContent
export const DesignBlueprintContent = designBlueprintContent
export const EvolveContent = evolveContent
export const FrontendDesignContent = frontendDesignContent

export const SleepycodeDescription =
  "Use this skill for any question about SleepyCode itself, including how SleepyCode works, using or configuring it, migrating from V1 to V2, troubleshooting it, developing plugins or integrations, using the SleepyCode SDK, clients, server, or API, and contributing to the SleepyCode codebase. Also use it for SleepyCode agents, commands, skills, tools, permissions, MCP servers, providers, models, themes, keybinds, formatters, the CLI, TUI, desktop app, and web app."
const REPORT_DESCRIPTION =
  "Use when the user wants to report an sleepycode issue or bug. Collect standard diagnostics, add user-specific reproduction context, and publish the issue with GitHub CLI."

export const Plugin = define({
  id: "sleepycode.skill",
  effect: Effect.fn(function* (ctx) {
    const reportContent = yield* reportContentWithDiagnostics(ctx.app)
    yield* ctx.skill.transform((editor) => {
      editor.add(
        Skill.Info.make({
          id: Skill.ID.make("sleepycode"),
          name: Skill.Name.make("SleepyCode"),
          description: SleepycodeDescription,
          path: AbsolutePath.make("/builtin/sleepycode.md"),
          content: SleepycodeContent,
        }),
      )
      editor.add(
        Skill.Info.make({
          id: Skill.ID.make("report"),
          name: Skill.Name.make("Report"),
          description: REPORT_DESCRIPTION,
          path: AbsolutePath.make("/builtin/report.md"),
          content: reportContent,
        }),
      )
      for (const [file, content] of [
        ["/builtin/design-blueprint.md", DesignBlueprintContent],
        ["/builtin/evolve.md", EvolveContent],
        ["/builtin/frontend-design.md", FrontendDesignContent],
      ] as const) {
        const parsed = SkillFile.parse("/builtin", file, content)
        if (parsed._tag === "Parsed") {
          editor.add(parsed.skill)
        }
      }
    })
  }),
})

const reportContentWithDiagnostics = Effect.fn("SkillPlugin.reportContentWithDiagnostics")(function* (
  app: Context["app"],
) {
  const plugins = yield* configuredPlugins()
  // Under emulation on Windows ARM64, os.arch() reads x64 but PROCESSOR_IDENTIFIER still names the ARM host.
  const emulated =
    process.platform === "win32" && os.arch() === "x64" && process.env.PROCESSOR_IDENTIFIER?.startsWith("ARM")
  return [
    ReportContent,
    "",
    "## Runtime Diagnostics Snapshot",
    "",
    "These values were captured when the built-in report skill was registered. Verify them before publishing.",
    "",
    `- sleepycode version: ${app.version}`,
    `- install/channel: ${app.channel}`,
    `- OS: ${os.type()} ${os.release()} (${os.platform()} ${os.arch()}${emulated ? ", emulated on ARM64" : ""})`,
    `- Terminal: ${terminal()}`,
    `- Shell: ${shell()}`,
    `- Active plugins: ${plugins.length === 0 ? "None found in config" : plugins.join(", ")}`,
  ].join("\n")
})

const configuredPlugins = Effect.fn("SkillPlugin.configuredPlugins")(function* () {
  const config = yield* Config.Service
  return (yield* config.entries())
    .filter((entry): entry is Document => entry.type === "document")
    .flatMap((entry) => entry.info.plugins ?? [])
    .map((entry) => (typeof entry === "string" ? entry : entry.package))
    .toSorted()
})

function terminal() {
  return (
    [
      process.env.TERM_PROGRAM ? `TERM_PROGRAM=${process.env.TERM_PROGRAM}` : undefined,
      process.env.TERM ? `TERM=${process.env.TERM}` : undefined,
      process.env.COLORTERM ? `COLORTERM=${process.env.COLORTERM}` : undefined,
    ]
      .filter((item): item is string => item !== undefined)
      .join(", ") || "Unavailable: terminal environment variables are not set"
  )
}

function shell() {
  return (
    process.env.SHELL ??
    process.env.ComSpec ??
    process.env.COMSPEC ??
    "Unavailable: shell environment variable is not set"
  )
}
