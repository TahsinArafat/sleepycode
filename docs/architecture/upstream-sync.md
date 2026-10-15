# Syncing `reparent/opencode-v2` with upstream

> **Purpose.** The re-parent is finished; the fork is now a *living* fork of `anomalyco/opencode`.
> This file is the loop for pulling upstream forward without re-litigating the port.
> Read `reparent-target.md` for why `dev` and not `v1`, and `fork-port-manifest.md` for the
> original Tier 1–5 triage and the field notes taken from the stable fork.

## Remote layout

Re-parenting onto opencode means opencode finally occupies the conventional slot. Nothing but
the names changed; the URLs are the ones the repo already had.

| Remote | URL | Role |
| --- | --- | --- |
| `origin` | `github.com/TahsinArafat/sleepy-code` | **Our fork.** Where finished work lands. |
| `upstream` | `github.com/anomalyco/opencode` | **The parent we sync from.** `upstream/dev` is the trunk. |
| `mimo` | `github.com/XiaomiMiMo/MiMo-Code` | Ancestor we re-parented away from. Read-only archaeology. |

`upstream/main` does not exist — opencode's default branch is **`dev`**. `upstream/v1` does exist
and is the other release line; the fork deliberately does not track it.

`reparent/opencode-v2` tracks `upstream/dev`, so `git status` reports ahead/behind against the
parent with no extra configuration.

## The loop

```bash
git fetch upstream --prune
git rev-list --left-right --count HEAD...upstream/dev     # behind   ahead

# What will it cost? Refuses to guess: walks both trees, reports per-file.
bun run script/port-map.ts refs/remotes/upstream/dev --ours=HEAD

# What is actually ours? Writes script/.fork-delta-*.txt (untracked, per-checkout).
bun run script/fork-delta.ts refs/remotes/upstream/dev HEAD

git merge upstream/dev
```

`port-map --ours=HEAD` is the decision instrument: it reports, in **lines**, the cost to
reconcile our tree onto upstream's and the cost to hand-port the files only upstream has. A
sync whose reconcile cost is a few hundred lines is an afternoon; one in the thousands is a
project, and the right response is a smaller merge, not a bigger effort.

### Merge, do not rebase

The branch is 25 commits deep and every one of them is a *decision*, not a copy. A rebase
replays each onto a moved base one at a time, so a single upstream refactor can surface the
same conflict five times and force five judgement calls with less context each round. A merge
resolves each contested file **once**. The commit graph is noisier afterwards; that is a price
worth paying for a single pass over each conflict.

### Then re-apply branding

Upstream will keep adding files that carry its name. The substitution is mechanical and the
script refuses to guess: it renames paths, rewrites bytes, and will not reformat, will not
touch a file with no token in it, and will not skip a file it could not read (a rebrand that
silently drops a file is worse than none, because every later diff is measured against a base
nobody has).

```bash
bun run script/apply-branding.ts                          # dry run, profile=opencode by default
bun run script/apply-branding.ts --write                  # apply
```

Two failure modes are refused rather than reported: a **collision** (two paths mapping to one
is a silent build break, so it is checked before anything is written) and a **binary decoded as
text**. `script/lib/branding.ts` defaults its active profile to `opencode` on this branch — the
old `mimo` default belonged to the parent we left. `SLEEPYCODE_UPSTREAM=<id>` overrides it.

### Verification gate

A sync is not done until it passes. Run these from the package directories, never the repo root:

```bash
cd packages/core && bun typecheck
cd packages/core && bun test test/plugin/ test/integration.test.ts
```

The known baseline is **345 pass / 22 fail**, and the 22 are pre-existing: GitLab OAuth binding
port 8080, `PluginSupervisor` watcher/reload timing, and a plugin-loader transitive dependency.
**Any other failure is a regression.** `bun ci` installs; never `bun install`/`npm install`, and
never let a sync rewrite the lockfile.

## What is ours

`fork-delta.ts` answer, at the re-parent point: of ~8 600 files, **122 exist only in the fork**.
Everything else must be either byte-identical to upstream or exactly `rebrand(upstream blob)`.
A file that is neither is fork logic, and fork logic is what conflicts.

That rule is the whole maintenance strategy: **keep the branded-but-otherwise-untouched surface
as large as possible.** Every file we edit *and* brand is a file that can conflict; a file we
only brand can never conflict, because the next `apply-branding` regenerates it.

So when adding fork behaviour on top of an upstream file, prefer a new file registered from ours
over an edit to theirs. Where an edit is unavoidable, keep it in one contiguous block with a
`// sleepy:` marker and its reason, so the next merge has something to reconcile against.

## Cautions

- **The clone is shallow.** History and blame are truncated; `git fetch --unshallow upstream`
  restores them at a real cost in disk. Depth does not affect merging, so unshallow only when
  you actually need archaeology.
- **`script/.fork-delta-*.txt` are untracked caches, one set per checkout.** They are generated
  against whatever pair was passed last. Moving between branches without regenerating them makes
  `port-map` report against the wrong branch — that is the failure it throws on rather than
  silently answering from stale data.
- **Pass full refnames** to the scripts (`refs/remotes/upstream/dev`, not `upstream/dev`): a
  stray tag of the same name makes git resolve the wrong object.
- **Docs name two different things.** `refs/remotes/upstream/dev` is our local ref. Bare
  `opencode/dev` in prose means the branch *as it exists in the upstream project* and stays
  correct regardless of what we call our remote.
- **Kill stale daemons before live checks.** A `serve` process started before a change keeps
  serving the old code, and it is the most convincing way to "prove" a change did nothing.

## State at the wrap-up

Landed on `reparent/opencode-v2`, re-parented onto **opencode 2.0.29** and fully branded
(`apply-branding` finds zero files to rewrite on this branch):

- Base re-brand, Sleepy gateway provider (device OAuth, token refresh, API-key login,
  gateway-driven models), global `sleepy` home/config discovery, TUI theme, three built-in
  skills, five agent personas, `login`/`doctor`/`init`, integration consolidation.

Carried over but **not yet wired into the prompt pipeline** — the session guards are library
code today, not behaviour:

- `packages/core/src/session/{auto-worktree-hint,conflict-detection,isolated-git-guard,fleet}.ts`
  are ported and exported from `session.ts`. The auto-worktree notice copy is complete.
  **Still missing:** the injection site (the fork fires it from prompt assembly, gated on
  primary agent + no parent session), once-per-session tracking (the fork uses a
  `auto_worktree_hint_sent` session column that v2 does not have), and `fleet.assembleFleet`.
- Process-group interrupt on abort in the shell tool: aborting a foreground command can still
  orphan grandchildren.
- Tests for `login`/`doctor`/`init` (v2 has no `packages/cli/test`), the Claude Code shim, a
  per-plugin judgement on `todo`/`think`/`lsp`, and release plumbing (`bin/sleepy`, `.npmrc`,
  README, publish workflow).
