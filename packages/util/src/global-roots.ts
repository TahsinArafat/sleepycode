import os from "os"
import path from "path"

const home = os.homedir()
const data = process.env.XDG_DATA_HOME || (home ? path.join(home, ".local", "share") : undefined)
const cache = process.env.XDG_CACHE_HOME || (home ? path.join(home, ".cache") : undefined)
const config = process.env.XDG_CONFIG_HOME || (home ? path.join(home, ".config") : undefined)
const state = process.env.XDG_STATE_HOME || (home ? path.join(home, ".local", "state") : undefined)

/** The XDG base directories that root sleepy's global paths. */
export function roots(app: string) {
  const custom = process.env.SLEEPY_HOME
  if (custom) {
    if (!path.isAbsolute(custom)) {
      throw new Error(`SLEEPY_HOME must be an absolute path, got: ${JSON.stringify(custom)}`)
    }
    return {
      data: path.join(custom, "data"),
      cache: path.join(custom, "cache"),
      config: path.join(custom, "config"),
      state: path.join(custom, "state"),
      tmp: path.join(os.tmpdir(), app),
    }
  }
  return {
    data: path.join(data!, app),
    cache: path.join(cache!, app),
    config: path.join(config!, app),
    state: path.join(state!, app),
    tmp: path.join(os.tmpdir(), app),
  }
}
