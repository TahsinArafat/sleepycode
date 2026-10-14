import { $ } from "bun"
import semver from "semver"
import path from "path"

const rootPkgPath = path.resolve(import.meta.dir, "../../../package.json")
const rootPkg = await Bun.file(rootPkgPath).json()
const expectedBunVersion = rootPkg.packageManager?.split("@")[1]

if (!expectedBunVersion) {
  throw new Error("packageManager field not found in root package.json")
}

// relax version requirement
const expectedBunVersionRange = `^${expectedBunVersion}`

if (!semver.satisfies(process.versions.bun, expectedBunVersionRange)) {
  throw new Error(`This script requires bun@${expectedBunVersionRange}, but you are using bun@${process.versions.bun}`)
}

const env = {
  SLEEPYCODE_CHANNEL: process.env["SLEEPYCODE_CHANNEL"],
  SLEEPYCODE_BUMP: process.env["SLEEPYCODE_BUMP"],
  SLEEPYCODE_VERSION: process.env["SLEEPYCODE_VERSION"],
  SLEEPYCODE_RELEASE: process.env["SLEEPYCODE_RELEASE"],
}
const CHANNEL = await (async () => {
  if (env.SLEEPYCODE_CHANNEL) return env.SLEEPYCODE_CHANNEL
  if (env.SLEEPYCODE_BUMP) return "latest"
  if (env.SLEEPYCODE_VERSION && !env.SLEEPYCODE_VERSION.startsWith("0.0.0-")) return "latest"
  const branch = await $`git branch --show-current`.text().then((x) => x.trim())
  if (!branch) return "detached"
  const channel = branch.replace(/[^a-zA-Z0-9._-]/g, "-")
  if (/^[a-zA-Z0-9]/.test(channel)) return channel
  return `branch-${channel}`
})()
const IS_PREVIEW = CHANNEL !== "latest"

const VERSION = await (async () => {
  if (env.SLEEPYCODE_VERSION) return env.SLEEPYCODE_VERSION
  if (IS_PREVIEW) return `0.0.0-${CHANNEL}-${previewBuildNumber()}`
  const version = await fetch("https://registry.npmjs.org/@sleepycode%2fcli/latest")
    .then((res) => {
      if (!res.ok) throw new Error(res.statusText)
      return res.json()
    })
    .then((data: any) => data.version)
  if (semver.lt(version, "2.0.0")) return "2.0.0"
  const [major, minor, patch] = version.split(".").map((x: string) => Number(x) || 0)
  const t = env.SLEEPYCODE_BUMP?.toLowerCase()
  if (t === "major") return `${major + 1}.0.0`
  if (t === "minor") return `${major}.${minor + 1}.0`
  return `${major}.${minor}.${patch + 1}`
})()

function previewBuildNumber() {
  const runNumber = process.env["GITHUB_RUN_NUMBER"]
  if (!runNumber) return new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "")
  const runAttempt = process.env["GITHUB_RUN_ATTEMPT"]
  if (runAttempt && runAttempt !== "1") return `${runNumber}.${runAttempt}`
  return runNumber
}

const bot = ["actions-user", "sleepycode", "sleepycode-agent[bot]"]
const teamPath = path.resolve(import.meta.dir, "../../../.github/TEAM_MEMBERS")
const team = [
  ...(await Bun.file(teamPath)
    .text()
    .then((x) => x.split(/\r?\n/).map((x) => x.trim()))
    .then((x) => x.filter((x) => x && !x.startsWith("#")))),
  ...bot,
]

export const Script = {
  get channel() {
    return CHANNEL
  },
  get version() {
    return VERSION
  },
  get preview() {
    return IS_PREVIEW
  },
  get release(): boolean {
    return !!env.SLEEPYCODE_RELEASE
  },
  get team() {
    return team
  },
}
console.log(`sleepycode script`, JSON.stringify(Script, null, 2))
