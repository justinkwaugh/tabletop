---
name: game-ui-harness
description: Run, launch, or test a game UI in the standalone dev harness. Use before testing game or harness behavior in a browser, and when source changes do not appear in a running harness.
---

# Game UI Dev Harness

Each `games/<game>-ui` package is a SvelteKit app that renders `Harness` from `@tabletop/frontend-components`. `vite dev` serves that package's own `src/` live, but resolves every workspace dependency to a **built output**, so a stale build silently serves old code.

Rebuild before launching. Skipping it is the single most common cause of "Justin's change isn't showing up".

## Rebuild the dependency artifacts

Game UIs consume their dependencies as build products, not source:

| Dependency | Consumed from | Declared by |
| --- | --- | --- |
| `@tabletop/frontend-components` | `dist/` | `exports` in its `package.json` |
| `@tabletop/common` | `esm/` | `exports` in its `package.json` |
| `@tabletop/<game>` (engine) | `esm/` | `exports` in its `package.json` |

A stale artifact does not fail loudly. A component added in source is simply **absent** from `dist/`, so the feature that renders it cannot appear, and nothing logs an error.

List every stale build in the workspace:

```bash
for d in libs/* games/* apps/*; do
  for out in dist esm; do
    [ -d "$d/src" ] && [ -d "$d/$out" ] || continue
    s=$(find "$d/src" -type f -printf '%T@\n' | sort -rn | head -1)
    t=$(find "$d/$out" -type f -printf '%T@\n' | sort -rn | head -1)
    [ "${s%.*}" -gt "${t%.*}" ] && echo "STALE: $d/$out"
  done
done
```

Rebuild each package the check flags that the harness actually loads — the two in the table plus the game engine:

```bash
pnpm --filter @tabletop/frontend-components build   # src/lib -> dist
pnpm --filter @tabletop/<game> build                # engine -> esm
```

`dist/` and `esm/` are gitignored, so rebuilding leaves the tree clean. Done when the check prints no line for `libs/frontend-components`, `libs/common`, or `games/<game>`.

A package's own `dist/` staleness is irrelevant to its harness (that output only matters when `apps/frontend` consumes it), so leave it unless testing through the real app shell.

## Launch

```bash
lsof -ti:5173 -sTCP:LISTEN | xargs -r kill   # free the port first
rm -rf games/<game>-ui/node_modules/.vite    # required after rebuilding deps
pnpm --filter @tabletop/<game>-ui dev
```

Each `vite.config.ts` already pins `port: 5173` and `host: true`, so passing `--port` or `--host` changes nothing. Poll the log for `Local:` rather than sleeping; startup is well under 2s.

`Re-optimizing dependencies because lockfile has changed` on first start is expected after a pull and clears itself.

## Verify

Routes are `/` (the harness) plus whatever asset routes the game defines. `curl` a couple for a `200`.

That is the limit of automated verification: `src/routes/+layout.ts` sets `export const ssr = false`, so the served HTML is a ~1KB shell and proves only that the server responds, never that the harness rendered. **Do not report a harness as working on a `200`.**

Visual confirmation needs a real browser. This container has no `chromium-cli`, and installing a Playwright browser has repeatedly failed here — it stalls mid-extraction and yields `ETXTBSY`. Do not attempt it. Hand the URL to the user for the visual check, and say plainly which parts were verified and which were not.

## Harness feature gates

Harness affordances are gated, so a correctly built harness can still look unchanged. Check the gate before concluding a feature is missing.

The acting-player dropdown in the hotseat panel ([`HotseatPanel.svelte`](../../../libs/frontend-components/src/lib/components/HotseatPanel.svelte), [`ActingPlayerControl.svelte`](../../../libs/frontend-components/src/lib/components/ActingPlayerControl.svelte)) needs all three:

1. **Admin toggle on** — `isActingAdmin` is `actAsAdminStore.current`; the toggle sits in the harness header and options dropdown.
2. **"View as non-active player" off** — the gate is `isActingAdmin && !isViewingAsNonActivePlayer`.
3. **More than one active player** — with one, it renders plain `Acting as <name>`, no dropdown. Most turns in most games have a single active player, so the dropdown only appears at simultaneous-action moments.
