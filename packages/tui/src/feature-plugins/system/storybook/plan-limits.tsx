import type { Plugin } from "@sleepy-ai/plugin/tui"
import type { SleepyUsageInfo } from "@sleepy-ai/client"
import { useTerminalDimensions } from "@opentui/solid"
import { createStore, produce } from "solid-js/store"
import { RGBA } from "@opentui/core"
import { SidebarContext } from "../../sidebar/context"
import { StoryFooter } from "./footer"
import type { Story } from "./index"

/**
 * The signed-in states the plan panel has to survive. `null` is the signed-out and
 * gateway-unreachable case, which is the same on the wire and must render nothing.
 */
const fixtures: ReadonlyArray<{ key: string; label: string; usage: SleepyUsageInfo | null }> = [
  { key: "1", label: "signed out", usage: null },
  { key: "2", label: "no plan", usage: {} },
  {
    key: "3",
    label: "mid plan",
    usage: {
      limits: { creditUSD: 4.5, limit5h: 0.5, limit24h: 1.5, limitWeekly: 3.5, limitMonthly: 5 },
      usageByWindow: { cost5h: 0.25, cost24h: 1, costWeekly: 2, costMonthly: 3 },
    },
  },
  {
    key: "4",
    label: "near limit",
    usage: {
      limits: { limit5h: 1, limit24h: 2, limitWeekly: 4, limitMonthly: 8 },
      usageByWindow: { cost5h: 0.8, cost24h: 1, costWeekly: 3.2, costMonthly: 8 },
    },
  },
  { key: "5", label: "credit only", usage: { limits: { creditUSD: 12 }, monthlyAllowanceUSD: 12 } },
]

// The panel colours its bars through the theme; the story supplies the resolved role so the
// three proximity states are visually distinguishable without borrowing production tokens.
const roleColor = {
  success: RGBA.fromInts(120, 200, 120),
  warning: RGBA.fromInts(220, 180, 90),
  error: RGBA.fromInts(220, 110, 110),
}

function PlanLimitsStory(props: { context: Plugin.Context }) {
  const dimensions = useTerminalDimensions()
  const [state, setState] = createStore({ index: 2, open: true })

  const current = () => fixtures[state.index]

  props.context.keymap.layer(() => ({
    commands: [
      {
        bind: "escape",
        title: "Back to storybook",
        group: "Storybook",
        run: () => props.context.ui.router.navigate({ type: "plugin", name: "storybook" }),
      },
      {
        bind: "n",
        title: "Next fixture",
        group: "Storybook",
        run: () => setState("index", (index) => (index + 1) % fixtures.length),
      },
      {
        bind: "p",
        title: "Previous fixture",
        group: "Storybook",
        run: () => setState("index", (index) => (index + fixtures.length - 1) % fixtures.length),
      },
      {
        bind: "c",
        title: "Toggle collapsed",
        group: "Storybook",
        run: () =>
          setState(
            produce((draft) => {
              draft.open = !draft.open
            }),
          ),
      },
      ...fixtures.map((fixture, index) => ({
        bind: fixture.key,
        title: `Fixture: ${fixture.label}`,
        group: "Storybook",
        run: () => setState("index", index),
      })),
    ],
  }))

  // The real production component, given a context whose only substitution is the usage
  // fetch and the collapse state, so the panel's own logic is what the story exercises.
  const context = {
    ...props.context,
    theme: {
      ...props.context.theme,
      text: {
        ...props.context.theme.text,
        feedback: {
          success: { base: roleColor.success },
          warning: { base: roleColor.warning },
          error: { base: roleColor.error },
        },
      },
    },
    storage: {
      ...props.context.storage,
      store: () => [
        { open: state.open },
        (mutation: (draft: { open: boolean }) => void) =>
          Promise.resolve(
            setState(
              produce((draft) => {
                const target = { open: draft.open }
                mutation(target)
                draft.open = target.open
              }),
            ),
          ),
      ],
    },
    client: {
      ...props.context.client,
      sleepy: { usage: () => Promise.resolve(current().usage) },
    },
  } as unknown as Plugin.Context

  return (
    <box
      width={dimensions().width}
      height={dimensions().height}
      flexDirection="column"
      backgroundColor={props.context.theme.background.base}
    >
      <box flexDirection="row" flexGrow={1} minHeight={0}>
        <box width={38} border={["right"]} borderColor={props.context.theme.border.base} paddingLeft={1} paddingRight={1}>
          <SidebarContext context={context} sessionID="storybook-plan-limits" />
        </box>
        <box paddingLeft={2} paddingTop={1}>
          <text fg={props.context.theme.text.muted}>sidebar.context — real component</text>
        </box>
      </box>
      <StoryFooter
        context={props.context}
        title="storybook / Plan & Limits"
        details={[current().label, state.open ? "expanded" : "collapsed"]}
        controls={[
          { shortcut: "n/p", label: "next/previous fixture" },
          { shortcut: "1-5", label: "jump to fixture" },
          { shortcut: "c", label: "collapse/expand" },
          { shortcut: "esc", label: "back" },
        ]}
      />
    </box>
  )
}

export const planLimitsStory: Story = {
  id: "plan-limits",
  title: "Plan & Limits",
  render: (context) => <PlanLimitsStory context={context} />,
}
