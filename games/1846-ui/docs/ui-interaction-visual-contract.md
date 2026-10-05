# Private distribution interaction

## Visual intents

The initial view conceals draft packets and commitments behind **Show my cards**.
The named player explicitly opens their packet, then chooses a card with a click,
tap, or keyboard activation. **Hide cards** immediately conceals both packet and
commitments. Each card submits one complete Action; there is no staged selection.
The last company's identity and price are public and bypass this cover. Players
can still show and hide their prior commitments while deciding on that offer;
hiding private cards never hides the public offer or its buy/pass controls.

## Coexistence and precedence

State publication and perspective changes invalidate an opened packet. A prior
player's reveal never opens another player's packet. Read-only History permits
inspection of that perspective's known cards but disables all purchase controls.
The first-stock-round handoff shows public purchases instead of draft controls.

## Shared visual state

The Game Session owns whether the current packet is open. Its key includes state
identity, action count, and player perspective; beforeNewState closes it before
publication. Pending transitions hide it immediately. Action submission closes
it even if submission fails; the player can explicitly reopen after a failure.
No private values are copied into UI state or persisted as display preferences.

## Render ownership

The title table renders the cover, packet, commitments, and public final offer.
Common owns the toolbar, perspectives, History, and recorded Action undo rules.
Every draft choice is an information barrier because it reveals the next packet;
mechanical reversal remains available to the runtime for history reconstruction.

## Verification scenarios

- Open a packet, choose a card: the next player sees a cover, not their cards.
- Open then hide: packet and commitments both disappear.
- Change History position or perspective while open: cover returns; History
  purchase controls stay disabled.
- Opponent/spectator delivery contains neither packet nor commitments; public
  final-offer and final purchase summaries remain visible.
- Reach the final-company offer with earlier commitments: show and hide those
  commitments while the public offer and buy/pass controls stay visible. Passing
  closes the private view before handing play to the next player. Verified
  manually in the development harness.
- Finish distribution: purchases, funded independents, and Priority Deal are
  shown; no finished-game result is fabricated.
- Narrow viewport: cards wrap and retain keyboard/touch targets.

Projection and full-draft replay are covered by logic tests. Interactive checks
use the protected development harness and ordinary hotseat.

## First stock round

Distribution automatically hands control to Priority Deal. Stock controls show
legal launch prices, purchases by source, sales by quantity, and Finish/Pass.
These are immediate committed Actions; there is no local selection or Back step.
History disables trading. Undo uses the Game Session's committed action history,
including automatic flotation/round-completion consequences. Public corporation
cash, prices, presidency and holdings are shown during and after trading. The
prototype continues into the first independent’s construction step. Each company’s
shares are sold as a single complete block; automatic closures have their own
System Action with semantic metadata.


## Board and construction

The boardless view is built from the shared map and tile renderers. Declared
board areas hold the market and phase-I/II depot outside map hexes. No physical
artwork view is claimed. Selection highlights and all token/track positions use
the logical map identities; the board and picker share tile definitions.

A selected hex is a manual local selection owned by the title session. Only the
acting player in the live track step can select; stock rounds, completed steps,
History, spectators and pending transitions cannot create a construction selection.
Leaving that interaction clears its selection. There is no automatic selection.
The map or hex selector sets it; Back clears it. Tile
buttons show a complete orientation and its evaluated cost, and commit a LayTile
Action through the session. Undo clears a manual selection first; otherwise it
reverses the committed action and its automatic consequences. Before state
publication, on a perspective change, or when history changes action position,
the selection and choices disappear. History keeps the board inspectable and
disables tile commitments and Finish. FinishTrack proceeds to routes, or automatically settles a zero run when no route
is possible. Both independent railroads complete before the majors operate; when all companies
finish, the next OR or stock round starts.

Verification: select a legal hex and Back; select a hex and Undo without changing
history; commit a lay and Undo to restore cash and supply; navigate History to
check controls are disabled; confirm selected tile orientation matches the board.
During a stock round, commit a purchase, click a board hex, then Undo: the purchase
is reversed immediately. After FinishTrack, clicking the board must likewise not
intercept committed-action Undo.

