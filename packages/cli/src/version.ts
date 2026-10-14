import { Option, Schema } from "effect"

declare const SLEEPYCODE_VERSION: string
declare const SLEEPYCODE_CHANNEL: string
declare const SLEEPYCODE_ARTIFACT: string
declare const SLEEPYCODE_RELEASE_HIGHLIGHTS: string

const version = typeof SLEEPYCODE_VERSION === "string" ? SLEEPYCODE_VERSION : "local"
const channel = typeof SLEEPYCODE_CHANNEL === "string" ? SLEEPYCODE_CHANNEL : "local"
const artifact = typeof SLEEPYCODE_ARTIFACT === "string" ? SLEEPYCODE_ARTIFACT : "cli"
// Stable release builds embed the release notes' Highlights; every other build has none.
const highlights =
  typeof SLEEPYCODE_RELEASE_HIGHLIGHTS === "string"
    ? Option.getOrElse(
        Schema.decodeUnknownOption(
          Schema.fromJsonString(Schema.Array(Schema.Struct({ title: Schema.String, body: Schema.String }))),
        )(SLEEPYCODE_RELEASE_HIGHLIGHTS),
        () => [],
      )
    : []

export {
  version as SLEEPYCODE_VERSION,
  channel as SLEEPYCODE_CHANNEL,
  artifact as SLEEPYCODE_ARTIFACT,
  highlights as SLEEPYCODE_HIGHLIGHTS,
}
export const SLEEPYCODE_LOCAL = channel === "local"
