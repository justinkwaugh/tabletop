---
name: game-pr-readiness
description: Audit a tabletop game implementation for pull-request acceptance and deployment readiness. Use when asked whether a game, game branch, or game PR is ready to submit, accept, merge, or deploy.
---

# Game PR Readiness

Perform a read-only, exhaustive gate review of one game's logic module and UI module. A single violation makes the result **NOT READY**. Finish all seven gates even after finding a failure; the report must contain every violation found, not merely representative examples.

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
- a large raster is stored in a format other than JPEG unless transparency genuinely requires PNG;
- a raster's natural dimensions materially exceed the high-density budget for its largest ordinary rendered dimensions. Treat approximately 2x the rendered width and height as desirable HiDPI resolution. Allow modest headroom above 2x for rounding, source aspect ratio, or avoiding a redundant asset variant; a ratio around 2.5x is not a violation by itself. Investigate ratios approaching 3x and fail only when the excess beyond the 2x target is meaningful and avoidable. An 800x400 image rendered only at 200x100 is a clear 4x violation;
- an image remains oversized after the 2x HiDPI allowance because CSS, SVG attributes, transforms, canvas drawing, or runtime code consistently scales it down. Check indirect component usage and responsive variants rather than relying only on `<img width>` attributes;
- an asset is unused, duplicated at unnecessary resolutions/formats, or otherwise ships avoidable image weight.

Record raster artwork that can reasonably be represented as SVG as a **strong recommendation**, because SVG is preferred for scalable shapes, masks, and line art. SVG suitability alone is not a violation, does not fail the gate, and does not contribute to the violation count. If the same asset independently violates a blocking rule above, report that violation separately.

Do not treat an alpha-capable PNG as transparent without checking actual pixels. When render size is dynamic, determine the normal maximum from the containing layout, aspect ratio, CSS, and component call sites. Judge excess resolution against that maximum after allowing for HiDPI density; do not fail an asset merely because its natural dimensions are a little more than 2x. Explain the concrete evidence and the appropriately sized or reformatted replacement in each violation.

### 2. Catalog title image

Locate `info.thumbnailUrl` in the game's `GameUiDefinition` and resolve it to an asset. Fail if it is absent, broken, remote/unstable, or unsuitable for the catalog.

Inspect the image visually and against both catalog contracts:

- compact card: 150px rendered height;
- large card: 340px rendered height, with responsive width behavior.

The title image must have a useful title/cover composition and aspect ratio at both sizes, enough natural resolution to avoid upscaling at 340px high, and no material excess resolution under gate 1. Record its file, format, natural dimensions, and expected rendered dimensions.

### 3. Svelte effects

Search every `.svelte` file in both allowed roots for runtime use of `$effect`, including `$effect.pre` and `$effect.root`. Any use is a violation. Distinguish executable use from comments or literal documentation, but report each executable occurrence with file, line, and the behavior it coordinates.

### 4. Animation architecture

Read and apply the [game UI animation skill](../game-ui-animation/SKILL.md) in review mode, including the canonical animation reference it requires. That skill is the authoritative entry point for animation ownership, mechanism choice, coordination, lifecycle, and history behavior. If animation guidance here ever conflicts with that skill or its canonical reference, follow the animation guidance.

Use the collector's animation inventory as a starting point, then trace every mechanism and state-derived visual change required by the animation review. Classify each as framework-owned semantic motion or local presentation and verify every path required by that skill. Do not infer readiness from the mechanism alone.

Fail this gate for every violation found by the animation review except actionless `AnimationContext` duration violations, which belong to gate 5. For each violation, report the exact transition contract and code path, the authoritative animation rule it violates, and the concrete remediation. This gate is complete only when every animation mechanism has been inventoried, every state-derived animation has been classified, and every applicable animation verification path has been evaluated.

### 5. Actionless AnimationContext budget

Use the same animation review to evaluate every game-session state-change listener and every branch reachable without an action against the authoritative actionless `AnimationContext` budget. Do not define a separate duration rule or include work that the animation guidance classifies as outside the shared context.

Fail this gate for every actionless context-owned path that violates the canonical budget or whose effective duration cannot be proven. Report the exact listener path and duration calculation required by the animation guidance. Keep these violations in gate 5 rather than duplicating them in gate 4.

### 6. Change boundary

Compare the complete change set with the fixed point established above. Every changed, renamed, deleted, staged, unstaged, or untracked path must be beneath one of the two allowed game roots. Any path outside them is a violation, including repository configuration, shared libraries, root lockfiles, docs, generated files, and other games.

### 7. Architecture and runtime integrity

Read and apply the repository's [game implementation design](../../../docs/DESIGN.md) as the authoritative entry point for game architecture and runtime invariants, including the domain documents, canonical interfaces, and conditional guides it routes to. The referenced sources define the rules; this gate defines how their findings affect readiness.

Classify the review scope before applying the design guidance:

- for a new game, evaluate the complete new-game contract and completion criteria;
- for a structural change to an existing game, trace every affected contract end to end without applying unrelated new-game requirements;
- for a UI-only change, evaluate the applicable UI, session, interaction, visual-contract, and verification requirements.

Review every applicable design area, including package and state boundaries, runtime composition and registration, deterministic execution, serialization and hydration, action and machine-state contracts, UI/session ownership, and repository verification. Follow the design document's pointers instead of restating their rules here.

Fail this gate for every violated invariant, missing required integration point, unresolved ambiguity that prevents the affected behavior from being proven, or applicable verification command that fails or cannot be completed. Treat recommendations as findings only when the authoritative guidance makes them required or the implementation causes a concrete architectural defect.

Assign thumbnail violations to gate 2, `$effect` violations to gate 3, animation violations to gates 4 or 5, and changed-path violations to gate 6. Report their architectural impact in those gates without duplicating them in gate 7. This gate is complete only when every applicable design verification item is recorded as passing, failing, or not applicable with a concrete reason.

## Report

Return a self-contained Markdown report with:

1. `READY` or `NOT READY`, the game, base ref, and merge-base commit;
2. a seven-row gate summary with `PASS` or `FAIL` and violation count;
3. every violation, grouped by gate, with a stable ID such as `IMG-001` or `ANIM-003`;
4. for each violation: file and line or asset path, observed evidence, violated rule, user-visible or deployment impact, and a concrete remediation;
5. verification details for passing gates, including the searches/files examined and image/title dimensions;
6. strong recommendations in a separate non-blocking section, excluded from gate violation counts and the readiness verdict;
7. an uncertainty section. Any unresolved uncertainty that prevents proving a gate passes makes that gate fail.

Do not modify the game while auditing. Do not stop at the first failure, collapse repeated violations into “and others,” or declare readiness based only on tests/builds.