Verified in the development harness: launch NYC, click the board, and Undo restores
the launch choice; select C13 during construction and Undo clears its choices
without leaving the track step; FinishTrack, click the board, and Undo returns to
construction immediately. Type checks, lint, and the UI package build pass.


## Independent routes and settlement

The SC owner commits a complete railroad/port assignment, or skips, after private
income and before MS starts. These controls have no staged selection. The current
assignment and bonus appear above the board and remain public in History.

The shared route editor owns manual train, start, path and saved-route selection.
The title session connects its live acting-player gate, state and Action submission
to that module. The existing route panel renders its controls; the shared map
renders saved and developing path overlays. Track selection is inactive here.
Back removes the last manual route choice. Undo clears the route editor before
undoing a committed Action. Publication, perspective changes and History invalidate
local routes. History displays recorded route results and has no route editing.
The displayed completed run comes from RunTrains metadata in the visible Action
Step, including a system-generated zero run. Its read-only summary and map paths
remain visible after settlement and the next-company handoff, in both Live View
and History. The next User Action replaces that summary; navigating before the
run hides it. Pending publication hides it until the new visible state arrives.

Confirming routes commits RunTrains. A System Action records and pays exactly half
to the owner and half to the independent treasury, then completes that independent's
turn. Undo reverses the run, payments and automatic next-turn handoff together.
The next independent starts with fresh construction and route selection.

Verification scenarios: choose train/start/paths, Back and Undo; save and confirm
Detroit–Port Huron; check $60 income splits $30/$30 and Big 4 starts; Undo restores
MS cash and route step; inspect the recorded run in History without edit controls;
finish Big 4 without a route and reach the explicit major-operations boundary.

The browser DOM walkthrough exercised these controls: Detroit–Port Huron showed
$60; confirmation increased the owner's cash by $30 and started Big 4; Undo
restored the route step and cash. Back removed the last path segment, and local
Undo cleared train selection without reversing the track step. History prevented
route editing; finishing Big 4 without a route reached Independent operations
complete. Snapshot/narrow-viewport visual verification remains outstanding.

Recorded-result regression verified through normal Previous/Next navigation:
MS's $60 Detroit–Port Huron run remains visible after settlement with its $40/$20
breakdown and no editing buttons. Moving before the run removes that result;
moving forward restores it. Four automated cases cover cascade retention, history
prefix isolation, the next User Action boundary, and automatic zero runs.

## Corporate finance

After both independents, the first major's president chooses one complete priced
issue/redeem block or Pass. Choices come from title logic and are dispatched by
the Game Session. There is no local selection or Back step. Controls disable for
spectators, History, busy state and visible-state publication. Undo reverses the
committed transaction. The prototype continues into combined major track/station construction;
no-major games still play both independent operating rounds. The board and corporation
balances reflect completed transactions through ordinary visible-state publication.


## Major construction

LayingTrack also holds the major's station step. The existing map/tile selection
remains available before and after a station placement, until Finish construction.
The station panel lists complete legal destinations, city identities, slots and
prices from the shared station evaluator with 1846 rules. Its direct buttons
commit PlaceStation through the title Game Session. They share track controls'
authorization, History, busy and visible-state publication gates; no local token
selection is staged. A committed station invalidates any manual track choice on
normal state publication so newly accessible track and changed cash are reflected.

Finish construction closes track and automatically closes stations before proceeding
to routes and earnings. Reaching two tile lays does not hide legal token choices.
The map displays C&WI's reservation in southeast Chicago with its own label.
Private-company purchases and powers remain a clearly disclosed future slice.


## Major routes and earnings

The shared route editor also serves majors. A newly launched major has no train;
automatic RunTrains and DistributeEarnings actions record zero revenue and the
stock-price drop without redundant confirmations. Nonzero completed runs offer
full, half, or withheld dividends as complete session-owned choices, gated by the
same actor, History, busy and publication checks as construction. Earnings result
presentation shows revenue, retention, dividends, recipient payments and stock
movement from the visible action step’s DistributeEarnings metadata, retaining
the summary when automatic closure clears operating state. The current earnings
state remains available after later decisions in the same operating turn. History
reads only its visible action prefix, and publication temporarily hides the summary.
Neither presentation reads patches. No local selection is
introduced. Ordinary state publication updates the treasury and stock market.

