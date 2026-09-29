---
name: game-pr-readiness
description: Audit a tabletop game implementation for pull-request acceptance and deployment readiness. Use when asked whether a game, game branch, or game PR is ready to submit, accept, merge, or deploy.
---

# Game PR Readiness

Perform a read-only, exhaustive gate review of one game's logic module and UI module. A single violation makes the result **NOT READY**. Finish every gate even after finding a failure; the report must contain every violation found, not merely representative examples.

## Establish scope

Identify the game slug and the comparison base. The only allowed change roots are:

- `games/<slug>/`
- `games/<slug>-ui/`

Gate 6 names the only changes allowed outside them. A title is **new** until it has been released: `new_title` is true when `origin` has no `<slug>-v*` or `<slug>-ui-v*` release tag (`release_tags`).

Use the user-supplied base when present. Otherwise use the merge base with the PR's base branch; if no PR metadata is available, prefer `origin/main`, then `main`, and state the chosen commit. Include committed changes since that merge base, staged and unstaged changes, and untracked files.

Run the UI package's `bundle` script, then the evidence collector:

```bash
pnpm --filter @tabletop/<slug>-ui bundle
python3 .agents/skills/game-pr-readiness/scripts/collect_readiness_evidence.py <slug> \
  --base <base-ref> --output /tmp/<slug>-readiness-evidence.json
```

The bundle's final catalog step fails on a missing cover image (gate 2) after Rollup has written `bundle/`; that output still serves gates 8 and 12. The collector finds evidence; every judgement is yours. It parses sources with the TypeScript and Svelte compilers installed for the UI package, so run `pnpm install` first if they are missing. Open every file and usage site it identifies. Use repository search as a fallback if the collector reports an unreadable image or incomplete evidence.

## Apply every gate

Record a pass or every violation for each numbered gate.

A gate marked **whole-title** judges the title as it stands, including code and assets the change does not touch. Trace capabilities a shared runtime factory in `libs/` supplies rather than relying only on hits beneath the game roots.

### 1. Image assets (whole-title)

Inventory every raster and SVG asset in the UI module. For each raster, record file bytes, natural dimensions, transparency, every usage site, and its ordinary/default rendered dimensions across responsive layouts.

Fail any of these:

- a PNG has no actual transparency; opaque raster artwork belongs in JPEG;
- a large raster is stored in a format other than JPEG unless transparency genuinely requires PNG;
- a raster's natural dimensions materially exceed the high-density budget for its largest ordinary rendered dimensions. Treat approximately 2x the rendered width and height as desirable HiDPI resolution. Allow modest headroom above 2x for rounding, source aspect ratio, or avoiding a redundant asset variant; a ratio around 2.5x is not a violation by itself. Investigate ratios approaching 3x and fail only when the excess beyond the 2x target is meaningful and avoidable. An 800x400 image rendered only at 200x100 is a clear 4x violation;
- an image remains oversized after the 2x HiDPI allowance because CSS, SVG attributes, transforms, canvas drawing, or runtime code consistently scales it down. Check indirect component usage and responsive variants rather than relying only on `<img width>` attributes;
- an asset is unused, duplicated at unnecessary resolutions/formats, or otherwise ships avoidable image weight.

Record raster artwork that can reasonably be represented as SVG as a **strong recommendation**, because SVG is preferred for scalable shapes, masks, and line art. SVG suitability alone is not a violation, does not fail the gate, and does not contribute to the violation count. If the same asset independently violates a blocking rule above, report that violation separately.

Do not treat an alpha-capable PNG as transparent without checking actual pixels. When render size is dynamic, determine the normal maximum from the containing layout, aspect ratio, CSS, and component call sites. Judge excess resolution against that maximum after allowing for HiDPI density; do not fail an asset merely because its natural dimensions are a little more than 2x. Explain the concrete evidence and the appropriately sized or reformatted replacement in each violation.

### 2. Catalog title image (whole-title)

Locate `info.thumbnailUrl` in the game's `GameUiDefinition` and resolve it to an asset. Fail if it is absent, broken, remote/unstable, or unsuitable for the catalog.

Inspect the image visually and against both catalog contracts:

- compact card: 150px rendered height;
- large card: 340px rendered height, with responsive width behavior.

The title image must have a useful title/cover composition and aspect ratio at both sizes, enough natural resolution to avoid upscaling at 340px high, and no material excess resolution under gate 1. Record its file, format, natural dimensions, and expected rendered dimensions.

### 3. Forbidden constructs

Test files, as the collector lists them under `test_files_exempt_from_forbidden_constructs`, are exempt. Every other file in both roots is in scope; a helper only tests import belongs in a test location.

