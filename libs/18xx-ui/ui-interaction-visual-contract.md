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
The separate `apps/18xx-playground` development app selects complete TOP, standard
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

There is no Action Selection, Back, Undo, replay, or history lifecycle in this viewer.
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
own persisted example; switching disposes the session and discards selections. Reload
restores committed state. These controls select examples, not game-rule actions.
Desktop/mobile checks cover both Back stages, confirmation, reload, position/title
switching, market/cash/ownership results and complete Undo of flotation.

### Full stock-round prototype

The session's existing FinishStockTurn method advances to the next player. The
control reads Pass before a stock action and Finish turn afterwards; it stays
disabled while a manual choice is open. StockRoundStatus renders the active player,
turn order, and either TOP pass order or 1889 consecutive passes. A committed
purchase/start/sale updates that status through runtime processing.

The stock menu choices and the spreadsheet period choices render as equal-width
segmented pill controls whose selected thumb slides between segments. The thumb
position derives from the selected index alone; it is local presentation, owns no
selection, and nothing waits on it. With no stock menu open the thumb is absent
and fades in at its segment. The turn-ending control stays a separate solid
button. Reduced-motion removes the slide.

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

### Standing instructions

During an open stock round a compact one-line bar pinned to the bottom of the
stock action body is visible to every seated player whose valid actions include
SetStockInstruction, regardless
of whose turn it is. In local hotseat play outside the developer harness the bar is hidden unless the
client is viewing as a non-active player, where it declares for that player. The prototype
trading panel embeds the same bar. Its left edge is an Autopass / Autobuy sliding toggle in
the same style as the Buy / Sell strip. Selecting Autopass shows an inline
Enable button. Selecting Autobuy extends the same line, wrapping only when the pane is narrow,
with a chevron and a bordered tray that reads as one clause: a single company
token that opens a popover list of companies and shows a "?" until one is
chosen, then "from" and a preferred pool segment listing only pools the title's
purchase rules let the player buy from (or the pool's name when the company's
shares sit in one pool), "until" and a Float / I own goal segment with a
share stepper bounded to one more than the player holds up to the smaller of
the ordinary ownership ceiling and what the player could buy by spending
current cash on the preferred pool while it holds shares, or otherwise on the
cheapest other pool, at each share's own price, and a "then pass" switch. Pool and
goal segments are sliding toggles whose thumb sizes to the selected segment.
The tray's corners round fully on one line and soften when it wraps. A green Enable follows the tray and
stays disabled until a company is chosen.
With an instruction declared the toggle
shows its kind pressed and disabled, followed by one summary line ("Autopass for
the rest of the round" or "Autobuy <company> · <pool> preferred · until float ·
then pass"), a "Stops next turn: <reason>" status when the session's
`instructions.warning` reports that the instruction would stop at its next
evaluation, and an inline Cancel button. A small "?" icon at the end of the row
opens a popover listing when an instruction stops on its own. A refused Autobuy
purchase reports whether the share was unaffordable or would breach the ownership or
certificate limit, rather than a generic refusal. After an instruction
stops, the bar shows "Autopass stopped: <reason>" or "Autobuy stopped: <reason>" in the
tray outline until the player declares again, clears, or the round ends. The goal
segment offers Float only for a company that has not floated, and Autobuy omits a
floated company with no reachable share goal.

The toggle's selected kind, company, pool, goal, count and then-pass values are
local component UI state. They are not staged selections: they are never
registered with LocalSelections, `Back` and `Undo` ignore them, and a stale
company or pool falls back to the first legal option. Only Enable and
Cancel commit `SetStockInstruction` through the session with `outOfTurn` set.
Controls disable while the session is busy, while viewing history, or when the
action is no longer valid. The existing Pass / End turn and Undo buttons keep
their behavior.

No history surface ever presents a standing instruction: round status, the
stock panel's history list, the shared game history, the position panel's latest
line, and history stepping all omit SetStockInstruction and StopStockInstruction,
which count as bookkeeping for navigation. The runtime's automatic FinishStockTurn
and BuyShares actions render and step exactly like the same actions taken by
hand, with no automatic marker, so history never reveals that an instruction
existed. This is a
presentation rule; Game State itself remains public.

### Live maps in finance examples

The session derives map drawings, placed stations, current reservations, and tile
counts from its exposed `gameState`, including History View. Static maps, manifests,
layouts, and station colors come from title UI configuration. Shared modules have
no title dependencies. Prepared placements persist with the financial example.

Map inspection is manual local presentation state, separate from stock selections.
It is hidden during `updatingVisibleState`. Hex inspection remains valid while its
location exists; path, node, and slot inspection also require the same tile face
and a valid target in the displayed drawing. Returning to a matching historical
face can restore that inspection. Station exchange alone preserves the selection.
Stock Back and Undo retain map inspection; neither consumes it as a stock selection.

The shared MapViewer composes MapScene, MapInspector, and Common ScalingWrapper.
Fit, focus, pan, zoom, fullscreen, and style choices generate no Game Actions.
Style is local to each hotseat player in this session; reload resets preferences.
History controls use the existing Game Session history, including individual
system actions. Stock decisions are unavailable in History View. Live returns to
committed state; Undo reverses the player action and its automatic cascade.

The disposable FinanceMap panel exposes inventory through the existing tile
library. Browsing it cannot place tiles or change available counts. The table can
optionally display title-supplied board artwork under the same semantic map; the
workbench continues to use the generic presentation.

Desktop browser checks cover TOP station exchange and its reservation through
purchase, flotation, history stepping, Live, and Undo; 1889's retained reservation,
placed tile and inventory count through flotation and reload; and independent
hotseat styles without extra actions. Shared map tests retain fit/zoom/pan coverage.

### Track construction

The session owns a manual location → tile → placement selection. Placement includes
rotation and the mapping of old stop IDs to the new tile. A single remaining
placement is auto-selected only when choosing the tile; no reactive loop chooses
or commits Actions. Back pops the last manual stage, skipping any auto placement.
Undo clears a manual selection before invoking committed history Undo. Reselecting a
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

Selections and targets are hidden in History View and while updatingVisibleState.
beforeNewState clears the selection. Back, Undo and history restoration redraw the
committed tiles and stations. Fit/focus, pan/zoom and player style do not change
the selection. Confirmation calls the session's LayTile method; Finish track calls its
FinishTrack method, which initializes the station step and transitions directly
to PlacingStation.
The prototype continues into station placement. Each committed lay appears in construction history with hex,
tile, rotation and cost.

Desktop checks cover TOP's manual rotation, Back, selection-clearing Undo, two lays,
second-lay cost, history, reload, and full Undo; and 1889's single auto placement,
Back skipping it, station-preserving upgrade, Finish track and Undo. Shared
semantic preview/target rendering is lasting; the control panel remains provisional.

### Station placement and track access

The session owns manual station → city-slot selections. An explicit click on a
hex or city with exactly one legal slot chooses that position; multiple legal
slots require a slot click or dropdown choice. No station is auto-selected.
Back removes the position before the station; Undo clears a manual selection before
undoing a committed action and its cascade. Selections are hidden during History View
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

Train selection is one manual local selection, with no automatic selection. It names
an actual finite train or the next deterministic unlimited identity. Back clears
that choice. Undo clears a manual selection before undoing a committed purchase.
History and updatingVisibleState hide the selection; beforeNewState clears it. A stale
choice cannot confirm without passing the same evaluator as the BuyTrain Action.
The component calls session methods; only explicit confirmation buys the train.

The preview highlights a selected depot rank and states its price. Money, supply,
rosters and purchase history remain canonical until confirmation. History restores
those values, and returning Live does not restore a cleared selection. Map inspection,
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
route selections before committed Undo. Selection overlays/controls are hidden in history
and during updatingVisibleState; beforeNewState clears them. The editor is rebuilt
from the next exposed game state. Reload restores committed results only. Map
style and viewport changes preserve selections. Save/edit/remove controls do not
mutate canonical state or generate Actions.

A selected train can start at a map revenue-center/slot click or the center
selector. Connected path clicks and Next track buttons append semantic path IDs.
Other hits retain map inspection. Selected paths are amber; saved routes have distinct
colors. Route selections retain only canonical location/node/path IDs, excluding
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
updatingVisibleState hide the selection; beforeNewState clears it. Reload restores
only committed earnings. Confirmation shows recipient amounts, retained revenue,
rounding/bonus supplements and share-price movement; it never changes route
geometry. Committed payment details remain visible during train purchasing.

DistributeEarnings enters BuyingTrains. Finish operating turn is disabled while a
train purchase is selected or a compulsory train is missing. The rules own company
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
a selection. No automatic selection consumes an Undo. Confirming the final discard
resumes the original company automatically without starting another player turn.

Diesel exchanges reuse the manual train-purchase selection and confirmation, including
its exchangeTrainId. Preview shows the trade-in, price, and resulting phase.
Market trains appear separately from depot supply. TOP's retained 4+ trains are
marked as awaiting a final operation and unavailable for trade. Their rusting
is an automatic consequence of completing the next RunTrains action.

Fixture version 18 adds Phase changes and Diesel arrival examples. These exercise
phase/rusting decisions; phase-triggered private powers and game-ending effects
are integrated in their planned later slices.

## Private exchanges and lifecycle

Private-company cards show ownership, income, closure, and eligible exchanges.
Selecting an exchange creates a manual session selection naming its owner and target.
Back clears that selection; Undo clears it before undoing committed history. History
and updatingVisibleState hide the selection; beforeNewState clears it.

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
private tile placement, and early train selection are manual local selections. Back
clears the selection; Undo clears a manual selection first, then uses engine history.
Selections hide during updatingVisibleState and History View and clear in beforeNewState.
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
A share-sale selection is a manual Game Session selection: Back clears it, and Undo
clears it before reversing a committed Action. Selections hide in History View and
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

History navigation uses one visible toolbar: above the horizontally scrolling
table below the shared layout's 640px breakpoint, and in the sidebar at wider
sizes. Both locations use the same table palette for enabled and disabled
controls. Browser coverage checks TOP and 1889 at phone, breakpoint and desktop
widths, including resizing back to mobile.
The operating company in the phase header uses title-defined initials below that
same breakpoint and its full name at wider sizes; its token remains visible.
In the paned layout the header centers the round / phase / company group and
appends the active player names, or History, after a further separator; Undo and
the artwork toggle stay at the right edge. When the centered group cannot fit
with symmetric margins, the round label compacts first and the group then yields
toward the left rather than overlapping the controls. The non-paned layout keeps
the round group at the left and the active player beside Undo.

The session's map.select is the common map-intent entry point for both the
table and the logic workbench. While track choices show, a click selects or rotates
track and never inspects. Otherwise route extension/start takes precedence, followed
by station selection and ordinary inspection. The existing session
owns all selections and invalidates them through beforeNewState/updatingVisibleState.
The shell does not create another selection state or publish Actions itself.

Header Undo delegates to the title session's existing undo method and is disabled
while busy, changing visible state or viewing history. hasLocalSelection reports the
same selections consumed by that method, including TOP's split selection. Embedded action
controls suppress their duplicate Undo buttons only in the table composition;
Back remains local to the active flow. History controls and history rows use the
existing History interface. The action list shows processed player Actions; system
consequences remain in canonical history and are navigable with HistoryControls.

Map, Market and Spreadsheet tabs sit between the action panel and the content
viewport, outside ScalingWrapper. Selection is local to the table and does not
clear an Action Selection or change Game State/history. The map stays mounted with
its viewport dimensions intact while inactive, preserving pan/zoom and inspection;
inactive panels are hidden from assistive technology and inert. Market renders
canonical visible-state prices and company markers. Spreadsheet is a placeholder.
Arrow keys, Home and End navigate the tabs; tab selection never scales with the map.

The Market panel now renders StockMarketScene directly in its own ScalingWrapper,
with no market heading, order summary or nested scroll frame. The scene owns only
the market spaces and company markers; the prototype StockMarket view composes
that same scene with its existing inspection chrome. Map and Market retain separate
pan/zoom positions while mounted; their shared tab strip remains outside both.
Market cells share single-width borders with values at the upper left. In the
dark table, neutral (white) cells use the raised table surface and table borders,
while colored cells keep each market color's hue at dark-surface lightness,
blended toward the raised surface. Prices are readable but slightly subdued so
company tokens remain the brightest elements on the board.
Company tokens keep their artwork unchanged and gain a thin dark ring so they
sit off the cell without altering their colors; the expanded-stack backdrop uses
the inset surface. The prototype market view
keeps its light rendering. Small
lower-right up and lower-left down arrows indicate the current titles' dividend
edge turns; these are static annotations, not controls or staged movement.

Company order sits between the action area and view tabs, outside ScalingWrapper.
Its ordered token list follows the displayed OperatingSet, including completed
companies, with completed turns dimmed and no checkmarks. The current company uses the ordinary
pill styling; its operating status remains available through accessible semantics.
Pills sit below the operating-order heading. Each places a 38px company token filling the rounded left end
beside two compact lines: the available station-token count and tiny token icon
alongside dollar-prefixed cash above the owned train names. The token count and
icon are grayed out at zero. These summaries follow the displayed state, not Action Selections.
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
displayed state, including Undo/history; no local selection affects them.

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

While the run-trains step displays autorouted routes and no train is selected for manual editing, the same translucent mask covers every hex outside those routes, and no map space is clickable or keyboard-selectable. Selecting a train for manual editing or committing the run clears the mask while the routes stay drawn. While navigating history, the table map masks non-route hexes whenever the settled position is a train run, and clears the mask at every other position. The historical map dialog masks non-route hexes the same way for run previews.

### Map track picker

Selecting a legal construction hex opens tile choices on a compact, evenly spaced circular arc around it. The arc prefers directly above the hex and rotates only as far as needed to clear viewport edges, without snapping to cardinal directions. It adjusts radius/size when rotation alone cannot fit. Choices match the map hex scale, shrinking only when needed to fit the viewport. Icon controls scale with the map. Both render outside the scaling wrapper and follow the hex through pan, zoom, and layout changes. Existing shared tile artwork and title layouts render each choice in a legal rotation.

Choosing a tile previews its first legal placement. Clicking that same map hex advances to the next distinct legal rotation, using its first legal station mapping; choosing another legal hex replaces the selection. Before tile choice, clicking away dismisses the picker and no cancel icon appears. After tile choice, cancel collapses the visible choices into the hex before clearing the selection and closing the picker. The accept icon calls the existing session confirmation, including consent when required. Neither tile choice nor rotation commits an action. Back/Undo retain source-tagged staged behavior; lifecycle invalidation and history suppress the picker with the existing track selection. Clicking away from the initial tile choices, including another tab, clears that selection; a selected tile preview remains staged when switching tabs.

The table action area keeps construction status, cost and Finish Track, with selection controls on the map. The economy workbench retains its existing explicit controls. Verification covers both titles, on-screen arc bounds, preview/rotation/cancel, acceptance, history, reload, Undo, and tab preservation.

The map construction header reserves inline space for the pending cost. Choosing, rotating, cancelling, or accepting a tile must not add a cost row or resize the map viewport.

### Selected tile motion

The map picker owns local, cancellable 220ms DOM motion triggered by a tile-choice or cancel gesture, not by committed game actions. On opening, choices fly and scale out from the selected hex into the arc. The selected choice moves to the hex; other choices remain selectable in their original arc positions, leaving a gap for the chosen tile. Selecting a replacement returns the previous choice to the arc. Cancel interrupts the current motion, shrinks all visible tiles into the hex over 160ms, then clears the selection and closes the picker. Clicking away from the initial choices uses the same collapse. Reduced-motion preference skips the flight.

A session-owned, selection-scoped in-flight flag keeps the map on its current committed artwork until the moving tile lands, avoiding duplicate preview artwork. The picker is the sole writer during the motion; selection replacement, teardown, and visible-state invalidation clear it. Accept interrupts and finishes the preview before invoking the existing action. New gestures retarget from current DOM positions. No animation frame writes interpolated motion into reactive state. History, replay, and silent restore do not create selected tile motion; teardown cancels outstanding DOM animations. The masking projection remains based on displayed construction state throughout busy updates.

Selection cancel/accept controls use a local 120ms opacity fade on entry and exit. On cancel, the fade begins alongside the tile collapse. This is non-blocking presentation, including picker teardown, with no opacity transition under reduced motion.

Tile text uses geometric-precision SVG rendering so revenue baselines remain centered during small-scale picker animations without waiting for pointer-triggered repaint.

Printed location names are visible only until a tile is laid on that hex; the location name remains available in its accessible label.

Hovering a picker tile enlarges its inner artwork by 10% over 120ms, replacing the colored glow. This local hover feedback is independent of the outer flight transform; reduced motion removes its transition.

Viewport-driven picker repositioning settles with a 100ms CSS translate transition. Browser interpolation handles motion without per-frame reactive tween writes. Explicit opening, selection, and collapse motion disables this settling transition so the two mechanisms do not compete; reduced motion also disables it.

Private-company rows in player panels and company cards (including purchasable privates) open title-owned descriptions on click or keyboard activation of the name. The shared floating layer centers above the row, flips or shifts against viewport boundaries, and locally rises 6px into place over 140ms (suppressed with reduced motion). The next click anywhere, Escape, or row removal dismisses it. This local information affordance neither stages nor commits game actions.

Accepting a track lay fades unchosen picker tiles in place over 120ms as the tile picker disappears. This non-blocking local exit does not delay confirmation or animate the committed tile. Cancel retains its collapse; reduced motion skips the exit.

A company portfolio header can expose its title-owned private description using the same click popover as private rows. TOP uses this for Union Bank; player headers remain ordinary headings.

During the opening auction's offer stage, the table shows the current auctioneer's legal lots, their face values and private income. Each Offer button commits through the session; no second confirmation is required. Buttons follow session authorization and busy/history eligibility. Undo remains the table's committed-action control. Bidding and stalled auctions retain the existing panel for now.

Offer-list location icons focus the Map tab using ScalingWrapper and select the referenced hex for inspection, without creating a game action. Clicking other row content opens its supplied description. Location icons and Offer buttons are excluded from description interactions. Company cards and player panels use the same click descriptions. TOP supplies PEIR numbered home locations and Vernon River Bridge's blocked hex; the shared UI does not infer geography from names.

Location focus frames a wider neighborhood around the hex. Repeating the same location-icon click fits the full map; a different icon focuses its location. The local focus toggle resets when the displayed financial state changes.

When operating pills overflow horizontally, a miniature token row appears beside the order label. A subtle window encloses only the fully visible pills' tokens, following scroll and resize; partially clipped pills remain outside the window. It disappears when the pills fit. The overview is decorative, mirrors canonical order, and never changes selection or game state. Measurement uses passive scroll events and ResizeObserver, coalesced with requestAnimationFrame; its short local window transition respects reduced motion.

ScalingWrapper keyboard shortcuts toggle fullscreen with F and exit with Escape. F is ignored in editable fields and with command modifiers; hidden map/market views do not handle it. This is local wrapper behavior, with no host bridge contract change. Deployed UI artifacts that bundle ScalingWrapper need republishing to adopt the shortcuts; old artifacts remain compatible.

### Market tokens

StockMarketScene renders title-owned company tokens in canonical market stacks. A single token is centered; two are separated vertically. Larger stacks use the available cell height before overlapping, with the first company in the stored stack above later arrivals. Hovering or focusing a crowded cell spreads the stack into fully visible tokens above neighboring cells, bounded by the rectangular board. A hover hit region keeps the spread reachable across gaps. Pointer exit, focus exit, Escape, or a visible-state update closes it. Hover offsets animate locally on inner wrappers and respect reduced motion.

Each mounted scene subscribes through MarketAnimationSource. Its caller supplies a market projection; the adapter registers one GameSession listener and forwards the original action and AnimationContext. The scene does not depend on a finance-example state class. Market tokens retain company-keyed DOM elements across cell changes. The shared AnimationContext owns committed movement, stack repositioning, and marker entry/exit; target stack z-order is applied before motion. Transient render entries cover the union of from/to markers for one replayed action, then settle to that action's destination. New markers fade in at their destination and departing markers fade out. Action moves take 300ms; actionless Undo/history take 180ms, reduced motion takes zero. Hidden scenes skip animation; silent restoration uses canonical props. Teardown removes the listener, kills its registered element tweens, and clears refs. No game/session host bridge shape changes are introduced.

### Tile manifest

Tiles follows Spreadsheet in the table tabs. Colored filter pills select one color or All; remaining tile faces render in an unframed grid with their available count, omitting exhausted faces. The filter is local browsing state and persists across tab switches and visible game-state updates. Counts follow the displayed canonical inventory in live play, history, Undo and restoration; an uncommitted tile preview does not consume stock. The manifest includes future-phase tiles and does not imply that a displayed tile is currently legal to lay. Layout and orientation come from the title's map presentation. It creates no actions and does not affect map selection.

### Ownership spreadsheet

A compact `X ↔ Y` button switches the axes for Current ownership at every screen
width. It swaps rows and columns through the saved family preference. Period and
axes controls occupy a compact full-width strip directly below the table tabs,
centered over the visible sheet even when its contents scroll horizontally.

Spreadsheet shows open share companies against players in priority order, with direct share counts at each intersection and subdued zeros. Counts follow the displayed state through actions, history and Undo. It does not aggregate a controlled company's shares into a player's holdings. During the acting player's stock turn, a Market or Treasury share cell with a legal player purchase opens a small confirmation showing the certificate's share count, company token, and exact price. A legal Union Bank purchase adds a centered "As Bank" button below Yes and No, with any contribution owed by its player owner; Yes buys for the player. A holding cell with a legal sale opens a confirmation asking to sell the company token's share or shares, using the singular when only one share can be sold. If only one share can be sold, the popover shows its proceeds and Yes/No; otherwise it lists each legal amount with its proceeds and a No button. Confirming commits one purchase or sale through the Stock Module. No, Escape, and clicking outside dismiss without an action. Ineligible cells and History View remain read-only. The pending choice is local to the popover and does not consume Back or Undo.

Title-selected corporate owners follow their controlling player in the ownership matrix. In Player view, each corporate row is indented, with a down-and-right connector from the controlling player's color dot. Company view preserves that owner order as columns, with a continuous horizontal connector across the player and corporate column boundary and vertically aligned header labels. Control comes from the shared controlling-owner calculation, including corporate control chains; uncontrolled corporate owners remain after the players, without a connector. Titles without corporate portfolios, including 1889, retain their player order. TOP's Union Bank remains a separate owner with its own shares and financial values; this grouping never aggregates its holdings into the player. The order and connector follow the displayed state through control changes, history and Undo. TOP explicitly marks Union Bank's net worth as included in its controlling player's total: both orientations use lighter text, an asterisk, and a matching footnote. This treatment is title-selected rather than assumed for all corporate holdings. Treasury shows each row company's own shares; Market counts shares in the title-supplied market pool only.

The spreadsheet uses compact row spacing and container-responsive company names: full above 800px, title-supplied short names through 800px, initials through 560px. Accessible row headers retain full company names at every width; resizing changes no ownership or selection.

The axes button transposes the same ownership matrix. Player view uses companies as columns and players, corporate owners, Treasury and Market as rows, preserving their order and counts. The chosen view is local browsing state, persists across tab switches and state updates, and creates no game action.

Cash, net worth, shares and certs/limit appear after ownership, as rows in Company view and columns in Player view. They use the same displayed-state valuation and certificate rules as player panels. Union Bank has cash, net worth and shares; certificate limits do not apply to it. Treasury and Market show dashes for these owner-level statistics.

### Operating-round financial history

Spreadsheet's Current / Income toggle switches to chronological OR rows with player or company columns. Company view shows finalized train revenue before distribution; Player view shows dividend/private-income receipts and recorded net worth. Unfinished or partial rounds carry an asterisk explained below the table. Historical company names remain available after closure. Only the displayed action prefix is read, without moving the history cursor. Current, Player income, and Company payouts are separate left-aligned view choices. The axes button applies only to Current; its saved family preference defaults to Player. Company payout values open their recorded run in the historical map modal; withheld runs are red.

Income calculation receives only visible context actions; it does not read or reconstruct game states.

Current ownership cells show the shared President badge for the company's canonical president in either orientation. Corporate presidencies are marked in that company's cell (such as Union Bank), never its controlling player's cell. Share numbers stay centered independently of the badge. The visible top of the P aligns with the top of the share number.

Where a title has a reserved exchange pool, Exchange appears immediately before Treasury in either orientation. The owners/pools divider precedes Exchange, and its financial-summary cells are dashes. Counts come from the supplied exchange pool and follow visible state and Undo.

Operating order offers Tokens only / Detailed chips icons beside its heading, separated by a slash. Detailed chips remain the default. Tokens-only retains company order, completion status and the same click-to-toggle company details. Switching style preserves the expanded card; overflow and the miniature visible-window overview remeasure the changed chip widths. This local display preference creates no game action.

Company cash follows Market, separated by the same stronger divider as the ownership pools. It is a column in Company view and a row in Player view, sourced from displayed company cash accounts. Intersections with owner statistics are not applicable and show dashes.

During TOP offer bidding the action panel shows the lot/value, current bid if present, next bidder, a minus/amount/plus control, Bid and Pass. Increment and affordability come from the auction model; disabled controls prevent stepping below the legal minimum or above available cash. Initial amount is the minimum without a staged selection. Amount changes use the session selection; Bid commits through the session and Pass clears the selection before passing. The next turn resets to its legal minimum through the normal session lifecycle. The bidding controls replace the prototype pile/award summaries in the table only.

PrivateCard is the shared name/value/income/description presentation for private popovers and the auctioned lot on the action panel's left. Numeric facts are supplied by callers, omitted when inapplicable, and never inferred from descriptions. Popover placement, dismissal and animation remain owned by PrivateDescription.

Construction picker and confirmation controls render in ScalingWrapper's unscaled viewport overlay, inside the fullscreen stacking context. They measure that same viewport for arc fitting and screen-to-local coordinates in either mode; fullscreen does not remount the picker or change selection/animation ownership. Other games can omit the additive overlay snippet. This changes no host bridge contract; TOP and 1889 UI artifacts must be republished to adopt it, with no logic or site publication required.

During an offer-pile opening auction, each player's card lists their remaining auction lot immediately after finances, with names and face values in the same order as the offer panel. The currently offered item remains in its pile until awarded; awards remove it, Undo restores it, and completed auctions hide this section. Corporate portfolios and titles without player-assigned offer piles do not invent auction lots.

Auction-lot rows open the standard PrivateCard popover when clicked anywhere, including the value. Share-specific descriptions are supplied by the title; private descriptions reuse their existing data. Popovers retain the usual viewport fitting and click-away dismissal.

Empty Ownership sections are hidden only while an opening auction is incomplete (offer-pile or waterfall). Nonempty ownership remains visible during auctions, and ordinary play retains the empty None display.

Title-supplied numbered share names enable indented number/name rows under the owning company's row. These companies appear last in portfolios (PEIR for TOP); ordinary holdings keep descending ownership order. Only active certificates owned by that portfolio appear, so purchases, exchanges and Undo update the list without local tracking.

Company names and tokens in portfolio ownership rows focus the Map tab on all of that company's placed stations. The bounds include roughly two surrounding hexes on each side to preserve track context even for a single station. Clicking the same company again fits the full map. Focus is camera-only, creates no selection/action and does not alter construction selections. A title may exclude special companies (TOP's PEIR); companies without placed stations have no focus interaction. Existing operating-order chip expansion remains independent.

