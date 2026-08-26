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

Choose the mechanism according to the animation's coordination needs. The following are acceptable and are not violations merely because they do not use GSAP:

- Svelte `fade` transitions for local entry and exit;
- Svelte `flip` for reordering a rendered list, including order changes derived from game state;
- CSS animations for continuous, repeating presentation such as pulsing, glowing, bouncing, or other ongoing affordance cues;
- simple CSS transitions for local hover, focus, opacity, color, and transform feedback.

GSAP is preferred when an animation needs explicit timing, sequencing, cancellation, or coordination across multiple elements. A visual change that must stay synchronized with a committed game-state transition should use the game session's state-change listener/animator framework and the shared `animationContext`. A single-element or self-contained animation does not need the session framework solely because a state-derived condition mounts it, reorders it, or starts/stops a continuous cue.

Fail an animation only when its actual coordination contract requires capabilities its implementation does not provide. Examples include independently timed elements that can drift, game-state choreography that races the exposed state update, timers that stand in for completion across several moving elements, or a GSAP state animator that detaches work from the shared context despite needing synchronization. Trace intent and call paths rather than judging by imports or by the presence of non-GSAP syntax alone. Explain the concrete race, drift, sequencing, cleanup, or synchronization failure in every violation.

### 5. Actionless transition duration

Inspect every game-session state-change listener and every branch reachable when its `action` is `undefined`. Compute only the effective duration contributed to the shared `AnimationContext`, including nested timelines added to `actionTimeline` or `finalTimeline`, delays, timeline positions, repeats, `ensureDuration`, and callbacks that add work to those context-owned timelines.

Any actionless state transition whose context-owned timeline can exceed **0.200 seconds** is a violation. Do not include Svelte transitions, Svelte FLIP, CSS transitions/keyframes, component-local GSAP, hover motion, or other animations that are unrelated to the `AnimationContext` in this calculation. Report the exact actionless listener path and context-timeline duration calculation. If a context-owned duration cannot be bounded from the code, report that uncertainty as a violation rather than passing it.

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
