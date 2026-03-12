You are creating a new release for this project. Follow these steps carefully:

## Step 1: Determine the last release

Run `git tag --sort=-v:refname` to find the most recent version tag (tags matching `v*`). If there are no tags, this is the first release — treat all commits as new.

Store the last tag (or the initial commit if none) for use in the next steps.

## Step 2: Gather and summarize changes

Get the full list of commits since the last release:

```
git log <last-tag>..HEAD --oneline
```

If there is no previous tag, use `git log --oneline`.

Count the number of commits. Then spawn **haiku subagents** to summarize the changes:

- If there are **≤ 20 commits**, use a single haiku subagent.
- If there are **> 20 commits**, split them into batches of ~15-20 and spawn **multiple haiku subagents in parallel**, one per batch.

Each haiku subagent should:
- Read the commit messages and diffs for its assigned batch (use `git show <hash>` for each commit, or `git log --patch <range>`)
- Produce a summary of what changed, grouped by Keep a Changelog categories: Added, Changed, Fixed, Removed, Security, Deprecated
- Each entry should be a concise, user-facing description — not raw commit messages

Give each subagent the specific commit hashes or range it is responsible for. Include the instruction to read the actual diffs, not just commit messages — commit messages alone are not sufficient.

Wait for **all** haiku subagents to complete before proceeding.

## Step 3: Determine version bump

After all summaries are collected, determine the appropriate semver bump. You (Opus) should make this determination yourself by reviewing all the summaries from step 2. Do NOT delegate this to a subagent.

Apply these rules:
- **major**: breaking changes to CLI interface, config format, or preset/unit contracts
- **minor**: new features, new presets/units, new config options, new commands
- **patch**: bug fixes, documentation, internal refactors, dependency updates

If the current version is `0.x.y`, be more liberal with minor bumps (breaking changes can go in minor during 0.x development).

Read `package.json` to get the current version. If there is no `version` field, start at `0.1.0`.

## Step 4: Confirm with the user

Present the following to the user and ask for confirmation before proceeding:

- The recommended version bump and new version number
- The full changelog entry that will be written (formatted in Keep a Changelog style)
- The number of commits being included

Wait for explicit user approval. If the user wants to adjust the version or changelog, incorporate their feedback.

## Step 5: Update CHANGELOG.md

Read the existing `CHANGELOG.md`.

- Rename the `[Unreleased]` section to `[<new-version>]` with today's date in ISO format (YYYY-MM-DD)
- Add a fresh empty `[Unreleased]` section above it
- Merge and deduplicate the categorized changes from all subagent summaries into the version section

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

Only include categories that have entries.

## Step 6: Update package.json

Update the `version` field in `package.json` to the new version number (without the `v` prefix). Add the field if it doesn't exist.

## Step 7: Commit, tag, and push

1. Stage `CHANGELOG.md` and `package.json`
2. Commit with message: `release: v<version>`
3. Create an annotated tag: `git tag -a v<version> -m "v<version>"`
4. Push the commit and tag: `git push && git push --tags`

The GitHub Actions release workflow will automatically build binaries, sign macOS builds, and create the GitHub release from the changelog.