The prototype continues to BuyingTrains. If the price reaches zero, System closure
removes the corporation's assets and ends its turn, then proceeds to the next
company or operating round.
Undo reverses the entire automatic cascade belonging to its triggering user action;
History is read-only. Corporate private purchases and powers remain unsupported.


## First major train buying

The live president chooses a complete depot offer showing train and price. Each
click commits one BuyTrain through the Game Session; there is no staged selection.
The panel shows the owned train count and four-train limit. Finish operating turn
is unavailable until the company owns a train. History, spectator, busy and
publication gates disable purchases and Finish. Ordinary publication refreshes
cash, depot inventory and ownership. Undo reverses each purchase or the completed
turn independently. Finish hands off to the next company or operating round.

If a trainless corporation cannot afford a train, the panel explicitly identifies
the unimplemented emergency funding boundary and preserves Undo. Phase-II train
choices unlock when the last depot 2 is sold; their first purchase reaches the
continued phase-II operating turn. No free train or skipped obligation is used.

Verification: purchase one $80 2-train, observe cash and depot decrease and owned
count increase; finish, Undo to buying, Undo the purchase; navigate History and
confirm purchase and finish controls are disabled.

Native desktop browser verification completed: IC bought its first 2 for $80,
ownership changed 0 → 1 and depot 5 → 4; Finish became available and reached the
completion boundary. History disabled both controls. Undo of Finish reopened
buying with its train; Undo of the purchase restored zero trains and $300 cash.


## Operating sequence

Finishing a major, settling an independent, or closing a corporation automatically
starts the next company's turn. At the end of OR 1, a System Action pays private
income and recomputes order for OR 2; the Steamboat owner may retain or change its
assignment before operations begin. The heading displays the current set/round.
No new local selection is introduced. Existing session controls enforce actor,
History and publication gates at each handoff.

After OR 2, StartStockRound initializes trading and selects the Priority Deal
player. The heading shows the stock-round number; the old operating order and
private-income statement are hidden while its set is complete. There is no third OR.
Undo reverses a triggering decision and its automatic handoff, including income
and order changes at a round boundary. History shows the corresponding OR identity.

Earlier verification notes describe the boundaries present in those slices; this
sequence replaces the former first-major and independent-only stopping screens.

Verified in the native desktop preview: Finish after IC's first train purchase
advanced the heading to Operating round 1.2 and reopened Steamboat assignment.
Undo returned to 1.1/train buying and restored pre-income player balances.
Replaying Finish, then completing both independents and IC in OR 2 reached the
second-stock-round boundary naming Ben as Priority Deal holder.


## Recurring stock rounds and train disposal

The existing stock controls serve every stock round; no new interaction is staged.
Completion of the last company in an OR set includes an automatic StartStockRound.
The active player becomes Priority Deal and fresh trading choices replace operating
controls. The next stock-round completion starts a new numbered two-OR set.
History and Undo retain their usual action-cascade behavior across both boundaries.

A closing company now removes its owned trains from the game. Train IDs are recorded
in CloseCorporation metadata, and Undo restores their ownership with the company.
The cards/board read the published state; closure never returns trains to the depot.
Earlier verification notes describe historical prototype boundaries that this slice
replaces. Later phases, emergency finance and inter-corporation train trades remain
unimplemented.

Native desktop verification: the OR1.2 handoff showed Stock round2, Ben's trading
controls and no obsolete operating-order caption. Undo restored OR1.2 train
buying. Replaying Finish, buying IC's $80 treasury share and passing out the stock
round reached OR2.1 with the updated treasury and Steamboat choice.


## Phase-II train introduction

