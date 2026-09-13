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
Unavailable offers state the rule or implementation boundary. Purchases that
advance a phase use the phase-change and compulsory-discard flow below.

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
route and dividend steps to enter BuyingTrains. Finish operating turn checks compulsory train ownership before advancing.

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
RunTrains stores OperatingResult and enters DistributingEarnings. The Routes fixture (version 15) supplies two trains and connected track
for each title. Zero/suboptimal submissions are permitted during this slice;
client-only automatic route suggestions belong to slice 18. No payout or market movement is
implied by a displayed route total. The route panel remains disposable.

### Earnings and round progression (slice 11)

Payout choice is manual session-owned local selection. Its preview uses the same
EarningsDistribution evaluator as DistributeEarnings. Back clears the choice;
Undo clears a manual choice before undoing a committed action. History and
updatingVisibleState hide the draft; beforeNewState clears it. Reload restores
only committed earnings. Confirmation shows recipient amounts, retained revenue,
rounding/bonus supplements and share-price movement; it never changes route
geometry. Committed payment details remain visible during train purchasing.

DistributeEarnings enters BuyingTrains. Finish operating turn is disabled while a
train purchase is drafted or a compulsory train is missing. The rules own company
completion, the next operator, private income at OR entry and the return to stock
trading. The operating-step strip and company order reflect canonical state.
Undo across a turn boundary also restores automatic round and income changes.

The Operating rounds fixture (version 16) starts at the first company's track
step, with first-round private income already included and trains prepared for
both majors. Subsequent private income is recorded by StartOperatingRound.
The Routes fixture now continues into earnings and train purchasing. Phase changes follow the interruption contract below; emergency funding and
game-ending obligations remain in later slices.

### Phase changes and compulsory train discards (slice 12)

Phase changes keep the operating company and its turn open. PhaseChanges displays
the current deciding company and controlling owner, excess count, and the saved
continuation. Buy/finish controls are unavailable until every compulsory discard
is resolved. The step strip continues to mark the interrupted operating step.
Completed events show rusted and deferred train identities in phase history.

Discard selection is manual session state; Back clears it, Undo clears it before
committed Undo. History/updatingVisibleState hide the selection and beforeNewState
clears it. Reload restores the pending company and continuation without restoring
a draft. No automatic selection consumes an Undo. Confirming the final discard
resumes the original company automatically without starting another player turn.

Diesel exchanges reuse the manual train-purchase draft and confirmation, including
its exchangeTrainId. Preview shows the trade-in, price, and resulting phase.
Market trains appear separately from depot supply. TOP's retained 4+ trains are
marked as awaiting a final operation and unavailable for trade. Their rusting
is an automatic consequence of completing the next RunTrains action.

Fixture version 18 adds Phase changes and Diesel arrival examples. These exercise
phase/rusting decisions; phase-triggered private powers and game-ending effects
are integrated in their planned later slices.

## Private exchanges and lifecycle

Private-company cards show ownership, income, closure, and eligible exchanges.
Selecting an exchange creates a manual session draft naming its owner and target.
Back clears that draft; Undo clears it before undoing committed history. History
and updatingVisibleState hide the draft; beforeNewState clears it.

An optional Dôgo exchange can belong to a different player than the ordinary turn.
The first active identity remains the ordinary decision owner; additional active
players may only exercise their own exchange. The example session preserves this
order for ordinary hotseat controls. Local hotseat exchange confirmation explicitly
names the private's owner; other clients only submit their own player's choice.
Components invoke session methods, never construct actions.

Phase history lists private closures, forced exchanges, and income changes.
Concession closure occurs with the company's earnings distribution. Prototype
version 20 adds four-player Private exchanges and Private phase effects examples;
ordinary game setup and negotiated powers remain later slices.

### Negotiated purchases and private powers

The disposable company-decisions panel is session-owned. Asset/price selection,
private tile placement, and early train selection are manual local drafts. Back
clears the draft; Undo clears a manual draft first, then uses engine history.
Drafts hide during updatingVisibleState and History View and clear in beforeNewState.
Committed offers, seller tile choices, and track-permission requests remain in
Game State across reload. Their entitled player decides before ordinary play resumes.
Other stock, construction, route, and train controls remain unavailable meanwhile.
Same-player purchases settle with one explicit confirmation. Another player's
private lay is selectable only through explicit Local Hotseat input; Hosted clients
remain limited to their associated player. All Actions are constructed by the
Game Session. Tile previews reuse the shared tile renderer, and committed changes
appear on the authoritative map. Track requiring another owner's consent says
Request track permission before submission and shows the proposed tile to that owner.

