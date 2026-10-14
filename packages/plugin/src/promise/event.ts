import type { EventApi } from "@sleepy-ai/client/promise/api"

export interface EventDomain extends Pick<EventApi, "subscribe"> {}
