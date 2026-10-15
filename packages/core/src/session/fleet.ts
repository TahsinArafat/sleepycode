export * as Fleet from "./fleet.js"

/**
 * Fleet observability: a single structured view of an orchestrator's children — each session
 * correlated to (a) its liveness and turn telemetry, and (b) the git worktree backing it
 * (dir + branch + commits-ahead) for isolated children. The worktree/branch mapping was
 * previously invisible, and liveness was a flat text dump.
 *
 * `renderFleetTable` is PURE (no Effect, no git, no clock) so it is testable in isolation.
 */

export type Liveness = "progressing" | "stalled" | "success" | "failure" | "cancelled" | "idle"

/** A single child session as the caller sees it before correlation. */
export type FleetSession = {
  id: string
  title: string
  directory: string
}

/** One parsed `git worktree list --porcelain` entry, canonicalized so it can be matched
 *  against a session's directory by exact string equality. */
export type WorktreeEntry = {
  /** Canonical (realpath-resolved, normalized) worktree directory. */
  directory: string
  /** Short branch name (refs/heads/ stripped), or undefined for a detached HEAD. */
  branch?: string
  /** Commits this worktree's branch is ahead of the repo's base — undefined when it could not
   *  be computed (non-git, detached, or rev-list failed). */
  ahead?: number
}

/** `bucketFor` on a running/pending row; idle/failed/cancelled are terminal. */
export type FleetBucket = "progressing" | "stalled" | "idle" | "failed" | "cancelled"

const BUCKET_ORDER: FleetBucket[] = ["progressing", "stalled", "idle", "failed", "cancelled"]

/** One fully-correlated row: session identity + liveness + turn telemetry + (optional)
 *  worktree mapping. */
export type FleetRow = {
  sessionID: string
  title: string
  mode: string
  bucket: FleetBucket
  liveness: Liveness
  status: string
  turnCount: number
  /** ms since anything last LANDED for this actor; undefined when there is no actor row. Not the
   *  step clock — the field name means what it says, and it is the quantity the liveness above was
   *  derived from. */
  lastActivityMs?: number
  /** Worktree correlation — present only for isolated children whose directory matched a
   *  `git worktree list` entry. */
  worktreeDir?: string
  branch?: string
  ahead?: number
}

export type FleetSummary = {
  total: number
  counts: Record<FleetBucket, number>
  rows: FleetRow[]
}

export function bucketFor(liveness: Liveness): FleetBucket {
  if (liveness === "progressing") return "progressing"
  if (liveness === "stalled") return "stalled"
  if (liveness === "failure") return "failed"
  if (liveness === "cancelled") return "cancelled"
  return "idle"
}

/** Compact human age: "-" when unknown, "<Ns>" under a minute, else "<Nm>"/"<Nh>". */
function ageOf(ms: number | undefined): string {
  if (ms === undefined) return "-"
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s`
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m`
  return `${Math.floor(ms / 3_600_000)}h`
}

/** A short worktree cell: "branch (+N) @ dir" for isolated children, "shared" otherwise. Kept as
 *  one column so the table stays narrow in a terminal. */
function worktreeCell(row: FleetRow): string {
  if (!row.worktreeDir) return "shared"
  const ahead = row.ahead === undefined ? "" : ` (+${row.ahead})`
  return `${row.branch ?? "detached"}${ahead} @ ${row.worktreeDir}`
}

const HEADINGS: Record<FleetBucket, string> = {
  progressing: "In progress — progressing (advancing)",
  stalled: "In progress — stalled (no recent activity)",
  idle: "Finished / idle",
  failed: "Failed",
  cancelled: "Cancelled",
}

/** Render the fleet summary as a grouped, column-aligned text table. Pure over the summary.
 *  One block per non-empty bucket; each row shows session id, liveness+age, turns, mode,
 *  worktree mapping, and title. Rows are grouped in a fixed order (progressing → stalled → idle →
 *  failed → cancelled) so the table reads top-down from most-active to terminal. */
export function renderFleetTable(summary: FleetSummary): string {
  if (summary.total === 0) return "No child sessions."

  const c = summary.counts
  const summaryLine =
    `Fleet: ${summary.total} total — ${c.progressing + c.stalled} running ` +
    `(${c.progressing} progressing, ${c.stalled} stalled), ${c.idle} idle` +
    (c.failed > 0 ? `, ${c.failed} failed` : "") +
    (c.cancelled > 0 ? `, ${c.cancelled} cancelled` : "")

  const cols = ["SESSION", "LIVENESS", "AGE", "TURNS", "MODE", "WORKTREE", "TITLE"]
  const allRows = summary.rows.map((row) => [
    row.sessionID,
    row.liveness,
    ageOf(row.lastActivityMs),
    String(row.turnCount),
    row.mode,
    worktreeCell(row),
    row.title,
  ])

  // Column widths sized across ALL rows so blocks align with each other.
  const widths = cols.map((heading, index) => Math.max(heading.length, ...allRows.map((row) => row[index].length)))
  const pad = (cells: string[]) =>
    cells
      .map((cell, index) => cell.padEnd(widths[index]))
      .join("  ")
      .trimEnd()

  const blocks = BUCKET_ORDER.filter((bucket) => c[bucket] > 0).map((bucket) => {
    const body = summary.rows
      .map((row, index) => ({ row, cells: allRows[index] }))
      .filter((entry) => entry.row.bucket === bucket)
      .map((entry) => "  " + pad(entry.cells))
    return `${HEADINGS[bucket]} (${c[bucket]}):\n${body.join("\n")}`
  })

  return [summaryLine, "", "  " + pad(cols), ...blocks].join("\n")
}