Between operating companies, an eligible private owner may act or Continue operating
round. Continuing declines only that window, retaining the unused power. The choice
and resulting automatic company start form a normal Undo history step. Automatic
private income and required home stations resolve before this optional window.

### Compulsory train funding

The prototype funding panel shows the selected train, remaining shortfall,
ordered liable owners, and only the current legal funding choices. FundTrain is
an explicit committed decision; its funding record persists across reload.
Issuance and contributions require explicit confirmation of the displayed amount.
A share-sale selection is a manual Game Session draft: Back clears it, and Undo
clears it before reversing a committed Action. Drafts hide in History View and
while updatingVisibleState, and clear in beforeNewState. Components call session
methods for every Action. Other operating, private, and stock actions are
unavailable during funding. Only the responsible player may act.

The selected train purchase uses existing phase-change and discard handling and
returns to ordinary train buying. Bankruptcy is a system consequence of exhausted
legal funding sources; the panel shows the company, player, and remaining
shortfall. It offers no further gameplay actions. Engine Undo restores the funding
state, including the contribution that triggered bankruptcy. Final scoring is a
later slice. Prototype save identity is version 22.

## Game table shell

The table shell owns the two-column layout, sidebar tabs, phase header, single
header Undo control, action-area boundaries and map viewport. It uses the existing
HistoryControls, DefaultTabs, GameChat and ScalingWrapper. Portfolio details can
be collapsed locally; neither expansion nor tab selection changes Game State.
MapScene renders directly in ScalingWrapper without a map card or inspector.

FinanceExampleSession.selectMap is the common map-intent entry point for both the
table and the logic workbench. Route extension/start takes precedence, followed by
track selection, station selection and ordinary inspection. The existing session
owns all drafts and invalidates them through beforeNewState/updatingVisibleState.
The shell does not create another selection state or publish Actions itself.

Header Undo delegates to the title session's existing undo method and is disabled
while busy, changing visible state or viewing history. hasActionDraft reports the
same drafts consumed by that method, including TOP's split draft. Embedded action
controls suppress their duplicate Undo buttons only in the table composition;
Back remains local to the active flow. History controls and history rows use the
existing History interface. The action list shows processed player Actions; system
consequences remain in canonical history and are navigable with HistoryControls.

Map, Market and Spreadsheet tabs sit between the action panel and the content
viewport, outside ScalingWrapper. Selection is local to the table and does not
clear an Action Draft or change Game State/history. The map stays mounted with
its viewport dimensions intact while inactive, preserving pan/zoom and inspection;
inactive panels are hidden from assistive technology and inert. Market renders
canonical visible-state prices and company markers. Spreadsheet is a placeholder.
Arrow keys, Home and End navigate the tabs; tab selection never scales with the map.

The Market panel now renders StockMarketScene directly in its own ScalingWrapper,
with no market heading, order summary or nested scroll frame. The scene owns only
the market spaces and company markers; the prototype StockMarket view composes
that same scene with its existing inspection chrome. Map and Market retain separate
pan/zoom positions while mounted; their shared tab strip remains outside both.
Market cells share single-width borders with values at the upper left. Small
lower-right up and lower-left down arrows indicate the current titles' dividend
edge turns; these are static annotations, not controls or staged movement.


Company order sits between the action area and view tabs, outside ScalingWrapper.
Its ordered token list follows the displayed OperatingSet, including completed
companies, with checks on completed turns. The current company uses the ordinary
pill styling; its operating status remains available through accessible semantics.
Pills sit below the operating-order heading. Each places a 38px company token filling the rounded left end
beside two compact lines: the available station-token count and tiny token icon
alongside dollar-prefixed cash above the owned train names. The token count and
icon are grayed out at zero. These summaries follow the displayed state, not Action Drafts.
During stock rounds it shows the prospective order supplied by the title's rules.
The strip owns no selection or Action; artwork has full company names available
as tooltips and accessible list labels. Interruptions do not substitute the deciding
company for the operator. Undo, history and reload derive the row from displayed
state. The same CompanyToken renderer uses title-provided artwork on map stations.

