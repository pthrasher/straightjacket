import { defineConfig } from "vitepress";

export default defineConfig({
  base: "/straightjacket/",
  title: "Straight Jacket",
  description:
    "Run AI agents in sandboxed containers. No footguns.",
  head: [
    ["meta", { property: "og:title", content: "Straight Jacket" }],
    [
      "meta",
      {
        property: "og:description",
        content:
          "Run AI coding agents autonomously in hardened containers.",
      },
    ],
  ],
  themeConfig: {
    nav: [
      { text: "Guide", link: "/guide/getting-started" },
      { text: "Reference", link: "/reference/config" },
      {
        text: "GitHub",
        link: "https://github.com/pthrasher/straightjacket",
      },
    ],
    sidebar: [
      {
        text: "Guide",
        items: [
          { text: "Getting Started", link: "/guide/getting-started" },
          { text: "Presets & Units", link: "/guide/presets-and-units" },
          { text: "Configuration", link: "/guide/configuration" },
          { text: "SSH Agent Forwarding", link: "/guide/ssh-forwarding" },
          { text: "Security Model", link: "/guide/security" },
        ],
      },
      {
        text: "Reference",
        items: [
          { text: "Config Options", link: "/reference/config" },
          { text: "CLI Commands", link: "/reference/cli" },
          { text: "Built-in Presets", link: "/reference/presets" },
          { text: "Built-in Units", link: "/reference/units" },
        ],
      },
      {
        text: "Roadmap",
        link: "/roadmap",
      },
    ],
    socialLinks: [
      {
        icon: "github",
        link: "https://github.com/pthrasher/straightjacket",
      },
    ],
    footer: {
      message: "Released under the MIT License.",
    },
    search: {
      provider: "local",
    },
  },
});