The two phase-II offer buttons name 3/5 ($160) and 4 ($180), referencing the same
physical certificate. They have distinct variant keys and share existing actor,
History, busy and publication gates. Buying either commits one BuyTrain; an
automatic AdvancePhase records phase II in the same user-action cascade.
The depot shows a shared certificate count, not two independent train supplies.

The phase change returns to train buying with the same operating company and
purchase step. Further purchases or Finish remain available. Green tiles appear
in subsequent construction decisions. Undo restores phase I, both offers, cash
and shared supply. History shows the recorded phase change and disables decisions.

Green construction reuses the map selection and orientation picker. A company can
lay two yellow tiles or a yellow tile and one upgrade in either order. Prices show
terrain and completed bridges/tunnels. Tokens and reservations migrate with the
upgrade; the returned tile is available again. The 3/5 route summary distinguishes
visited stops from counted payments, including the station requirement and E–W
bonuses. Only counted endpoints qualify for E–W revenue.

## Corporate acquisitions

During each major's operating steps, the purchase panel offers player-owned
privates and independent railroads. Selecting a company is a manual local draft;
its price is editable, constrained by treasury and list price. Confirm submits
OfferPurchase. Back cancels the draft. Undo cancels that draft first, then uses
committed history on its next activation. There is no auto-selected draft.

The session owns the selected request and draft price. Selecting an acquisition
clears construction and route drafts and suspends those inputs. Publication,
perspective change and History invalidate the acquisition draft; read-only History
cannot select or confirm it. Pending publication disables confirmation.

A different seller receives Accept/Decline controls. The operating step is
suspended, preserving its construction allowance, routes and other decisions;
only the named seller can respond. Acceptance settles, refusal leaves assets and
cash unchanged, and both resume the buyer. A shared controller settles immediately.
The title panel owns the draft and response presentation; the map retains the
current physical state. History shows public offer terms and transferred assets.

Absorption adds the independent's cash, train and an extra placed station, or
removes its station if the buyer is already there. Its charter retires and it
leaves later operating orders. The train is excluded from route choices in the
acquisition OR and becomes eligible next OR. Private construction powers are extra actions throughout the operation.

Purchasing Steamboat clears its player-owned port assignment. The old beneficiary
and buyer receive no inherited bonus. The buyer receives an explicit marker
placement opportunity, including when purchased after routes. Placement or Skip
resumes the same operating step; other decisions remain disabled while it is pending.
History and Undo restore the recorded pre-purchase assignment.

## Revenue private powers

Before routes, the operating corporation may place its owned revenue markers.
Boomtown and Meat Packing are permanent placements; Steamboat can move once per OR.
Each location button commits the named placement. These buttons do not stage a
local draft, and Undo reverses their Actions. Skip declines only the immediate
purchase opportunity. It is a committed choice, not Back. Actor, busy, publication,
purchase-offer, acquisition-draft and History gates apply to all marker controls.

The session projects persistent revenue markers onto the shared map, labeling
the beneficiary, private and amount. History projects the markers from its visible
state; placement summaries use Action metadata. Closing a corporation removes its
markers. Purchases, placements and History publication invalidate route drafts.

Mail Contract automatically rewards one longest visited route, including unpaid
3/5 stops. Saved-route rows, the current route preview, total and committed run
use run-aware scoring. Removing a route reallocates the bonus; editing previews
can change which train earns it. No extra manual mail assignment is required.

Verification scenarios: green upgrade and Undo restore cash/supply/token positions;
manual purchase Back/Undo leave history untouched; self-purchase settles directly;
external offer blocks operating controls until seller response; refusal resumes
without transfers; accepted absorption updates treasury/train/token and Undo
restores all of them. History disables purchase and construction controls. The
logic suite covers these state transitions, next-OR eligibility and replay.

Native desktop verification (2026-10-04, playground `/1846`, seed 7): reached
OR1.2 through the phase-II train purchase; placed green 295 in Detroit for $40
and restored yellow track with Undo. Back and Undo canceled a private-purchase
draft. C&WI's seller declined, then accepted a second offer; acceptance removed its
reservation and added the private to IC's holdings. Undo restored the reservation
and pending offer. MS absorption added $60, its 2 train and Detroit station to IC;
History showed MS's prior station with decisions disabled, and Undo restored the
pending offer and all assets. No runtime errors occurred. The shared stylesheet
is loaded by this playground route, keeping the board inside its scaling viewport.