Company pills toggle one detail panel below the row. This inspection choice is
local to CompanyOrder and never initiates an Action or participates in Back/Undo.
Opening another company switches the panel; clicking the open pill collapses it.
The pill is the sole toggle; there is no close button in the card. The selected identity persists through visible
state updates and history; it is hidden while absent from the displayed order.
The panel always reads the displayed financial state, not staged purchases, routes
or station placements. Opening/closing it preserves map and market selections and
uses layout space above the tabs. The map viewport yields height without adding a
second scaling wrapper. Ownership rows distinguish owners and certificate pools;
private powers distinguish company ownership from the controlling player's privates.
Purchasable privates includes only open privates eligible for purchase by the inspected
company under the title's current transfer terms. It shows the maximum purchase
price, not operating revenue; the heading and divider disappear when empty.
Inspection does not depend on the active player or create a purchase offer.

The expanded card shows compact train badges directly beneath the company name,
with distance details in tooltips and an explicit No trains state. The header also
displays remaining station tokens with their current
placement cost under each. Costs come from title StationRules, with pending free
homes shown as $0. These are inspection graphics, not station-selection controls.

The president's ownership row is bold. A corporate president also shows a compact
“controlled by” line for its controlling player; direct player presidents need no
separate line. This is presentation of existing control, not a new control rule.

Private descriptions in company details are supplied by the title UI and limited
to powers affecting that railway’s operation, including powers gained on purchase.
Income, closure and share-exchange text is omitted. TOP describes Hunslet’s early
train purchase; 1889 describes Ehime’s unused sale-triggered upgrade and Sumitomo’s
terrain discount. Player-only powers are not implied to transfer with ownership.

No trains is red in both pill and expanded header when the inspected open company
requires a train under the title’s TrainRules for the displayed map. Trainless
exempt companies (including TOP PEIR) stay neutral. The signal is independent of
the active player and current operation step; it updates with displayed state.

The operating-order row stays on one line and scrolls horizontally within its
available width. Its heading and expanded company detail remain outside that
scroll area. Pills retain their natural size and the row uses a thin scrollbar.

Train badges in the company strip and expanded header share TrainBadge. Backgrounds
use the train's title-provided phase color from the existing tile palette, with
contrasting dark text. They retain the train's own color as the game advances.

Player panels use priority order, with a Priority deal marker on the first player
and a subtle border for the currently acting player. Cash, liquidity, shares, Certs (weighted count/limit), and current net worth precede the ownership table (company token, name, percentage; president
bold) and private-company table (income per OR and value). Liquidity is cash plus
one legal stock-sale block per company at current terms, excluding corporate cash
and negotiated private sales. Valuation is title-owned. All values follow the
displayed state, including Undo/history; no local draft affects them.

Shares totals directly owned share units, including multi-share president
certificates and numbered PEIR interests; it excludes privates and company-owned
assets. It is separate from the weighted certificate-limit count.

President ownership rows in player panels and company details share a small muted
P badge with an accessible President label, alongside bold text. The marker follows
the canonical president owner, including corporate presidents, rather than simply
the largest holding or the controlling player.

Title-selected company portfolio cards follow all priority-ordered player cards. They show direct company cash, shares, ownership, and net worth, with the controlling player identified separately; they receive neither a player priority marker nor player certificate-limit or liquidity statistics. TOP selects Union Bank; 1889 selects none.

During actionable track construction, all locations absent from the session’s legal track choices receive a translucent dark mask above map content. Legal locations remain clear without dashed target outlines; a preview uses the same single red outline as selection and hover. The mask follows the displayed construction state, including while accept or Undo is busy; it clears when leaving construction or entering history. Interaction eligibility remains separate. Masked spaces cannot be clicked or keyboard-selected during construction. The table ignores inspection-only clicks outside an actionable selection; the diagnostic workbench retains explicit inspection.

Hovering a legal track-lay location uses the same solid red outline as selection, without stacking a second outline. Masked locations receive no hover outline. Pointer exit, scene changes, and construction-availability changes clear this local presentation state; hover never selects or commits an action.

### Map track picker

