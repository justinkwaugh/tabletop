# Shikoku 1889 finances

The finance example follows the shared
[finance inspection contract](../../../libs/18xx-ui/ui-interaction-visual-contract.md#finance-inspection).
The Game Session exposes an illustrative position with one prepared stock turn supporting purchases, sales, and Finish turn.
Share selection, trade previews, stock history, market rendering, and Undo follow the shared
contract. Switching away disposes this Game Session,
and revisiting restores its local example.
Stock-round history gives every player action and pass its own tinted line with
the player name repeated in regular-weight text; no player dot or colon appears.
The action verb starts lowercase after the player name.
History descriptions use full company names. Automatic flotation names the
company without a player name or player tint; its token sits beside the summary
and capital detail.
Company operation history headers use the recorded controlling player's color tint.
Operating round dividers show company order between the title and phase when it fits,
and below both on narrow panes.

IPO and Market appear as separate pools of Bank-owned certificates. A president
certificate shows its 20% interest, two shares, and one certificate
limit contribution. Private ownership can be personal or corporate; the displayed
Controlling Owner identifies the player in control without changing ownership.

Browser checks cover those distinctions, title switching, and reload at desktop
and mobile widths. Runtime tests verify hydration and player identity stability.
Purchase, reload, and Undo are checked in the browser; processed-action replay is
checked through the engine.

IPO purchases display the par price; Market purchases display the market price.
Both pay the Bank. The prepared position uses ordinary market spaces.

Sales follow the shared contract: preview and cancellation leave the market and
portfolios unchanged; confirmation updates proceeds, presidency, and market
position. Undo restores the full trade. Effective certificate counts come from
the title rules for the current displayed market position.

Company starts and flotation follow the shared staged-selection contract. Sanuki
can be started by selecting its par price, and its separate flotation example
shows the qualifying purchase and capital grant. Its home remains reserved and
its station available after flotation, awaiting the operating round. Undo reverses
the purchase and automatic grant together.
History steps over that purchase and flotation together, and the action panel
describes both at the same position.

1889 displays consecutive passes, which reset after any stock transaction.
The completed view shows next-round priority after the last actor and the
operating company order after sold-out adjustments.

Round completion and Undo follow the shared full-stock-round contract. The finance
UI remains disposable; this slice requires desktop interaction verification only.

The map follows the shared live-map contract. Its current tiles, stations,
reservations, and inventory counts come from the session's visible state. Map
inspection is independent of stock drafts and survives station exchange, history,
and Undo when its target remains valid. Each hotseat player has a local map style.
Fit/focus/pan/zoom and tile browsing create no actions. This remains a prepared
position; legal track construction follows the shared track-construction contract.

Track construction follows the shared draft, preview, target, Back/Undo and history
contract. The new Track construction example starts directly in the first
operating company's track step. Normal stock examples reach that step through
system Actions. The map shows legal locations and candidate tile artwork before
confirmation; payment, supply and station changes occur only in LayTile.
Finish track continues into station placement under the shared station-selection,
preview, access, Back/Undo and history contract. Finish stations currently ends
the implemented operating steps. The Station placement example supplies connected
track and available stations.

The Train purchases example follows the shared depot-selection, confirmation,
Back/Undo and history contract. It starts directly in same-phase train buying,
with a prepared owned train. Operating examples continue through running trains and distributing earnings;
phase changes use the shared interruption flow; emergency financing remains later work.

The Routes example uses the shared route editor and interaction contract. Map
path clicks and extension controls stage routes for two trains; only Confirm
routes commits. Title RouteRules supplies train distance requirements and revenue
stages. FinishStations now enters RunningTrains; RunTrains enters DistributingEarnings
for payout selection. Route overlays, Back/Undo, history
and reload follow the shared contract (fixture version 16).

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

### Opening waterfall auction

The shared auction panel shows ordered lots, public standing bids, cash commitments,
the acting bidder, and awarded privates. Other trading and operating controls are
hidden until the opening is complete; the financial inspector remains available.
The Standard Game supports 2–6 players. The opening example offers that player count
and uses a separate local save for each count (prototype save identity version 23).

Purchases and bids have explicit manual drafts owned by the Game Session. Back
clears only the draft; Undo clears a draft first, otherwise reversing a committed
Action and its automatic cascade. Drafts hide during updatingVisibleState and
History View and clear in beforeNewState. Pass is an immediate explicit Action.
Components call session methods and never construct Actions. Public reservations,
restricted bidding, and automatic awards survive reload in canonical state.
Completion shows the first stock round with the saved priority player. Undo can
restore the last opening turn, including reversing automatic awards and completion.

## Game ending and final wealth

The ending panel renders the canonical ending schedule and final wealth from the
Session's displayed state, including history. It owns no draft or gameplay
mutation. Its Undo control invokes the existing Session Undo method and is disabled
during state publication, busy processing, and History View. Undo reverses the
triggering user Action and its System Action cascade together, restoring the ending
schedule, results, Bank state, and ordinary play. GameOver exposes no game Actions.
The prototype harness reloads completed games as well as active ones.

The initial game table follows the shared game-table-shell contract. The title's
normal UiDefinition uses that shell, while PrototypeUiDefinition retains the
logic-workbench layout. The table supplies title-specific auction/action content,
uses canonical active player ids and the existing title Session for all decisions,
and renders the same semantic map and previews. This is the first desktop layout
increment; the old workbench remains available for detailed rule inspection.

The company-order row and token artwork follow the shared game-table-shell
contract. This title supplies its existing OperatingRules and packaged token
artwork; order and token identities remain canonical during history and Undo.

Automatic history follows the shared consequence contract: sold-out price moves
belong to the completed stock round, and phase entries include Uno-Takamatsu
income changes as well as private closures.
