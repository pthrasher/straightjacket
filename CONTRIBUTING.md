# Contributing to Straight Jacket

We welcome contributions. We also have high standards.

## The Bar

Code is cheap now. AI can generate a thousand lines in seconds. This means there is **no excuse** for code that isn't excellent.

Every contribution — whether written by hand, by AI, or by some combination — must be:

- **Correct.** It works. It handles edge cases. It doesn't break existing behavior.
- **Clean.** It reads well. Names are precise. Structure is obvious. There's no dead code, no commented-out experiments, no "TODO: fix later."
- **Minimal.** It does what's needed and nothing more. No speculative abstractions, no premature generalization, no "while I'm here" refactors.
- **Tested.** If it can break, it has a test. If it's a bug fix, there's a regression test.
- **Secure.** No command injection, no secret leakage, no unsafe defaults.

Contributions that don't meet this bar will be closed. Not with malice — with respect for everyone's time, including yours.

## AI Is Welcome

We don't care if you used AI to write your contribution. We care about the result.

If your AI-assisted PR is thoughtful, well-structured, properly tested, and solves a real problem — great. If it's a sloppy dump of generated code with obvious issues — it gets closed, same as any other low-quality PR.

The availability of AI tools makes the quality bar **higher**, not lower. When producing good code is easy, producing bad code is a choice.

## How to Contribute

### Bug Reports

Open an issue with:
- What you expected to happen
- What actually happened
- Steps to reproduce
- Your environment (OS, Podman version, `sj` version)

### Feature Requests

Open an issue describing:
- The problem you're trying to solve
- Your proposed solution (if you have one)
- Why existing functionality doesn't cover it

### Pull Requests

1. **Check for an existing issue first.** If there isn't one, open one to discuss before writing code.
2. **Keep PRs focused.** One logical change per PR. Don't bundle unrelated fixes.
3. **Write a clear description.** What changed, why, and how to verify it works.
4. **Ensure CI passes.** Run `bun run typecheck` and `bun test` before submitting.
5. **Match the existing style.** Read the code around your change. Follow its patterns.

### Development Setup

```bash
# Prerequisites: Bun 1.3.9+ (see .tool-versions), Podman

git clone https://github.com/anthropics/straightjacket.git
cd straightjacket
bun install

# Run in development mode
bun run dev

# Type-check
bun run typecheck

# Run tests
bun test

# Build the binary
bun run build
```

### Architecture Notes

- Presets and units are embedded into the compiled binary via Bun's `import ... with { type: "file" }` — adding a new unit or preset requires updating the import maps in `src/built-in-units.ts` or `src/built-in-presets.ts`.
- The entrypoint script is generated at runtime, not maintained by hand.
- Config resolution uses c12 with layered priority: CLI > per-repo > global > defaults.

See [CLAUDE.md](CLAUDE.md) for more architectural context.

## Code of Conduct

Be kind. Be constructive. Assume good intent. We're all here to build something useful.