A title may associate a numbered share with a map location. Clicking that share's number/name focuses its location with the same context padding as company station focus; clicking again fits the map. TOP maps PEIR rights to their railway's printed home location, even before that railway forms. PEIR's aggregate ownership row stays noninteractive.

The table's stock-round panel starts with legal Buy/Sell/Start/Exchange/Pass-or-Finish options. Stock action and sale-company navigation use manual stagedSelection entries in the session, while company starts retain their existing company/price stages. Back/Undo pop selection decisions before reversing committed actions; state transitions clear the menu. Buy choices preserve purchaser, pool, certificate size/presidency and numbered identity, combining only equivalent ordinary certificates. Selecting a purchase commits it directly. Start selects company then legal par price and commits; sales select company and quantity, retain ordered multi-company batches, and commit with Sell. Private exchanges remain available through Exchange. No automatic selection effects or UI-constructed Actions are introduced.

Company focus also works before home-station placement: if there are no placed stations, use that company's canonical station reservations. The same target helper controls button availability and camera framing. Once stations are placed their actual locations take precedence.

Title-specific stock actions can contribute menu entries without dependencies from shared UI to games. TOP's Split entry requires an eligible parent, an available branch and current split permission. Selecting it records a manual split-action stage; only then is the branch-split editor shown. Back and Undo unwind allocation, price, branch, parent and finally the menu entry. No branch-split panel appears alongside unrelated stock decisions.

