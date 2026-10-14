import { NodeFileSystem } from "@effect/platform-node"
import { compile, emitEffectImported, emitEffectShape, emitPromise, write } from "@sleepy-ai/httpapi-codegen"
import { ClientApi, effectOmitEndpoints, groupNames, promiseOmitEndpoints } from "@sleepy-ai/protocol/client"
import { Agent } from "@sleepy-ai/schema/agent"
import { Command } from "@sleepy-ai/schema/command"
import { Config } from "@sleepy-ai/schema/config"
import { Credential } from "@sleepy-ai/schema/credential"
import { Event } from "@sleepy-ai/schema/event"
import { EventLog } from "@sleepy-ai/schema/event-log"
import { FileDiff } from "@sleepy-ai/schema/file-diff"
import { FileSystem } from "@sleepy-ai/schema/filesystem"
import { Form } from "@sleepy-ai/schema/form"
import { Instruction } from "@sleepy-ai/schema/instruction"
import { InstructionEntry } from "@sleepy-ai/schema/instruction-entry"
import { Integration } from "@sleepy-ai/schema/integration"
import { Location } from "@sleepy-ai/schema/location"
import { Mcp } from "@sleepy-ai/schema/mcp"
import { Model } from "@sleepy-ai/schema/model"
import { Money } from "@sleepy-ai/schema/money"
import { Permission } from "@sleepy-ai/schema/permission"
import { PermissionSaved } from "@sleepy-ai/schema/permission-saved"
import { Plugin } from "@sleepy-ai/schema/plugin"
import { Project } from "@sleepy-ai/schema/project"
import { Worktree } from "@sleepy-ai/schema/worktree"
import { AgentAttachment, FileAttachment, Prompt, PromptMention } from "@sleepy-ai/schema/prompt"
import { PromptInput } from "@sleepy-ai/schema/prompt-input"
import { Provider } from "@sleepy-ai/schema/provider"
import { Pty } from "@sleepy-ai/schema/pty"
import { PtyTicket } from "@sleepy-ai/schema/pty-ticket"
import { Question } from "@sleepy-ai/schema/question"
import { Reference } from "@sleepy-ai/schema/reference"
import { AbsolutePath, RelativePath } from "@sleepy-ai/schema/schema"
import { Session } from "@sleepy-ai/schema/session"
import { SessionMessage } from "@sleepy-ai/schema/session-message"
import { SessionInbox } from "@sleepy-ai/schema/session-inbox"
import { Shell } from "@sleepy-ai/schema/shell"
import { Skill } from "@sleepy-ai/schema/skill"
import { Snapshot } from "@sleepy-ai/schema/snapshot"
import { Vcs } from "@sleepy-ai/schema/vcs"
import { WebSearch } from "@sleepy-ai/schema/websearch"
import { Workspace } from "@sleepy-ai/schema/workspace"
import { SessionsCursor } from "@sleepy-ai/protocol/groups/session"
import { Effect, Schema } from "effect"
import { fileURLToPath } from "url"