Revenue-power verification (2026-10-04, native playground `/1846`, five players,
seed 7): buying SC removed the prior player assignment and suspended finance for
placement. Placing Holland displayed its beneficiary on the map; Undo restored
the pending decision. Skip then voluntary placement worked, and History disabled
all choices. External seller consent returned control for MPC/BT placement;
the next OR offered SC movement without offering permanent-marker moves.
Detroit–Port Huron showed $80 ($60 base plus $20 Mail) in the live preview,
saved route, committed run and dividend choices. No browser errors occurred.
Chicago 298 uses the same title-owned layout in the map, picker and tile library;
the rendering regression covers all tiles, rotations and orientations.

## Private construction drafts

Private construction begins by selecting an owned power. Tile buttons stage up to
one lay per permitted hex; staged placements appear on the board. The power and
all staged lays are manual local selections. Back removes the latest lay, then the
power selection. Undo clears this draft before undoing a committed action. Confirm
commits the whole power and consumes its single use; confirming only one MC/O&I
lay explicitly forfeits its second lay. Little Miami confirmation requires the
completed connecting plan. Preview costs include any bridge payment.

While a private construction draft is open, ordinary construction, routes, finance,
acquisitions, markers and the extra Chicago station cannot be initiated. The title
session owns this precedence and the draft's lifetime. Publication, a new displayed
state, acting-player change or History navigation clears the draft. No selection
commits automatically. History is read-only and describes placed tiles from Action
metadata. The board renders the preview inventory and migrated station positions
from the same evaluated draft; cancellation restores the actual map.

C&WI's button immediately commits its extra station, without staging a location.
It does not consume an ordinary station or the operating turn's placement. Tunnel
Blasting has no activation button: construction choices already include its
applicable discounts. Private controls use the same busy, publication, perspective,
purchase-offer and pending-marker gates as other operating actions.

Exercise one/two-tile drafts, Back and Undo cancellation, map preview, invalid LM
confirmation, payment, late operation use and History restoration. Verify C&WI
placement/Undo and ordinary actions resuming after confirmation or cancellation.
Saved route rows and the current route preview use the same combined evaluation,
so adding/editing a train immediately reallocates Mail in every displayed row.

Native playground verification (2026-10-04, five-player seed 7): staged MC's linked
B10/B12 tiles on the board, canceled with Back and Undo, then confirmed and undid
the committed pair. Finance and acquisitions were disabled during staging.
History cleared a two-tile LM draft. An invalid LM first tile disabled confirmation;
a valid H12/G13 pair confirmed. C&WI's extra Chicago station placed and undid.
O&I used one tile after routes, showing the forfeiture notice and preserving the
recorded run. No browser errors occurred. Logic tests cover costs and legality;
the shared editor regression covers Mail allocation across saved/draft routes.

## Train trading and emergency purchases

Train offers use the existing acquisition draft in the train-buying step. A train
choice identifies its seller and allows a negotiated positive price; company
choices retain their list-price ceiling. Back cancels the draft; Undo clears it
before changing history. A pending seller response suspends the buyer's train
and private decisions. Refusal restores the buyer; acceptance shows new ownership
and cash. Publication, perspective and History changes clear the local draft.

Emergency purchase buttons show the train price, number of treasury shares,
issuance proceeds and president contribution. Clicking commits that complete
transaction. No selection is automatic. These buttons share the ordinary-action
gates, including disabling during acquisition/private drafts, pending decisions,
History or publication. The result text uses Action input; metadata records the
cash and stock movement. Undo restores the whole purchase including issuance.

Verify a trade draft's Back/Undo, an external seller's refusal and acceptance,
and History/Undo cash and train restoration. Verify an emergency quote and its
stock-price movement, contribution, purchase and History/Undo restoration. Engine
tests verify numerical and authorization cases that are costly to set up in UI.

