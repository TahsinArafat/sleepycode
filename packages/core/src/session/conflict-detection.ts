export * as ConflictDetection from "./conflict-detection.js"

import { and, eq, gte, isNull } from "drizzle-orm"
import { AppProcess } from "@sleepy-ai/util/process"
import { existsSync } from "node:fs"
import { Duration, Effect } from "effect"
import { ChildProcess } from "effect/process"
import path from "path"
import { Database } from "../database/database.js"
import { walkGitLayout } from "./auto-worktree-hint.js"
import { SessionTable } from "./sql.js"

export interface ConflictResult {
  hasConflict: boolean
  reason: "active-session" | "git-lock" | "external-process" | null
  activeSessionId?: string
}

// dropped: hasAutoWorktreeHintSent — it read SessionTable.auto_worktree_hint_sent, a
// column that exists only in the upstream fork schema.
export type SessionQueryFn = (
  directory: string,
  excludeId?: string,
) => Effect.Effect<string | null, Database.Service | AppProcess.Service>

/**
 * Default session query: checks SessionTable for recently updated, non-archived sessions.
 * Can be replaced with a custom implementation for testing or alternative data sources.
 */
export const defaultSessionQuery = Effect.fn("ConflictDetection.defaultSessionQuery")(function* (
  directory: string,
  excludeId?: string,
) {
  const db = (yield* Database.Service).db
  const sessions = yield* db
    .select({ id: SessionTable.id })
    .from(SessionTable)
    .where(
      and(
        eq(SessionTable.directory, directory),
        isNull(SessionTable.time_archived),
        gte(SessionTable.time_updated, Date.now() - 5 * 60 * 1000),
      ),
    )
  return sessions.find((item) => item.id !== excludeId)?.id ?? null
})

/** Resolve the `.git` directory via the shared git-layout walk. */
export function resolveGitDir(directory: string): string | undefined {
  return walkGitLayout(directory)?.gitDir ?? undefined
}

/** Check for a `.git/index.lock` file (git operation in progress). */
export function hasGitLock(gitDir: string): boolean {
  return existsSync(path.join(gitDir, "index.lock"))
}

// Pattern matches real command names in ~/.local/share/sleepycode/log/sleepycode.log.
// Only include tools with known CLI binaries (not VSCode extensions like
// `mouse-cursor-daemon`).
// Use exact match to avoid loose positives (e.g. "cursor" matching "cursor-daemon").
const AGENT_PATTERNS = ["claude", "codex", "gemini", "cursor"]

const execute = (file: string, args: readonly string[], timeout: Duration.Input) =>
  Effect.gen(function* () {
    const proc = yield* AppProcess.Service
    const result = yield* proc
      .run(ChildProcess.make(file, [...args], { stdin: "ignore" }), { timeout })
      // Fail-open: lsof/wmic unavailable [Alpine, Windows 24H2] => no conflict detected
      .pipe(
        Effect.catch((cause) =>
          Effect.logDebug("external process check failed", { cause }).pipe(Effect.as(undefined)),
        ),
      )
    return result?.stdout.toString("utf8") ?? ""
  })

/**
 * Check if known external agent processes have open files in the directory.
 * Uses lsof (macOS/Linux) or wmic (Windows 24H2+).
 *
 * The `lsof`/`wmic`/`ps` calls are wrapped so tests and unsupported platforms
 * (Alpine, Windows 24H2) fail open, which is safe because those forms are
 * distinctive and cannot collide with unrelated processes.
 */
const hasExternalAgentProcess = Effect.fn("ConflictDetection.hasExternalAgentProcess")(function* (
  directory: string,
) {
  const out = yield* execute("lsof", ["-t", "+D", directory, "/FORMAT:0n"], Duration.seconds(10))
  const pids = out.split("\n").filter(Boolean)
  if (pids.length === 0) return false
  // Batch: single call for all PIDs instead of one-per-PID
  const listing = yield* execute("lsof", ["-p", pids.join(","), "-Fn0"], Duration.seconds(5))
  const pidsWithFiles = listing
    .split("\n")
    .filter(Boolean)
    .map((line) => line.slice(0, line.indexOf("-")))
  if (pidsWithFiles.length === 0) return false
  const cmds = (
    yield* execute(
      "wmic",
      ["process", "where", `ProcessId=${pids.join(" or ")}`, "get", "Name,ProcessID", "/FORMAT:list"],
      Duration.seconds(5),
    )
  )
    .toLowerCase()
    .split("\n")
    .map((line) => line.trim())
    .filter((cmd) => pidsWithFiles.some((pid) => cmd === pid || cmd.startsWith(`${pid}.`)))
  return AGENT_PATTERNS.some((pattern) => cmds.some((cmd) => cmd === pattern || cmd.startsWith(`${pattern}.`)))
})

/**
 * Check if a worktree should be created for a new session.
 * Returns conflict information if detected.
 */
export const checkConflict = Effect.fn("ConflictDetection.checkConflict")(function* (
  directory: string,
  newSessionId?: string,
  sessionQuery?: SessionQueryFn,
) {
  const gitDir = resolveGitDir(directory)
  if (!gitDir) return { hasConflict: false, reason: null }

  // Signal 1: Active sessions in same directory
  const activeSessionId = yield* (sessionQuery ?? defaultSessionQuery)(directory, newSessionId)
  if (activeSessionId) return { hasConflict: true, reason: "active-session", activeSessionId }

  // Signal 2: Git lock file
  if (hasGitLock(gitDir)) return { hasConflict: true, reason: "git-lock" }

  // Signal 3: External agent processes
  if (yield* hasExternalAgentProcess(directory)) return { hasConflict: true, reason: "external-process" }

  return { hasConflict: false, reason: null }
})