Selecting a legal construction hex opens tile choices on a compact, evenly spaced circular arc around it. The arc prefers directly above the hex and rotates only as far as needed to clear viewport edges, without snapping to cardinal directions. It adjusts radius/size when rotation alone cannot fit. Choices match the map hex scale, shrinking only when needed to fit the viewport. Icon controls scale with the map. Both render outside the scaling wrapper and follow the hex through pan, zoom, and layout changes. Existing shared tile artwork and title layouts render each choice in a legal rotation.

Choosing a tile previews its first legal placement. Clicking that same map hex advances to the next distinct legal rotation, using its first legal station mapping; choosing another legal hex replaces the draft. Before tile choice, clicking away dismisses the picker and no cancel icon appears. After tile choice, cancel collapses the visible choices into the hex before clearing the draft and closing the picker. The accept icon calls the existing session confirmation, including consent when required. Neither tile choice nor rotation commits an action. Back/Undo retain source-tagged staged behavior; lifecycle invalidation and history suppress the picker with the existing track selection. Clicking away from the initial tile choices, including another tab, clears that draft; a selected tile preview remains staged when switching tabs.

The table action area keeps construction status, cost and Finish Track, with selection controls on the map. The economy workbench retains its existing explicit controls. Verification covers both titles, on-screen arc bounds, preview/rotation/cancel, acceptance, history, reload, Undo, and tab preservation.

The map construction header reserves inline space for the pending cost. Choosing, rotating, cancelling, or accepting a tile must not add a cost row or resize the map viewport.

### Draft tile motion

The map picker owns local, cancellable 220ms DOM motion triggered by a tile-choice or cancel gesture, not by committed game actions. On opening, choices fly and scale out from the selected hex into the arc. The selected choice moves to the hex; other choices remain selectable in their original arc positions, leaving a gap for the chosen tile. Selecting a replacement returns the previous choice to the arc. Cancel interrupts the current motion, shrinks all visible tiles into the hex over 160ms, then clears the draft and closes the picker. Clicking away from the initial choices uses the same collapse. Reduced-motion preference skips the flight.

A session-owned, draft-scoped in-flight flag keeps the map on its current committed artwork until the moving tile lands, avoiding duplicate preview artwork. The picker is the sole writer during the motion; selection replacement, teardown, and visible-state invalidation clear it. Accept interrupts and finishes the preview before invoking the existing action. New gestures retarget from current DOM positions. No animation frame writes interpolated motion into reactive state. History, replay, and silent restore do not create draft motion; teardown cancels outstanding DOM animations. The masking projection remains based on displayed construction state throughout busy updates.

Draft cancel/accept controls use a local 120ms opacity fade on entry and exit. On cancel, the fade begins alongside the tile collapse. This is non-blocking presentation, including picker teardown, with no opacity transition under reduced motion.

Tile text uses geometric-precision SVG rendering so revenue baselines remain centered during small-scale picker animations without waiting for pointer-triggered repaint.

Printed location names are visible only until a tile is laid on that hex; the location name remains available in its accessible label.

Hovering a picker tile enlarges its inner artwork by 10% over 120ms, replacing the colored glow. This local hover feedback is independent of the outer flight transform; reduced motion removes its transition.

Viewport-driven picker repositioning settles with a 100ms CSS translate transition. Browser interpolation handles motion without per-frame reactive tween writes. Explicit opening, selection, and collapse motion disables this settling transition so the two mechanisms do not compete; reduced motion also disables it.

Private-company rows in player panels and company cards (including purchasable privates) open title-owned descriptions on click or keyboard activation of the name. The shared floating layer centers above the row, flips or shifts against viewport boundaries, and locally rises 6px into place over 140ms (suppressed with reduced motion). The next click anywhere, Escape, or row removal dismisses it. This local information affordance neither stages nor commits game actions.

Accepting a track lay fades unchosen picker tiles in place over 120ms as the draft picker disappears. This non-blocking local exit does not delay confirmation or animate the committed tile. Cancel retains its collapse; reduced motion skips the exit.

A company portfolio header can expose its title-owned private description using the same click popover as private rows. TOP uses this for Union Bank; player headers remain ordinary headings.

During the opening auction's offer stage, the table shows the current auctioneer's legal lots, their face values and private income. Each Offer button commits through the session; no second confirmation is required. Buttons follow session authorization and busy/history eligibility. Undo remains the table's committed-action control. Bidding and stalled auctions retain the existing panel for now.