Report every executable occurrence with file, line, and the behavior it serves. Distinguish executable code from comments or literal documentation. Fail each of these:

- `$effect`, `$effect.pre`, or `$effect.root` in a `.svelte` file (`search_hits.svelte_effect`);
- a type-assertion cast, `value as T` or `<T>value`, which the [coding policy](../../../docs/agent-coding-policy.md) forbids. `as const` is allowed. `type_escapes.violations` comes from parsing each file, including Svelte template expressions, so each hit is real syntax; open `type_escapes.unparsed_files` manually;
- an explicit `any` type (`type_escapes.violations` with kind `any`);
- a type-check or lint suppression comment (`production_hits.type_check_suppression`);
- a nondeterministic source in the logic package (`logic_hits.nondeterminism`) whose value can reach game state, an Action, the system Action cascade, or a rule decision. [Deterministic execution](../../../docs/DESIGN.md#deterministic-execution) requires these values to come from a persisted state PRNG. Record why each remaining hit cannot reach them.

One cast is exempt: `UiDefinition as unknown as GameUiDefinition<GameState, HydratedGameState>` in the dev harness page (gate 7), `games/<slug>-ui/src/routes/+page.svelte`, reported under `type_escapes.exempt_harness_casts`. Every other cast is a violation, including another in the harness page.

### 4. Animation architecture

Read and apply the [game UI animation skill](../game-ui-animation/SKILL.md) in review mode, including the canonical animation reference it requires. That skill is the authoritative entry point for animation ownership, mechanism choice, coordination, lifecycle, and history behavior. If animation guidance here ever conflicts with that skill or its canonical reference, follow the animation guidance.

Use the collector's animation inventory as a starting point, then trace every mechanism and state-derived visual change required by the animation review. Classify each as framework-owned semantic motion or local presentation and verify every path required by that skill. Do not infer readiness from the mechanism alone.

Fail this gate for every violation found by the animation review except actionless `AnimationContext` duration violations, which belong to gate 5. For each violation, report the exact transition contract and code path, the authoritative animation rule it violates, and the concrete remediation. This gate is complete only when every animation mechanism has been inventoried, every state-derived animation has been classified, and every applicable animation verification path has been evaluated.

### 5. Actionless AnimationContext budget

Use the same animation review to evaluate every game-session state-change listener and every branch reachable without an action against the authoritative actionless `AnimationContext` budget. Do not define a separate duration rule or include work that the animation guidance classifies as outside the shared context.

Fail this gate for every actionless context-owned path that violates the canonical budget or whose effective duration cannot be proven. Report the exact listener path and duration calculation required by the animation guidance. Keep these violations in gate 5 rather than duplicating them in gate 4.

### 6. Change boundary

Compare the complete change set with the fixed point established above. Every changed, renamed, deleted, staged, unstaged, or untracked path must be beneath one of the two allowed game roots. Any path outside them is a violation, including repository configuration, shared libraries, docs, generated files, and other games, except these two:

- a new title's `config/config-games/src/games.json` change whose only effect is adding that title's `{ gameId, packageId }` entry, which the release tools and local hosting require (`exempt_catalogue_addition`);
- a `pnpm-lock.yaml` change confined to the title: it changes only the `games/<slug>` and `games/<slug>-ui` importer entries, otherwise only adds package entries, and `pnpm install --frozen-lockfile --lockfile-only` passes (`lockfile_change`).

The collector leaves a qualifying file out of `outside_allowed_roots`. Any other change to either file is a violation; a lockfile change beyond the title, such as another package's version moving, belongs in its own PR.

### 7. Architecture and runtime integrity

Read and apply the repository's [game implementation design](../../../docs/DESIGN.md) as the authoritative entry point for game architecture and runtime invariants, including the domain documents, canonical interfaces, and conditional guides it routes to. The referenced sources define the rules; this gate defines how their findings affect readiness.

Classify the review scope before applying the design guidance:

- for a new game (`new_title`), evaluate the complete new-game contract and completion criteria, including its `games.json` entry;
- for a structural change to an existing game, trace every affected contract end to end without applying unrelated new-game requirements;
- for a UI-only change, evaluate the applicable UI, session, interaction, visual-contract, and verification requirements.

Review every applicable design area, including package and state boundaries, runtime composition and registration, deterministic execution, serialization and hydration, action and machine-state contracts, UI/session ownership, and repository verification. Follow the design document's pointers instead of restating their rules here.

Fail this gate for every violated invariant, missing required integration point, unresolved ambiguity that prevents the affected behavior from being proven, or applicable verification command that fails or cannot be completed. Treat recommendations as findings only when the authoritative guidance makes them required or the implementation causes a concrete architectural defect.

Every title's UI package carries its own dev harness, even when a shared playground also hosts the title: a `dev` script, `vite.config.ts`, `src/app.html`, and `src/routes/+page.svelte` rendering the shared `Harness` with the title's `UiDefinition` (`dev_harness`). Record each missing piece as a violation.

Player Identity is the player ID ([player relationships](../../../docs/DESIGN.md#player-relationships)); record this item explicitly, reporting each rule that compares or keys on player color as a violation.

Assign thumbnail violations to gate 2, forbidden-construct violations to gate 3, animation violations to gates 4 or 5, changed-path violations to gate 6, UI entry weight violations to gate 8, metadata and stored-game compatibility violations to gate 9, tournament setup violations to gate 10, and hidden-information violations to gate 11. Report their architectural impact in those gates without duplicating them in gate 7. This gate is complete only when every applicable design verification item is recorded as passing, failing, or not applicable with a concrete reason.

### 8. Metadata-only UI entry

The site imports every published title's UI entry (`index.js`) to list the library, on every signed-in page load, so each entry must stay **metadata-only**: `info` and the cover asset, with the game itself reached only through the `runtime()` dynamic import.

In source, the module exporting `UiDefinition` builds `info` from the logic package's lightweight `<Title>Info` export (as `BridgesInfo` and `EstatesInfo` do), in a logic-package module whose imports are metadata only. Fail when it imports the logic package's `Definition`, or any other value whose module evaluates runtime construction such as `createEighteenXXRuntime(...)`, handlers, or the engine, even when only `.info` is read: that import carries the whole runtime into the entry chunk.

Prove it in the built artifact: follow the static `import`/`export … from` graph from `bundle/index.js`, excluding dynamic `import()`. Record the files and total bytes. Fail if that graph contains the chunk that `runtime()` imports, game components, or logic runtime code. For reference, lightweight entries measure from about 1 KB to 90 KB, while The Old Prince's pre-fix entry, which imported `Definition`, pulled in 501 KB.

### 9. Title metadata and stored-game compatibility

Check the title's `GameInfo` and runtime registration (`logic_hits.title_metadata`, `logic_hits.runtime_registration`, and `versions`). Fail any of these:

- player counts are not positive integers with `minPlayers <= defaultPlayerCount <= maxPlayers`;
- `metadata.version` does not come from `GAME_VERSION`, or the generated `src/definition/version.ts` differs from the logic `package.json` version;
- a new title (`new_title`) omits `metadata.visibility`. Without it, a title with `beta: false` is listed as Public on its first publication (`libs/common/src/site/titleVisibility.ts`). Report the declared value;
- the runtime does not register `canonicalStateValidator` with the compiled validator of the title's strict canonical state schema.

For a released title, determine whether games stored under the currently published Logic still load, replay, undo, and continue. `schema_diff` lists changed lines that touch TypeBox schemas since the merge base; also trace rule changes in the changed paths. Fail when previously valid stored state, Actions, or configuration become invalid or change meaning without being handled where the [design](../../../docs/DESIGN.md) places compatibility: the title configurator's `normalizeConfig` for configuration, and normalization or migration at load before canonical validation for state. Also fail rule changes that alter the result of replaying recorded Actions. Additive optional fields and new Action types are compatible.

### 10. Tournament setup (whole-title)

The authority is the [tournament game capabilities](../../../docs/tournament-game-capabilities.md); start from `logic_hits.competition`.

Fail any of these:

- the initializer does not declare `supportsStartingPositions: true`. The backend refuses tournament creation and provisioning without it;
- when a tournament assigns seats, the player in seat one is not the first player, or, where the title has a turn order, the players in later seats do not follow in their assigned order;
- the runtime does not declare `randomnessVersion: 1`;
- the runtime does not declare `scoring.finalScores`, or it reports a tiebreak value instead of the primary value the terminal handler ranks by;
- any terminal branch, including a defensive one, can record a result that `validateGameResult` rejects;
- no competition spec (`competition_specs`) covers every player count from `minPlayers` to `maxPlayers` and every configuration option that changes setup or the first actor. It must assert, for each assigned order, that seat one is the first player and later seats follow in their assigned order where the title has a turn order, that ordinary setup is otherwise unchanged for the same seed, and that a finished game passes `validateGameResult`. `games/estates/src/definition/competition.spec.ts` shows the expected coverage.

### 11. Hidden information (whole-title)

The authorities are the [hidden-information contract](../../../docs/hidden-information.md), the [design's schema and hydration rules](../../../docs/DESIGN.md#schemas-and-hydration), and the [adoption catalog](../../../docs/hidden-information-game-catalog.md).

First decide whether the title has hidden information: undrawn deck or bag contents or order, owner-only hands or money, pending sealed bids, secret randomness, or a configuration option that makes any of these private. Use the catalog entry when the title has one; otherwise analyze the rules and the state, Action, and randomness code, starting from `logic_hits.hidden_information_candidates`. Record the decision and its evidence either way.

Regardless of that decision, fail when the title uses visibility annotations or the protected PRNG (`logic_hits.hidden_information_api`) without registering `runtime.visibility`. Annotations do not enable projection, so hosted clients receive the full canonical state.

When the title has hidden information, fail any of these:

- `runtime.visibility` is missing, or lacks either the state projector or the Action projector;
- a secret field lacks a protecting policy, or an Action payload or metadata reveals a secret to a Perspective not entitled to it;
- secret randomness draws from the public PRNG instead of the protected stream;
- the projected schema is not derived with `Visibility.createProjectionSchema` from the strict canonical schema, or hydration does not accept the projected representation;
- the title has Exploration without a `createFromProjectedState` that populates hypothetical hidden values from the projection and public constraints only;
- no test verifies, for each Perspective, that the projection omits or redacts what it must, exposes what the Perspective is entitled to, and hydrates.

A title without hidden information and without visibility registration passes this gate; state why.

### 12. CSS encapsulation (whole-title)

A title's game-specific CSS styles only its own table. Every such rule sits under `[data-game-ui="<id>"]`, the attribute the site's `GameUI` puts on the title's root, or carries the package's Svelte scope class, `.svelte-<package slug>-`. The site injects every loaded title's CSS into one document and keeps it after navigation, so an unscoped rule restyles the site and every other title, and titles that ship the same unscoped selector override each other in load order.

Prove it in the built bundle: `css_encapsulation.bundle_scan` parses every stylesheet the bundle injects and classifies each selector. Fail each of these:

- the title publishes no stylesheet of its own: no non-harness code imports the stylesheet the scope plugin covers (`stylesheet_imports` with `covered_by_scope_plugin: true`), or `bundle_scan.prefixedRules` is 0. A title whose classes come from the site's own Tailwind scan of its sources (`site_tailwind_scans_title`) ties its styling to site releases; it bundles its scoped stylesheet from the runtime module instead, as The Old Prince and Bus do;
- a selector in `bundle_scan.leaks`. Trace each to the rule that defines it; its `source` is a sourcemap hint reliable only to the package. A top-level `:global(...)` rule is fixed by nesting it under a component-scoped selector (`.history :global(.timeline-item)`). A plain `.css` import the scope plugin does not cover (`stylesheet_imports` with `covered_by_scope_plugin: false`) is fixed by moving its rules into the scoped stylesheet or a component `<style>` block. A shared family library's leaks, such as `@tabletop/18xx-ui`'s, count against every title that ships them, with the fix in the library;
- a selector in `bundle_scan.wrongPrefix`, or a `scope_prefix` that differs from the title's `GameInfo.id`;
- a title-authored at-rule in `bundle_scan.globalAtRules`. `@keyframes`, `@font-face`, `@property`, and `@counter-style` names are document-wide, so give each a title-specific name, or declare keyframes in a component `<style>` block, which Svelte scopes. The scan already excludes Tailwind's own `--tw-*` properties and `spin`, `ping`, `pulse`, and `bounce` keyframes, which match the site's;
- code that styles the page outside the title's root (`production_hits.page_styling`): changing `document.body` or `document.documentElement` style or classes, or injecting style elements or rules.

The **platform layer** is the CSS that `@tabletop/frontend-components` and its third-party libraries ship identically in every title, such as the emoji picker, the Sonner toaster, and `GameChat`. It is shared by design and passes; the scan counts it under `platformLeaks` and `platformAtRules` instead of listing it. A third-party package the title's UI depends on directly is game-specific, and the scan lists its leaks.

## Report

Return a self-contained Markdown report with:

1. `READY` or `NOT READY`, the game, base ref, and merge-base commit;
2. a gate summary, one row per gate, with `PASS` or `FAIL` and violation count;
3. every violation, grouped by gate, with a stable ID such as `IMG-001`, `CAST-002`, or `HIDDEN-001`;
4. for each violation: file and line or asset path, observed evidence, violated rule, user-visible or deployment impact, and a concrete remediation;
5. verification details for passing gates, including the searches/files examined, image/title dimensions, the UI entry's static graph files and bytes, the CSS scan's scoped-rule count, the exempt harness cast, the declared catalog visibility, and the hidden-information decision;
6. strong recommendations in a separate non-blocking section, excluded from gate violation counts and the readiness verdict;
7. an uncertainty section. Any unresolved uncertainty that prevents proving a gate passes makes that gate fail.

Do not modify the game while auditing. Do not stop at the first failure, collapse repeated violations into “and others,” or declare readiness based only on tests/builds.
