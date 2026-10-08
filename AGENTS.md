# Repository Agent Guidance

Before changing code, follow `docs/agent-coding-policy.md` for repository-wide coding, game-session action flow, transient UI state, visual-contract, and debugging rules.

## Agent skills

### Issue tracker

Issues and specs are tracked in this repository's GitHub Issues. See `docs/agents/issue-tracker.md`.

### Triage labels

Use the default five-role triage label vocabulary. See `docs/agents/triage-labels.md`.

### Domain docs

Use the multi-context domain-doc layout. See `docs/agents/domain.md`.

### Game UI host contract

Before changing Site Frontend ↔ Game UI communication or shared Game Client behavior bundled into a UI Artifact—including `GameSession`, its host dependencies, `TabletopApi` results consumed by a Game Session, `BridgedContext`, or `GameSessionBridge`—read `docs/adr/0004-game-ui-host-bridge-contract.md` and `docs/contexts/game-distribution/CONTEXT.md`. Verify mixed-artifact compatibility and identify which UI Artifacts must be republished to adopt the change.

### Game implementation

For new games or structural changes to game actions, state handlers, game state, or game components, read `docs/DESIGN.md`.

### 18xx design

Before designing or changing any 18xx model, Action, state/handler, logical or visual component, or other reusable functionality, follow `docs/agents/18xx-design.md`. Consider the functionality across all researched titles; TOP and Shikoku 1889 are the first implementation consumers.

### Staged interactions

For multi-step action selection, auto-selection, or `Undo` behavior, and before adding any `Back` control, read `docs/user-interactions.md`.

### Game UI layout

When building or reworking a game UI's table layout, turn header, action area, board interaction, board scaling, small-screen behavior, player panels, or history panel, read `docs/game-ui-layout.md`.

### Local infrastructure

The Firestore emulator and Redis run as the `firebase` and `cache` Docker Compose services, reachable from the devcontainer at `firebase:8080` and `cache:6379`. Emulator-backed specs run only when their hosts are set:

`FIRESTORE_EMULATOR_HOST=firebase:8080 CACHE_TEST_REDIS_HOST=cache pnpm exec vitest run <path>`

For end-to-end verification through the hosted site, use `.agents/skills/local-hosted-game/SKILL.md`.

The devcontainer is on the user's Tailscale network as `tabletop`. Bind dev servers to `0.0.0.0` (e.g. `vite --host`) and report URLs as `http://tabletop:<port>`, not `localhost`.

### Releasing

To release, deploy, or publish a game or the site frontend, or to check what is serving, use `.agents/skills/release/SKILL.md`.

### Production investigation

For read-only production evidence (logs, Cloud Tasks queues, Firestore records, serving revisions), use `.agents/skills/prod-investigation/SKILL.md`.

### Animation

For game UI animation design, implementation, debugging, or review, use `.agents/skills/game-ui-animation/SKILL.md`.