Offer-list location icons focus the Map tab using ScalingWrapper and select the referenced hex for inspection, without creating a game action. Clicking other row content opens its supplied description. Location icons and Offer buttons are excluded from description interactions. Company cards and player panels use the same click descriptions. TOP supplies PEIR numbered home locations and Vernon River Bridge's blocked hex; the shared UI does not infer geography from names.

Location focus frames a wider neighborhood around the hex. Repeating the same location-icon click fits the full map; a different icon focuses its location. The local focus toggle resets when the displayed financial state changes.

When operating pills overflow horizontally, a miniature token row appears beside the order label. A subtle window encloses only the fully visible pills' tokens, following scroll and resize; partially clipped pills remain outside the window. It disappears when the pills fit. The overview is decorative, mirrors canonical order, and never changes selection or game state. Measurement uses passive scroll events and ResizeObserver, coalesced with requestAnimationFrame; its short local window transition respects reduced motion.

ScalingWrapper keyboard shortcuts toggle fullscreen with F and exit with Escape. F is ignored in editable fields and with command modifiers; hidden map/market views do not handle it. This is local wrapper behavior, with no host bridge contract change. Deployed UI artifacts that bundle ScalingWrapper need republishing to adopt the shortcuts; old artifacts remain compatible.

### Market tokens

StockMarketScene renders title-owned company tokens in canonical market stacks. A single token is centered; two are separated vertically. Larger stacks use the available cell height before overlapping, with the first company in the stored stack above later arrivals. Hovering or focusing a crowded cell spreads the stack into fully visible tokens above neighboring cells, bounded by the rectangular board. A hover hit region keeps the spread reachable across gaps. Pointer exit, focus exit, Escape, or a visible-state update closes it. Hover offsets animate locally on inner wrappers and respect reduced motion.

Each mounted scene registers one GameSession listener. Market tokens retain company-keyed DOM elements across cell changes. The shared AnimationContext owns committed movement, stack repositioning, and marker entry/exit; target stack z-order is applied before motion. Transient render entries cover the union of from/to markers for one replayed action, then settle to that action's destination. New markers fade in at their destination and departing markers fade out. Action moves take 300ms; actionless Undo/history take 180ms, reduced motion takes zero. Hidden scenes skip animation; silent restoration uses canonical props. Teardown removes the listener, kills its registered element tweens, and clears refs. No game/session host bridge shape changes are introduced.

### Tile manifest

Tiles follows Spreadsheet in the table tabs. Colored filter pills select one color or All; remaining tile faces render in an unframed grid with their available count, omitting exhausted faces. The filter is local browsing state and persists across tab switches and visible game-state updates. Counts follow the displayed canonical inventory in live play, history, Undo and restoration; an uncommitted tile preview does not consume stock. The manifest includes future-phase tiles and does not imply that a displayed tile is currently legal to lay. Layout and orientation come from the title's map presentation. It creates no actions and does not affect map selection.

### Ownership spreadsheet

Spreadsheet shows open share companies against players in priority order, with direct share counts at each intersection and subdued zeros. Counts follow the displayed state through actions, history and Undo. It is read-only and does not aggregate a controlled company's shares into a player's holdings.

After players, the spreadsheet includes title-selected corporate owners, then Treasury and Market. Treasury shows each row company's own shares; Market counts shares in the title-supplied market pool only. Union Bank remains a separate owner in TOP.

The spreadsheet uses compact row spacing and container-responsive company names: full above 800px, title-supplied short names through 800px, initials through 560px. Accessible row headers retain full company names at every width; resizing changes no ownership or selection.

A Company / Player toggle transposes the same ownership matrix. Player view uses companies as columns and players, corporate owners, Treasury and Market as rows, preserving their order and counts. The chosen view is local browsing state, persists across tab switches and state updates, and creates no game action.

Cash, net worth, shares and certs/limit appear after ownership, as rows in Company view and columns in Player view. They use the same displayed-state valuation and certificate rules as player panels. Union Bank has cash, net worth and shares; certificate limits do not apply to it. Treasury and Market show dashes for these owner-level statistics.

### Operating-round financial history