The operating-order section is omitted when its current/prospective company list is empty, including its label and display controls.

Each offered auction is one stable history card keyed by its offer action. The card lists the offer, chronological bids/passes and the recorded award, while cards remain newest first. Its lines navigate to the corresponding action; Undo and visible history prefixes rebuild the card rather than maintaining a separate mutable log. Waterfall auction events retain ordinary history until their distinct grouping is designed. Private-card monetary headers place Income left and Value right.

## Scrolling round history

History follows the player’s selected order, defaulting to newest last. Each opening auction, stock round, and
operating round has a full-width, 36px-minimum divider at its chronological
beginning. Bold expanded round names, phase labels, stronger phase colors, and
dark top/bottom borders separate rounds. Phase changes within a round retain
fixed 45° color segments. Dividers stick within their own round and scroll away
at its boundary; no stacks, combined tabs, reserved end space, or scroll-position
observers remain.
The dividers are headings, not navigation controls.

The history list and grouping use the same visible history context. Round identity
comes from recorded stock/operating state patches, including prepared partial
games. History navigation remains in the existing controls, while track/run
labels retain historical-map inspection.

The family round-sequence survey includes variable operating-set lengths,
consecutive stock rounds, inserted special rounds, and nonstandard calendars.
The layout only knows round identities, not alternation or fixed set length.
The current state-to-round adapter supports the implemented auction, SR, and OR
states; titles with special rounds will supply their own identities rather than
having their events guessed from player action names.

Each round segment uses title-supplied phase colors and the phases recorded in
its state patches, including automatic phase changes. Muted backgrounds retain
dark, high-contrast labels. A corner-to-corner diagonal hard split shows successive distinct colors
when a round spans phases; adjacent phases sharing a color use one fill. Phase
colors are independent of train identity in the shared interface: the initial
titles explicitly reuse their train palettes. The phase/round survey includes
exports and other automatic triggers, delayed phase effects, and round counts
fixed before a phase changes; header colors do not infer or alter that schedule.

Round interstitials retain square ends; no combined segment geometry is used.

## Compact history groups

Round contents use a light ledger: stock-turn actors share the first action line,
company operations have a token header, and consecutive stock passes share a row. Stock-turn player names appear inline before the first action, using the full available width and natural wrapping rather than a fixed name column; long unbroken names wrap without hiding action details.
Groups follow the selected history order, with events chronological inside each turn or operation. Consecutive stock passes represent separate turns, so their individual rows also follow the selected history order. Recorded
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

Company operation and offered-auction history headers share the same compact padding and corner treatment. Operation headers contain the token, company name, controlling player's name and starting cash, with a 15% tint of that player's color over the theme surface. Automatic turn-start records have no player attribution because the next controller becomes active only after the action applies. Completed turns use the recorded finishing action to identify that player; an unfinished turn uses the controller in the selected history state. Auction headers identify the offering player and item. History cards and round interstitials share a 5px vertical gap, with no extra round-list padding. Both groups have a subtle 1px card border and slightly rounded 5px outer corners, without an additional outer divider. Track-lay history shows location and cash cost, without a tile identifier/rotation description.

SR/OR interstitial backgrounds use the active phase’s train-color mapping, including split backgrounds for changes within the round. Phase-change entries separately compare the title’s available tile colors and explicitly announce newly unlocked colors (“green tiles now available”). These are distinct inputs even when their colors coincide in TOP and 1889.

An operating round divider places the recorded company order after its title, before the phase, when the whole order fits. Otherwise the whole order sits on a second line; title and phase remain aligned on the first line. The order no longer repeats as an action row. Both history sort directions use the same divider layout.

Train palettes use title-owned hex colors, separate from tile colors. TOP uses its ten train-roster colors (including blue 2+, cyan 3+, and red 7); badges select contrasting text and SR/OR bands tint those same colors. The final company cash balance appears as an amount only, with a short rule above it, when at least one action adjusted company cash. Operations with no cash adjustments omit both; offsetting adjustments still show the final balance. Full dividend distributions are labeled “Paid out”.

During a live, actionable RunningTrains step, the table starts client-side
autorouting in a title-owned Web Worker. Its state-tagged result is an automatic
transient preview owned by EighteenXXSession. It renders paths on the map
and per-train income in the action panel, using matching route colors and the
title's train badges. The panel has one Run trains action and no manual route
selection. Trains with no run display zero income; an empty fleet can submit an
empty run. Pending and failed calculation states do not offer submission.

The worker is canceled on visible-state transition, history navigation or panel
teardown; stale replies cannot publish a preview. Before publishing, the session
validates routes against that same canonical state. Automatic previews take
precedence over company-network focus, including an empty route result. Only
Run trains commits a Game Action. Undo skips this automatic preview and undoes
the last committed action; returning to RunningTrains calculates a new preview.
Recorded route results continue to render after submission and during history.
The game table never substitutes reachable-track overlays when there is no train
run to display, including on the finished map. Reachable-track inspection remains
a separate control in the prototype logic workbench.
The logic workbench retains its independent manual editor.

Automatic run income uses a compact two-column train/income table with a total
row. Map routes use a fully opaque 8-unit colored stroke without a white outline,
with revenue centers/stations above it. This keeps runs distinct from black
track without obscuring tokens or changing path geometry.

When an automatic route preview becomes available, GameTable opens the Map tab
and focuses the union of its route locations. Clicking anywhere in a train's
income row focuses that individual route; the same row toggles back to the full
map. Rows without a run are disabled. Focus uses the existing ScalingWrapper
focusRect animation and the same contextual padding as company station focus.
Location/company/route focus clear one another's toggle identity.

Camera motion remains local presentation: it neither submits an action nor gates
play, and the wrapper owns interruption and teardown. Automatic focus runs once
per new preview, not on tab changes or manual panning; a pending focus is canceled
when the preview disappears. Empty route sets do not move the camera. Returning
to RunningTrains through Undo recalculates and focuses the new preview.

The turn header pairs the current operating company's name with its title-owned
token. The phase is a button opening a native modal phase chart with a full-screen
backdrop. Its independent phase and train tables use canonical title data and
highlight the current visible phase, including history positions. Special rust
timing is explicit in the chart notes. Opening/closing is local presentation with
no Action or Undo step. The native dialog owns focus containment, Escape,
backdrop dismissal and focus restoration; it sits in the browser's top layer.

Phase-chart rows include a title-supplied Notes column for phase-specific
purchasing windows, private closures and diesel availability. Compact table
spacing makes room for those notes beside their phase; delayed rusting remains
an explicitly marked train footnote. General rules that do not belong to a
particular phase remain beneath the chart.

The clickable header phase uses the same colored badge and contrasting text as
its phase-chart entry, following the title's train-phase palette rather than its
available tile colors.

The turn header uses its own available width to shorten Operating round/Stock
round to OR/SR only when the full heading and turn controls exceed the available width. The table opts out of DefaultTableLayout's top inset;
its history controls and turn header share a 44px border-box height and aligned
bottom borders. The action panel no longer adds a second top border. Other
DefaultTableLayout consumers retain the default 8px top inset.

History train-run entries show train badges and total revenue without listing route stops.

History action rows and group headers do not move the history cursor. Track-lay and train-run labels can open a separate historical map preview. Navigation remains in the history controls.

