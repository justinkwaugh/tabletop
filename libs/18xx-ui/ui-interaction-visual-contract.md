# Tile library visual contract

This library owns tile artwork and catalog inspection. It has no Game Session,
Action Draft, authorization, history, or rules engine. Game hosts own those
contracts when composing these assets into a Game Client.

## Visual intents

- **Browse:** search and color/track/stop filters determine the visible catalog.
  Matching definitions retain their full identity, including same-number variants.
- **Inspect:** choosing a card marks that card and displays its enlarged tile,
  identity, labels, values, token capacity, and explicit track segments. Pointer,
  touch, Enter, and Space use the same native button interaction.
- **Rotate:** clockwise/counterclockwise controls change the inspected orientation
  by one sixth-turn. The inspection reports degrees and rotated edge numbers.
- **Change presentation:** orientation and style controls affect all tile views in
  that viewer. They preserve definition, rotation, and highlighted path identity.
- **Inspect a segment:** a segment button toggles emphasis on precisely that path.
  Every path has a separate button, including paths that cross visually.
- **Choose for a host:** an optional Use tile button emits the definition ID and
  rotation. Browsing, automatic initial inspection, rotation, and highlighting
  never emit this event. The host decides whether to stage a game interaction.

## Coexistence and precedence

Inspection chrome surrounds the card and does not recolor the tile. Path emphasis
coexists with card inspection, style, and rotation. It draws over normal track and
under stops/annotations. Selecting a different tile resets rotation and path
emphasis. Reset returns to rotation zero and clears segment emphasis.

Changing the filtered collection resets inspection to the first visible tile at
rotation zero, with no segment emphasis. An empty result shows an empty state and
offers Clear filters. No hidden selection can be emitted. Each viewer instance
owns independent browsing state.

## Shared visual state

The viewer owns inspection (definition ID, rotation, optional path ID), filters,
orientation, and appearance. The renderer consumes those values and owns none of
their lifecycle. Inspection is valid only within the current filtered definitions.
Its writable derived default is replaced when that collection changes. Mounting
a new viewer starts a fresh local inspection; presentation is not persisted.

The renderer's supplied highlighted path IDs refer to the unrotated definition's
stable path IDs. Layout hints adjust only visual positions/controls. They cannot
add paths, merge cities, or alter token capacity. The caller must supply a matching
face and drawing when using the lower-level SVG artwork component.

There is no library Back/Undo interaction. Live View, History View, replay, and
restoration remain host concerns: a game host supplies the intended face and
presentation inputs for the state it is showing. The library commits no Actions.

## Render ownership

Artwork owns the hex background, track, stops, token spaces, revenue, and city labels.
It also renders the port symbol and a rectangular badge for a face's upgrade cost.
That cost belongs to the current face; terrain and persistent rights remain map facts.
Tile identifiers appear in viewer metadata and accessible names, not on the tile.
Geometry comes from the shared model and Common hex
geometry in a radius-50 coordinate space. Text remains upright in both hex
orientations and all rotations. Appearance changes styling, not drawing topology.
Circular revenue markers choose among the six corners, avoiding track and other
content. Cities with three or more slots move their revenue farther toward the
corner for clearance in both orientations. The separate-city specimen supplies
revenue overrides at 0° and 180° in flat-top views and throughout pointy-top
rotation to keep each value associated with its city. Labels yield to revenues.
Ordinary edge-to-edge tracks are circular arcs, or straight lines for opposite
edges. Towns split the same geometry at their stop without changing its curvature.
Through-town positions can move along that curve, as on #56. Central junction
towns use larger round dots; Classic through-towns use bars. Independent two-town
tiles preserve distinct node/path identities.
All track borders render beneath all track strokes, so borders cannot cut through
the black track at junctions or crossings.

Hosts can compose a track-overlay snippet after track and before stops, and an
overlay snippet after stops and before annotations. Both receive the same drawing,
including rotated path/node/slot coordinates. Hosts own route overlays, tokens,
location names, and associated input handling; catalog definitions remain immutable.
The library's annotations do not intercept pointer input. A whole-tile SVG exposes
an accessible name; the group artwork relies on its containing SVG/host for naming.
Optional inventory counts appear beside cards and in inspection details. The host
supplies counts; filtering, rotating, and browsing never consume or return pieces.
The separate `apps/18xx-tile-viewer` development app selects complete TOP, standard
1889, or beginner 1889 sets. It owns game imports and title integration/browser
tests; this shared package has no game dependencies or imports.

