import type { SleepyCodeEvent } from "@sleepy-ai/client"
import { useClient } from "./client"

type EventMetadata = {
  directory: string | undefined
}
type SleepyCodeEventMap = { [Type in SleepyCodeEvent["type"]]: Extract<SleepyCodeEvent, { type: Type }> }

export function useEvent() {
  const client = useClient()

  function subscribe(handler: (event: SleepyCodeEvent, metadata: EventMetadata) => void) {
    return client.event.listen(({ details }) => {
      if (details.type === "server.connected") return
      handler(details, { directory: details.location?.directory })
    })
  }

  function on<T extends SleepyCodeEvent["type"]>(
    type: T,
    handler: (event: SleepyCodeEventMap[T], metadata: EventMetadata) => void,
  ) {
    return client.event.on(type, (event) => {
      handler(event, { directory: event.location?.directory })
    })
  }

  return {
    subscribe,
    on,
  }
}