Native playground verification (2026-10-04, three-player seed 7): IC at $30 with
$40 treasury issued one share for $10 and received $30 from its president to buy
a 2; the marker moved to $20. Undo restored the president's $190, treasury $40,
share, marker and depot train. An open acquisition draft disabled the emergency
button. NYC negotiated IC's 2 for $50: Back and Undo canceled drafts, refusal
returned control to NYC, acceptance moved the train and both treasuries, and Undo
restored the pending offer. Buyer controls were disabled during seller response;
History disabled response buttons. No browser errors occurred.

Interaction precedence is resolved once by the title session. Read-only, inactive,
busy and publication states block gameplay controls. A pending seller response or
revenue-marker decision takes priority; otherwise an acquisition draft or private
construction draft owns interaction before ordinary turn actions. Each control
consumes the corresponding session capability. Track highlights use the same
capability as track selection, so a blocked board does not advertise selectable
ordinary hexes. Back and Undo retain their existing cancellation semantics.

Centralized-precedence verification (2026-10-04, native playground): seller
response enabled only its controls; acquisition drafts blocked turn completion
and private powers. A required SC placement enabled marker choices and blocked
ordinary actions. O&I staging kept tile controls enabled while blocking purchases,
revenue markers, ordinary track selection and completion. Back restored competing
controls, Undo canceled the draft, and History cleared it and disabled decisions.
No browser errors occurred; title UI and playground checks and title UI lint pass.


## Personal emergency funding

Begin personal share sales commits required treasury issuance and changes the
canonical interaction to FundingTrain. There is no local draft or Back step.
The funding screen lists legal personal sale blocks and affordable train variants;
all buttons use the session's ordinary-action capability, including History,
perspective, publication and busy gates. The funding state offers no private
powers, negotiated purchases or operating-turn completion. The screen shows the
minimum train price imposed by prior sales. Each sale commits independently;
Undo reverses a sale, issuance or purchase and associated system Actions. Cash
remaining with the player after buying is visible in the ordinary holdings panel.
Funding-start and sale history descriptions use Action input and metadata only.

Verify issuance, share sale, updated quotes, purchase, Undo and read-only History.
An unavoidable funding shortfall now offers the bankruptcy flow below.

Native playground verification (2026-10-04, three players, seed 7): IC had $0
and a $30 marker; its president had $30 and 40% NYC. Beginning funding issued one
IC share for $10 and moved IC to $20. Selling 10% NYC raised $40, moved NYC from
$40 to $30, retained the presidency, and enabled the $80 train with a $70 owner
contribution. Purchase left IC and its president with $0. History
disabled sales; a private construction draft blocked beginning funding. Three
Undo steps independently restored purchase, sale, and issuance, including stock,
certificates, cash and the depot train. No browser errors were recorded.


## Bankruptcy and receivership

Declare bankruptcy is a committed player Action, with the unavoidable shortfall
and liquidation/elimination consequences displayed beside it. No local draft or
Back step is introduced. The session owns initiation; ordinary action gates apply.
Undo restores liquidated holdings, cash, closures, turn order and all automatic
receiver consequences. Bankruptcy history uses settlement metadata.

Receiver operation exposes only the existing route editor to surviving players.
The prompt asks for the best routes they can find; the server validates routes,
while maximization remains player-assisted, matching the reference. Withholding,
stock drops, closure and affordable cheapest depot purchases are system Actions.
The holdings panel marks receivers and bankrupt players. Stock trading offers the
virtual 10% purchase only when eligible, alongside ordinary recovery purchases.
The last-survivor game result names the winner. History remains read-only.

Verify bankruptcy, continuation, History/Undo, ordinary and virtual share recovery,
and receiver route entry. Engine fixtures cover the rare phase-change and final
elimination cases as well as rejection of eliminated actors.