## Verification scenarios

Browser tests exercise same-number search/inspection, rotation/reset, segment
emphasis, style changes preserving geometry, empty results, label clearance from
stops and revenues, and mobile keyboard interaction
without horizontal overflow. The specimen page exercises each tile in all six rotations, both orientations, and
both styles, plus caller-owned route/token/location overlays and 64/110/180-pixel
views. Geometry tests verify logical endpoints, slot capacity, continuous town
curves, circular radii and tangents, crossing/junction distinction, city/revenue
association, and explicit layout hints.
Inventory tests verify physical-piece conservation, paired faces, return/retirement,
title isolation, and serialized state. Browser tests verify full title counts,
beginner extras, port rendering, preprinted tiles, and replacement examples.

Visual review covers labeled T/X/CX cities, the two #611 definitions, crossings,
multiple independent cities, staged revenue, and enlarged/mobile views. The
standalone development host renders on the client so it does not expose controls
before event handlers are attached.

## Map inspection and navigation

### Visual intents

Selecting a map hex outlines it and shows its map facts in inspection. Selecting
an internal path also highlights precisely that segment; selecting a station slot
outlines that space. Nodes without station slots are selectable as stops. Pointer,
touch activation, Enter, and Space emit the same stable semantic selection.
Keyboard focus has a visible outline before activation.

Fit, pan, zoom, full screen, and focus-on-selection change only the viewport.
Changing appearance preserves the current selection. The development host's
Show sample tile, token & route switch replaces its displayed inventory and overlays; choosing
a different map replaces the whole scene. Neither operation is a game Action.

### Coexistence and precedence

Slot and stop hit targets take precedence over tracks beneath them; track targets
take precedence over the containing hex. Transparent hit targets travel with the
artwork. A selected path's emphasis draws above a route highlight on that path;
both draw beneath stops and tokens. Hex selection coexists with all overlays. Hex outlines and terrain borders render
after every tile; selection and keyboard-focus outlines render above those layers.
These layers never intercept input, and neighboring tiles cannot cover an outline.
Names and annotations do not intercept pointer input. Markings have their own
reserved annotation space, while explicit tile layouts retain placement authority.

### Shared visual state

The host owns manual local inspection and supplies it to the scene and inspector.
The scene tracks keyboard focus locally for its top outline layer, clearing it on
blur or scene replacement.
The development host clears inspection when the map or prepared position changes;
style and viewport changes preserve it. Selection is valid only for a location,
path, stop, or slot in the current drawing. Tokens and routes are supplied position
data, independent of inspection. Viewport state belongs to `ScalingWrapper`; a new
map mounts a fresh wrapper and starts fitted. No map-view state is serialized.

There is no Action Draft, Back, Undo, replay, or history lifecycle in this viewer.
Future Game Session consumers must supply the intended visible position and own
selection invalidation at their session boundaries. The shared scene renders the
supplied position without initiating actions or inferring live/history mode.

### Render ownership

The map composes immutable geography with current tile drawings. The tile renderer
owns the underlying track/stops/revenues; the map owns location names, terrain,
future labels, persistent markers, borders, route highlights, tokens, and hit targets.
Map artwork labels named locations only; coordinates remain in inspection and
accessible names.
Initial home labels occupy empty station spaces and are reference annotations;
active reservation rules remain the host's responsibility. Covered terrain is
hidden on the board and retained in inspection. Zero fixed revenues are hidden
on the map, but remain available in inspection. Tile numbers stay outside artwork.

All geometry and overlays share one SVG and wrapper transform. The renderer's
natural hex size determines content dimensions; fit and focus must use those same
dimensions. Physical artwork and alignment are not part of the boardless view.

### Verification scenarios

Automated checks select edge stations and internal slots by keyboard and pointer,
then focus, zoom, pan, refocus, and fit at desktop/mobile widths. Inspection and
prepared token/route identity survive those viewport changes. Switching maps
checks complete location counts; inspecting geography checks private markers,
future labels, untokenable cities, and combined terrain costs. Unit checks verify
both orientations, adjacent border alignment, immutable map facts after replacement,
and rejection of invalid overlay targets or multiple tokens in one slot.

