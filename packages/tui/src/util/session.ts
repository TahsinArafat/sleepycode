import type { ModelInfo, SessionMessageInfo } from "@sleepy-ai/client"
import { lastAssistantWithUsage } from "@sleepy-ai/client/solid"
import { Locale } from "./locale"

type SessionNode = {
  id: string
  parentID?: string | null
}

export function sessionFamily<T extends SessionNode>(sessions: readonly T[], sessionID: string) {
  const byID = new Map(sessions.map((session) => [session.id, session]))
  const current = byID.get(sessionID)
  if (!current) return []

  const children = new Map<string, T[]>()
  sessions.forEach((session) => {
    if (!session.parentID) return
    const group = children.get(session.parentID)
    if (group) group.push(session)
    else children.set(session.parentID, [session])
  })

  function root(session: T): T {
    const parent = session.parentID ? byID.get(session.parentID) : undefined
    return parent ? root(parent) : session
  }

  function walk(parentID: string, ancestors: boolean[]): Array<{ session: T; prefix: string }> {
    const group = children.get(parentID) ?? []
    return group.flatMap((session, index) => {
      const last = index === group.length - 1
      const prefix =
        ancestors.length === 0
          ? ""
          : ancestors
              .slice(1)
              .map((ancestor) => (ancestor ? "   " : "│  "))
              .join("") + (last ? "└─ " : "├─ ")
      return [{ session, prefix }, ...walk(session.id, [...ancestors, last])]
    })
  }

  return walk(root(current).id, [])
}

export function contextUsage(
  messages: ReadonlyArray<SessionMessageInfo>,
  models: ReadonlyArray<ModelInfo> | undefined,
  boundary?: string,
) {
  const last = lastAssistantWithUsage(messages, boundary)
  if (!last) return
  const tokens =
    last.tokens.input + last.tokens.output + last.tokens.reasoning + last.tokens.cache.read + last.tokens.cache.write
  if (tokens <= 0) return
  const model = models?.find((model) => model.providerID === last.model.providerID && model.id === last.model.id)
  return {
    tokens,
    percent: model?.limit.context ? Math.round((tokens / model.limit.context) * 100) : undefined,
  }
}

export function formatContextUsage(tokens: number, percent?: number) {
  const value = Locale.number(tokens)
  return percent === undefined ? value : `${value} (${percent}%)`
}

/**
 * Cumulative token spend across every assistant message in the session.
 *
 * `contextUsage` above reports the *last* message against the model's context window, which is
 * a different number: one is "how full is the window right now", this is "what has this session
 * cost in tokens". Both are wanted, and the sidebar shows them in separate sections so neither
 * masquerades as the other.
 *
 * Reasoning is folded into output, because providers bill and report it as generated tokens.
 * Messages after a revert boundary are excluded, matching `contextUsage`.
 */
export function sessionTokens(messages: ReadonlyArray<SessionMessageInfo>, boundary?: string) {
  const end = boundary ? messages.findIndex((message) => message.id === boundary) : -1
  const visible = end === -1 ? messages : messages.slice(0, end)
  return visible.reduce(
    (total, message) => {
      if (message.type !== "assistant" || !message.tokens) return total
      return {
        input: total.input + message.tokens.input,
        output: total.output + message.tokens.output + message.tokens.reasoning,
      }
    },
    { input: 0, output: 0 },
  )
}

/** True when the session has recorded any token usage, so the section can stay hidden. */
export function hasSessionTokens(usage: { input: number; output: number }) {
  return usage.input > 0 || usage.output > 0
}