Native playground verification (2026-10-04, seed 7, three players): through normal
UI actions, Developer acquired both independents, launched IC at $80, bought three
2-trains and sold them to NYC/B&O for $1 each. In OR 1.2 IC reached $3 treasury,
a $60 marker and a president with $0. Mandatory issuance raised $60 and left a
$97 shortfall against the $160 train. Bankruptcy closed both independents, sold
the president certificate for $80, left IC in receivership with $143, and began
stock round 2 with Ben. Undo restored the funding position, both independents and
the president. History disabled bankruptcy. Ben and Cora each bought one market
share; with only the president certificate left, Ben's virtual $40 purchase
restored his presidency. Undo restored receivership. Buying a treasury share
also restored it, paying the $40 to IC instead. The virtual purchase history
rendered its price and presidency outcome. No browser errors were recorded.


## Phase III trains and lifecycle

Phase advancement and train retirement are recorded system consequences. Their
summary panels read Action metadata, including private/independent closure and
player Steamboat removal. Placed corporate markers remain on the board. Holdings
label phased-out trains, and the depot and buying controls show the current limit.
Bank-returned certificates offer both legal faces, with a returned-stock label.

Compulsory discard interrupts the operating corporation with the deciding
company's active player(s). A single button commits a discard through the title
Game Session; there is no local draft or Back step. Normal interaction gates and
valid Action types disable it during History, transitions and non-active views.
The final discard resumes the interrupted buyer, including receiver completion.
Undo reverses discard independently; undoing the initiating purchase also restores
all phase effects.

Native playground smoke check (2026-10-04, seed 7, three players): created a
fresh game, completed distribution, launched IC, reached train buying and bought
a 2. The depot showed all three train tiers and their shared certificate counts;
the buying panel showed owned/counting trains and the current limit. History was
read-only and Undo restored the purchased train to the depot. No browser errors
were recorded after restarting Vite to clear stale build output. Phase III's
closure/discard/resume paths were verified with canonical engine fixtures and
replay/Undo tests; the browser check did not play through to Phase III.

Phase III closure releases an unpurchased C&WI Chicago reservation. Its board
reservation overlay follows canonical state, and the phase summary lists released
reservations from Action metadata. Undo restores the reservation and its placement
restriction together; other corporations' reservations remain in Phase III.

## Phase III brown construction

Brown choices use the existing construction picker and Game Session action path.
The phase, color sequence, connected track, finite stock and one-upgrade limit
come from canonical construction choices. Selecting an offered rotation commits
the lay; there is no additional draft or automatic commit. History and inactive
views retain the existing interaction gates. Undo restores the tile supply, cash,
stations and reservations through the canonical action.

Brown Chicago uses the same four separate city positions as green Chicago, with
$70 revenues. The board and tile library share this layout. Explicit revenue positions keep
Chicago’s four values separate in both orientations and all rotations, including
the printed and green Chicago faces. Z 297 shows three
station slots and $60. The Phase I–III library includes every supplied brown tile
and supports both orientations and rotation. No animation or transient-state
contract changes are introduced.

Native playground verification (2026-10-04): the title’s tile library exposes all
13 brown types. Inspected Chicago 299 and Z 297, and switched Chicago to pointy
orientation with rotation. The browser check covers rendering and library controls;
canonical engine tests cover Phase III construction, replay and Undo.

## Phase IV trains and gray construction

The depot displays unlimited 6/7/8 certificates. Buying, emergency funding and
receiver purchases reuse the existing Game Session paths. Phase advancement
removes corporate revenue markers and special station reservations from canonical
state; board overlays follow that state. The phase result reads Action metadata
for immediate train removal, deferred retirement, released reservations and removed
markers. Corporate Mail and special station prices/remote rights persist.

Gray tile choices come from ordinary construction rules. The library includes 51,
290 and 300; Chicago keeps its four city positions and non-overlapping revenue
labels, now $90 each. History remains read-only, and Undo reverses purchases,
discards, phase effects and construction through the existing action mechanism.
There are no new transient interactions or animation lifetimes.

Native playground verification (2026-10-05): created a fresh seed-7 three-player
game; confirmed the depot lists 6/$800 and 7/8/$900 with unlimited supply and
remains clear of the board. Filtered the library to gray and inspected all three
faces, including Chicago in pointy orientation at 60°. Its four $90 values remain
separate. No browser errors were recorded. This smoke check covers presentation;
canonical engine scenarios cover Phase IV purchases, effects, discards, routes,
construction and replay/Undo.

