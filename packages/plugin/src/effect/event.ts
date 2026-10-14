import type { EventApi } from "@sleepy-ai/client/effect/api"

export interface EventDomain extends Pick<EventApi<unknown>, "subscribe"> {}
