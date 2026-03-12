---
layout: home
hero:
  name: Straight Jacket
  text: Autonomous AI agents, contained.
  tagline: Run Claude Code, Codex, and other AI agents in full bypass-permissions mode inside hardened Podman containers. One command. Zero footguns.
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: View on GitHub
      link: https://github.com/pthrasher/straightjacket
features:
  - icon: 🔓
    title: Unattended & Autonomous
    details: Agents run in full bypass-permissions mode — no confirmation prompts, no interruptions. The container is the sandbox. Let them work while you do something else.
  - icon: ⚡
    title: One Command Launch
    details: '"sj claude" and you''re coding. No Dockerfiles to write, no volume mounts to remember, no environment variables to juggle. One binary, zero setup.'
  - icon: 🧩
    title: Composable Presets
    details: Mix and match units — Node, Rust, Playwright, Ghidra, and more — to build exactly the container environment your project needs.
  - icon: 🔒
    title: Hardened by Default
    details: All capabilities dropped, no new privileges, user namespace isolation. Credentials forwarded at runtime, never baked into images.
  - icon: 💾
    title: Persistent Agent State
    details: Agent config, caches, shell history, and installed tools survive across sessions via sandboxed home directories.
  - icon: 📦
    title: Single Binary
    details: Presets and units are embedded into the compiled executable. No runtime dependencies beyond Podman.
---
