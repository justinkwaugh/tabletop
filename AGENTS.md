# Repository Agent Guidance

Before changing code, follow `docs/agent-coding-policy.md` for repository-wide coding, game-session action flow, transient UI state, visual-contract, and debugging rules.

## Agent skills

### Issue tracker

Issues and specs are tracked in this repository's GitHub Issues. See `docs/agents/issue-tracker.md`.

### Triage labels

Use the default five-role triage label vocabulary. See `docs/agents/triage-labels.md`.

### Domain docs

Use the multi-context domain-doc layout. See `docs/agents/domain.md`.

### Game implementation

For new games or structural changes to game actions, state handlers, game state, or game components, read `docs/DESIGN.md`.

### Staged interactions

For staged selection, auto-selection, `Back`, or `Undo` behavior, read `docs/user-interactions.md`.

### Animation

For game UI animation design, implementation, debugging, or review, use `.agents/skills/game-ui-animation/SKILL.md`.

### Dev harness

To run, launch, or test a game UI, or when source changes do not appear in a running harness, use `.agents/skills/game-ui-harness/SKILL.md`.