## Game endings and final wealth

The shared GameEnding component displays the pending final operating set, ending
reason, winning names (including ties), and ranked final wealth. It reads the
currently displayed canonical state so History shows only facts known at that
point. The final title header reads Game over. Bankruptcy records its own
last-survivor reason; bank exhaustion and closure use the shared scheduling and
settlement Actions. No client effect commits an ending or initiates a move.

GameOver has no legal gameplay Actions. Existing history navigation and Undo
remain available; undoing the final player action restores its automatic ending
consequences as well. There are no new drafts, Back steps or animation lifetimes.
The shared component accepts only ending fields, the money formatter and player
names; other title callers keep their existing props.

Native playground verification (2026-10-05): loaded a canonical engine fixture
with a bank break during the first stock round and IC at the end of OR1.2. The
banner identified operating set 1 as final. Clicking Finish operating turn showed
Player 3 winning with $430, followed by $340 and $320; no gameplay controls
remained. Undo restored train buying and the pending-ending banner. Previous
action entered read-only History with construction disabled. Returning to the
latest state and finishing again restored the same result. No browser errors
occurred during this verification. The fixture accelerates setup; the final
action, Undo and history navigation used the normal playground controls.


## Two-player public opening

The company purchase panel displays every remaining company and its current price
for all perspectives. Only affordable choices for the active player are enabled;
History, spectator and busy states cannot submit purchases or passes. A visible
rule explains the mandatory first purchase, two-pass operating pause and final
company discount. Company purchase/pass buttons call Game Session methods that
submit canonical Actions; there is no transient selection or additional Back step.

Two consecutive passes with at least two companies available expose the existing
operating controls for purchased independents. Private income and empty ORs resolve
through normal system Actions. After two ORs, public purchases return. The final
purchase enters Stock round 1 with Priority Deal active. Regular operating-round
numbering restarts at 1 after any preliminary operations.
Undo reverses a committed purchase/pass and its automatic consequences together;
History renders the distribution mode and prices at the selected action.

Validation (2026-10-05): title UI packaging, Svelte checking and lint pass. Canonical
engine scenarios cover purchases, preliminary ORs, public projection, replay and
Undo. Native browser verification was attempted, but snapshot, navigation,
evaluation and reopening the preview repeatedly timed out. The visible opening
flow has therefore not been confirmed interactively in this slice.

The independent home stations are visible from initial setup, including before
purchase. Purchasing a company and undoing its purchase preserve these board
stations. Unbought Big 4 blocks connectivity through Indianapolis during
preliminary operations. Rendering uses the existing canonical station overlays.


## Two-player regular play

Public distribution continues through existing stock/operating controls. Legal
choices use the 70% ownership and 19/16 certificate limits. The board shows pending
blocking stations as labelled markers at their destination cities; green upgrades
replace those markers with canonical station tokens. Yellow lays do not consume
station capacity. Marker drawing consumes only location/kind, without fake private
company ownership. History reads the same state, and Undo restores both a green
tile and its blocker to their preceding state together.

The depot displays four shared final certificates for two players and unlimited
supply for three-to-five players. Empty new/resale supply enables Finish operating
turn without a train and suppresses purchases of a seller's only train. The shared
ending banner shows the final set and final wealth, including an earlier bank-break
ending when appropriate. All controls retain existing actor, busy and History gates.

Native browser verification (2026-10-05): created a fresh two-player seed-7 game.
Pass was disabled before the mandatory first purchase. Buying MS and passing twice
entered preliminary OR1.1; finishing its two track steps returned to public
purchases. Buying the remaining companies entered Stock round 1 with Priority
Deal. Undo restored the final company offer; History disabled purchase controls.
Returning live, repurchasing, launching IC and passing entered regular OR1.1. The
board showed both independent stations, PRR/B&O pending-blocker labels, and four
shared final train certificates. No new browser errors occurred. Restarting the
stopped dev server resolved the earlier preview timeouts.