Spreadsheet's Current / Income toggle switches to chronological OR columns. Company view shows finalized train revenue before distribution; Player view shows actual dividend/private-income receipts and OR-end net worth. The current unfinished round is marked In progress and uses its latest displayed valuation. Missing OR-entry records produce a Partial label, not invented earlier income. Historical company names remain available after closure. Stock-round trades never rewrite a completed OR's valuation. The data comes from recorded action metadata and independently reconstructed snapshots, without moving the session's history cursor. Undo, exploration and history navigation use only the current visible action prefix. The history projection is built only while its view is mounted.

State and action records are taken together from the same visible history context. The delayed rendered gameState must not be paired with a newer/truncated actions array during transitions, since its undo patches would then target a different snapshot.

Current ownership cells show the shared President badge for the company's canonical president in either orientation. Corporate presidencies are marked in that company's cell (such as Union Bank), never its controlling player's cell. Share numbers stay centered independently of the badge.

Where a title has a reserved exchange pool, Exchange appears immediately before Treasury in either orientation. The owners/pools divider precedes Exchange, and its financial-summary cells are dashes. Counts come from the supplied exchange pool and follow visible state and Undo.

Operating order offers Tokens only / Detailed chips icons beside its heading, separated by a slash. Detailed chips remain the default. Tokens-only retains company order, completion status and the same click-to-toggle company details. Switching style preserves the expanded card; overflow and the miniature visible-window overview remeasure the changed chip widths. This local display preference creates no game action.

Company cash follows Market, separated by the same stronger divider as the ownership pools. It is a column in Company view and a row in Player view, sourced from displayed company cash accounts. Intersections with owner statistics are not applicable and show dashes.

During TOP offer bidding the action panel shows the lot/value, current bid if present, next bidder, a minus/amount/plus control, Bid and Pass. Increment and affordability come from the auction model; disabled controls prevent stepping below the legal minimum or above available cash. Initial amount is the minimum without a staged selection. Amount changes use the session draft; Bid commits through the session and Pass clears the draft before passing. The next turn resets to its legal minimum through the normal session lifecycle. The bidding controls replace the prototype pile/award summaries in the table only.

PrivateCard is the shared name/value/income/description presentation for private popovers and the auctioned lot on the action panel's left. Numeric facts are supplied by callers, omitted when inapplicable, and never inferred from descriptions. Popover placement, dismissal and animation remain owned by PrivateDescription.

Construction picker and confirmation controls render in ScalingWrapper's unscaled viewport overlay, inside the fullscreen stacking context. They measure that same viewport for arc fitting and screen-to-local coordinates in either mode; fullscreen does not remount the picker or change draft/animation ownership. Other games can omit the additive overlay snippet. This changes no host bridge contract; TOP and 1889 UI artifacts must be republished to adopt it, with no logic or site publication required.

During an offer-pile opening auction, each player's card lists their remaining auction lot immediately after finances, with names and face values in the same order as the offer panel. The currently offered item remains in its pile until awarded; awards remove it, Undo restores it, and completed auctions hide this section. Corporate portfolios and titles without player-assigned offer piles do not invent auction lots.

Auction-lot rows open the standard PrivateCard popover when clicked anywhere, including the value. Share-specific descriptions are supplied by the title; private descriptions reuse their existing data. Popovers retain the usual viewport fitting and click-away dismissal.

Empty Ownership sections are hidden only while an opening auction is incomplete (offer-pile or waterfall). Nonempty ownership remains visible during auctions, and ordinary play retains the empty None display.

Title-supplied numbered share names enable indented number/name rows under the owning company's row. These companies appear last in portfolios (PEIR for TOP); ordinary holdings keep descending ownership order. Only active certificates owned by that portfolio appear, so purchases, exchanges and Undo update the list without local tracking.

Company names and tokens in portfolio ownership rows focus the Map tab on all of that company's placed stations. The bounds include roughly two surrounding hexes on each side to preserve track context even for a single station. Clicking the same company again fits the full map. Focus is camera-only, creates no selection/action and does not alter construction drafts. A title may exclude special companies (TOP's PEIR); companies without placed stations have no focus interaction. Existing operating-order chip expansion remains independent.

A title may associate a numbered share with a map location. Clicking that share's number/name focuses its location with the same context padding as company station focus; clicking again fits the map. TOP maps PEIR rights to their railway's printed home location, even before that railway forms. PEIR's aggregate ownership row stays noninteractive.

