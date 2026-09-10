# Tile library visual contract

The lasting tile/map components own artwork, catalog inspection, and navigation.
Game hosts supply state and own gameplay authorization. The separate finance
example modules compose these components with a Game Session for prototype play.

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
Reservation labels use supplied current reservations; omitted inputs derive printed
home annotations from the current map. An explicit empty list suppresses them.
Empty first station spaces contain the label; occupied spaces show it below the
token. Inspection lists both the placed station and any reservation. Active
reservation rules remain the host's responsibility. Covered terrain is
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

### Full stock-round prototype

The session's existing FinishStockTurn method advances to the next player. The
control reads Pass before a stock action and Finish turn afterwards; it stays
disabled while a manual choice is open. StockRoundStatus renders the active player,
turn order, and either TOP pass order or 1889 consecutive passes. A committed
purchase/start/sale updates that status through runtime processing.

The final pass automatically completes the round, adjusts sold-out markers,
updates player priority, and starts the operating set. The terminal prototype
shows the first operating order, controlling owners, fixed set length, and next
stock-round order. It advances to the first company’s track step; later operating steps remain deferred. History includes passes,
turn finishes, round completion, market movements, and operating-set start.

Undo across an ordinary turn finish returns control to the previous player. Undo
after completion reverses the final pass and both system actions together. No new
UI effects initiate actions. Reload restores the same stage and facts. Fixture
version 13 preserves previous example versions. Desktop checks cover these flows;
mobile refinement is deferred because this finance UI will be replaced.

Saved example selection requires successful canonical loading, not just a matching
fixture name. The harness preserves incompatible saves and tries another matching
save, creating a fresh example when none is compatible. Unrelated loading errors
still surface. A browser regression seeds the old stock-state shape under the
current fixture name, verifies recovery, and checks that the old data remains
unchanged and subsequent reloads reuse the new example.


### Live maps in finance examples

The session derives map drawings, placed stations, current reservations, and tile
counts from its exposed `gameState`, including History View. Static maps, manifests,
layouts, and station colors come from title UI configuration. Shared modules have
no title dependencies. Prepared placements persist with the financial example.

Map inspection is manual local presentation state, separate from stock drafts.
It is hidden during `updatingVisibleState`. Hex inspection remains valid while its
location exists; path, node, and slot inspection also require the same tile face
and a valid target in the displayed drawing. Returning to a matching historical
face can restore that inspection. Station exchange alone preserves the selection.
Stock Back and Undo retain map inspection; neither consumes it as a stock draft.

The shared MapViewer composes MapScene, MapInspector, and Common ScalingWrapper.
Fit, focus, pan, zoom, fullscreen, and style choices generate no Game Actions.
Style is local to each hotseat player in this session; reload resets preferences.
History controls use the existing Game Session history, including individual
system actions. Stock decisions are unavailable in History View. Live returns to
committed state; Undo reverses the player action and its automatic cascade.

The disposable FinanceMap panel exposes inventory through the existing tile
library. Browsing it cannot place tiles or change available counts. Boardless
rendering is active; physical presentation awaits title artwork.

Desktop browser checks cover TOP station exchange and its reservation through
purchase, flotation, history stepping, Live, and Undo; 1889's retained reservation,
placed tile and inventory count through flotation and reload; and independent
hotseat styles without extra actions. Shared map tests retain fit/zoom/pan coverage.


### Track construction

The session owns a manual location → tile → placement draft. Placement includes
rotation and the mapping of old stop IDs to the new tile. A single remaining
placement is auto-selected only when choosing the tile; no reactive loop chooses
or commits Actions. Back pops the last manual stage, skipping any auto placement.
Undo clears a manual draft before invoking committed history Undo. Reselecting a
location or tile removes downstream choices.

Legal target IDs come from the same TrackConstruction evaluator used by LayTile.
The scene draws dashed green target outlines above ordinary borders and below
selection/focus. Activating a legal target stages its location; other hexes retain
ordinary inspection. Slot/track hit precedence remains unchanged, and construction
uses the containing location regardless of the hit's subtype.

Selecting a placement supplies a hypothetical drawing and migrated station and
reservation overlays to MapViewer. The candidate hex gets an inset dashed amber outline;
inspection/focus remains above it. The selected location is inspected as a whole
hex, so old path/slot identities never highlight the wrong preview object.
The inspector describes that preview. Inventory counts, treasury, action history
and the actual game state remain committed values until Confirm track.

Drafts and targets are hidden in History View and while updatingVisibleState.
beforeNewState clears the draft. Back, Undo and history restoration redraw the
committed tiles and stations. Fit/focus, pan/zoom and player style do not change
the draft. Confirmation calls the session's LayTile method; Finish track calls its
FinishTrack method, which initializes the station step and transitions directly
to PlacingStation.
The prototype continues into station placement. Each committed lay appears in construction history with hex,
tile, rotation and cost.

