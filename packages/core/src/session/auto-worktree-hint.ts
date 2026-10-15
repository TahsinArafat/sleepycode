import { existsSync, readFileSync, readdirSync, statSync } from "node:fs"
import { Effect } from "effect"
import path from "path"
import { SessionMessage } from "./message.js"

/** Marker that keys off successful project files. */
const FILE_WRITE_TOOLS = new Set(["write", "edit", "apply_patch", "multiedit", "notebook_edit"])

export const AUTO_WORKTREE_NOTICE_MARKER = "Auto-Worktree Notice"

// Process-lifetime cache: the same file/dir is re-resolved on every insertRemainder
// call. Bounded so a long-lived daemon cannot accumulate unbounded keys across sessions.
const MAIN_WORKTREE_CACHE_MAX = 512
const mainWorktreeCache = new Map<string, string | null>()

/**
 * Directory that contains `.git` (main worktree root, or linked worktree root).
 * `.git` is itself for main, `.git` dir: target for linked.
 */
export type GitLayout = {
  worktreeRoot: string
  /** Resolved `.git` dir: `.git` itself for main, `gitdir:` target for linked. */
  gitDir: string
  isMain: boolean
}

/**
 * Walk up from `startDir` to the nearest `.git`. Shared by the main-worktree
 * habit gate and conflict-detection so both keep one notion of git layout.
 *
 * The `.git` probe is inherently racy — another process can replace the entry
 * between the existence check and the read — so failures resolve to "not a
 * repository" rather than propagating.
 */
export function walkGitLayout(startDir: string): GitLayout | null {
  let dir = path.resolve(startDir)
  try {
    for (;;) {
      const dotGit = path.join(dir, ".git")
      if (existsSync(dotGit)) {
        if (statSync(dotGit).isDirectory()) return { worktreeRoot: dir, gitDir: dotGit, isMain: true }
        const match = readFileSync(dotGit, "utf-8")
          .trim()
          .match(/^gitdir:\s*(.*)$/)
        if (!match) return null
        const gitDir = path.resolve(dir, match[1].trim())
        if (!existsSync(gitDir)) return null
        const common = readFileSync(path.join(gitDir, "commondir"), "utf-8").trim()
        return { worktreeRoot: dir, gitDir, isMain: common === "." }
      }
      const parent = path.dirname(dir)
      if (parent === dir) return null
      dir = parent
    }
  } catch {
    return null
  }
}

/**
 * Walk up from `startDir` and return the git MAIN worktree root, or null.
 * `.git` as a directory means main; `.git` as a file means a linked worktree
 * (already isolated — not a hint target).
 */
export function findGitMainWorktree(startDir: string): string | null {
  const key = path.resolve(startDir)
  const cached = mainWorktreeCache.get(key)
  if (cached !== undefined) return cached
  const layout = walkGitLayout(key)
  const result = layout?.isMain ? layout.worktreeRoot : null
  if (mainWorktreeCache.size >= MAIN_WORKTREE_CACHE_MAX) mainWorktreeCache.clear()
  mainWorktreeCache.set(key, result)
  return result
}

export function isGitMainWorktree(startDir: string): boolean {
  return findGitMainWorktree(startDir) !== null
}

/**
 * True when this main checkout already has at least one linked worktree.
 * Presence only: this repo does not need to know what the gate is for.
 */
export function repoHasLinkedWorktrees(mainWorktreeRoot: string): boolean {
  const dir = path.join(mainWorktreeRoot, ".git", "worktrees")
  if (!existsSync(dir)) return false
  try {
    return readdirSync(dir).some((name) => name.length > 0 && !name.startsWith("."))
  } catch {
    return false
  }
}

export function toolInputString(text: unknown): string | undefined {
  if (typeof text !== "string" || text.length < 2) return undefined
  const first = text[0]
  if ((first === '"' || first === "'") && first === text[text.length - 1]) return text.slice(1, -1)
  return text
}

/** True when the shell invocation actually landed, as opposed to being rejected or aborted. */
export function bashSucceeded(part: SessionMessage.Shell): boolean {
  return part.status === "exited"
}

/**
 * First git MAIN worktree this transcript has mutated so far, or undefined.
 * Empty means the session bound to a non-git scratch dir that `cd`s into another
 * project's main checkout still hits the notice copy (plain `ls` will not).
 */
