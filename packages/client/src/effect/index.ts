// TODO: Keep additional network capabilities inside Schema and Protocol as the client grows; /effect must never import
// Core or Server. Preserve these datatype exports so internal model reorganizations do not require caller migrations.
import type { Effect } from "effect"
import type { SleepyCode } from "./client.js"

export * from "./generated/index"
export { SleepyCode } from "./client.js"
export type {
  AgentApi,
  AppApi,
  CommandApi,
  ConfigApi,
  EventApi,
  IntegrationApi,
  ModelApi,
  PluginApi,
  ProviderApi,
  ReferenceApi,
  RpcApi,
  RpcClient,
  WebSearchApi,
  SessionApi,
  SkillApi,
} from "./api.js"
export { Agent } from "@sleepy-ai/schema/agent"
export { Command } from "@sleepy-ai/schema/command"
export { Config } from "@sleepy-ai/schema/config"
export { Credential } from "@sleepy-ai/schema/credential"
export { Event } from "@sleepy-ai/schema/event"
export { EventLog } from "@sleepy-ai/schema/event-log"
export { FileSystem } from "@sleepy-ai/schema/filesystem"
export { Form } from "@sleepy-ai/schema/form"
export { Integration } from "@sleepy-ai/schema/integration"
export { Location } from "@sleepy-ai/schema/location"
export { Model } from "@sleepy-ai/schema/model"
export { Permission } from "@sleepy-ai/schema/permission"
export { PermissionSaved } from "@sleepy-ai/schema/permission-saved"
export { Project } from "@sleepy-ai/schema/project"
export { Worktree } from "@sleepy-ai/schema/worktree"
export { Vcs } from "@sleepy-ai/schema/vcs"
export { Provider } from "@sleepy-ai/schema/provider"
export { Pty } from "@sleepy-ai/schema/pty"
export { Question } from "@sleepy-ai/schema/question"
export { Reference } from "@sleepy-ai/schema/reference"
export { WebSearch } from "@sleepy-ai/schema/websearch"
export { AbsolutePath, RelativePath } from "@sleepy-ai/schema/schema"
export { Session } from "@sleepy-ai/schema/session"
export { SessionInbox } from "@sleepy-ai/schema/session-inbox"
export { SessionMessage } from "@sleepy-ai/schema/session-message"
export { Skill } from "@sleepy-ai/schema/skill"
export { Prompt } from "@sleepy-ai/schema/prompt"
export { PromptInput } from "@sleepy-ai/schema/prompt-input"
export type { SleepyCodeEvent } from "@sleepy-ai/protocol/groups/event"
export type SleepyCodeClient = Effect.Success<ReturnType<typeof SleepyCode.make>>