Desktop checks cover TOP's manual rotation, Back, draft-clearing Undo, two lays,
second-lay cost, history, reload, and full Undo; and 1889's single auto placement,
Back skipping it, station-preserving upgrade, Finish track and Undo. Shared
semantic preview/target rendering is lasting; the control panel remains provisional.


### Station placement and track access

The session owns manual station → city-slot selections. An explicit click on a
hex or city with exactly one legal slot chooses that position; multiple legal
slots require a slot click or dropdown choice. No station is auto-selected.
Back removes the position before the station; Undo clears a manual draft before
undoing a committed action and its cascade. Drafts are hidden during History View
and updatingVisibleState, and cleared by beforeNewState. Only session methods
create PlaceStation and FinishStations Actions.

The preview reuses station tokens and reservation overlays, plus the inset amber
hex outline. Legal station hexes use the existing green target outlines. Selection
and focus stay above those outlines; slot hit precedence remains unchanged.
The inspector sees the hypothetical token; treasury, supply and history remain
committed until Confirm station. Finish stations initializes RouteStep and reaches RunningTrains. Finish track initializes station progress in the same Action; Undo restores
the unfinished track step and removes that station progress. 1889 homes appear through PlaceHomeStations before the
first company operates; their placement is individually visible in history.

The Company access selector and Show reachable track checkbox are local inspection
state. Blue paths reuse MapViewer's semantic segment overlay below stop artwork
and selection. They identify ordinary reachable track, not a validated train run.
The blocked-city list names reachable rival-filled cities where traversal stops.
Station previews recompute access for the inspected company; cancelling, committing,
Undo and history recompute from their corresponding displayed stations. Access
paths are hidden during tile previews and visible-state updates. Viewport and
style changes do not commit gameplay or consume staged choices.

The Station placement example is prepared and uses fixture version 15. Desktop
controls are provisional; no mobile layout work is part of this slice.


### Depot train purchases

The Train purchases example enters BuyingTrains directly. The title's TrainRules
supplies the depot and policies to the session. The session derives offers,
company rosters, allowance usage and the current train limit from exposed gameState.
Unavailable offers state the rule or implementation boundary; future phase changes
are blocked until their complete effects exist.

Train selection is one manual local draft, with no automatic selection. It names
an actual finite train or the next deterministic unlimited identity. Back clears
that choice. Undo clears a manual draft before undoing a committed purchase.
History and updatingVisibleState hide the draft; beforeNewState clears it. A stale
choice cannot confirm without passing the same evaluator as the BuyTrain Action.
The component calls session methods; only explicit confirmation buys the train.

The preview highlights a selected depot rank and states its price. Money, supply,
rosters and purchase history remain canonical until confirmation. History restores
those values, and returning Live does not restore a cleared draft. Map inspection,
styles and viewport controls remain independent. No map overlay represents an
uncommitted train purchase. Existing station/track examples do not skip the missing
route and dividend steps to enter BuyingTrains. The prototype has no finish control
that could bypass compulsory train funding.

Fixture version 13 preserves old saves. Train purchase controls remain provisional.


### Routes and operating results

RouteEditor owns the manual selected train, starting revenue center, ordered path
segments, and saved uncommitted routes. Session methods gate edits and construct
RunTrains. Save route stages a completed route; Confirm routes submits the full
set. The same authoritative evaluator produces per-center payments, per-train
revenue, distance and set-level track-conflict feedback. Invalid sets cannot be
confirmed. No optimizer or automatic route selection runs in the editor.

Back removes one path, then the start, then train selection. Undo clears all manual
route drafts before committed Undo. Draft overlays/controls are hidden in history
and during updatingVisibleState; beforeNewState clears them. The editor is rebuilt
from the next exposed game state. Reload restores committed results only. Map
style and viewport changes preserve drafts. Save/edit/remove controls do not
mutate canonical state or generate Actions.

A selected train can start at a map revenue-center/slot click or the center
selector. Connected path clicks and Next track buttons append semantic path IDs.
Other hits retain map inspection. Draft paths are amber; saved routes have distinct
colors. Route drafts retain only canonical location/node/path IDs, excluding
presentation fields from map selections. While route overlays are present, the reachability controls and blue
legend are hidden. Route overlays replace reachable-track overlays, retaining
the existing layer ordering below node artwork and selection. History renders
committed route overlays and itemized results for the viewed state.

FinishStations initializes RouteStep and advances directly into RunningTrains.
RunTrains stores OperatingResult and reaches TrainsRun pending earnings
settlement. The Routes fixture (version 15) supplies two trains and connected track
for each title. Zero/suboptimal submissions are permitted during this slice;
client-only automatic route suggestions belong to slice 18. No payout or market movement is
implied by a displayed route total. The route panel remains disposable.
