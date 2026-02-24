# Shared Code and Types Policy

1. Before editing, run a duplication sweep in touched files (`rg`) and note candidate shared helpers/types.
2. Reuse existing helpers from `@tabletop/*` packages or local shared modules; do not add a local helper if an equivalent exists.
3. When duplicate logic appears in touched scope, extract/refactor to a shared module and update all call sites in the same change.
4. Reuse existing shared types from `@tabletop/*` packages or local shared modules; do not redefine equivalent structural types.
5. Prefer canonical shared types over inline structural aliases (example: use `Point` from `@tabletop/common` rather than `{ x: number; y: number }`).
6. Never use TypeScript type-assertion casts (for example `as SomeType`). `as const` is allowed for literal narrowing. If there is no safe way forward without a type-assertion cast, stop and ask for permission first.
7. Keep each layer focused: UI components should render and coordinate UI state, not own unrelated domain computation.
8. Keep derived/view-model types minimal: include only fields consumed by that specific render path.
9. If different render paths need different fields, split into separate derived shapes instead of one overloaded model.
10. Avoid speculative fallback logic: add fallback behavior only when explicitly required by product behavior.
11. Treat typed local configuration as trusted input; do not add repetitive runtime guards unless data is truly untrusted.
12. Apply normalization (rounding/snapping/clamping) at write/mutation boundaries, not repeatedly during read paths.
13. When branches share most logic, compute shared fields once and branch only for true differences.
14. Move reusable non-UI logic into utilities/modules; avoid embedding reusable algorithms in component files.
15. Before finalizing, run a complexity check: if a file mixes data assembly, domain logic, and rendering heavily, split/refactor.