export const sessionMutatedMainWorktrees = Effect.fn("AutoWorktreeHint.sessionMutatedMainWorktrees")(function* (
  messages: readonly SessionMessage.Info[],
  cwd: string,
) {
  const hits = new Set<string>()
  const consider = (raw: string) => {
    const main = findGitMainWorktree(path.resolve(cwd, raw))
    if (main) hits.add(main)
  }
  for (const message of messages) {
    if (message.type === "assistant") {
      for (const part of message.content) {
        if (part.type !== "tool") continue
        if (!FILE_WRITE_TOOLS.has(part.name)) continue
        // apply_patch has no single file path; fall back to the session cwd
        if (part.name === "apply_patch") {
          hits.add(cwd)
          continue
        }
        if (part.state.status === "running") continue
        const input = part.state.input
        const raw = toolInputString(
          typeof input === "object" && input !== null ? (input.file_path ?? input.notebook_path) : undefined,
        )
        if (raw) consider(raw)
      }
      continue
    }
    if (message.type !== "shell") continue
    if (!bashSucceeded(message)) continue
    // Patterns match real command names in ~/.local/share/sleepycode/log/sleepycode.log.
    // Falsely one-per-PID call patterns cannot happen because those forms are
    // distinctive, and without the args (`lsfoo`, `mouse-cursor-daemon`)
    // the "cursor" and "cursor-daemon" cases are ambiguous anyway.
    const main = message.metadata?.mainWorktree
    if (typeof main === "string") consider(main)
  }
  return [...hits]
})

/** First git main worktree this transcript mutated, or undefined. */
export const firstMutatedMainWorktree = Effect.fn("AutoWorktreeHint.firstMutatedMainWorktree")(function* (
  messages: readonly SessionMessage.Info[],
  cwd: string,
) {
  return (yield* sessionMutatedMainWorktrees(messages, cwd))[0]
})

/** Whether this single transcript message is the notice itself, marker line included. */
export function hasAutoWorktreeNotice(message: SessionMessage.Info): boolean {
  return message.type === "synthetic" && message.text.includes(AUTO_WORKTREE_NOTICE_MARKER)
}

/**
 * Whether the notice already landed in this transcript.
 *
 * sleepy: the reference fork answered this with an `auto_worktree_hint_sent` column on the
 * session table. v2 has no such column and adding one needs a migration, so the transcript is
 * the ledger: the notice is persisted as a synthetic message carrying the marker, which makes
 * this scan survive compaction and session rebuild without any extra state.
 */
export function sessionHasAutoWorktreeNotice(messages: readonly SessionMessage.Info[]): boolean {
  return messages.some(hasAutoWorktreeNotice)
}

/**
 * The user-facing copy. Injected as a user-side `<system-reminder>` so it lands in the
 * transcript rather than the system prompt, which keeps it out of compaction and lets
 * the model treat it as current context instead of a standing rule.
 *
 * The two branches exist because the correct instruction is not the same when the repo
 * already uses worktrees. If it does, the agent can move on its own; if it does not,
 * creating a worktree is a decision the user makes.
 */
export function buildAutoWorktreeNotice(mainWorktreePath: string): string {
  const body = repoHasLinkedWorktrees(mainWorktreePath)
    ? [
        `This session is mutating the git main worktree at \`${mainWorktreePath}\`. Concurrent write/edit or git operations there can interfere with other agents or local changes.`,
        "",
        "This repo already uses worktrees. Isolate this task in a new worktree and switch into it before any further write or edit. You do not need to ask the user first.",
        "",
        "This rule is not limited to the path above. If you later start writing to another git repository that already uses worktrees, or run git mutations against its main worktree, isolate there the same way without asking.",
      ]
    : [
        `This session is mutating the git main worktree at \`${mainWorktreePath}\`. Concurrent write/edit or git operations there can interfere with other agents or local changes.`,
        "",
        "Do NOT create a worktree on your own. Before any further write or edit, ask the user whether they want an isolated worktree.",
        "",
        "If the user agrees, isolate this task in a new worktree and switch into it before continuing. If the user declines, continue with the original plan without creating a worktree.",
        "",
        "This rule is not limited to the path above. If you later start writing to another git repository, or run git mutations against another repo's main worktree, apply the same check there: ask the user before continuing in that main worktree.",
      ]
  return ["<system-reminder>", AUTO_WORKTREE_NOTICE_MARKER, "", ...body, "</system-reminder>"].join("\n")
}