Round interstitials are prominent, full-width headings in normal document flow. Each sticks at the chronological beginning edge while its round is visible, and never combines into a stack.

System-action history groups omit an actor heading; their events appear directly without a “Game” label or empty header space.

Each OR starts with one “Operating order” entry showing the entire ordered token list, even when unchanged, with 6px between its label and tokens. The set-start bookkeeping action is hidden. This order entry has no bottom divider or movement arrows; later order changes retain their movement diagrams.

Historical map inspection is an explicit, session-owned manual preview, independent of
the history cursor. Only track-lay and train-run labels are buttons; other history
text stays read-only. Clicking one shows the map immediately after that action,
including its tiles, stations and reservations, with recorded routes for train runs.
A separate native dialog owns its map renderer and ScalingWrapper. It occupies
90% of viewport width and height, centered with subtly rounded corners and a
translucent dark backdrop. At widths up to 760px or heights up to 560px it fills
the viewport with square corners.
Its header identifies Historical run (or track lay), company, OR and recorded run
revenue. History runs and the expanded company card's Last run share this viewer.
Close, F and Escape dismiss it; zoom/pan controls remain but no expansion control
is shown. The dialog blocks live-map interactions. Opening and closing do not
change the underlying tab, map contents, selection, zoom or pan.

Visible-state transitions invalidate the session-owned preview before the state
swap, including Undo, replay, new actions and history navigation. Camera focus
belongs only to the mounted viewer and uses recorded locations with contextual
padding. This presentation reuses the family map projection across titles; no
train, phase or revenue policy is inferred by the viewer.

Historical map reconstruction applies only map, station, company and round undo
patches after the selected action to a detached projection. It never mutates live
state, moves the history cursor or invokes the autorouter. A three-entry cache is
scoped to the source history state and replaced when that source changes. The
shared projection accommodates title-specific tile sets, station artwork, private
track lays and train route paths without inferring rules from map appearance.

Verification: the finished TOP game's earliest lay/run previews reconstructed
synchronously in about 14 ms and appeared within about 39 ms in a desktop Chromium
check; cached reconstruction took about 1 ms. These are local measurements, not a
device-independent guarantee, and exclude the subsequent camera easing. Browser
checks cover past placements, recorded routes, unchanged table state, read-only
map interaction, fullscreen return, repeat-click closing and Undo invalidation for
both titles. The projection test also verifies action-boundary accuracy and that
neither the source state nor recorded undo patches are mutated.

## Operating-order display preference

The existing tokens/details control updates the session's user preference at
18xx family scope. CompanyOrder renders that resolved choice; it owns no saved
preference state. The change is immediate, survives game-instance changes and
reload, and carries between TOP and 1889 for the same account. It leaves the
operating roster, open company card, turn, and canonical state unchanged.

Preferences belong to the signed-in account even when viewing another player,
history, or an exploration. Saves are serialized; failures revert the failed
choice and show a toast. Signing into a different account discards the previous
account's pending presentation and ignores late responses. Undo and action-state
reset do not reset preferences. See `docs/title-preferences.md` for inheritance,
API/cache behavior, and mixed-artifact adoption.

History has a compact text toggle above the scrolling list for Newest last / Newest first, defaulting to Newest last. The choice is saved through the session’s existing 18xx family preferences and follows the player between titles. This display choice reverses rounds and their grouped entries, retaining chronological events inside auction and operation cards. Round interstitials remain at the chronological beginning of each round. Short histories align to the top for Newest first and bottom for Newest last. Switching order scrolls to the newest end: top for Newest first, bottom for Newest last. Changing the toggle does not move the game-history cursor or create an Action.

When deferred history becomes complete, the list waits for its rows to render and scrolls to the newest end in the selected order. Ordinary history updates preserve the reader's scroll position. The scroll belongs to the history panel and does not change the history cursor or preferences. This completion behavior uses the existing Game Context completeness flag and requires new TOP and 1889 UI Artifacts only; it adds no host bridge or Logic change and remains compatible with hosts supplying complete history at session creation.

The additive historyOrder preference uses existing preference endpoints and defaults for older records; no host bridge contract changes. TOP and 1889 Logic/UI Artifacts must be republished to expose the new schema and control in hosted games.

History currently omits the “Your last action” marker; no player-relative highlight is displayed.

The history tab reduces the sidebar’s tab-to-content gap from 8px to 4px; other sidebar tabs retain their spacing.

Round interstitials use native sticky positioning bounded by their round section: top for Newest last, bottom for Newest first. At a round boundary the departing heading scrolls away and yields to the next one. There is no stack, duplicate heading, scroll listener, or game-state animation.

A right-aligned Index button beside the left-aligned history-order toggle opens a native popover over the history list. Its compact phase-colored round buttons follow the selected display order. Selecting one closes the index and scrolls that round’s beginning to the pinned edge without changing the history cursor or game state. Outside click, Escape, or viewport resize dismisses the index; the list scrolls within the available history height.

Round sections contain their content margins, while sticky interstitials have no outer margin. This preserves the 5px card-to-heading spacing and lets consecutive pinned headings meet without a gap at round boundaries.

Stock purchases use one company card with its token and full name, containing vertical source/price buttons. A row submits the selected canonical purchase through the session. Equivalent certificates remain deduplicated, but numbered shares, denominations and presidency distinctions stay explicit. Buyer selection is part of the manual action-menu stage: Buy selects the player; Buy for <owner> selects each available corporate buyer. Back clears that whole stage in one step. The shared UI does not name Union Bank or depend on TOP.

Design review: the ownership/certificate survey includes TOP’s Union Bank, 1841 corporate investment, differing IPO/market/treasury pools and 18MEX certificate denominations. Accordingly buyer and source remain canonical Owner and certificate-pool data, independent of company grouping. This slice renders the existing legal choices for TOP/1889 without adding new corporate trading rules. Verify one card for multiple pools, direct row submission for the selected buyer, distinct numbered certificates and Back without an Action.

Stock purchase source rows label Treasury shares as Treasury. The stock action panel has no separate Back button; the existing staged-selection-aware history controls own stepping back through manual choices.

The operating-order display-style toggle is right-aligned in its heading row; the overflow overview stays beside the heading.

After an acted stock turn, the outer stock handler evaluates the fully composed legal-action set, including title extensions and private exchanges. If only FinishStockTurn remains, it appends that action as a system consequence. Pass remains explicit on an untouched turn, and ownership/certificate-limit sales cannot be bypassed. Undo restores the initiating transaction and automatic completion together. The outer placement preserves optional actions across TOP branch splits, Union Bank purchases, 1889 exchanges, and differing sell/buy sequences; no title’s purchase count is treated as a universal end-of-turn rule.

Stock sales highlight the chosen share-count option in place; there is no separate removable-sale row. When a manually selected company has exactly one legal sale choice and it is one share, the session derives an auto-sourced selection. Confirmation still submits the sale. Undo from the share-count choices clears both the count and selected company, returning directly to company selection for manual and automatic counts alike. Automatic selection is gated by stock menu, company choice, and visible-state lifecycle without an effect.

Stock exchange choices read private name → destination company token and full name, in one clickable row. Destination identity comes from the offered certificate, not its encoded identifier. The whole row keeps the existing direct exchange submission behavior.

Company starts select the buyer in the stock action stage, just like share purchases: Start for a player, or Start for the eligible corporate owner. The company list contains only that buyer’s valid starts; buyer-specific prices and canonical start requests remain intact. Global Undo unwinds the existing staged selection.

Selecting a company to start focuses its home locations using the map’s contextual focus bounds. This local selection owns a saved viewport: unwinding the company selection restores the prior tab and viewport, including after changing the selected company, while committing or navigating game history discards the saved view. Map focus remains an imperative ScalingWrapper presentation operation, not a game-state action.

Ordinary station placement automatically selects the cheapest available token with a legal placement, retaining supply order for equal costs. Titles whose token identities introduce a meaningful choice can override requiresStationTokenChoice to retain manual selection. Token selection is derived and marked auto; only the location choice is a manual stage. Undo skips the automatic token selection, and Finish stations remains available until a location is selected. Canonical token identity, costs and placement validation are unchanged.

Station placement masks map hexes without legal placements. Clicking anywhere on a valid single-city hex submits PlaceStation directly; interchangeable slots use the first legal slot. Hexes containing multiple separate cities require a city/slot click, even when only one city is eligible. No location dropdown or confirmation stage is shown; committed placement is undone through action history.

Reaching the title’s ordinary station-placement limit produces a canonical system FinishStations action in the placement cascade. The UI advances without an extra click. Titles permitting additional placements retain the placement step. Undo reverses the placement and its automatic completion together.

A trainless company entering RunningTrains receives a canonical empty RunTrains system action. With zero revenue and no trains, withholding is automatic when permitted by the title. The distribution still applies market movement and operation effects, then advances to BuyingTrains without either player prompt. Existing recorded runs with revenue retain their dividend decision even if their trains rusted afterward.

When a selected track hex has exactly one legal tile definition, its tile and initial legal rotation are auto-selected. The picker scales that tile directly into the hex with no arc detour; rotation and acceptance remain available. The map preview is suppressed during this local entrance using the existing in-flight flag. Undo skips these automatic stages, and reduced-motion displays the selection immediately.

After a track lay, construction automatically finishes if the composed action handlers offer no further ordinary, private, or consent-based track placement. The system completion is part of the lay’s action cascade. The map prompt reads “Choose a space or” with a Skip button; skipped/finished construction advances through the canonical FinishTrack action.

The currently operating company always displays its detailed chip. The operating-order display preference continues to control every other company and is not modified by this override. Station placement presents “Choose a city to place a station or” followed by Skip.

Entering station placement with no legal token/location choice automatically finishes the step. This uses full placement validation, including available tokens, costs, connectivity, reservations and the title’s placement limit.

Earnings choices are direct-submit cards. Each shows per-share dividends, retained income, recipient payments and market-price movement before selection. Clicking Pay, Half-pay or Withhold commits the existing validated action immediately; there is no confirmation or manual selection to unwind afterward.

Leaving RunningTrains, including Undo, restores the viewport saved before its
first automatic route focus. The saved view belongs to that company's running
step, rather than the asynchronous route result. Manual map pan or zoom discards
it; route-row focus remains part of the temporary inspection. Restoration uses
ScalingWrapper's interruptible 180ms camera motion and neither gates game actions
nor changes canonical state. Leaving before a result arrives cancels the pending
focus without moving the map.

Train purchase choices commit immediately through the session's `buyTrain`
method. There is no local confirmation selection for depot, Market, or exchange
choices; global Undo reverses the committed purchase. A compact train-badge row
shows this company's purchases recorded in the current train-purchase step.
All available depot types and legal Market offers precede the next depot type,
which is disabled and labeled Upcoming. Market offers group matching type and
price while retaining the selected physical train's identity for the action.

Train buying separates Depot, My companies, and Other companies. Company sources
include only offers accepted by the canonical transfer validator at their minimum
price. Source and train selection use stagedSelection; editing the negotiated
price updates that train selection, so Undo first returns to the train choices,
then the default depot, then committed history. Commit uses OfferPurchase:
shared control settles immediately, while a different controlling player accepts
or declines the offer. Union Bank presidencies use their controlling player for
this distinction. Purchased badges include accepted intercompany transfers and
name the selling company after the badge; depot and Market purchases show only
the badge.

BuyingTrains automatically completes with a System FinishOperatingTurn when the
composed title handler offers no decision other than ending the turn. Legal
company transfers, depot/Market purchases, exchanges, compulsory funding, private
powers, and pending responses keep their opportunity to act. This is canonical
state flow, not a client click; Undo reverses the automatic completion together
with its triggering purchase. Titles retain their own purchase limits and train
requirements.

A construction outline belongs to the current track selection rather than a
persistent map inspection. Choosing a construction space clears the previous
inspection; finishing or canceling that selection removes its outline. The
normal beforeNewState reset clears it after a committed lay and its automatic
follow-up actions, without affecting historical-map selection.