Manual review covers both complete maps at fit, enlarged Kouchi's track/label/cost
layout, and narrow-screen navigation. The surrounding controls remain prototype
presentation; the tile/map geometry and semantic hit-target contract are shared
library assets.

## Finance inspection

### Visible intents

Portfolios show cash, certificate pools, share units, effective certificate-limit
weights, and private ownership. Company details identify the President and
Controlling Owner. Title-specific numbered-share explanations remain visible.

The prepared stock turn supports purchasing, selling, company starts, and finishing. A manual
purchase selection replaces the choices with the price, payer contributions, and
any presidency exchange. A sale selection shows quantities, total proceeds,
resulting market prices, and presidency exchanges. Additional companies may join
the sale; ordered blocks determine marker arrival order. Buttons move a block
earlier or later or remove it. Native buttons support pointer, keyboard, and touch.

The shared stock market displays each distinct space and its committed marker
stack, top to bottom. Its scroll area is keyboard focusable and contained at
mobile widths. Market order is listed beneath it. Equal prices retain separate
spaces and stack identities. Previewing a trade does not move markers.

### Coexistence and precedence

Only one manual purchase, sale, or company-start selection exists at a time. A sale may contain
several ordered company blocks. Back cancels an entire purchase or sale selection;
company starts unwind the stages described below. Undo
clears a manual selection first, otherwise it undoes committed history, including
Finish turn. There are no automatic selections. While processing or in History
View, selections do not render and trade controls are unavailable.

Finishing requires no pending selection and compliance with the stock limits.
Over-limit states display a sale requirement. Title rules determine available
purchases and sales, including sale-before/after-purchase restrictions. The example
stops after Finish turn; Undo restores that turn.

### Shared visual state

The Game Session owns manual selection and derives eligibility and preview results
from Displayed Game State. Selection is hidden during visible-state updates and
cleared before new state is published. It drives previews only. Title switching,
reload, and state replacement discard selection; saved trades and their history
survive reload. History View is read-only; the example exposes Undo but no history
navigation controls. Portfolio counts and market positions follow the displayed
state when it changes, without local mutation or replay effects.

### Render ownership

The shared trading panel renders choices, confirmation, and committed trade history.
The market renders spaces and marker stacks. The inspector arranges owner portfolios
and management details; its certificate-weight input comes from the title's stock
rules, so market exemptions affect both legality and displayed counts. The Game
Session creates all actions. The host supplies title choice and session lifetime,
preserving earlier fixture versions. These are prototype trading layouts.

### Verification scenarios

Automated desktop/mobile browser checks select, cancel, confirm, reload, and undo
Union Bank purchases, with 40 paid by Union Bank and 52 by Alex. Reserved purchases
are disabled. 1889 distinguishes IPO par from Market pricing.

Sale checks select two Mainline shares, preview 184 and an Alex-to-Blair presidency
exchange, cancel without mutation, then confirm. Mainline enters the 86 space below
Souris; Alex receives 184. Reload restores the sale. A Souris purchase and Finish
turn then undo in reverse order, restoring cash, presidency, certificates, and
market position. 1889 checks an Iyo purchase that changes president and a subsequent
Awa sale; both undo exactly. Engine tests cover multi-company arrival order, market
exemptions, rejection, and processed replay. Screens have no page errors or document
horizontal overflow.

### Company formation and flotation

Starting companies adds a third exclusive manual selection alongside purchases
and sales. Selecting a company/buyer opens its starting-price choices; selecting a
price opens the payment confirmation. These use Common's staged selection helpers.
Back from confirmation clears the price; Back from price choice clears the company.
Undo clears the entire manual selection before committed history. Neither stage
auto-selects. Processing, History View, state publication, and disposal use the
same visibility/lifetime rules as other stock selections.

A purchase preview identifies flotation and initial capital when it reaches the
threshold. Confirmation records the purchase and its automatic FloatCompany action.
One gameplay Undo reverses the triggering purchase and its system consequences.
History records the start or flotation and payments. Company details show separate
started/funded/floated/operated facts and reserved or placed home locations.

The harness selects Share trading, Starting companies, or Flotation. Each has its
own persisted example; switching disposes the session and discards drafts. Reload
restores committed state. These controls select examples, not game-rule actions.
Desktop/mobile checks cover both Back stages, confirmation, reload, position/title
switching, market/cash/ownership results and complete Undo of flotation.
