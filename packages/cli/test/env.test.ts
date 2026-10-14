import { expect, test } from "bun:test"
import { Env } from "../src/env"

test("session environment omits server credentials", () => {
  const previousPassword = process.env.SLEEPYCODE_PASSWORD
  const previousLegacyPassword = process.env.SLEEPYCODE_SERVER_PASSWORD
  const previousValue = process.env.SLEEPYCODE_SESSION_ENV_TEST
  process.env.SLEEPYCODE_PASSWORD = "password"
  process.env.SLEEPYCODE_SERVER_PASSWORD = "legacy"
  process.env.SLEEPYCODE_SESSION_ENV_TEST = "included"

  const environment = Env.session()

  if (previousPassword === undefined) delete process.env.SLEEPYCODE_PASSWORD
  else process.env.SLEEPYCODE_PASSWORD = previousPassword
  if (previousLegacyPassword === undefined) delete process.env.SLEEPYCODE_SERVER_PASSWORD
  else process.env.SLEEPYCODE_SERVER_PASSWORD = previousLegacyPassword
  if (previousValue === undefined) delete process.env.SLEEPYCODE_SESSION_ENV_TEST
  else process.env.SLEEPYCODE_SESSION_ENV_TEST = previousValue

  expect(environment.SLEEPYCODE_PASSWORD).toBeUndefined()
  expect(environment.SLEEPYCODE_SERVER_PASSWORD).toBeUndefined()
  expect(environment.SLEEPYCODE_SESSION_ENV_TEST).toBe("included")
})
