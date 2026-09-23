---
name: release-game
description: Release and deploy a game to production with tools/deploy. Use when asked to release, deploy, publish, or ship a game, or to check what is currently serving for a game.
---

# Release Game

Publishing a game is one command, `release-game`, which bumps versions, commits, tags, pushes,
and deploys. The work of this skill is choosing its flags correctly and confirming them with the
user. Run every command from the repository root as `node tools/deploy/esm/cli.js <command>`;
build the tool first with `pnpm --filter @tabletop/deploy run build` if `esm/` is missing.

## 1. Preflight

Run `preflight --game=<gameId>` and report to the user, before anything else:

- the serving logic and UI versions, or that the serving manifest is unavailable and why;
- the local versions and whether they match serving;
- which artifacts changed since their release baseline, with the file list and commits.

The preflight is deterministic about `--logic`: `release needed: logic and ui` means pass
`--logic`; `release needed: ui` means omit it. It counts the game's own package and its family
libraries (for an 18xx title, `libs/18xx` is part of the game's logic) and leaves out the
platform packages every game shares. Platform changes since the baseline are still listed under
`platform changes`; report them to the user, because a platform fix the game needs is a reason
to pass `--logic` even when the count says otherwise. That override is the user's call.

Stop and tell the user when:

- `release needed: none` — nothing to publish; ask what they expected to ship.
- `working tree clean: no` — release refuses a dirty tree. Show `git status --short` and ask
  whether to commit the changes, since committing is the user's decision.
- the branch is not the one the user intends to release from.

## 2. Choose the bump

The bump is the user's decision. If they gave `--major`, `--minor`, or `--patch`, use it. If
they did not, suggest one from the preflight's changed files and commits, show the evidence,
and get explicit confirmation or a different choice with `AskUserQuestion` before continuing.

For logic, the bump has runtime meaning: a loaded client on an older logic version keeps
playing against a newer minor or patch, and must reload on a new major
(`docs/contexts/game-distribution/CONTEXT.md`, Loaded Client Compatibility). Suggest:

- **major**: State or Action schema changes, changed action semantics, removed or renamed
  actions, anything a loaded client could not continue through.
- **minor**: new actions, options, or rules kept compatible with existing games.
- **patch**: fixes with no schema or interface change.

For a UI-only release: **major** for a change to the game's visual contract or the host bridge
usage, **minor** for new interactions or screens, **patch** for fixes and styling.

A hosted game exists for The Old Prince, so a logic major there means an already-running game
must survive the schema change. Say so in the suggestion when it applies.

## 3. Release

Run `release-game --game=<gameId> [--logic] --<bump>` and wait for it to finish. Before it
uploads anything it prints two lines, `serving before deploy:` and `deploying:`; relay both to
the user verbatim, as the record of what production had and what is about to replace it. It then
prints each step with its log path. On failure, read the log it names under `/tmp`, report the
failing step and the error text, and then:

- if the failure came before `Pushed`, nothing was published and nothing was tagged remotely;
  fix the cause and rerun the same command;
- if the failure came after `Pushed`, the release exists. Rerun the deploy only, with
  `deploy-game --game=<gameId> [--logic]` using the same `--logic` choice. A second
  `release-game` would spend another version. If commits have landed since the release, the
  tag is no longer on HEAD: check out the tag (`git checkout <tag>`), run `deploy-game` there,
  and return to the branch afterwards.
- `spawn gcloud ENOENT` or `No credentialed accounts` means this environment cannot upload.
  The Cloud CLI must be installed and logged in (`gcloud auth login --no-launch-browser`);
  that login is interactive, so hand it to the user.

## 4. Report

The command ends with `deploy SUCCEEDED:` or `deploy FAILED:` followed by `serving now:`, the
logic and UI versions the backend reports after the run. Relay those two lines verbatim, then
add the tags created and the pushed commit. The tool itself fails when the backend still
reports the old versions after the manifest upload, so a `SUCCEEDED` line already means
production serves the new versions. Report the outcome in exactly this shape:

```
Result: success | failure (<failing step>)
Served before: logic <x> / ui <y>
Deployed:      <artifacts and versions>
Serving now:   logic <x> / ui <y>
```

## Boundaries

`release-game` is the only path that changes package versions. Frontend and backend deploys
use the older `deploy-frontend` and `deploy-backend` commands and are outside this skill; a
change to shared Game Client code that must reach players through the frontend needs its own
publication (`docs/adr/0004-game-ui-host-bridge-contract.md`).