Phase-dependent tile revenues display contiguous phase-colored value cells, arranged horizontally or vertically according to available tile space. Titles can supply stage colors for names that differ from tile colors. Fixed revenues retain their circular markers.

While unavailable map spaces are masked, a matching translucent perimeter extends 25 map units (one quarter hex diameter) beyond the map shape. The union mask avoids overlapping dark seams, ignores pointer input, and sits below tile artwork and interaction outlines. Map bounds reserve this margin in every interaction mode so entering or leaving masking does not resize the map.

Action-selection button text uses regular weight, including nested labels and stock action choices.

Placement masking focuses the map on the union of its legal locations, with the existing contextual focus margin. The table uses the same location set for masking and camera framing. Focus refreshes after visible-state updates and legal-target changes, not tile selection or rotation. Empty sets do not move the camera. This is local camera assistance through ScalingWrapper, not a game-action animation; it does not gate interaction or mutate game state.

Staged revenue layout favors horizontally centered rows or vertically centered columns. Track/stop clearance and staying inside the hex take precedence over centering.

Station-placement selection outlines belong to the placement selection, matching track placement. They disappear when the visible-state update begins and do not return after placement, cancellation, or Undo clears the selection. General map inspection selections also clear before publishing a new visible state; historical-map previews retain their separate explicit selection ownership.

Stock-menu navigation (Buy, Sell, Start, Exchange and title-specific staged choices) uses light buttons. Dark action-button treatment is reserved for submission. The root stock prompt includes an inline lowercase pass, or end turn after acting, only when FinishStockTurn is legal.

Station Skip rejects only a pending placement, not a token selection. Automatic cheapest-token selection (or choosing a special token without placing it) does not commit the company to a station purchase; Skip submits FinishStations and Undo restores that decision.

Automatic history consequences stay with their triggering event. Meaningful
sold-out market moves are shown in the stock round that ended, without player
attribution; no-op moves remain hidden. Flotation shows its recorded certificate
exchanges and patch-derived presidency/closure changes. Phase entries show forced
private exchanges and income changes alongside closures and resulting presidencies.
Company history is reconstructed from recorded patches, never from current owners
alone, and does not mutate state or initiate gameplay.

Track-consent responses use the same compact summary and direct response controls
as negotiated train purchases: requesting company token/name, location and small
proposed tile, then Allow/Decline. No separate inspector card or deciding-player
caption is shown. Title policy still determines whether consent is needed; the
shared response layout initiates decisions only through session callbacks.

While track consent is pending, the construction controls are suspended: show the
permission response without the space-selection prompt or Skip button.

Track permission history distinguishes requests, declines, and approval that actually lays track (including its cost). A declined response appears above the resumed construction prompt until the next user action. The notice derives from visible recorded actions, so undo and history navigation do not retain stale notices.

Pending track permission projects the requested tile and relocated stations from canonical request details into the table map at 55% opacity. The map is read-only during approval and focuses the requested space with the existing contextual placement focus. Resolution/undo removes this projection; historical map inspection takes precedence.

Map availability never uses dashed target outlines. Masking shows legal placement areas; solid highlights identify only the selected, focused, previewed, or hovered target.

Selected track placement shows its cost in a dark floating chip below the map tile, scaled with the picker and fading with its controls. The table action prompt does not repeat the cost.

Forced depot purchases use the ordinary train button and show the required cash
contributions before purchase. Clicking the train executes canonical mandatory funding steps and buys it. Share-sale choices are presented separately, and completing the required sales waits for that explicit train click. Negotiated train sources
remain selectable before that commitment when company cash permits them. Reload
and undo do not themselves execute funding actions.

The forced train view names the obligated company beside its token and shows the required train badge and price. Each legal funding sale appears as a company token above its share count and proceeds. Clicking commits the sale directly; Undo reverses the committed sale. A sales ledger persists throughout funding. Raising sufficient cash reveals the normal train purchase button; it does not purchase automatically. Completed contributions remain visible above the next owner’s shortfall, derived from the current funding sequence’s visible actions. Pending cash contributions are shown and executed on that explicit purchase click.

On entering train running, a company with no trains or no connected station route
records an automatic empty run. Empty, zero-income runs automatically withhold
when supported by the title. History retains these actions and their market
consequences, while the action panel advances without a run or payout click.

A compact game-information block sits between history controls and the sidebar
tabs. It shows title-supplied company roles with tokens in a single compact row (full names on hover), plus the
visible state's phase train limit, so historical navigation shows matching data.

Titles may supply additional compact game information below that row. TOP shows
its three non-initial tranches as grouped station-token slots, populated from the
visible state's tranche assignments; unfilled slots remain visible.
TOP's unavailable unfilled tranche slots show empty dashed circles with lock icons;
currently available slots retain empty dashed circles. Availability follows the
title's tranche rule, including the preceding companies' operation/sold-out condition.

Keyboard shortcuts M/K/S/T select Map/Market/Spreadsheet/Tiles. P/H/C activate
the existing Players/History/Chat tab controls, preserving their normal behavior.
Modified shortcuts, repeated keys, and typing within inputs, editors, or dialogs
are ignored.

Private purchases open from Buy privates into a staged source choice. Your privates
is the default when eligible; Other players is available only with eligible offers.
Cards show private income and the legal purchase range. Selecting one opens price
entry and Buy (same controller) or Offer (seller approval). Sidebar/header Undo
clears the asset selection first, then the source stage; canonical purchases retain
ordinary undo. During the picker, unrelated operating prompts and private powers
are hidden. Source selection resets before publishing the next game state.

A horizontal operating-step strip sits below the turn header. The current canonical
step is highlighted, prior steps muted, and later mandatory steps noninteractive.
Station/Run destinations may finish optional track/station steps through session
methods and canonical actions. Pending selections or decisions block these shortcuts.
The session waits for each visible transition and stops if a required decision or
company/round boundary intervenes. Prior-step buttons never navigate or undo.
Steps completed without an action show an inline second line: Not available for
canonical automatic completion, Skipped for voluntary completion. These labels
use current-operation actions and step results, and have no explanatory tooltip.
The step strip also summarizes performed actions inline: N laid, Placed, Ran for
$N, Paid out/Withheld/Half-paid, and N bought. Counts and outcomes come from the
visible canonical step state, including partial progress in the current step.

### Stock action strip

The stock round uses a persistent rectangular action strip directly beneath the
header. Only legal action categories appear; title UI supplies additional choices
(such as Split) and their selected state. Selection replaces the current manual
stock selection using the session; switching away from Split clears its selection too.
Buy and Start show the eligible purchasing owners within their choices, only when
there are multiple owners. The purchasing-owner selector shares the stock action
strip’s sliding pill highlight, retains corporate cash labels, and follows the
session’s selected buyer. This local selection feedback does not gate interaction;
reduced motion disables sliding and entry/exit fades. Pass / End turn is separated at the right and commits
immediately. The action pills center across the full strip when they fit clear of
Pass / End turn; otherwise they center in the remaining space to its left. The
layout measures the current choices and turn button. As space narrows further,
stock pill padding shrinks to zero before labels overflow, reserving an 8px gap
between the pill group and the turn-button area while the labels fit. Padding
returns as space grows. This supports title-specific categories
and either turn-button label use the same rule. The strip remains outside the
scrolling action choices. It sticks to the top of its scroll container above
the action content whenever that area scrolls vertically.

The Buy panel centers its contents vertically in available pane space and keeps
share choices horizontally centered. When content exceeds the pane height, the
action body scrolls with the beginning of the content still reachable. In the
non-paned layout, Buy expands the action area to its content height without an
vertical internal scroll area or viewport-height cap. Buy cards form a single
horizontally scrollable row in the non-paned layout, centered when they fit and
starting at the first card when they overflow. In panes, cards wrap into rows. Corporate share offers show a cream
YOU PAY amount beneath the share box when the purchase preview requires cash from
the viewing player. Amounts come from preview payments; fully corporate-funded
and personal purchases omit the label. Offers with multiple prices preserve the
corresponding distinct contribution amounts.

The share purchase view reuses CompanyDetails in a vertical layout: identity and
trains, financial summary, ownership with clickable legal purchase source rows, then private
companies and powers. Source rows commit the selected owner's purchase directly.
The operating-order detail retains its horizontal layout. Title-owned power
descriptions and pool labels are shared between both presentations.

During a stock round, company ownership rows use canonical stock-round sales to
mark sellers red. Sellers remain listed at zero shares, displayed as a dash. The
marker is scoped to the current stock round and follows visible state on undo
and history inspection; no sales are inferred from changes in share counts.

Stock choices appear only after selecting Buy or Sell. Compact company pills
show the token beside the price above compact source rows. Buy lists only legal sources for the selected buyer,
side by side beneath the shaded token/price header, with a tiny source label
above its larger share count. A single source fills the width; multiple sources
have short vertical dividers. Differing purchase prices remain explicit. Clicking a source commits the purchase. Sell lists only companies with legal sales, using the same token/market-value
header as Buy. Company headers remain visible with the selected company highlighted. Its legal
quantities appear in a separate row below with proceeds. Selecting a quantity
stages the sale; switching company clears the previous quantity;
the existing Sell submission and Undo behavior remain. No full company cards occupy the action
panel. TOP abbreviates PEIR and places it last; other choices retain market order.
Switching the buyer recomputes legal options from the session.

Sidebar game information pairs train limit with depot availability. Each currently
available depot type uses the title's train badge and canonical remaining count
(infinity for unlimited supply); sold-out types are omitted. Clicking Depot opens
a depot-only roster with live remaining counts and the same current-row highlight
as the phase chart. All available types are highlighted; exhausted rows are muted. Title-specific company roles share the compact information row; TOP labels them
Main and Short. Additional title information such as tranches follows below.

Expanded operating-order company cards show Cash, Par (if present), Market, and
Last run below the header. Last run uses the latest visible RunTrains revenue;
clicking it invokes the same historical map preview and route focus as history.
A company without a recorded run shows a noninteractive dash.

Stock-round company choices follow stock-market operating order, including market stack tie order. TOP places PEIR last, matching its special operating position.

Unfloated buy choices show a dark band between their header and sources: “N to float”. The remaining share count comes from title CompanyRules and shares the flotation eligibility calculation; floated companies omit the band.

Starting a company keeps all legal company tokens visible, highlighting the staged selection. Legal par choices appear in a second row with large par values and the full purchase cost underneath, using the matching market space background colors. Switching companies replaces the staged selection; selecting par still submits immediately.

Sell headers show the player's current holding count and sale price. In titles
that allow extending a sale block, the price remains the block's original price
for the current turn. Subsequent legal quantities are additions, with rules
evaluating the cumulative limit. History renders one total-sale sentence for
that block and retains the individual consequence lines and order diagrams.
Undo recomputes the total from the remaining visible action prefix.

When private purchases are legal during an operating turn, Buy privates sits at the right end of the OR strip after Trains. It opens the existing staged private-purchase panel and highlights while selected; there is no duplicate entry button in the action panel. The purchase remains optional and available across eligible OR steps, rather than becoming a sequential step.

Private purchase choices reuse compact private-card headers with name, income and purchase range, without descriptions. TOP omits the chooser heading because Hunslet is its sole buyable private. Other titles show AVAILABLE PRIVATES. When both sources exist, Mine / Other players uses a short vertical divider and a selected background.

Private purchase cards use equal-width responsive grid columns. Another player's ownership is shown beneath the card as right-aligned “owned by [name]”.

Private train powers use the same colored train-and-price buttons as ordinary train buying. The prompt identifies the private that closes. Clicking a legal train commits its private train purchase directly through the session, without a dropdown or confirmation step.

Private tile powers reuse the ordinary map mask, focus, staged tile picker, rotation, cost chip, cancel and accept controls. A sole power is auto-selected; multiple powers require a manual choice. The selected private's construction terms supply legal locations, definitions, payer and connectivity, and acceptance submits LayPrivateTile rather than an ordinary track action. Private construction takes precedence over normal route/station interaction while active. Cancel clears the tile preview; Undo clears manual tile/power selection before reverting a committed action and skips auto-selected power stages. 1889's Mitsubishi Ferry prompt is “Place the port tile”; Ehime Railway uses “Place a tile in Ohzu”, both in sentence case. Committing or undoing retains the existing session reset and map animation lifecycle.

