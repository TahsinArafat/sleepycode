import { Plugin } from "@sleepy-ai/plugin/tui"
import { createMemo, createResource, For, Show } from "solid-js"
import { contextUsage } from "../../util/session"
import { creditBalance, progressBar, ratioRole, usageWindows } from "./limits-data"

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
})

export function SidebarContext(props: { context: Plugin.Context; sessionID: string }) {
  const theme = props.context.theme
  const msg = createMemo(() => props.context.data.session.message.list(props.sessionID))
  const session = createMemo(() => props.context.data.session.get(props.sessionID))
  const cost = createMemo(() => props.context.data.session.cost(props.sessionID))

  const state = createMemo(() =>
    contextUsage(msg(), props.context.data.location.model.list(session()?.location), session()?.revert?.messageID),
  )

  return (
    <>
      <Show when={state() || cost() > 0}>
        <box>
          <text fg={theme.text.base}>
            <b>Context</b>
          </text>
          <Show when={state()}>
            {(value) => (
              <>
                <text fg={theme.text.muted}>{value().tokens.toLocaleString()} tokens</text>
                <Show when={value().percent !== undefined}>
                  <text fg={theme.text.muted}>{value().percent}% used</text>
                </Show>
              </>
            )}
          </Show>
          <Show when={cost() > 0}>
            <text fg={theme.text.muted}>{money.format(cost())} spent</text>
          </Show>
        </box>
      </Show>
      <PlanLimits context={props.context} />
    </>
  )
}

function PlanLimits(props: { context: Plugin.Context }) {
  const theme = props.context.theme
  const [view, updateView] = props.context.storage.store("planLimits", { initial: { open: true } })
  // The gateway meters on the server, so this is a fetch rather than reactive data, and it
  // is refetched on the same cadence as any other server-backed panel state.
  const [usage] = createResource(() => props.context.client.sleepy.usage())
  const data = createMemo(() => usage() ?? null)
  const windows = createMemo(() => usageWindows(data()))
  const credit = createMemo(() => creditBalance(data()))

  return (
    <Show when={windows().length > 0 || credit() !== undefined}>
      <box>
        <box
          flexDirection="row"
          gap={1}
          onMouseDown={() => {
            void updateView((draft) => {
              draft.open = !draft.open
            }).catch((error) => console.error("Failed to persist plan limits sidebar state", error))
          }}
        >
          <text fg={theme.text.base}>
            <b>Plan & Limits</b> {view.open ? "▼" : "▶"}
          </text>
        </box>
        <Show when={view.open}>
          <Show when={credit()}>
            {(value) => <text fg={theme.text.muted}>Credit: {money.format(value())}</text>}
          </Show>
          <For each={windows()}>
            {(window) => (
              <box flexDirection="row">
                <text fg={theme.text.feedback[ratioRole(window.ratio)].base}>{progressBar(window.ratio)}</text>
                <text fg={theme.text.muted}>
                  {" "}
                  {window.label} ({money.format(window.spent)}/{money.format(window.limit)})
                </text>
              </box>
            )}
          </For>
        </Show>
      </box>
    </Show>
  )
}

export default Plugin.define({
  id: "sleepycode.sidebar.context",
  setup(context) {
    context.ui.slot({
      append: "sidebar.content",
      render: (props) => <SidebarContext context={context} sessionID={props.sessionID} />,
    })
  },
})
