export * as IsolatedGitGuard from "./isolated-git-guard.js"
import { Effect } from "effect"
import { existsSync, realpathSync } from "node:fs"
import path from "path"
import { FSUtil } from "@sleepy-ai/util/fs-util"
import { Global } from "@sleepy-ai/util/global"
import { containsDirectory } from "@sleepy-ai/util/path"

/**
 * Cross-branch git guard for ISOLATED CHILD sessions.
 *
 * An isolated child runs in an app-managed git worktree under `<data>/worktree/<projectID>/<name>`.
 * Every worktree of a repository shares ONE ref store (`--git-common-dir`), so a git command run
 * from inside the child's worktree can write refs that other checkouts depend on.
 *
 * WHAT ACTUALLY REACHES ACROSS — measured, not assumed: `git update-ref`, `git symbolic-ref` and
 * `git tag -f` all SUCCEED from a linked worktree with no warning, and `git push` writes the
 * REMOTE irreversibly. `git checkout <branch>` and `git branch -f <branch>` are refused by git
 * itself, so this module is only a second line there.
 *
 * ONE THING THAT IS NOT A HAZARD: `git rebase main` rebases the CURRENT branch onto main and does
 * not move main — so its rejection below is a deliberate strictness choice, not a git fact.
 *
 * The orchestrator prompt already tells the orchestrator and ordinary sessions; this module only
 * gates the orchestrator and ordinary sessions' CHILDREN. Legitimately gated commands are rare.
 */

/** git global options that consume the FOLLOWING token as their value. */
const GLOBAL_WITH_VALUE = new Set([
  "-C",
  "-c",
  "--git-dir",
  "--work-tree",
  "--namespace",
  "--exec-path",
  "--config-env",
  "--super-prefix",
])

/** Flags that make `rebase`/`merge` operate on an ALREADY IN-PROGRESS operation in this worktree only. */
const IN_PROGRESS = new Set(["--abort", "--continue", "--skip", "--quit", "--edit-todo", "--show-current-patch"])

/** `git branch` flags that delete, force-move or rename a ref. */
const BRANCH_MUTATE = new Set(["-d", "-D", "--delete", "-f", "--force", "-m", "-M", "--move"])

/** `git worktree` subcommands that write the shared worktree registry. */
const WORKTREE_MUTATE = new Set(["add", "remove", "move", "prune", "repair", "lock", "unlock"])

export type Violation = {
  /** The single command that was rejected, as written. */
  command: string
  /** Short human reason, e.g. "git rebase rewrites shared refs". */
  reason: string
}

function unquote(text: string) {
  if (text.length < 2) return text
  const first = text[0]
  if ((first === '"' || first === "'") && first === text[text.length - 1]) return text.slice(1, -1)
  return text
}

/** Index of the first token that is not a git global option. */
function skipGlobals(argv: string[]) {
  let index = 1
  while (index < argv.length && argv[index].startsWith("-")) {
    index += GLOBAL_WITH_VALUE.has(argv[index]) ? 2 : 1
  }
  return index
}

/**
 * Splits a git argv into `{ sub, args }`, skipping git's global options so
 * `git --no-pager -C /elsewhere rebase main` is still seen as `rebase`.
 * Returns undefined when the command is not git or has no subcommand.
 */
function gitInvocation(tokens: string[]) {
  const argv = tokens.map(unquote).filter((token) => token.length > 0)
  if (argv.length < 2) return
  const head = path.basename(argv[0]).toLowerCase()
  if (head !== "git" && head !== "git.exe") return
  const index = skipGlobals(argv)
  if (index >= argv.length) return
  return { sub: argv[index], args: argv.slice(index + 1) }
}

/** Positional (non-flag) arguments. A bare `-` is positional: `git checkout -` returns to the previous branch. */
function positionals(args: string[]) {
  return args.filter((arg) => arg === "-" || !arg.startsWith("-"))
}

function valueOf(args: string[], flags: Set<string>) {
  return args.flatMap((arg, index) =>
    [...flags].flatMap((flag) => {
      if (arg === flag) return [args[index + 1]]
      if (arg.startsWith(`${flag}=`)) return [arg.slice(flag.length + 1)]
      return []
    }),
  )[0]
}