The table's stock-round panel starts with legal Buy/Sell/Start/Exchange/Pass-or-Finish options. Stock action and sale-company navigation use manual stagedSelection entries in the session, while company starts retain their existing company/price stages. Back/Undo pop draft decisions before reversing committed actions; state transitions clear the menu. Buy choices preserve purchaser, pool, certificate size/presidency and numbered identity, combining only equivalent ordinary certificates. Selecting a purchase commits it directly. Start selects company then legal par price and commits; sales select company and quantity, retain ordered multi-company batches, and commit with Sell. Private exchanges remain available through Exchange. No automatic selection effects or UI-constructed Actions are introduced.

Company focus also works before home-station placement: if there are no placed stations, use that company's canonical station reservations. The same target helper controls button availability and camera framing. Once stations are placed their actual locations take precedence.

Title-specific stock actions can contribute menu entries without dependencies from shared UI to games. TOP's Split entry requires an eligible parent, an available branch and current split permission. Selecting it records a manual split-action stage; only then is the branch-split editor shown. Back and Undo unwind allocation, price, branch, parent and finally the menu entry. No branch-split panel appears alongside unrelated stock decisions.

The operating-order section is omitted when its current/prospective company list is empty, including its label and display controls.

Each offered auction is one stable history card keyed by its offer action. The card lists the offer, chronological bids/passes and the recorded award, while cards remain newest first. Its lines navigate to the corresponding action; Undo and visible history prefixes rebuild the card rather than maintaining a separate mutable log. Waterfall auction events retain ordinary history until their distinct grouping is designed. Private-card monetary headers place Income left and Value right.

## Scrolling round history

History entries remain newest first. Each opening auction, stock round, and
operating round has a divider at its chronological beginning. Dividers follow
scroll position between the top and bottom stacks. A stock round and its following operating
set share one compact 20px row when docked together, retain separate click targets and horizontal
slots while separating, and join again on contact. A round label scrolls to its
oldest entries without navigating Game State; action rows still navigate through
the existing History interface.

The history list and grouping use the same visible history context. Round identity
comes from recorded stock/operating state patches, including prepared partial
games. Resizing or updating visible history remeasures the content. Scroll motion
is local presentation: one animation-frame callback updates DOM transforms from
cached offsets, with no per-frame reactive state changes or game animation
coordination. Native smooth scrolling respects reduced-motion preferences.
Observers, listeners, and pending frames are released on teardown.

The family round-sequence survey includes variable operating-set lengths,
consecutive stock rounds, inserted special rounds, and nonstandard calendars.
The layout only knows round/group identities, not alternation or fixed set length.
The current state-to-round adapter supports the implemented auction, SR, and OR
states, grouping each SR with its numbered OR set; titles with special rounds will supply their own identities rather than
having their events guessed from player action names.

Each round segment uses title-supplied phase colors and the phases recorded in
its state patches, including automatic phase changes. Muted backgrounds retain
dark, high-contrast labels. A corner-to-corner diagonal hard split shows successive distinct colors
when a round spans phases; adjacent phases sharing a color use one fill. Phase
colors are independent of train identity in the shared interface: the initial
titles explicitly reuse their train palettes. The phase/round survey includes
exports and other automatic triggers, delayed phase effects, and round counts
fixed before a phase changes; header colors do not infer or alter that schedule.

Separating round segments soften their exposed internal ends with up to 5px
corner rounding, shrinking continuously to flush joins as the segments meet.
This treatment depends only on header geometry and applies to every round group.

## Compact history groups

Round contents use a light ledger: stock-turn actors share the first action line,
company operations have a token header, and consecutive stock passes share a row.
Groups are newest first, with events chronological inside each group. Recorded
turn completion ends a group even if the same player acts next. A funding sale's
company identifies the shares sold, not the operating company; it remains with
that company's funding sequence. Actor changes within an operation remain visible.

Summaries use processed action outcomes for money, dividends, purchases, phase
changes and rusting. Bookkeeping finish steps are omitted from the displayed history. Stock actions
and their consequences are visible directly with no disclosure control; operating
Details exposes route and tile information. Meaningful events remain individually
clickable. The original action identities are preserved; no grouped
Action is synthesized. Offered auctions retain their existing grouping and action
navigation with lighter borders and tighter event spacing. Title-local descriptions
handle unique procedures such as branch splits, and shared views receive company
name variants rather than depending on title modules.

