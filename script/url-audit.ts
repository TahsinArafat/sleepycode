#!/usr/bin/env bun
/**
 * Report upstream URLs that no decision covers.
 *
 * `apply-branding` rewrites identifiers and cannot touch a URL: `opencode.ai` is in PROTECT
 * as a whole host, because some of its endpoints genuinely belong to upstream (the
 * model-metadata service, the SystemOne inference endpoint). That blanket shield is what let
 * 590 files keep pointing at upstream while the rebrand reported zero rewrites.
 *
 * The gap is not the shield, it is that PROTECT cannot express "leave this one" as distinct
 * from "we have not looked at this one yet". `INTENTIONALLY_UPSTREAM` in ./lib/branding holds
 * the signed-off ones with a reason each; this script prints everything else, so the next
 * upstream sync sees a new endpoint instead of silently inheriting it.
 *
 * Usage: bun run script/url-audit.ts
 *        bun run script/url-audit.ts --runtime   # shipped-runtime paths only
 *
 * Exit code is 1 when anything is unclassified in the shipped runtime, so it can gate.
 */

import { unclassifiedUpstreamUrls, shouldSkipContent } from "./lib/branding"

const TEXT = /\.(ts|tsx|js|jsx|mjs|cjs|json|jsonc|md|mdx|astro|txt|yml|yaml|sh|toml)$/i
// Paths whose text reaches a user or a running process. Docs sites and deployment config are
// reported but do not gate: they are a deliberate follow-up, not a shipped-binary defect.
//
// `src/content`, `src/asset`, `src/assets` and `src/i18n` are content trees that happen to sit
// under `src/` in the web/app packages - bundled docs, translations and media, not code paths a
// binary executes. Without excluding them the gate fires on ~600 translated docs and is useless
// as a signal.
const RUNTIME =
  /^(packages\/(cli|core|tui|server|protocol|schema|ai|desktop|util|plugin|sdk)\/src\/|install$)/
const CONTENT = /(^|\/)(content|assets?|i18n)\//
// Tests are not shipped: a URL in a fixture is arbitrary input, and a test asserting URL
// handling is not a call a binary makes. Both spellings matter - a `test/` directory, and a
// `*.test.ts` colocated inside `src/`, which is where packages/desktop keeps its renderer
// tests and would otherwise pass for runtime.
const TESTS = /(^|\/)(test|tests|e2e|fixture|fixtures)\/|\.(test|spec)\.[cm]?[jt]sx?$/

const isRuntime = (file: string) => RUNTIME.test(file) && !CONTENT.test(file) && !TESTS.test(file)

const runtimeOnly = process.argv.includes("--runtime")

const listed = await Bun.$`git ls-files`.text()
const files = listed
  .split("\n")
  .filter(Boolean)
  .filter((file) => !shouldSkipContent(file))
  .filter((file) => TEXT.test(file))

const owners = new Map<string, string[]>()
for (const file of files) {
  const text = await Bun.file(file)
    .text()
    .catch(() => undefined)
  if (text === undefined) continue
  for (const found of unclassifiedUpstreamUrls(text)) {
    const url = found.slice(0, found.lastIndexOf(" ("))
    const where = owners.get(url) ?? []
    where.push(file)
    owners.set(url, where)
  }
}

const rows = [...owners.entries()]
  .filter(([, where]) => !runtimeOnly || where.some(isRuntime))
  .sort((a, b) => b[1].length - a[1].length)

console.log(`url-audit: scanned ${files.length} files, ${owners.size} unclassified upstream URLs`)
console.log(`add a decision to INTENTIONALLY_UPSTREAM in script/lib/branding.ts, or repoint it.`)
console.log()
for (const [url, where] of rows) {
  const runtime = where.some(isRuntime)
  console.log(`${runtime ? "RUNTIME" : "other  "} ${String(where.length).padStart(4)}  ${url}`)
  console.log(`                 e.g. ${where[0]}`)
}

const gating = [...owners.entries()].filter(([, where]) => where.some(isRuntime))
if (gating.length > 0) {
  console.log(`\n${gating.length} unclassified URL(s) in shipped-runtime paths.`)
  process.exit(1)
}