The OR strip exposes optional Buy privates (Buy Hunslet in TOP) and Use privates buttons only when their actions are available. At panel widths of 720px or less, two available buttons collapse into a Privates popover with the same choices; a sole available action stays direct. The popover closes on selection, outside click, or Escape. Use privates is a manual session selection sharing the purchase chooser's lifetime and Undo handling. It reveals the existing private-power controls and suppresses the ordinary OR action prompt until dismissed; required private-power windows remain visible independently.

### Operating income projection

Operating income scans recorded actions once in forward order. Shared StartOperatingRound and FinishOperatingTurn actions record net-worth snapshots using title valuation rules; DistributeEarnings records its round identity, company name and payments. Completed rounds use their closing snapshot; unfinished rounds use the latest round-start or company-completion snapshot. No engine, replay patches, or historical states are used by the calculator. Player-income and net-worth footnotes appear only in Player view. Old unpublished local examples are migrated once in the development host.

Company-change and cash history ledgers own both their initial data and copies of inserted undo-patch values. Recorded action payloads remain immutable during backward reconstruction, and retained presidency changes are value snapshots independent of later ledger changes.

History descriptions and company-name lookups use the same visible history context as grouping and ledger reconstruction. They must not read the animation-delayed table state: a jump can publish ending actions before the displayed starting state has settled.

### Read-only position panel

History, spectators, and non-active players see PositionPanel in place of the action snippets and stock menu. OR chevrons remain visible as disabled progress indicators, with private-action buttons omitted. Live spectators and non-active players also keep the stock action strip during a stock round: it lists the title's stock menus (Buy, Sell, Start while unstarted companies remain, and Exchange when a private carries exchange terms) as disabled pills with no selection, no Pass/End turn, and no title-specific extras; history hides the strip. In those live positions the panel opens with a large turn heading naming the turn manager's current player, with that player's color, followed by "'s turn". Additional active players from private timing windows are not listed; the heading always identifies the player whose stock or operating turn it is, and is omitted while no turn is open. Status headings omit player names; event details retain actor names where relevant. Historical chevrons identify the selected event’s step; live spectators see the current decision step. The panel presents event-specific information, including purchased train badges, prices, payouts and recorded route revenue, without a generic cash/inventory row. Run tables reuse TrainRunTable, including the income headings, train badges and total; recorded payouts reuse EarningsCard as a noninteractive result with recipients and market movement. Run tables appear for the run event, not subsequent payouts; the round and operating-company labels remain in the shared header. It does not mount action choosers or the automatic route calculator. Track results render the recorded tile and rotation; upgrades show the previous tile → replacement, with “for $N” for a positive cost and no coordinate label. Results reuse GameEnding with the supplied position state.

Every game-data lookup in PositionPanel comes from the session's published game state and the actions up to its action count, so the panel follows the animation framework like the rest of the table and updates once state-change animations complete, in live and history positions alike. Title-provided names, train definitions, token appearances and auction rules remain presentation inputs. Auction lot lookup takes that same state explicitly. Returning to an actionable current position restores the normal controls. The mechanism is shared across title-specific auction, stock and operating procedures; state labels belong to the existing finance-example flow, not a universal 18xx turn sequence. No bridge or host API shape changes are introduced.

18xx history stepping skips finish-track, finish-station, finish-operating-turn and non-pass finish-stock-turn bookkeeping records without stopping on them. Automatic stock-turn completion after a purchase never creates an invisible stop; the purchase and next player's pass remain separate stops. PositionPanel keeps the preceding action description after an exact jump to bookkeeping. A share purchase that floats a company is one step, and PositionPanel shows the purchase and flotation together, including the recorded capital detail. Train runs and payouts remain separate stops. Exact history targeting and stored records are unchanged. Read-only operating progress and the round/company header use the same visible history context as the position panel.

History navigation projects map framing from the selected history context: a recorded run fits all route locations, a committed tile lay fits its location and outlines that hex only while its event is selected, a station placement fits and outlines its tile with a “Placed [token] for $N” summary, other OR events fit the operating company’s stations (reserved homes if none are placed), and stock/auction positions fit the full map. Route overlays are limited to the selected run event. Camera framing is applied without an additional animation after the displayed map reaches that history position; cancelled navigation cannot apply stale focus. Live placement and autoroute camera effects do not run in history. Historical inspection modals remain independent.

For pass-order stock rounds (TOP), player-card headers show a compact turn-position number instead of Priority deal. A fresh SR clears the numbers; each passed player receives “Next N” from the existing pass-order projection. Outside the SR all player cards show their established positions. Consecutive-pass titles retain the priority-deal marker because their pass order does not establish fixed next-turn positions.

Player cards always follow turnManager.turnOrder. During an SR the prospective order affects only the “Next N” labels (or priority marker for consecutive-pass titles); cards reorder only when the round commits its next turn order.

Player-card reordering uses Svelte animate:flip on the existing keyed articles (180ms). This is non-blocking layout settling: it has no action sequencing or interaction dependency, can be interrupted, and does not own card state. History navigation also animates reordering; only reduced-motion preferences suppress the motion.

Operating-order chips use the same 180ms Svelte animate:flip layout settling on keyed list items, with no game-state or interaction dependency. Reordering animates during history navigation too; reduced-motion preferences suppress it universally.

TOP branch allocation opens automatically with an auto-sourced empty allocation after par selection. Two outlined Parent/Branch panels contain stations, trains, Hunslet when initially present, and cash. Transfers remain staged until Confirm split; arrows move assets between panels, protected homes cannot transfer, and the first transferred station supplies the internal branch-home token assignment without a separate choice. Undo resets manually edited allocation to its initial automatic value before backing out the par selection. Station names use the table’s normal location-focus callback. The branch panel includes its bank grant in cash and cannot transfer that grant back to the parent.

Branch allocation uses one cash slider spanning both panels and one parent-cash input; branch cash is a read-only total including its bank grant. Empty train/Hunslet sections remain on the parent only if it originally owned those assets, and are hidden on the branch. Transfer arrows use larger borderless shaded buttons.

### Sidebar tab typography

The shared table owns Players/History/Chat label typography in component CSS so
published UI Artifacts carry the 11px uppercase labels and their letter spacing.
It must not depend on the Site Frontend scanning the family source for Tailwind
utilities. Title harnesses scan family sources for other utility-class styling.

### Construction reach and placement eligibility

During tile laying the mask exposes every location reachable under the laying
company's construction rules, plus legal placement locations granted by special
powers. Available tile inventory, cash, phase and remaining lays restrict clicks,
not the displayed reach. Blocked cities still stop network traversal. The camera
fits the exposed area. `MapScene.highlightedLocationIds` owns mask visibility;
`legalLocationIds` independently owns selection and hover eligibility. Station
placement continues to use its legal placement locations for both sets.

### Explicit history jumps

Round interstitials navigate from their entire surface to the final recorded
action in that round, including bookkeeping omitted from displayed entries.
Company headers similarly navigate to the final action in their operation group.
Both use exact action boundaries so the selected section remains complete and
the next section is not shown. Jumps request exact state-only navigation and are
disabled while the session/history is busy. These controls do not open the
historical map preview modal.

### Compact player portfolios

Only the player card's compact/expand header toggle changes all cards together.
The header toggle provides keyboard access. The compactPlayerCards family preference
persists this player’s choice across reloads and 18xx titles, defaulting to expanded. Company-map
links and private-description controls retain their own behavior. Compact cards
hide the Ownership label and the entire Privates/Income/Value header, and arrange abbreviated company holdings
in two columns, preserving percentages and presidency markers. Company tokens remain visible. Numbered railway
shares appear inline centered between the company abbreviation and ownership percentage (for example PEIR 3, 5, 6),
with location names retained as accessible labels/tooltips and map-focus buttons.
Reordering cards and navigating history preserve the preference; it is presentation only and never a game action.

Company links in player portfolios focus all track reachable from the company's
placed stations, respecting blocked cities and impassable borders, with reserved
homes as the fallback for companies without placed stations. Clicking the same
company again fits the whole map. History station-focused navigation retains its
separate station-only behavior.

The operating-order strip is visible only during operating rounds, including historical operating positions, and is hidden after game end. Active player cards use a reinforced outline with the normal unshaded header; the live round header pairs each active player name with their player-color dot and the same typography as the operating company.

After a stock share sale settles, keep the Sell menu open at company selection if the same player remains active in that stock round and has another legal sale. Clear the previous company and quantity selection; normal reset behavior applies when the turn or round ends.

Offered-lot auctions distinguish the auctioneer and initial value from a bidder and high bid. When an offered-lot bidder cannot make the minimum legal bid, the handler records a system PassAuction; it preserves the procedure's re-entry and forced-purchase rules. TOP opts into a system OfferAuctionLot when its auctioneer has exactly one lot remaining; the offer appears in history and bidding opens without a manual selection. Stock rounds likewise record a system FinishStockTurn when the title's full action handler exposes only finishing/passing. These decisions belong to game logic, not a client effect; optional exchanges, starts, and title-specific actions prevent automatic passing. Waterfall auction offering/purchase behavior is unchanged.