This presentation builds on the family survey of operating sequences, interrupted
procedures, treasury funding, dividends, private powers and auction variations.
The common UI supports both initial titles' stock/operating actions and waterfall
bid descriptions; offered auctions and reserved bids retain their distinct rules.
Grouping does not infer that every companyId denotes the operator or that a phase
change terminates an operation. Future title-specific actions retain an individually
accessible description until a title supplies their concise summary. Details are
local disclosure state; history navigation continues through the existing Game
Session interface. No game-state animation or new read-bookmark contract is added.

Stock prices read inline ("Bought 1 Summerside for $73"), and pass entries put the
player before "passed". Sale settlement metadata supplies market-price changes
and named presidency transfers. Operating-order notices use the recorded order
before/after each action, including indexed array patches, so fixed order remains
fixed until a recorded change. Initial order, new round order, and emergency
funding reorders are shown with the actual company sequence; a stock-price move
alone does not imply that the current OR reordered. Disclosure buttons only appear
when additional route/tile detail exists.

Phase changes that change the title-provided phase color highlight their history row with the new color and explicitly name the old and new colors. Phase changes within the same color retain ordinary event styling. This uses each title’s phase palette, independent of its phase identifiers or operating-round count.

Recorded operating-order changes use token diagrams. Reorders show only each relocated company’s faded old position, solid new position, and intervening companies, connected by a low static overhead arrow. The diagram has no visible “Operating order” label; its accessible description retains the movement meaning. Multiple relocations use successive minimal moves; new orders with changed membership show the resulting token row. The diagram derives solely from the recorded before/after order and remains identical during replay or restoration; it does not animate game state.

Stock sales select one company and a share quantity per committed action. Selecting another company replaces the uncommitted selection; there is no sale basket or reorder control. Separate sales retain separate market settlement, presidency consequences, history and Undo steps. Family review: stock-transaction ordering and market behavior (including 1870’s intervening price-protection decision) favor company-scoped player decisions; multi-company disposal calculations remain available internally for financial projections, not as a stock-round action.

Emergency train funding raises each contributor’s required cash through ordered company sales before transferring their contribution once. Existing company cash and treasury issuance still reduce the shortfall first. TOP’s Union Bank and its controlling owner remain separate ordered funding sources; 1889’s compulsory ownership sales still precede contribution. If a source cannot fully cover the shortfall after exhausting legal sales, its cash is used before advancing to the next source or bankruptcy.

Operation headers stack the player name immediately below the company name beside the token. Before a contributor’s first emergency sale, history shows their recorded required contribution as “President owes $N”; any cash shortfall is appended as “and is short $N”. The actual single transfer remains a later “President contributed $N” entry. This obligation is recorded before the sale, rather than inferred from a later action.

Company operation history uses a cash ledger: opening cash at the right of its header, signed company cash deltas aligned right (negative red, positive black), and closing cash in its footer. Amounts are reconstructed from canonical cash undo patches, including automatic cash events, not inferred from nominal revenue or prices. Train revenue and per-share dividends remain informational amounts in the action text; president share-sale proceeds stay inline and are excluded from company cash. Supplemental action details are shown inline without a Details control. The closing balance has a short rule over its amount, separate from the operation group divider. The move arrowhead touches the destination token. Family review: treasury dividends, retained/half-paid earnings, private income, negotiated transactions and indirect funding can differ across titles; owner-specific balance deltas accommodate those differences without assuming revenue enters company cash.

Company operation headers use a subtle contrasting background behind the token, company/player names and starting cash. Track-lay history shows location and cash cost, without a tile identifier/rotation description.

SR/OR interstitial backgrounds use the active phase’s train-color mapping, including split backgrounds for changes within the round. Phase-change entries separately compare the title’s available tile colors and explicitly announce newly unlocked colors (“green tiles now available”). These are distinct inputs even when their colors coincide in TOP and 1889.

Train palettes use title-owned hex colors, separate from tile colors. TOP uses its ten train-roster colors (including blue 2+, cyan 3+, and red 7); badges select contrasting text and SR/OR bands tint those same colors. End cash uses a single-line label beside the amount, with a short rule above the amount.
