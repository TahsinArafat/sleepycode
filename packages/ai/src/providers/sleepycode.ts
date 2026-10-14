import { HttpOptions, ProviderID, type ModelID } from "../schema/index.js"
import { AuthOptions, type ProviderAuthOption } from "../route/auth-options.js"
import { SystemOne } from "../experimental/system-one.js"

export const id = ProviderID.make("sleepycode")
const baseURL = "https://opencode.ai/inference/v1"

export type Options = ProviderAuthOption<"optional"> & {
  readonly baseURL?: string
  readonly headers?: Record<string, string>
  readonly http?: HttpOptions.Input
}

export const configure = (input: Options = {}) => {
  const evaluation = (modelID: string | ModelID) =>
    SystemOne.model({
      id: modelID,
      provider: id,
      providerMetadataKey: "sleepycode",
      auth: AuthOptions.bearer(input, "SLEEPYCODE_API_KEY"),
      baseURL: input.baseURL ?? baseURL,
      headers: input.headers,
      http: HttpOptions.make(input.http),
    })
  return { id, experimental: { evaluation }, configure }
}

export const provider = configure()
export const experimental = provider.experimental

export * as SleepyCode from "./sleepycode.js"
