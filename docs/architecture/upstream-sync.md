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
| `fork` | `github.com/TahsinArafat/sleepycode` | **Our fork of opencode.** Where `reparent/opencode-v2` lands. GitHub records its parent as `anomalyco/opencode`, so the fork network and the "Sync fork" button both apply. |
| `upstream` | `github.com/anomalyco/opencode` | **The parent we sync from.** `upstream/dev` is the trunk. |
| `origin` | `github.com/TahsinArafat/sleepy-code` | The **stable v1 fork**. Its history is MiMo-rooted, which shares no ancestor with opencode's. It holds the stable CLI and is untouched by this branch. |
| `mimo` | `github.com/XiaomiMiMo/MiMo-Code` | Ancestor we re-parented away from. Read-only archaeology. |

`origin` is deliberately **not** the push target: it is a fork of MiMo-Code, so pushing an
opencode-rooted branch into it uploads the entire opencode history into a repo whose recorded
parent is a different project — no fork network, and a repository holding two unrelated roots.
`fork` exists precisely so the fork relationship is the true one.

`upstream/main` does not exist — opencode's default branch is **`dev`**. `upstream/v1` does exist
and is the other release line; the fork deliberately does not track it.

`reparent/opencode-v2` tracks `fork/reparent/opencode-v2`, so a bare `git push` goes to our own
fork and can never be aimed at the parent by accident. Drift against the parent is therefore
asked for explicitly, and every command below does:

```bash
git rev-list --left-right --count HEAD...upstream/dev     # behind  ahead
```

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
cd packages/core && rm -rf node_modules/.ts-dist && bun typecheck
cd packages/core && bun test test/plugin/ test/integration.test.ts
```

The `rm -rf` is not optional — see the Cautions entry on the `tsgo` cache. That cache is also why
a per-package `bun typecheck` can report success it did not earn: `tsgo -b` short-circuits on an
up-to-date buildinfo. Use `bun typecheck --force` when you need the answer to be real.

**The canonical gate is `bun run check` from the repository root** — lint plus `turbo typecheck`
across all 40 packages. It is green on this branch at `c5e513e98e` (2.0.30), including the nine
`test/session-*.test.ts` files that used to report 255 Effect environment-union errors; that debt
was resolved upstream and the merge brought the fix with it. Do not reintroduce a per-package-only
gate: it is what let the inherited debt sit here unnoticed.

The known core baseline is **345 pass / 22 fail**, and the 22 are pre-existing: GitLab OAuth binding
port 8080, `PluginSupervisor` watcher/reload timing, and a plugin-loader transitive dependency.
**Any other failure is a regression.** `bun ci` installs; never `bun install`/`npm install`.

The TUI baseline at `c5e513e98e` is **1483 pass / 2 skip / 8 fail**, and all 8 are environment, not fork:
two `test/component/dialog-shell-output.test.tsx` cases need ~5.19 s against the default 5000 ms budget
(passes under `--timeout 30000`), and the six in `test/plugin-keymap.test.tsx` /
`test/plugin-source.test.ts` come from a local bun 1.3.14 throwing a non-`Error` `ResolveMessage` for a
legitimately absent optional plugin entrypoint, which `packages/plugin/src/host.ts` deliberately
rethrows. Do not weaken that guard or widen those timeouts to make them green.

The lockfile is the one file a sync may have to regenerate. Upstream's `bun.lock` merged cleanly
and `apply-branding` rewrote it with its integrity check intact, so it did not need one; when
upstream adds or removes a dependency, the branded lockfile cannot supply the new hashes and
`bun install --frozen-lockfile` will say so.

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

- **`bun typecheck` will lie to you unless you clear the incremental cache.** `tsgo -b` writes
  `packages/core/node_modules/.ts-dist/{source,tests}.tsbuildinfo` and treats an up-to-date
  cache as success. A poisoned or stale cache has already produced a false "clean" here. Run
  `rm -rf packages/core/node_modules/.ts-dist` before believing the result, and after any
  branch switch — the cache does not know which branch wrote it.
- **History is full — do not re-shallow it.** The clone was originally shallow, which is what
  made the first push fail: a shallow clone cannot send the ancestry a remote does not already
  have. `git fetch --unshallow upstream` fixed it and `git rev-parse --is-shallow-repository`
  now reports `false`. A shallow clone of an unrelated root cannot be pushed anywhere, so treat
  depth as load-bearing, not an optimisation to reclaim.
- **`script/.fork-delta-*.txt` are untracked caches, one set per checkout.** They are generated
  against whatever pair was passed last. Moving between branches without regenerating them makes
  `port-map` report against the wrong branch — that is the failure it throws on rather than
  silently answering from stale data.
- **Pass full refnames** to the scripts (`refs/remotes/upstream/dev`, not `upstream/dev`): a
  stray tag of the same name makes git resolve the wrong object.
- **Docs name two different things.** `refs/remotes/upstream/dev` is our local ref. Bare
  `opencode/dev` in prose means the branch *as it exists in the upstream project* and stays
  correct regardless of what we call our remote.
- **Pushes need `--no-verify` until bun is upgraded.** `.husky/pre-push` requires the
  `packageManager` version in root `package.json` (currently `bun@1.4.2`) while the machine has
  bun 1.3.14, so the hook aborts every push. `git push --no-verify fork reparent/opencode-v2`
  works; the hook's substantive half is `bun run check`, so run that yourself if you skip it.
  `bun upgrade` removes the workaround.
- **Kill stale daemons before live checks.** A `serve` process started before a change keeps
  serving the old code, and it is the most convincing way to "prove" a change did nothing.

## WitDiff

`witdiff.toml` at the repo root makes the tool *run* here at all. The load-bearing key is
`base_dependency_dirs = ["node_modules", "packages/util/node_modules"]`: WitDiff checks the base out into a
temporary worktree, and without those it dies on `Cannot find package 'effect'` before it attempts anything,
which surfaces as `base_control_failed` for every possible base. That is a missing dependency, not a
regression, and it is why a bare `witdiff verify` here says nothing about the branch.

It still cannot finish on this repository, for two independent reasons:

1. **`base_control` must be green before a proof is allowed.** A base run has to pass the base's own tests.
   So a fix whose test is *red* at the base — which is every fix this branch makes — is rejected before the
   transplant is even attempted. Only behaviour newly added on an already-green base is provable, and that
   is a small, artificial slice of what a sync does.
2. **The runner is `bun test` and the JavaScript classifier does not read bun's output.** A base run that
   fails on a real assertion is reported as `reason: unrecognized_failure_kind`,
   `failure_kind: "command_failure"`, even when the output plainly contains the failing test.

So the honest reading of `status: not_verified` here is *unsupported case*, not *pass* and not *regression*.
`test_source_unparsable` findings mean the structural test-weakening analysis was skipped for those files,
so integrity coverage is partial there too. The fix, if WitDiff support matters, is upstream in the
JavaScript classifier — not something this branch can configure around.

## Completed syncs

| Upstream head | Version | Commits merged | Shape of the merge |
| --- | --- | --- | --- |
| `3943b84ef0` | 2.0.29 | — | The re-parent base itself. |
| `c5e513e98e` | 2.0.30 | 82 | 254 conflicted paths, of which **3 were real fork edits**. |
| `50d4280dbd` | 2.0.30 | 2 | 3 conflicted paths, all branding-only, resolved mechanically. |

The 2.0.30 sync resolved like this, and it is the shape every sync after it should take:

- **`git checkout --theirs` + `apply-branding --write` for everything that is branding-only.**
  Taking upstream's blob and re-running the rebrander reproduces our file exactly, because our only
  delta on those paths *was* the rebrand. 251 of the 254 conflicts resolved that way with no
  judgement required.
- **Accept upstream's deletions.** Upstream retired the enterprise share app
  (`packages/enterprise/**`, `share.mdx`, `infra/enterprise.ts`) in favour of `infra/share.ts`.
  Those files were branding-only in our tree, so the merge deleted them; no reference to
  `packages/enterprise` survives anywhere in the repo.
- **Three hand-resolved files**: `packages/cli/package.json` (version 2.0.29 → 2.0.30),
  `packages/util/test/global.test.ts` (upstream's `TEMP`/native-`realpathSync` fixes on top of our
  `sleepy` directory expectations), and `packages/ai/src/providers/sleepycode.ts` (upstream's
  `systemone` inference endpoint).
- **`bun run generate` in `packages/client` afterwards.** The merge restores upstream's generated
  types, which do not know about the `server.sleepy` group we added. The `SleepyLogoutOutput` type
  is the canary: if it is missing from `packages/client/src/promise/generated/types.ts`, the client
  is stale.
- **Then run the TUI suite and treat a rebrand-shaped failure as a fork bug.** The 2.0.30 suite had
  30 failures. Four were fork debt: `packages/tui/src/theme/assets/v2/sleepycode.json` had drifted
  out of the upstream document shape (palette under `dark` instead of `light`, dropped `hue` scales);
  `INTEGRATION_PRIORITY` in `dialog-integration.tsx` still ranked `sleepycode` when the gateway
  provider id is `sleepy`; and two test artifacts were stale from the rebrand's longer identifiers —
  the `inline-tool-wrap` snapshot (72-column wrap point moved) and the session-tab marquee boundary,
  which is now derived from `marqueeCycleWidth(title)` rather than hardcoded.

### Classify conflicts against the merge base, not the new upstream

`fork-delta.ts` and `port-map.ts` measure our tree against the ref you pass them, so pointing them
at the **new** upstream makes them report every piece of *upstream's own* content change as our fork
logic. On the 2.0.30 sync that produced a list of 219 "REAL FORK" conflicts — 216 of them
translations and docs that differ only because upstream deleted the share feature.

Compare each conflicted path against the **merge base** instead:

```bash
BASE=$(git merge-base HEAD upstream/dev)
# ours is branding-only when rebrand($BASE:path) == $HEAD:path
```

Against the base, the 254 conflicts collapsed to 251 branding-only and 3 real edits. Any triage
that reads the new upstream's blob as "our side" over-counts the fork surface by an order of
magnitude, and makes a three-file merge look like a project.

## State at the wrap-up

`reparent/opencode-v2` is pushed and tracks **`fork/reparent/opencode-v2`** at
`github.com/TahsinArafat/sleepycode` — a real GitHub fork of `anomalyco/opencode`, so the fork
network and the "Sync fork" button apply. The clone is unshallowed (full history), and the
branding default now resolves to the `opencode` profile.

Landed on the branch, re-parented onto **opencode 2.0.30** and fully branded
(`apply-branding` finds zero files to rewrite on this branch):

- Base re-brand, Sleepy gateway provider (device OAuth, token refresh, API-key login,
  gateway-driven models, live reload on gateway-file change), global `sleepy` home/config discovery,
  TUI theme, built-in skills, agent personas, `login`/`doctor`/`init`, integration consolidation.
- Gateway config I/O owned by `packages/util/src/gateway.ts`; `sleepy logout` in the CLI and
  `POST /api/sleepy/logout` in the server both go through it.

Carried over but **not yet wired into the prompt pipeline** — the session guards are library
code today, not behaviour:

- `packages/core/src/session/{auto-worktree-hint,conflict-detection,isolated-git-guard,fleet}.ts`
  are ported and exported from `session.ts`. The auto-worktree notice copy is complete.
  **Still missing:** the injection site (the fork fires it from prompt assembly, gated on
  primary agent + no parent session), once-per-session tracking (the fork uses a
  `auto_worktree_hint_sent` session column that v2 does not have), and `fleet.assembleFleet`.
- Process-group interrupt on abort in the shell tool: aborting a foreground command can still
  orphan grandchildren.
- Tests for `login`/`doctor`/`init` beyond the `logout` round-trip that already exists in
  `packages/cli/test`, the Claude Code shim, a per-plugin judgement on `todo`/`think`/`lsp`, and
  release plumbing (`bin/sleepy`, `.npmrc`, README, publish workflow).
