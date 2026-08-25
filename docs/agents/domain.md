# Domain Docs

How engineering skills should consume this repository's domain documentation when exploring the codebase.

## Before exploring, read these

- **`CONTEXT-MAP.md`** at the repository root. It points to the `CONTEXT.md` files for individual contexts; read each one relevant to the work.
- **`docs/adr/`** for system-wide architectural decisions.
- Context-scoped `docs/adr/` directories beneath the relevant workspace, such as `apps/<context>/docs/adr/`, `games/<context>/docs/adr/`, or `libs/<context>/docs/adr/`.

If any of these files do not exist, proceed silently. Do not flag their absence or suggest creating them upfront. The `/domain-modeling` skill creates them lazily when terminology or architectural decisions are resolved.

## File structure

This repository uses a multi-context layout:

    /
    ├── CONTEXT-MAP.md
    ├── docs/adr/                    ← system-wide decisions
    ├── apps/
    │   └── <context>/
    │       ├── CONTEXT.md
    │       └── docs/adr/            ← context-specific decisions
    ├── games/
    │   └── <context>/
    │       ├── CONTEXT.md
    │       └── docs/adr/
    ├── libs/
    │   └── <context>/
    │       ├── CONTEXT.md
    │       └── docs/adr/
    ├── config/
    └── tools/

`CONTEXT-MAP.md` is the source of truth for which workspaces constitute distinct domain contexts. A workspace need not receive a `CONTEXT.md` until it has domain terminology worth recording.

## Use the glossary's vocabulary

When output names a domain concept—in an issue title, refactor proposal, hypothesis, or test name—use the term defined in the relevant `CONTEXT.md`. Do not drift to synonyms the glossary explicitly avoids.

If a required concept is absent, reconsider whether the output is inventing language the project does not use. If it represents a genuine gap, note it for `/domain-modeling`.

## Flag ADR conflicts

If output contradicts an existing ADR, surface the conflict explicitly rather than silently overriding it:

> _Contradicts ADR-0007 (event-sourced orders), but worth reopening because…_