const promiseContract = compile(ClientApi, { groupNames, omitEndpoints: promiseOmitEndpoints })
const effectContract = compile(ClientApi, { groupNames, omitEndpoints: effectOmitEndpoints })
const effectTypeReferences = [
  ...namespaceTypes("Agent", "@sleepy-ai/schema/agent", Agent),
  ...namespaceTypes("Command", "@sleepy-ai/schema/command", Command),
  ...namespaceTypes("Config", "@sleepy-ai/schema/config", Config),
  ...namespaceTypes("Credential", "@sleepy-ai/schema/credential", Credential),
  ...namespaceTypes("Event", "@sleepy-ai/schema/event", Event),
  ...namespaceTypes("EventLog", "@sleepy-ai/schema/event-log", EventLog),
  ...namespaceTypes("FileDiff", "@sleepy-ai/schema/file-diff", FileDiff),
  ...namespaceTypes("FileSystem", "@sleepy-ai/schema/filesystem", FileSystem),
  ...namespaceTypes("Form", "@sleepy-ai/schema/form", Form),
  ...namespaceTypes("Instruction", "@sleepy-ai/schema/instruction", Instruction),
  ...namespaceTypes("InstructionEntry", "@sleepy-ai/schema/instruction-entry", InstructionEntry),
  ...namespaceTypes("Integration", "@sleepy-ai/schema/integration", Integration),
  typeReference("Location.PublicRef", "@sleepy-ai/schema/location", Location.PublicRef),
  typeReference("Location.PublicInfo", "@sleepy-ai/schema/location", Location.PublicInfo),
  ...namespaceTypes("Mcp", "@sleepy-ai/schema/mcp", Mcp),
  ...namespaceTypes("Model", "@sleepy-ai/schema/model", Model),
  ...namespaceTypes("Money", "@sleepy-ai/schema/money", Money),
  ...namespaceTypes("Permission", "@sleepy-ai/schema/permission", Permission),
  ...namespaceTypes("PermissionSaved", "@sleepy-ai/schema/permission-saved", PermissionSaved),
  ...namespaceTypes("Plugin", "@sleepy-ai/schema/plugin", Plugin),
  ...namespaceTypes("Project", "@sleepy-ai/schema/project", Project),
  ...namespaceTypes("Worktree", "@sleepy-ai/schema/worktree", Worktree),
  ...namespaceTypes("PromptInput", "@sleepy-ai/schema/prompt-input", PromptInput),
  ...namespaceTypes("Provider", "@sleepy-ai/schema/provider", Provider),
  ...namespaceTypes("Pty", "@sleepy-ai/schema/pty", Pty),
  ...namespaceTypes("PtyTicket", "@sleepy-ai/schema/pty-ticket", PtyTicket),
  ...namespaceTypes("Question", "@sleepy-ai/schema/question", Question),
  ...namespaceTypes("Reference", "@sleepy-ai/schema/reference", Reference),
  ...namespaceTypes("Session", "@sleepy-ai/schema/session", Session),
  ...namespaceTypes("SessionMessage", "@sleepy-ai/schema/session-message", SessionMessage),
  ...namespaceTypes("SessionInbox", "@sleepy-ai/schema/session-inbox", SessionInbox),
  ...namespaceTypes("Shell", "@sleepy-ai/schema/shell", Shell),
  ...namespaceTypes("Skill", "@sleepy-ai/schema/skill", Skill),
  ...namespaceTypes("Snapshot", "@sleepy-ai/schema/snapshot", Snapshot),
  ...namespaceTypes("Vcs", "@sleepy-ai/schema/vcs", Vcs),
  ...namespaceTypes("WebSearch", "@sleepy-ai/schema/websearch", WebSearch),
  ...namespaceTypes("Workspace", "@sleepy-ai/schema/workspace", Workspace),
  typeReference("Prompt", "@sleepy-ai/schema/prompt", Prompt),
  typeReference("PromptMention", "@sleepy-ai/schema/prompt", PromptMention),
  typeReference("FileAttachment", "@sleepy-ai/schema/prompt", FileAttachment),
  typeReference("AgentAttachment", "@sleepy-ai/schema/prompt", AgentAttachment),
  typeReference("AbsolutePath", "@sleepy-ai/schema/schema", AbsolutePath),
  typeReference("RelativePath", "@sleepy-ai/schema/schema", RelativePath),
  typeReference("SessionsCursor", "@sleepy-ai/protocol/groups/session", SessionsCursor),
]

await Effect.runPromise(
  Effect.all(
    [
      write(
        emitPromise(promiseContract, {
          mutableOutputs: true,
        }),
        fileURLToPath(new URL("../src/promise/generated", import.meta.url)),
      ),
      write(
        emitEffectImported(effectContract, {
          module: "../../contract",
          api: "ClientApi",
          shapeModule: "../api/api.js",
        }),
        fileURLToPath(new URL("../src/effect/generated", import.meta.url)),
      ),
      write(
        emitEffectShape(effectContract, {
          typeReferences: effectTypeReferences,
          outputTypes: {
            "event.subscribe": {
              name: "SleepyCodeEvent",
              import: 'import type { SleepyCodeEvent } from "@sleepy-ai/protocol/groups/event"',
            },
          },
        }),
        fileURLToPath(new URL("../src/effect/api", import.meta.url)),
      ),
    ],
    { concurrency: 3, discard: true },
  ).pipe(Effect.provide(NodeFileSystem.layer)),
)

function namespaceTypes(namespace: string, module: string, values: object) {
  return Object.entries(values).flatMap(([name, schema]) =>
    Schema.isSchema(schema) ? [typeReference(`${namespace}.${name}`, module, schema)] : [],
  )
}

function typeReference(name: string, module: string, schema: Schema.Top) {
  return {
    schema,
    name,
    import: `import type { ${name.split(".")[0]} } from ${JSON.stringify(module)}`,
  }
}
