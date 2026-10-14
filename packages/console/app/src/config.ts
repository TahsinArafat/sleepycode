/**
 * Application-wide constants and configuration
 */
export const config = {
  consoleMarketingEnabled: import.meta.env.VITE_CONSOLE_MARKETING_ENABLED === "true",

  // Base URL
  baseUrl: "https://opencode.ai",

  // GitHub
  github: {
    repoUrl: "https://github.com/anomalyco/opencode",
    starsFormatted: {
      compact: "208K",
      full: "208,000",
    },
  },

  // Social links
  social: {
    twitter: "https://x.com/sleepycode",
    discord: "https://discord.gg/sleepycode",
  },

  // Static stats (used on landing page)
  stats: {
    contributors: "950",
    commits: "13,000",
    monthlyUsers: "16M",
  },
} as const
