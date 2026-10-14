export * as SleepyCodeWorkerd from "./workerd"

import { Layer } from "effect"
import type { Config, Scope } from "effect"
import { WorkerdProfile } from "../internal/workerd"
import { SleepyCode } from "./sleepycode"

export type Configuration = WorkerdProfile.Configuration

export interface CreateOptions<R = never> extends WorkerdProfile.Options {
  readonly log?: SleepyCode.CreateOptions["log"]
  readonly plugins?: SleepyCode.CreateOptions["plugins"]
  readonly workspaceProviders?: SleepyCode.CreateOptions["workspaceProviders"]
  readonly instances?: SleepyCode.CreateOptions<R>["instances"]
}

export const create = <R = never>({ log, plugins, workspaceProviders, instances, ...options }: CreateOptions<R>) => {
  const profile = WorkerdProfile.make(options)
  return SleepyCode.create(
    { ...profile.options, log, plugins, workspaceProviders, instances },
    { overrides: profile.replacements },
  )
}

export const layer = <R = never>(
  options: CreateOptions<R>,
): Layer.Layer<SleepyCode.Service, Config.ConfigError | Error, Exclude<R, Scope.Scope>> =>
  Layer.effect(SleepyCode.Service, create(options))

export type Interface = SleepyCode.Interface
export type Requirements = Scope.Scope
