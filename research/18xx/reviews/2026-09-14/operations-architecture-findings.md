# Operations architecture / integration findings

172/172 assigned files accounted for. No confirmed runtime correctness issue in this architecture assignment. One low-priority documentation defect is actionable; test regression O1 is retained in the separate operating findings file.

## A1 — P3: Replace obsolete current-scope descriptions in the public title documentation

- File: `games/the-old-prince/README.md:12-15`; same defect in `games/shikoku-1889/README.md:13-16`, both UI package READMEs at lines 7-11, and `apps/18xx-tile-viewer/README.md` economy scope paragraph.
- Trigger/consequence: a maintainer following either title's primary entry documentation is told Definition loads only a strict three-player finance inspection, has no gameplay Actions, no real setup/playable game, and no catalog registration. Current Definitions default to real opening initialization, register complete Action/handler compositions, support 3–4/2–6 players and are staged as title artifacts; both full-game tests finish through canonical play. Normal UiDefinition also now uses GameTable while PrototypeUiDefinition owns the workbench. These conflicting entry points give an incorrect integration map to subsequent implementation and review.
- Evidence/spec: current `games/*/src/definition.ts`, `games/*-ui/src/lib/runtime.ts`, and passing `completeGame.spec.ts`; `docs/DESIGN.md` treats exact current canonical interfaces as authoritative, and `docs/agents/18xx-design.md` requires clear supported/extension/out-of-scope distinctions. This is documentation maintenance, not a claimed rule omission or a demand to finish deferred UI work.
- Correction: rewrite current-scope paragraphs to identify actual opening/runtime/table/workbench exports and supported counts, link the current complete-game/autorouter evidence, and retain explicit TOP auction ambiguity, deferred beginner/physical-map/mobile limitations as appropriate. Keep historical slice notes labeled historical rather than presenting obsolete milestones as current status.

## Reviewed design boundaries

Shared logic/UI dependencies flow toward Common and family packages, with title rules/data/layouts injected. Tile geometry preserves semantic paths/nodes and station slots; catalog identity is separate from supply identity. Renderer, GameTable and worker code do not commit gameplay in reactive effects. Worker result cancellation, source-tagged selections, draft tile motion, map focus restoration, and historical map reconstruction follow their stated ownership boundaries. The prototype session's accepted size was not treated as a defect.

Frontend changes are additive: default top inset remains 8px; overlay/toolbar/manual-camera callbacks are optional; preference methods are optional for older hosts; local hotseat terminal Undo changes local authorization only. Adopting shared UI/session changes requires republishing bundled UI Artifacts (TOP and 1889 for these consumers); schema/rule changes require their corresponding Logic/UI adoption. No public host bridge shape was removed.

## Verification limits

22/22 shared UI geometry/selection/history helper tests and 22/22 full-game/opening/finished-fixture tests passed. Exact benchmark JSON/script executed successfully. The generated finished-game JSON was covered by canonical replay of every command plus exact processed replay/reverse Undo, not by manually reading every repeated JSON record. Existing frontend infrastructure was reviewed through all changed hunks and surrounding call paths. No browser styling or hosted deployment audit was performed or claimed.
