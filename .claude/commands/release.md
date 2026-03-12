You are creating a new release for this project. Follow these steps carefully:

## Step 1: Determine the last release

Run `git tag --sort=-v:refname` to find the most recent version tag (tags matching `v*`). If there are no tags, this is the first release — treat all commits as new.

Store the last tag (or the initial commit if none) for use in the next steps.

## Step 2: Gather changes

Get the full list of commits since the last release:

```
git log <last-tag>..HEAD --oneline
```

If there is no previous tag, use `git log --oneline`.

Then use **subagents in parallel** to analyze the changes:

1. **Subagent 1 — Commit analysis**: Read through all commit messages and the actual diffs (`git diff <last-tag>..HEAD`) to produce a detailed summary of what changed, grouped by category (Added, Changed, Fixed, Removed, etc. per Keep a Changelog format).

2. **Subagent 2 — Version bump recommendation**: Review the commit messages and diffs to determine the appropriate semver bump:
   - **major**: breaking changes to CLI interface, config format, or preset/unit contracts
   - **minor**: new features, new presets/units, new config options, new commands
   - **patch**: bug fixes, documentation, internal refactors, dependency updates

   If the current version is `0.x.y`, be more liberal with minor bumps (breaking changes can go in minor during 0.x development).

Wait for both subagents to complete.

## Step 3: Confirm with the user

Present the following to the user and ask for confirmation before proceeding:

- The recommended version bump and new version number
- The changelog entry that will be written
- The list of commits being included

Wait for explicit user approval. If the user wants to adjust the version or changelog, incorporate their feedback.

## Step 4: Update CHANGELOG.md

Read the existing `CHANGELOG.md`.

- Rename the `[Unreleased]` section to `[<new-version>]` with today's date in ISO format (YYYY-MM-DD)
- Add a fresh empty `[Unreleased]` section above it
- Write the categorized changes into the version section

The format must follow Keep a Changelog:

```markdown
## [Unreleased]

## [X.Y.Z] - YYYY-MM-DD

### Added
- ...

### Changed
- ...

### Fixed
- ...

### Removed
- ...
```

Only include categories that have entries. Each entry should be a concise, user-facing description — not raw commit messages.

## Step 5: Update package.json

Update the `version` field in `package.json` to the new version number (without the `v` prefix).

## Step 6: Commit, tag, and push

1. Stage `CHANGELOG.md` and `package.json`
2. Commit with message: `release: v<version>`
3. Create an annotated tag: `git tag -a v<version> -m "v<version>"`
4. Push the commit and tag: `git push && git push --tags`

The GitHub Actions release workflow will automatically build binaries, sign macOS builds, and create the GitHub release from the changelog.