/** Normalizes a push refspec to the branch name it WRITES on the remote. */
function pushTarget(refspec: string) {
  const spec = refspec.startsWith("+") ? refspec.slice(1) : refspec
  const colon = spec.lastIndexOf(":")
  const dst = colon === -1 ? spec : spec.slice(colon + 1)
  return dst.replace(/^refs\/heads\//, "")
}

/**
 * Decides whether a single git invocation crosses the isolated child's branch
 * boundary. Pure: `isPath` is injected so the caller owns filesystem access.
 * `branch` is the child's own branch (undefined when it could not be read —
 * ownership-sensitive rules then fail closed, which is safe because those forms
 * are destructive and a child never needs them).
 */
export function violates(input: { tokens: string[]; branch?: string; isPath?: (arg: string) => boolean }) {
  const git = gitInvocation(input.tokens)
  if (!git) return
  const args = git.args
  const sub = git.sub
  const branch = input.branch
  const isPath = input.isPath ?? (() => false)
  const owns = (name: string) => Boolean(branch) && (name === branch || name === "HEAD")

  if (sub === "rebase" || sub === "merge") {
    if (args.some((arg) => IN_PROGRESS.has(arg))) return
    if (sub === "rebase") return "`git rebase` rewrites history against another branch and writes the shared ref store"
    return "`git merge` integrates another branch — integration is the orchestrator's job"
  }

  if (sub === "checkout" || sub === "switch") {
    // With `--`, or with 2+ positionals, git restores FILES from a tree-ish and never moves HEAD.
    if (args.includes("--")) return
    const pos = positionals(args)
    if (pos.length !== 1) {
      if (args.includes("--detach")) return "`--detach` moves this worktree's HEAD off its own branch"
      return
    }
    // Creating a brand-new branch is the child's own ref: allowed.
    if (valueOf(args, new Set(["-b", "-c", "--orphan"])) !== undefined) return
    const forced = valueOf(args, new Set(["-B", "-C"]))
    if (forced !== undefined) {
      if (owns(forced)) return
      return `\`git ${sub}\` force-creating '${forced}' resets a branch this session does not own`
    }
    const target = pos[0]
    if (isPath(target)) return
    if (owns(target)) return
    return `switching this worktree to '${target}' moves a ref/HEAD in the shared ref store`
  }

  if (sub === "branch") {
    if (!args.some((arg) => BRANCH_MUTATE.has(arg))) return
    const pos = positionals(args)
    if (pos.length > 0 && pos.every((name) => owns(name))) return
    return "deleting, force-moving or renaming a branch mutates the shared ref store"
  }

  if (sub === "push") {
    const specs = positionals(args).slice(1)
    const forced = args.includes("--force") || args.includes("-f") || specs.some((spec) => spec.startsWith("+"))
    const deleting = args.includes("--delete") || specs.some((spec) => spec.startsWith(":"))
    if (!forced && !deleting) return
    // No refspec ⇒ the current (own) branch.
    if (specs.length === 0) return
    const foreign = specs.map(pushTarget).filter((name) => !owns(name))
    if (foreign.length === 0) return
    return `force-pushing or deleting '${foreign[0]}' rewrites a branch this session does not own`
  }

  if (sub === "worktree") {
    const pos = positionals(args)
    if (pos.length === 0 || !WORKTREE_MUTATE.has(pos[0])) return
    return `\`git worktree ${pos[0]}\` mutates the shared worktree registry`
  }

  if (sub === "update-ref") {
    const ref = (positionals(args)[0] ?? "").replace(/^refs\/heads\//, "")
    if (owns(ref)) return
    return "`git update-ref` writes the shared ref store directly"
  }

  if (sub === "symbolic-ref") {
    // One positional is a READ (`git symbolic-ref HEAD`); two is a write.
    if (positionals(args).length < 2 && !args.includes("--delete") && !args.includes("-d")) return
    return "`git symbolic-ref` repoints HEAD in the shared ref store"
  }

  if (sub === "tag") {
    // Tags live in the shared ref store and carry NO "already checked out by another worktree"
    // protection, so a force-update from here silently moves a tag the parent checkout resolves.
    if (args.includes("-f") || args.includes("--force")) return "`git tag -f` moves a shared tag"
    if (args.includes("-d") || args.includes("--delete")) return "`git tag -d` deletes a shared tag"
    return
  }
}

function real(target: string) {
  return existsSync(target) ? realpathSync(target) : path.resolve(target)
}

/**
 * True when `directory` is one of the app-managed worktrees that back an isolated child session
 * (`<data>/worktree/<projectID>/<name>`). The orchestrator and ordinary sessions run in the user's
 * project directory and are therefore never gated. Compares realpaths too, because a symlinked
 * prefix (macOS `/var` → `/private/var`) defeats a raw string-prefix test.
 */
export const isIsolatedWorktree = Effect.fn("IsolatedGitGuard.isIsolatedWorktree")(function* (
  directory: string | undefined,
  root?: string,
) {
  if (!directory) return false
  const global = yield* Global.Service
  const base = root ?? path.join(global.data, "worktree")
  if (containsDirectory(base, directory)) return true
  return containsDirectory(real(base), real(directory))
})

/**
 * Best-effort read of the branch a worktree is on, without spawning git.
 * `<worktree>/.git` is a file containing `gitdir: <repo>/.git/worktrees/<name>`, whose `HEAD`
 * holds `ref: refs/heads/<branch>`. Returns undefined on any surprise (detached HEAD,
 * unreadable, plain clone layout is handled too).
 */
export const ownBranch = Effect.fn("IsolatedGitGuard.ownBranch")(function* (directory: string) {
  const fs = yield* FSUtil.Service
  const dotGit = path.join(directory, ".git")
  const pointer = yield* fs.readFileStringSafe(dotGit)
  const target = pointer?.match(/^gitdir:\s*(.+)$/m)?.[1]?.trim()
  const head = yield* fs.readFileStringSafe(path.join(target ? path.resolve(directory, target) : dotGit, "HEAD"))
  return head?.trim().match(/^ref:\s*refs\/heads\/(.+)$/)?.[1]
})

function message(input: { violation: Violation; directory: string; branch?: string }) {
  const branch = input.branch ?? "(could not be determined)"
  return (
    `Blocked in an isolated child session: ${input.violation.command}\n` +
    `Reason: ${input.violation.reason}.\n\n` +
    `Every worktree of this repository shares ONE .git/ ref store, so a cross-branch git\n` +
    `operation run from inside your worktree writes refs the MAIN checkout is using and can\n` +
    `move its HEAD — corrupting the working tree the user and other agents are in right now.\n\n` +
    `  your worktree: ${input.directory}\n` +
    `  your branch:   ${branch}\n\n` +
    `Do this instead:\n` +
    `  - work only in your worktree, on your own branch\n` +
    `  - \`git add\` + \`git commit\` + \`git push\` YOUR branch, and nothing else\n` +
    `  - ask the orchestrator to rebase/merge/land it — cross-branch integration is its job\n`
  )
}

/**
 * The gate. Throws (loudly, with remediation) when any command in a bash invocation crosses the
 * isolated child's branch boundary. No-ops when the session is not an isolated child.
 */
export function assertIsolatedGitAllowed(input: {
  /** argv of every command node in the parsed invocation (pipelines, `&&` chains and subshells
   *  each contribute one entry). */
  commands: string[][]
  /** Rendered source of each command, index-aligned with `commands`; used only for the error text. */
  sources?: string[]
  directory: string
  isolated: boolean
  branch?: string
  isPath?: (arg: string) => boolean
}) {
  if (!input.isolated) return
  const hit = input.commands
    .map((tokens, index) => ({
      tokens,
      index,
      reason: violates({ tokens, branch: input.branch, isPath: input.isPath }),
    }))
    .find((candidate) => candidate.reason !== undefined)
  if (!hit?.reason) return
  throw new Error(
    message({
      violation: { command: input.sources?.[hit.index] ?? hit.tokens.join(" "), reason: hit.reason },
      directory: input.directory,
      branch: input.branch,
    }),
  )
}
