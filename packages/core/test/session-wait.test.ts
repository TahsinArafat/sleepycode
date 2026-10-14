import { describe, expect } from "bun:test"
import { Effect, Layer } from "effect"
import { Database } from "@sleepy-ai/core/database/database"
import { AppNodeBuilder } from "@sleepy-ai/core/effect/app-node-builder"
import { LayerNode } from "@sleepy-ai/util/effect/layer-node"
import { Bus } from "@sleepy-ai/core/bus"
import { Location } from "@sleepy-ai/core/location"
import { Project } from "@sleepy-ai/core/project"
import { AbsolutePath } from "@sleepy-ai/core/schema"
import { Session } from "@sleepy-ai/core/session"
import { SessionProjector } from "@sleepy-ai/core/session/projector"
import { SessionExecution } from "@sleepy-ai/core/session/execution"
import { SessionStore } from "@sleepy-ai/core/session/store"
import { testEffect } from "./lib/effect"
import { globalProjectNode } from "./lib/project"

const location = Location.Ref.make({ directory: AbsolutePath.make("/project") })
const awaited: Session.ID[] = []
const execution = Layer.mock(SessionExecution.Service, {
  awaitIdle: (sessionID) => Effect.sync(() => awaited.push(sessionID)),
})
const it = testEffect(
  AppNodeBuilder.build(
    LayerNode.group([Database.node, Bus.node, SessionProjector.node, SessionStore.node, Session.node]),
    [Project.node.replace(globalProjectNode), SessionExecution.node.replace(execution)],
  ),
)

describe("Session.wait", () => {
  it.effect("delegates to SessionExecution.awaitIdle", () =>
    Effect.gen(function* () {
      awaited.length = 0
      const sessions = yield* Session.Service
      const session = yield* sessions.create({ location })

      yield* sessions.wait(session.id)

      expect(awaited).toEqual([session.id])
    }),
  )
})
