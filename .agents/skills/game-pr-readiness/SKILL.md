---
name: game-pr-readiness
description: Audit a tabletop game implementation for pull-request acceptance and deployment readiness. Use when asked whether a game, game branch, or game PR is ready to submit, accept, merge, or deploy.
---

# Game PR Readiness

Perform a read-only, exhaustive gate review of one game's logic module and UI module. A single violation makes the result **NOT READY**. Finish all six gates even after finding a failure; the report must contain every violation found, not merely representative examples.

## Establish scope

Identify the game slug and the comparison base. The only allowed change roots are:

- `games/<slug>/`
- `games/<slug>-ui/`

Use the user-supplied base when present. Otherwise use the merge base with the PR's base branch; if no PR metadata is available, prefer `origin/main`, then `main`, and state the chosen commit. Include committed changes since that merge base, staged and unstaged changes, and untracked files.

Run the evidence collector before reviewing:

```bash
python3 .agents/skills/game-pr-readiness/scripts/collect_readiness_evidence.py <slug> \
  --base <base-ref> --output /tmp/<slug>-readiness-evidence.json
```

The collector finds evidence; it does not decide semantic animation or rendering questions. Open every file and usage site it identifies. Use repository search as a fallback if the collector reports an unreadable image or incomplete evidence.

## Apply every gate

Record a pass or every violation for each numbered gate.

### 1. Image assets

Inventory every raster and SVG asset in the UI module, including assets not changed by the PR. For each raster, record file bytes, natural dimensions, transparency, every usage site, and its ordinary/default rendered dimensions across responsive layouts.

Fail any of these:

- a PNG has no actual transparency; opaque raster artwork belongs in JPEG;
- raster artwork can reasonably be represented as SVG, because SVG is preferred;
- a large raster is stored in a format other than JPEG unless transparency genuinely requires PNG;
- a raster's natural dimensions materially exceed its largest ordinary rendered dimensions. There is no numeric file-size cutoff: compare the asset with its real render contract. An 800x400 image rendered only at 200x100 is a violation;
- an image is oversized because CSS, SVG attributes, transforms, canvas drawing, or runtime code consistently scales it down. Check indirect component usage and responsive variants rather than relying only on `<img width>` attributes;
- an asset is unused, duplicated at unnecessary resolutions/formats, or otherwise ships avoidable image weight.

Do not treat an alpha-capable PNG as transparent without checking actual pixels. When render size is dynamic, determine the normal maximum from the containing layout, aspect ratio, CSS, and component call sites. Explain the concrete evidence and the appropriately sized or vector replacement in each violation.

### 2. Catalog title image

Locate `info.thumbnailUrl` in the game's `GameUiDefinition` and resolve it to an asset. Fail if it is absent, broken, remote/unstable, or unsuitable for the catalog.

Inspect the image visually and against both catalog contracts:

- compact card: 150px rendered height;
- large card: 340px rendered height, with responsive width behavior.

The title image must have a useful title/cover composition and aspect ratio at both sizes, enough natural resolution to avoid upscaling at 340px high, and no material excess resolution under gate 1. Record its file, format, natural dimensions, and expected rendered dimensions.

### 3. Svelte effects

Search every `.svelte` file in both allowed roots for runtime use of `$effect`, including `$effect.pre` and `$effect.root`. Any use is a violation. Distinguish executable use from comments or literal documentation, but report each executable occurrence with file, line, and the behavior it coordinates.

### 4. Animation architecture

Inventory every animation mechanism: GSAP calls/timelines/plugins, Svelte animation and transition directives, CSS `animation`/`transition` and keyframes, Web Animations API, timers or `requestAnimationFrame` used for motion, FLIP helpers, and animation libraries.

GSAP is the default animation engine. Report every non-GSAP animation and determine whether it is a violation; an exception needs a concrete, narrow justification and must not animate a game-state change.

For every visual change intended to represent a game-state change, require all of the following:

- registration through the game session's state-change listener/animator framework;
- receipt of the shared `animationContext` for that transition;
- scheduling on `animationContext.actionTimeline` or `animationContext.finalTimeline`, with cleanup through the framework as applicable;
- no component-local watcher, Svelte effect, standalone GSAP timeline, CSS transition, or delayed callback independently reacting to game state.

Trace intent and call paths, not imports alone. An animator that imports GSAP but bypasses the session context is a violation.

### 5. Actionless transition duration

Inspect every game-session state-change listener and every branch reachable when its `action` is `undefined`. Compute the effective total duration contributed to the shared `AnimationContext`, including nested timelines, delays, timeline positions, repeats, `ensureDuration`, callbacks that add timelines, and the sequential action/final timeline contract.

Any actionless state transition whose total effective timeline can exceed **0.200 seconds** is a violation. Report the exact actionless path and duration calculation. If a duration cannot be bounded from the code, report that uncertainty as a violation rather than passing it.

### 6. Change boundary

Compare the complete change set with the fixed point established above. Every changed, renamed, deleted, staged, unstaged, or untracked path must be beneath one of the two allowed game roots. Any path outside them is a violation, including repository configuration, shared libraries, root lockfiles, docs, generated files, and other games.

## Report

Return a self-contained Markdown report with:

1. `READY` or `NOT READY`, the game, base ref, and merge-base commit;
2. a six-row gate summary with `PASS` or `FAIL` and violation count;
3. every violation, grouped by gate, with a stable ID such as `IMG-001` or `ANIM-003`;
4. for each violation: file and line or asset path, observed evidence, violated rule, user-visible or deployment impact, and a concrete remediation;
5. verification details for passing gates, including the searches/files examined and image/title dimensions;
6. an uncertainty section. Any unresolved uncertainty that prevents proving a gate passes makes that gate fail.

Do not modify the game while auditing. Do not stop at the first failure, collapse repeated violations into “and others,” or declare readiness based only on tests/builds.
