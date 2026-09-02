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

### Staged interactions

For staged selection, auto-selection, `Back`, or `Undo` behavior, read `docs/user-interactions.md`.

### Animation

For game UI animation design, implementation, debugging, or review, use `.agents/skills/game-ui-animation/SKILL.md`.
