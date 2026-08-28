# Repository Agent Guidance

See docs/agent-coding-policy.md for shared-code and shared-types rules.

## Agent skills

### Issue tracker

Issues and specs are tracked in this repository's GitHub Issues. See `docs/agents/issue-tracker.md`.

### Triage labels

Use the default five-role triage label vocabulary. See `docs/agents/triage-labels.md`.

### Domain docs

Use the multi-context domain-doc layout. See `docs/agents/domain.md`.

### Animation

For game UI animation design, implementation, debugging, or review, use `.agents/skills/game-ui-animation/SKILL.md`.

## General Debugging Policy

- Treat bugs as deterministic unless proven otherwise. If behavior is wrong, there is a causal chain to identify.
- Default to root-cause fixes, not symptom suppression.
- Do not add guards, narrowing, fallback behavior, or render-path overrides unless you can explain the exact bad state/render path they are blocking.
- If you are explaining a root cause and still using guessing words like `probably`, `maybe`, or `likely`, then you have not identified the root cause yet.
- Before fixing a bug, be able to state:
  - the exact symptom
  - the upstream cause
  - the invariant being violated
  - why the proposed change fixes that cause instead of only hiding it
- If the root cause is not yet known, say that explicitly and keep tracing rather than writing “this shouldn’t happen” and patching around it.
- If a containment fix is necessary, label it as containment, explain the unresolved root cause, and do not present it as a complete fix.
