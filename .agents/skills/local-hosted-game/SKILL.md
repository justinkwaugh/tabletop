---
name: local-hosted-game
description: Run and verify a Game through the full local hosted site, including manifest-selected Logic and UI Artifacts, Firestore, Redis, the backend, the Site Frontend, and multiple client accounts. Use when hosted behavior such as authorization, notifications, persistence, or hidden-information projections cannot be exercised faithfully in the single-game development harness.
---

# Local Hosted Game

Use the repository runner instead of rebuilding its orchestration in ad hoc shell commands.

## Start the site

1. Resolve the Game's `packageId` from `config/config-games/src/site-manifest.json`. If the request does not identify a Game and the intended one is not unambiguous, ask.
2. From the repository root, start `tools/scripts/local-hosted-game.mjs <packageId>` in a persistent terminal session.
3. Wait for `Local hosted game ready`. Do not report readiness based only on spawned processes; the runner checks both HTTP applications.
4. Give the user the printed Site Frontend, backend, and Firestore emulator URLs. Keep the terminal session running while they test.

The runner verifies that the package versions match the local Publication, builds the Game's Logic and UI Artifacts, stages the UI, checks or starts Firestore and Redis, and then starts the backend and Site Frontend. Do not read or print `.env` values; the runner checks configured service endpoints without exposing credentials.

If Compose is unavailable inside a devcontainer and infrastructure is down, ask the user to start the `cache` and `firebase` Compose services from the host, then rerun the command. Do not deploy or publish any production artifact.

## Exercise hosted behavior

- Use separate browser contexts and separate accounts for per-player behavior. Hotseat cannot validate confidentiality boundaries.
- Create and play the Game through the Site Frontend so requests pass through the real backend, persistence, notification transport, and hosted Game Session.
- Use the Firestore emulator UI only when canonical persistence needs inspection. Never treat canonical emulator data as proof of what a player client received.
- For hidden-information work, compare each player's visible State and History with the host/admin perspective, and test refresh, undo, and later reveal where applicable.

## Rebuild or stop

The runner deliberately does not live-watch Game source. After changing Game logic, Game UI, or shared client code, stop it with Ctrl-C and rerun it so the server Logic and staged UI are rebuilt together.

Use `--prepare-only` when the user intentionally manages the frontend and backend separately and only needs a validated rebuild/stage. If an application port is unexpectedly occupied, do not kill an unknown process; identify it or ask the user to stop the existing local site.

When testing is complete or the user asks to stop, send Ctrl-C to the runner and verify that its process has exited.
