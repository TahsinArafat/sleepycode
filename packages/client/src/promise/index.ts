import type { SleepyCode } from "./client.js"

export * from "./generated/index.js"
export { SleepyCode } from "./client.js"
export type {
  AgentApi,
  CommandApi,
  ConfigApi,
  EventApi,
  IntegrationApi,
  ModelApi,
  PluginApi,
  ProviderApi,
  ReferenceApi,
  RpcApi,
  RpcCallOptions,
  RpcClient,
  RpcEventPayload,
  WebSearchApi,
  SessionApi,
  SkillApi,
} from "./api.js"
export type { EventSubscribeOutput as SleepyCodeEvent } from "./generated/types.js"
export type SleepyCodeClient = ReturnType<typeof SleepyCode.make>
