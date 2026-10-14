import type { FileSystem } from "@sleepy-ai/core/filesystem"
import { Bus } from "@sleepy-ai/core/bus"
import { Image } from "@sleepy-ai/core/image"
import { LocationServiceMap } from "@sleepy-ai/core/location-service-map"
import type { LocationServices } from "@sleepy-ai/core/location-services"
import { Plugin } from "@sleepy-ai/core/plugin"
import { PluginHooks } from "@sleepy-ai/core/plugin/hooks"
import { Skill } from "@sleepy-ai/core/skill"
import type { Location } from "@sleepy-ai/schema/location"
import { makeGlobalNode } from "@sleepy-ai/util/effect/app-node"
import { LayerNode } from "@sleepy-ai/util/effect/layer-node"
import { Effect, Layer, LayerMap } from "effect"

// Plain-prompt unit fixtures use virtual directories.
export const promptLocationNode = makeGlobalNode({
  service: LocationServiceMap.Service,
  layer: Layer.effect(
    LocationServiceMap.Service,
    Effect.gen(function* () {
      const bus = yield* Bus.Service
      return yield* LayerMap.make(
        (_ref: Location.Ref) =>
          LayerNode.compile(LayerNode.group([PluginHooks.node, Image.node, Skill.node, Plugin.node]), {
            replacements: [
              Bus.node.replace(Layer.succeed(Bus.Service, bus)),
              Plugin.node.replace(Layer.mock(Plugin.Service, { awaitActivation: Effect.void })),
            ],
          }) as unknown as Layer.Layer<LocationServices, FileSystem.DirectoryNotFoundError>,
      )
    }),
  ),
  deps: [Bus.node],
})
