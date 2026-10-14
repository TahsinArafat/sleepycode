import { Agent } from "@sleepy-ai/core/agent"
import { AISDK } from "@sleepy-ai/core/aisdk"
import { Command } from "@sleepy-ai/core/command"
import { Config } from "@sleepy-ai/core/config"
import { Credential } from "@sleepy-ai/core/credential"
import { Database } from "@sleepy-ai/core/database/database"
import { FileAccess } from "@sleepy-ai/core/file-access"
import { LayerNodePlatform } from "@sleepy-ai/util/effect/app-node-platform"
import { AppProcess } from "@sleepy-ai/util/process"
import { LayerNode } from "@sleepy-ai/util/effect/layer-node"
import { Bus } from "@sleepy-ai/core/bus"
import { FileSystem } from "@sleepy-ai/core/filesystem"
import { FSUtil } from "@sleepy-ai/util/fs-util"
import { Form } from "@sleepy-ai/core/form"
import { Generate } from "@sleepy-ai/core/generate"
import { Integration } from "@sleepy-ai/core/integration"
import { KV } from "@sleepy-ai/core/kv"
import { Location } from "@sleepy-ai/core/location"
import { ManagedPolicy } from "@sleepy-ai/core/managed-policy"
import { Mcp } from "@sleepy-ai/core/mcp/index"
import { Model } from "@sleepy-ai/core/model"
import { Npm } from "@sleepy-ai/util/npm"
import { Plugin } from "@sleepy-ai/core/plugin"
import { PluginHooks } from "@sleepy-ai/core/plugin/hooks"
import { Provider } from "@sleepy-ai/core/provider"
import { Session } from "@sleepy-ai/core/session"
import { PersistentPty } from "@sleepy-ai/core/persistent-pty"
import { LocationServiceMap } from "@sleepy-ai/core/location-service-map"
import { AppNodeBuilder } from "@sleepy-ai/core/effect/app-node-builder"
import { Permission } from "@sleepy-ai/core/permission"
import { Reference } from "@sleepy-ai/core/reference"
import { Rpc } from "@sleepy-ai/core/rpc"
import { Skill } from "@sleepy-ai/core/skill"
import { SkillDiscovery } from "@sleepy-ai/core/skill/discovery"
import { Watcher } from "@sleepy-ai/core/filesystem/watcher"
import { Tool } from "@sleepy-ai/core/tool"
import { Vcs } from "@sleepy-ai/core/vcs"
import { WebSearch } from "@sleepy-ai/core/websearch"
import { Worktree } from "@sleepy-ai/core/worktree"
import { WorktreeStrategies } from "@sleepy-ai/core/worktree/strategies"
import { Effect, Layer } from "effect"
import { tempLocationLayer } from "../fixture/location"
import { emptyMcpLayer } from "../fixture/mcp"

const npmLayer = Layer.succeed(
  Npm.Service,
  Npm.Service.of({
    add: (name) => Effect.succeed({ directory: "", name }),
    resolve: (name) => Effect.succeed({ directory: "", name }),
    check: () => Effect.succeed(false),
    update: (name) => Effect.succeed({ directory: "", name }),
    which: () => Effect.undefined,
  }),
)

const generateLayer = Layer.succeed(Generate.Service, Generate.Service.of({ text: () => Effect.succeed("") }))

const configLayer = Config.testLayer()

const permissionLayer = Layer.succeed(
  Permission.Service,
  Permission.Service.of({
    close: Effect.void,
    ask: (input) => Effect.succeed({ id: input.id ?? Permission.ID.create(), effect: "ask" }),
    assert: () => Effect.void,
    reply: () => Effect.void,
    get: () => Effect.succeed(undefined),
    forSession: () => Effect.succeed([]),
    list: () => Effect.succeed([]),
  }),
)

export const makePluginTestLayer = (permission = permissionLayer) =>
  AppNodeBuilder.build(
    LayerNode.group([
      AppProcess.node,
      FileSystem.node,
      FSUtil.node,
      Location.node,
      Npm.node,
      Credential.node,
      Config.node,
      Database.node,
      FileAccess.node,
      Bus.node,
      Form.node,
      Generate.node,
      LayerNodePlatform.httpClient,
      Plugin.node,
      Agent.node,
      AISDK.node,
      Provider.node,
      Model.node,
      Command.node,
      Integration.node,
      KV.node,
      ManagedPolicy.node,
      Mcp.node,
      Session.node,
      PersistentPty.node,
      LocationServiceMap.node,
      Permission.node,
      PluginHooks.node,
      Reference.node,
      Rpc.node,
      Skill.node,
      SkillDiscovery.node,
      Tool.node,
      Vcs.node,
      Watcher.node,
      WebSearch.node,
      Worktree.node,
      WorktreeStrategies.node,
    ]),
    [
      Location.node.replace(tempLocationLayer),
      Npm.node.replace(npmLayer),
      Config.node.replace(configLayer),
      Mcp.node.replace(emptyMcpLayer),
      Generate.node.replace(generateLayer),
      Permission.node.replace(permission),
    ],
  ).pipe(Layer.provideMerge(configLayer))

export const PluginTestLayer = makePluginTestLayer()
