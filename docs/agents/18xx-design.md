# 18xx design rule

For every model, Action, state/handler, logical or visual component, or other
functionality designed for the 18xx family or an individual 18xx title, consider
how that functionality is used across **all 18xx games covered by the research**.
Choose the most usefully reusable design with the least necessary complexity.
This applies to title-local work as well as the shared libraries.

TOP and Shikoku 1889 are the first executable consumers. Their agreement alone
does not establish a family-wide invariant; their differences do not exhaust the
family's variation.

## UI, tile-library, and map-rendering priorities

Early logic slices may use disposable prototype screens and controls. Use them to
exercise real Game Session and runtime behavior; treat their layout as temporary.
Design the eventual desktop and mobile experience separately around the complete
information and interaction demands of these games.

The shared tile model, catalog, rendered tiles, and map renderer are intended lasting assets.
Develop them early in the family libraries, considering tile variations across
all researched titles. Share verified tile definitions and renderer behavior
between games. Keep printed identifiers distinct from catalog identity, physical
inventory, and map placement; preserve title/edition-specific variants explicitly.
Use Common's hex geometry. Verify that visual track connections match the logical
topology and that tiles remain legible in small board and tile-picker views.

Design map rendering around one authoritative semantic map and two presentations:
physical-board artwork with placed tiles overlaid, and a generic boardless view.
Both share tile rendering, map-object identities, overlays, and interaction
semantics. Title-owned artwork alignment maps canonical locations to presentation
positions; rules and hit targets must not be inferred from artwork pixels.
The boardless view must convey the same rule-relevant geography, printed track,
terrain, labels, values, and persistent rights.

Allow the presentation to become an individual player's display preference.
Its storage scope and default remain presentation decisions; changing it must not
change Game State, generate an Action, or change another player's view. Verify
tile/station alignment, pointer-to-map conversion, overlays, and small-screen
navigation in both modes. Match physical artwork to the chosen map/rules edition;
record missing or mismatched assets before claiming that title's physical view.

Keep prototype-only panels in the development harness or title UI. Promote visual
modules into `@tabletop/18xx-ui` when they have demonstrated reusable value; shared
tile and map rendering are explicit priorities from the start. Disposable presentation
still follows the repository's action, authorization, and Back/Undo contracts.

## Before settling an interface

1. Identify the mechanism and existing Common/family functionality it could reuse.
   Common already supplies `HexGrid`, coordinate/direction/geometry types, and
   graph traversal/pathfinding interfaces.
2. Survey that mechanism across the full researched title catalog and recorded
   trait profiles. Group equivalent behavior, note substantive variations, and
   include titles that lack the mechanism. An unverified profile is an evidence
   gap, not proof of absence. Follow linked primary rules/source for variations
   that affect the proposed interface.
3. Separate stable meaning and shared procedure from differing data, rule policy,
   decision sequence, and presentation. Evaluate known counterexamples to each
   proposed invariant. Apply this to serialized data, action payloads, state
   sequencing, and visual assumptions, not just the calculation implementation.
4. Choose the smallest useful implementation for the current slice. Preserve
   distinctions needed for known future uses, while implementing rule options,
   extension points, and abstractions only when they earn their complexity.
   A title-specific procedure can compose shared modules. Record an intentional
   limit when broader support would need a later extension.
5. Record a concise design note with the slice's issue or design proposal:
   research sections/profiles surveyed; relevant variations and counterexamples;
   shared behavior and title-owned choices; support implemented now versus
   considered for later; and examples that will verify the decision.

The design review is complete when every new or materially changed asset has this
evidence accounted for. Closely related assets can share one note if it explicitly
covers each asset's assumptions. Executable examples from TOP and 1889 verify the
current implementation; broader research examples challenge its interface without
requiring every researched title to be implemented.

## Research entry points

The existing research package is currently in the main workspace at
`/workspace/research/18xx-2026-09-08`. A worktree may not contain these untracked
sources; locate the package in the main workspace before duplicating research.

- `18xx-domain-model-study.md`: mechanisms and their meaningful variations.
- `18xx-game-variation-catalog.md`: title coverage and differences with source links.
- `18xx-trait-catalog.md` and `data/title-traits.json`: comparison traits and full
  title profiles, including scoped values and evidence gaps. These are research
  indexes, not an executable rules schema to copy into the library.
- `18xx-shared-engine-design.md`: existing implementation reuse and its limits.
- `top-rulebook-comparison.md`: TOP-specific evidence and unresolved differences.

The proposed [development slices](../../research/18xx/development-slices.md)
identify the first implementation consumers and deliverables. Their illustrative
counterexamples supplement the full-catalog survey; they do not replace it.
