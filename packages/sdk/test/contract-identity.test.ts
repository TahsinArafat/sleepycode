import { expect, test } from "bun:test"
import { EnvironmentDriver } from "@sleepy-ai/core/environment/driver"
import { EnvironmentFiles } from "@sleepy-ai/core/environment/files"
import { Location as CoreLocation } from "@sleepy-ai/core/location"
import { WorkspaceDriver } from "@sleepy-ai/core/workspace/driver"
import { SessionInbox as CoreSessionInbox } from "@sleepy-ai/core/session/inbox"
import { SessionMessage as CoreSessionMessage } from "@sleepy-ai/core/session/message"
import { Agent } from "@sleepy-ai/schema/agent"
import { Config } from "@sleepy-ai/schema/config"
import { Event } from "@sleepy-ai/schema/event"
import { Location } from "@sleepy-ai/schema/location"
import { Model } from "@sleepy-ai/schema/model"
import { Project } from "@sleepy-ai/schema/project"
import { Provider } from "@sleepy-ai/schema/provider"
import { WebSearch } from "@sleepy-ai/schema/websearch"
import { Session } from "@sleepy-ai/schema/session"
import { SessionInbox } from "@sleepy-ai/schema/session-inbox"
import { SessionMessage } from "@sleepy-ai/schema/session-message"
import { Workspace } from "@sleepy-ai/schema/workspace"
import { Worktree } from "@sleepy-ai/schema/worktree"
import { Api } from "@sleepy-ai/server/api"
import { ClientApi, groupNames, promiseOmitEndpoints } from "@sleepy-ai/protocol/client"
import { compile, emitPromise } from "@sleepy-ai/httpapi-codegen"

const SDK = await import("../src/index")
const SDKEffect = await import("../src/effect")
const CoreAgent = await import("@sleepy-ai/core/agent")
const CoreModel = await import("@sleepy-ai/core/model")
const CoreProject = await import("@sleepy-ai/core/project")
const CoreSession = await import("@sleepy-ai/core/session")
const CoreWorktree = await import("@sleepy-ai/core/worktree")

test("re-exports canonical contracts directly from Schema", () => {
  expect(SDK.Agent).toBe(Agent)
  expect(SDK.Config).toBe(Config)
  expect(SDK.Event).toBe(Event)
  expect(SDK.Model).toBe(Model)
  expect(SDK.WebSearch).toBe(WebSearch)
  expect(SDK.Session).toBe(Session)
  expect(SDK.Worktree).toBe(Worktree)
  expect(SDK.Workspace).toBe(Workspace)
  expect(Object.keys(SDK).sort()).toEqual([
    "AbsolutePath",
    "Agent",
    "ClientError",
    "Command",
    "Config",
    "Credential",
    "Event",
    "FileSystem",
    "Integration",
    "Location",
    "Model",
    "Permission",
    "PermissionSaved",
    "Project",
    "Prompt",
    "PromptInput",
    "Provider",
    "Pty",
    "Question",
    "Reference",
    "RelativePath",
    "Session",
    "SessionInbox",
    "SessionMessage",
    "Skill",
    "SleepyCode",
    "Tool",
    "WebSearch",
    "Workspace",
    "Worktree",
  ])
})

test("Core and Server reuse the authoritative Schema and Protocol values", () => {
  expect(CoreAgent.ID).toBe(Agent.ID)
  expect(CoreLocation.Ref).toBe(Location.Ref)
  expect(CoreModel.Ref).toBe(Model.Ref)
  expect(CoreSession.Info).toBe(Session.Info)
  expect(CoreProject.Current).toBe(Project.Current)
  expect(CoreWorktree.DirectoryUnavailableError).toBeDefined()
  expect(CoreWorktree.List).toBe(Worktree.List)
  expect(CoreWorktree.Info).toBe(Worktree.Info)
  expect(CoreSessionInbox.Item).toBe(SessionInbox.Item)
  expect(CoreSessionInbox.User).toBe(SessionInbox.User)
  expect(CoreSessionInbox.Synthetic).toBe(SessionInbox.Synthetic)
  expect(CoreSessionMessage.Info).toBe(SessionMessage.Info)
  expect(CoreSessionMessage.AssistantText).toBe(SessionMessage.AssistantText)
  expect(Api.groups["server.session"].identifier).toBe("server.session")
  expect(Api.groups["server.project"].identifier).toBe("server.project")
  expect(Object.keys(ClientApi.groups)).toEqual(Object.keys(Api.groups))
  expect(Session.ID.create()).toStartWith("ses_")
  expect(String(Project.ID.global)).toBe("global")
  expect(String(Provider.ID.anthropic)).toBe("anthropic")
  expect(Workspace.ID.create()).toStartWith("wrk_")
})

test("client and Server contracts generate identically", () => {
  const server = compile(Api, { groupNames, omitEndpoints: promiseOmitEndpoints })
  const client = compile(ClientApi, { groupNames, omitEndpoints: promiseOmitEndpoints })

  expect(emitPromise(client)).toEqual(emitPromise(server))
})

test("re-exports workspace and environment driver contracts from @sleepy-ai/sdk/effect", () => {
  expect(SDKEffect.WorkspaceDriver).toBe(WorkspaceDriver)
  expect(SDKEffect.EnvironmentDriver).toBe(EnvironmentDriver)
  expect(SDKEffect.EnvironmentFiles).toBe(EnvironmentFiles)
})