Tile selection, placement previews, legal tile hover, and history tile focus use a solid orange (#f07818), eight-unit outline with rounded joins.

The operating-order chips are centered when they fit and scroll from the start when they overflow, without left padding. Their display toggle sits at the right edge of the map toolbar, outside the view tablist.

Live and historical table maps allow manual zoom to twice native size. ScalingWrapper keeps its original maximum for callers that do not opt in; no host-bridge contract changes are required. TOP and 1889 UI artifacts need republication to adopt the increased map zoom.

X and T upgrade locations show only the standard tile-label-sized X or T, inset from the left edge and vertically centered. This marker remains on yellow tile placements until the tile itself carries the label; tile definitions remain unchanged, and existing tile labels are not duplicated.

Routes render above tile artwork and map borders as continuous round-ended strokes with a darker shade of each route’s color as their border. City interiors are masked to preserve station tokens; cities have no route outline. Matching regular track endpoints are redrawn only within a two-unit strip across tile edges above the map borders, without bridging unmatched track ends. Map names render above these seam repairs. Names up to 18 characters (such as “Royalty Jct & York”) stay on one line; longer names split at the word boundary nearest their midpoint into two centered lines, retaining the full name instead of truncating it. The first line keeps the single-line top inset, and the second line extends downward. Single-word names remain intact. Tile annotation text declares its central baseline directly, rather than relying on an SVG group baseline, so WebKit and Chromium both center fixed and staged revenues in their backgrounds. This presentation is shared by live and historical maps across titles.

The zoom wrapper does not permanently promote its content with `will-change: transform`, allowing vector content to repaint at the settled zoom scale. This is an internal rendering change with no host-bridge API change; UI artifacts bundling ScalingWrapper must be republished to adopt it.

The track picker keeps its entire overlay in a persistent compositing layer above the transformed map, including tile choices, placement cost, and accept/cancel controls. Its stacking order must remain stable during and after entry animations, dragging, and fullscreen transitions. TOP and 1889 UI artifacts need republication to adopt this Safari rendering workaround; game logic and the host bridge are unchanged.

In the non-pane layout, the phase and Undo header stays within the same column as the action panel and map. Phase and turn controls wrap when they cannot fit together, and long company/player names wrap within their group. Pane-layout header alignment is unchanged.

Wheel-event trackpad pinch (Ctrl-marked wheel events) uses a 0.006 zoom coefficient, independently of ordinary mouse-wheel zoom at 0.003. Touch-distance pinch and native Safari gesture scaling are unchanged. This internal shared-wrapper change requires republication of consuming UI artifacts to adopt it, without host-bridge changes.

TOP imports its Tailwind stylesheet from the production runtime, with generated rules scoped to `[data-game-ui="the-old-prince"]`, matching the independent artifact pattern used by Bus and Indonesia. The development page must not be the only stylesheet entry. Republishing the TOP UI artifact adopts this fix without a Site Frontend or host-bridge change.

### Concession private tokens

TOP supplies tokens for Mainline and Shortline Concessions from the companies
currently assigned those roles. Auction offer icons, bidding cards and private
description cards share those appearances; cards place the token at the upper
right. The association follows displayed state, including history. Other privates
and titles keep their existing presentation unless they supply a token. This is
UI-only metadata and does not infer a universal concession or formation rule.
Concession descriptions start by identifying the president’s certificate and
the actual assigned company, then retain the closure conditions. This descriptive
text lives in TOP’s private rules module; the icon metadata lives in its UI.
No host-bridge member or gameplay rule changes.

The round/phase header uses a 4px gap between the Phase label and its badge when both are visible. Mobile retains the badge alone.

Operating-history footnotes wrap within the table’s available width and do not contribute intrinsic width; income and payout tables remain centered beneath the full-width controls strip.

Auction offer icon buttons reserve a fixed 26px square for both company tokens and private abbreviations, with a 9px gap before the name. The button’s width is explicit so Firefox and WebKit do not size it from the abbreviation text while its icon overflows.

TOP’s Royal Agricultural Society and Railcar Ferry use the Mainline token and begin with ‘Includes one share of [company].’ Mainline and Shortline concessions begin with ‘Includes the president’s cert for [company].’ Shared private cards split descriptions on blank lines and render explicitly double-asterisk-delimited introductory paragraphs in bold; other paragraphs remain regular text.

TOP exchange privates Merchants and Co., Vernon River Bridge, and Shipbuilding use the assigned Shortline company token and a bold opening paragraph: ‘Includes one reserved share of [company].’ Ice Boats uses an outlined token with a large question mark because its exchange target is chosen from eligible companies. The same appearance is used on private cards and auction icons.

Auction share cards use the issuing company’s token in their upper-right corner, including each numbered PEIR share. Auction lists, pile popovers, and active bidding cards share the same lot token resolution.

Schreiber and Burpee Construction uses a yellow straight-track tile icon, exported from the standard tile 9 geometry and classic palette, in auction lists and the card corner. Card titles balance within 22ch so this long title occupies two lines.

TOP private closure and forced-exchange conditions appear in the final paragraph. Phase references in that paragraph use the title-supplied phase colors and shared TrainBadge; timing text and exceptions remain intact. Introductory bold formatting is explicit, so splitting an ordinary description does not make its first paragraph bold.

The auction offer table centers within the action panel when narrower than the panel. It omits the redundant player-name / offer-instruction heading; the round header retains acting-player context.

Auction offers use compact 3px vertical cell padding and no horizontal row dividers.

Player headers expose a compact/expand icon beside the order badge: two horizontal bars with arrows pointing inward to compact or outward to expand. The icon is light tan at rest and darkens on hover or keyboard focus. The dedicated button retains an explicit accessible action label; background/name clicks do not change the card layout.

Expanded private-company headers retain the “Income” label; compact cards omit the complete private header row and append “ / OR” to each private income amount.

Player-card private rows leave zero income blank, including its / OR suffix; the private’s value remains visible.

Compact player cards use the existing optional preference host API without changing its interface. Existing stored preferences acquire the new expanded default through normal preference resolution. TOP and 1889 need updated Logic and matching UI Artifacts: the backend validates the added preference key against the published Logic schema. No host API change is required. The preference is shared presentation across the researched family, independent of title-specific ownership or turn-order rules.

TOP X/T labels apply from yellow onward. Its yellow tight/gentle X/T city tiles have 20 revenue and unlimited supply; other yellow tiles are also unlimited except the single straight and two each of the double-dit tiles. The manifest displays ∞ and the tile library says Unlimited.

The manifest groups yellow tiles by label: plain, T, then X, preserving the existing simplicity order within each group.

The spreadsheet leaves up to 20px below its controls strip when vertical room permits. This space shrinks to zero before the sheet needs vertical scrolling; controls remain directly below the tabs.

### Table color theme

The table always uses dark mode, with no theme toggle. Existing saved theme
preferences remain accepted for older UI Artifacts but do not affect this UI.
Dark mode uses table-scoped surface, text, border, focus, and interaction colors.
Popovers and dialogs inherit the table
palette, including phase/depot charts and historical maps. The map surround is
darkened, while tile colors, map artwork, stock-market cells, company tokens,
player colors, and train/phase badges retain their gameplay meaning.

TOP and 1889 require updated UI Artifacts for the dark-only presentation.
The host API, Logic schema, and serialized Game State are unchanged.

In dark mode, phase-colored history interstitials, round-index entries, and phase-change rows use canonical phase colors at full strength, including split-color round backgrounds. Their text adapts to the phase color instead of tinting the color to match the dark surfaces.

Canonical phase colors also apply to all train/phase badges, purchase buttons, header/depot indicators, private-card closure badges, charts, and company panels in dark mode. Saturation, dimming, and hover filters must not alter these semantic colors.

Dark-mode history interstitial borders match the dark table background, leaving the canonical phase fill prominent without bright separator lines.

Operated companies dim as a whole in both themes, including their train badges. This intentional completed-state dimming is an exception to preserving phase colors at full strength in dark mode.

The ownership spreadsheet outlines the current player row and operating company column in player-row orientation; reversed axes outline the current player column and operating company row.

### Initial preference loading

The table waits for the initial player preference request before rendering its contents,
using a dark canvas while pending so a saved dark theme never paints the light default.
A failed request or an older host without the preference API settles to the existing
defaults. Background preference refreshes keep the table mounted; an account change
waits for that account's preferences. This correction requires updated TOP/1889 UI
Artifacts, with no Site Frontend publication, Logic, or host API change.

### Sidebar layout

At every viewport width, Players/History/Chat remain in the existing left sidebar,
with history controls and phase/depot/title information above them. Player cards
remain stacked vertically. P/H/C select those sidebar tabs. The action area belongs to the tab workspace.

### Splittable table workspace

At widths of 1024px (64rem) and above, Actions, Map, Market, Spreadsheet and
Tiles use the shared splittable `TabWorkspace`. Initially Actions occupies the top half and the other four tabs share the
bottom half with Map active. Their horizontal divider is draggable; Actions can
move, merge, and reorder like any other tab. Each header offers horizontal (top/bottom)
and vertical (left/right) split buttons. Any pane may split in either direction repeatedly, up to eight panes total.
At that limit both split buttons are disabled until a pane is deleted. New panes start empty with “Drag a tab
here”. Dragging a tab moves it without duplicating it; emptied panes remain usable.
All split dividers support pointer capture and arrow keys, Home/End, with ratios
limited to 20–80%. Alt+Shift+Left/Right moves a focused tab between panes. M/K/S/T/A
activate the corresponding tab in whichever pane owns it.

Panels stay mounted at stable DOM locations while their rectangles and visibility
change, preserving map camera, spreadsheet axis and component state. Workspace
layout is a saved family preference; the sidebar remains in place at all widths. Below 1024px, Actions is an ordinary
content-sized area above the four fixed view tabs, with no split/delete/drag controls.
Crossing this breakpoint remounts the view layout; returning to wide restores the saved or pending arrangement. Previously stored spreadsheet split preferences remain accepted
for compatibility but no longer control the workspace. Persisting layouts requires updated Logic preference schemas and UI Artifacts; the host API is unchanged.

The sidebar retains its existing Players/History/Chat tab appearance.

The player-row spreadsheet highlights the active player(s) from the displayed
financial state with an outline only in both themes. History therefore
uses its viewed turn. Pool and portfolio-company rows are excluded, and company
rows receive the operating-company outline when the axes are reversed. In the player-row orientation,
the currently operating company column has a continuous outline from its header
to the final statistic. Neither outline tints the cells.

Workspace tabs can be reordered by dropping before another tab. Every pane has a Delete button when multiple panes exist. Deleting one merges
its tabs into its sibling and expands that sibling without remounting tab content.
The last pane cannot be deleted. Workspace headers use a compact 35px height.

The map tile picker uses Map’s active state within its own pane, independent of
the last globally selected tab. Moving or selecting a tab in another pane must
not suppress tile selection overlays on a still-visible map.

At 1024px and above, Game info and Players/History/Chat occupy ordinary panes
in the same workspace as the other views. All panes share the eight-pane limit.
Their shortcuts select the tab in its current pane. Below 1024px the original
three sidebar tabs remain unchanged. Chat mounts when active, so merely rendering
a hidden Chat tab does not mark messages read.

### Saved pane arrangements

`paneLayout` is an account preference at 18xx family scope, with a versioned compact
JSON layout: `{v:1, sidebar:[tab IDs], main:node}`. A node is an ordered tab-ID
array or `["rows"|"cols", firstPercent, firstNode, secondNode]`. Active tabs and
runtime pane IDs are not stored. Divider percentages are rounded to integers.
Unknown/duplicate tabs are removed, missing tabs restored, ratios clamped, and
invalid or oversized trees replaced by defaults. Future versions display defaults
without rewriting the stored preference until the user deliberately edits layout.

Only completed structural edits and divider releases/keyboard changes notify the
save controller. Saves debounce for three seconds, with Layout unsaved / Saving… /
Saved feedback and explicit save or Retry. A local account/family recovery copy
protects pending edits on reload; it is applied only when its baseline still
matches the account preference. Narrow layouts do not modify the saved layout.
Failures retain the layout and recovery copy. Account changes cancel pending timers.
Adoption requires TOP/1889 Logic schemas plus UI Artifacts; no new host API is used.

Each divider offers Swap sides, exchanging whole branches (including nested
panes) while preserving their sizes. The resulting layout is saved normally.

Swap sides is hidden and does not intercept clicks until its divider is hovered
or focused. It stays visible while hovering the button and is keyboard focusable.

Where the current-player row crosses the operating-company column, the cell has
no highlight edges. Row and column outlines join as one cross-shaped boundary,
without tinting the intersection or drawing an internal box.

Player cards use one horizontal, scrolling row of 310px cards when their pane is
at least 660px wide and wider than it is tall; otherwise they stack vertically.
The layout follows the actual pane dimensions, including resizing and tab moves.
In Actions panes, the operating-order footer stays at the bottom while action
content scrolls above it. Expanded order details may scroll within the footer.

In the splittable workspace, spreadsheet tables (current holdings, income and
payouts) fill the pane horizontally with no gap below the controls. Narrow, non-paned layouts retain the centered
intrinsic-width sheet. Controls remain centered and oversized tables scroll.

Pane headers offer Add tab or widget. The catalog moves existing tabs without
duplicating them, and adds absent optional tabs.
Optional tabs are excluded from defaults and missing-tab recovery, but retained
when present in saved layouts. Operating Order is the first optional widget; in
the wide layout it replaces the Actions footer and is absent until added. The
original narrow layout retains its operating-order strip.

Pane headers consolidate splitting and adding/moving tabs into a compact options
popover anchored below an ellipsis button. Delete remains the far-right control.

The options popup uses a consistent compact width, with split icons followed by
Current tabs and Add tabs sections. Add tabs is always visible when tabs can be added;
there is no separate plus button.

The Add list contains only tabs absent from every pane. Already placed tabs move
via dragging, not the catalog. Hide Add tabs when no absent tabs remain.

The options dropdown lists the pane’s current tabs with individual close buttons.
Actions is protected and never closeable. Closed tabs become available in Add.
An optional `closed` list in saved layouts distinguishes deliberate closures from
missing newly introduced tabs; protected tabs ignore entries in that list.

Spreadsheet row/column emphasis is a continuous, noninteractive SVG layer over the
ownership table, measured from rendered rows and columns. Cell and section dividers
do not interrupt it. Resizing, content changes, axis swaps, and active-owner changes
remeasure the outline; intersecting player/company edges remain omitted.

In a workspace pane, the action surface fills the available width and remaining
height beneath its action strips. Content scrolls when the pane is too small;
the original narrow-screen action area retains its content-sized height.

18xx supplies tab content, responsive layout policy, preferences, and a mapping
from railway colors to the base TabWorkspace theme. The reusable workspace itself
has no 18xx dependency; its v1 saved layout format remains unchanged.

Auction history headers use a subtle 15% tint of the offering player’s color over
the theme surface; auction names have no dots. Auction history cards have no outer
border and use square corners, including the tinted header. Each player-attributed
stock-round action and pass has its own line, untinted, with the player's name as a
medium-weight rounded badge: a 45% mix of that player's color over the theme surface
behind the name only, with no dot or colon. The description and its values stay
regular weight. A player-attributed stock description starts with a lowercase verb after
the player name. History descriptions use full company names unless a title provides a
history-specific name. Automatic flotation names the company without a player
name or player tint and places its company token beside both the flotation
summary and detail. Stock sales remain separate recorded lines. Both use the
viewing player's palette.

Players/History/Chat uses the standard workspace tab spacing in pane mode. The
original non-paned sidebar spacing is unchanged.

In pane mode, all views share one unrestricted workspace. The default is a 20/80
left/right split: Game info above Players/History/Chat on the left (25/75), and
Actions above Map/Market/Spreadsheet/Tiles on the right (50/50). Game info contains
phase, train limit, depot, and title-supplied information such as TOP tranches.
History controls remain above the workspace. Every pane supports ordinary split,
resize, swap, tab transfer, and deletion; only the Actions tab is protected.
Below 1024px the original fixed sidebar/action/view arrangement remains in use.

Table layout version 2 retains the base v1 wire format and adds a caller-owned
version marker. Legacy main splits and ratios survive migration, with former
sidebar tabs promoted into ordinary panes. At seven/eight legacy panes, combine
the added tabs into one/a surviving pane respectively to preserve the eight-pane
limit without discarding tabs or existing dividers. Existing valid saved layouts
win over the default when returning to pane mode. This needs updated TOP/1889 UI
Artifacts only, with no host bridge or Logic schema change.

The pane-mode history navigation and round/phase header share one bottom border
across the workspace width. Game info keeps an eight-pixel inset around its
phase/depot buttons so controls do not touch the pane divider.

Player portfolio headers share the auction header’s 15% player-color tint in both
compact and expanded views and both themes. Non-player portfolio headers retain
the neutral surface.

Spreadsheet player-name header cells use the shared 15% player-color tint: row
and column headers in ownership views and player-group headers in income history.
In ownership views that tint runs across the player's whole row or column,
holdings and financials alike, and a player header carries a 3px bar of the
player's color on its leading edge instead of a dot. A controlled portfolio such
as Union Bank takes its controller's tint without the bar. Income history tints
each player's data columns; its metric header row stays neutral.

Company/pool headers use the raised label surface. The available pool is neutral
like untinted holdings, with every second pool row or column one step lighter in
its data cells only. Share value uses a faint turquoise as market-derived data,
and company cash, trains, tokens, and last run sit on a recessed darker fill.
Sold-share rose takes precedence over any fill, and hover lightens whatever fill
is beneath it. Cells where player financials would cross the pool or company
financials are never populated: they show bare table background with no dashes or
rules, bounded only by the section dividers that border real data.

Section dividers are 2px and cell rules are faint 1px lines; a header receiving
an ownership connector omits its leading rule. Row headers stay pinned during
horizontal scroll and carry the first divider. While a company operates only
that company is outlined; the active player is outlined otherwise. The outline
stays visible over these fills in either orientation, and pinned headers cover
it only while the sheet is scrolled.

Company cards echo the spreadsheet: the cash cell uses the recessed fill, the
value cell the faint turquoise, and investor rows carry their player's tint to
the card's left and right edges. Corporate investors follow the player who
controls them. A sold-out company shows a cream SOLD OUT label at the right of
its ownership heading, judged by the title's own sold-out rule.

Player cards in workspace panes start 10px below the pane header, matching the
10px gap between cards in both vertical and horizontal arrangements.

When Map and Market are visible in separate panes, F toggles Map fullscreen only.
Market accepts F when Map is hidden or closed; its fullscreen button remains
available in either case. Visibility is checked when the key is pressed, so tab
transfers and remount order do not change shortcut priority.

Expanded Map/Market views render above all workspace panes and dividers through
the shared wrapper’s modal browser top layer, preserving mounted content on exit.
Fullscreen blocks background pointer input, focus, and table keyboard shortcuts.

The unified pane-mode history/round header uses the same 15% player tint for the
single active player in its displayed state, including history navigation. It
remains neutral when no single player is active. The tint and bottom border span
the screen width. Panes reach both screen edges without outer side padding; header
controls and Players pane content have an internal 8px side inset. Phase badges retain canonical colors.

Player Aid is a default table tab after Tiles, movable and closable like the other reference views. It shares the phase chart, train roster, and notes with the phase popup, uses the viewed phase, and stacks its tables in narrow panes.

In pane mode, Chat has no outer border or rounded container corners. Its message composer retains its input styling.

Player Aid and Depot share a live train roster: Remaining shows depot stock / initial supply, including ∞ for unlimited trains; currently available nonempty train types are highlighted and exhausted types dimmed. Depot is an optional tab, absent from the default layout and available through Add tabs.

Fullscreen and historical-map modals use the shared wrapper’s pre-paint dimension fitting, including the initial route focus, so opening them does not expose an intermediate scale or position.

Companies is a default table tab after Spreadsheet. It displays the spreadsheet's
started, open share companies in the same title-supplied or start-action order,
using the existing 200px vertical CompanyDetails cards. In pane mode, cards wrap
left to right into as many rows as fit the available height, accounting for actual
card heights. When those rows cannot fit the pane width, the pane scrolls horizontally.
Non-paned layouts retain a single horizontal row. Cards retain their width. Both
views derive their company list from the displayed state and history position.
The tab participates in the existing workspace move, close, and saved-layout
recovery behavior and is also available in the narrow layout. TOP and 1889 need
updated UI Artifacts to adopt it; no Logic or host contract change is required.

This presentation reuses the existing company/share distinction across the
researched family: private companies remain in portfolios, while minors,
formations, and title-specific company sequences retain the spreadsheet's
eligibility and ordering. The variation catalog's differing company structures
(1822 minors, 1824 formations, and TOP split companies) require no new rules or
card interface for this view. TOP's supplied ordering and 1889's start ordering
exercise the two supported ordering paths.

Titles may explicitly include existing share companies in Companies even when they
have no start action or started flag. Explicitly included companies follow the normally ordered companies. TOP places
PEIR last and labels its narrow card PEIR; other card names retain their full names.

Company cards with numbered shares show certificate numbers before share counts
in each ownership row, keeping the count in the rightmost column.

History View displays a 14px cream strip of thick dark-blue horizontal dashes immediately
above the table header, with VIEWING HISTORY centered on a solid cream label. Each dash is 18px
wide and 6px tall with an 8px gap, vertically centered; the blue matches the dark-mode table
background (#18212b). It spans
the full table width, including the sidebar, in both layouts. The layout height
accounts for the strip so the table still fits the viewport. It follows the existing session History View flag, uses
the same colors in both themes, and disappears on return to Live View. This shared
presentation applies across titles without changing history rules or host contracts.

Round interstitials expose their entire surface as a keyboard-accessible jump to
the recorded final action, without clock icons. In History View, the current
round interstitial and its most recent company header each have a separate return-arrow button using the exploration return
glyph. The company arrow sits immediately after the company name, above the player
name. It returns to the current game through history navigation, preserving any
active exploration. Busy-state navigation guards apply to both controls; returning
live removes the arrow and the history strip. Company headers share the full-surface jump target without a clock icon; auction headers retain their existing behavior.

### Published board presentation

The picture button beside Undo is available only when a title supplies board
artwork. It switches this client's table between generic and published
presentations, with a pressed state and an accessible label describing the next
choice. The choice lasts for the mounted table and resets to generic on reload.
It creates no Action, changes no other client's view, and retains any Action Selection
and map selection. Switching fits the selected presentation's full bounds.

The image renders at its native dimensions behind laid tiles, station tokens,
routes, placement masks, hit targets and selection highlights. Unlaid hexes remain
transparent; printed labels and track are supplied by the image. The diagnostic grid is hidden in artwork mode; selection and focus highlights
remain visible. The same image-to-map mapping must determine
rendered positions and focus rectangles. The image never supplies game identities
or pointer hit targets.

History View, historical-map dialogs and Undo use the selected presentation with
their displayed map state. Existing masks, route emphasis and selection precedence
continue to apply. The table owns the local presentation choice; MapScene owns the
background and overlay composition. No Game Session transient value is added.

Browser verification switches modes with a track selection, commits a lay, steps back
and returns to Live View, then undoes the lay at desktop and mobile widths. The
image remains visible while tiles follow the displayed state. A title without
artwork retains its generic map and has no picture button.

Train-income row hit targets are confined to the visible train and income cells.
The full row is a real button, including the income amount, with hover and keyboard
focus on that same button. It must never intercept adjacent actions such as Run
trains. WebKit browser coverage verifies route focus, Run trains and Undo for TOP
and 1889.

Stock sales, company starts and private exchanges share Buy’s vertical centering
and pane scrolling behavior, as does the root prompt. Company
choices show the owned share count at token size, followed by the token and the
price at Buy’s price size. Clicking a company with one owned share immediately
commits its legal sale. Other companies open legal quantity choices; clicking a
quantity commits that sale directly, without a confirmation stage. These explicit
clicks use the existing session sale path, including sale-block pricing, visible
state settlement, continued selling, and committed-action Undo.

Sale quantity choices are introduced by HOW MANY. Below the stock controls, a
compact SALES table shows each company token and total shares sold in the current
stock turn. It derives totals from visible committed sales since the last turn or
round boundary, follows Undo/history, and disappears when the turn has no sales.

At Actions-pane widths of 500px or more, the current-turn sales summary occupies
a 140px dark strip on the right, with a left border spanning the action content’s
height beneath the persistent action strip. The controls center in the remaining
space. Narrower panes and non-paned layouts retain the summary below the controls.

When exactly one legal stock action menu is available apart from Pass/End turn,
it opens automatically. The count includes private exchanges and title-specific
menus such as TOP Split. This is an auto-sourced transient choice: it commits
nothing, preserves Pass, and Undo proceeds to committed history unless a manual
selection remains. Manual menus take precedence; hidden selections and unavailable
interaction suppress automatic menus. Clearing selections recomputes the sole
choice from current legality without an effect.

This uses the variation catalog's stock-trading distinctions: title-owned buyer,
start, exchange, and split legality remain authoritative. It imposes no stock
sequence on titles without ordinary stock rounds. TOP and 1889 adopt this through
UI-only publication; Logic and the host bridge are unchanged, so mixed host/UI
versions remain compatible. Automated module coverage checks sole-option opening,
title-option counting, manual precedence, disabled interaction, Pass, and Undo.

Private exchange lists group equivalent certificates into one option per target
company, retaining a legal certificate identity for the submitted action. Different
private rights, players, share sizes, presidencies, numbered identities, sources,
and certificate-limit weights stay distinct. This is presentation grouping only;
title exchange eligibility and committed-action validation remain authoritative.
The stock action list and private-company cards use the same grouped options.
Module coverage checks duplicate ordinary shares, distinct companies, numbered
shares, and confirmation of the selected target.

Live spectator and non-active-player action panels label the latest recorded event
LAST ACTION across auctions, stock rounds and operating rounds, without a second
phase-status title such as Auction bidding. The heading has 28px of separation
below the player-turn line and appears only when an event is available. In pane
mode the turn line and event form one vertically centered block below the disabled
action strip, using the same layout behavior as stock controls. Narrow layouts
retain content-sized height; History View retains its position-status headings and uses the same pane-mode
vertical centering while navigating recorded actions.

Active operating controls use the same pane-mode vertical centering as stock
controls. Track, station, route, payout and train controls center as one block
with any associated company decision; the operating-step strip remains at the
top. Oversized controls scroll within the Actions pane, and narrow layouts keep
content-sized height. Both TOP and 1889 share this presentation.

Auction offering and bidding controls also center vertically in pane mode,
including TOP's stalled-auction fallback and 1889's waterfall auction. TOP's
branch-split editor uses the same centering. Negotiated purchase and track-consent
responses remain grouped within the centered operating controls. Tall lists grow
the scrollable action body; narrow layouts retain their natural content height.
