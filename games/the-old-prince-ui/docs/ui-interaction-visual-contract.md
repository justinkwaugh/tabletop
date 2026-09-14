# TOP finances

The finance example follows the shared
[finance inspection contract](../../../libs/18xx-ui/ui-interaction-visual-contract.md#finance-inspection).
The Game Session exposes an illustrative position with one prepared stock turn supporting purchases, sales, and Finish turn.
Share selection, trade previews, stock history, market rendering, and Undo follow the shared
contract. Switching away disposes this Game Session,
and revisiting restores its local example.

TOP additionally shows each numbered PEIR share's fraction of distributed earnings
and explains its current president: most shares, then lowest numbered share. Both
are derived from the displayed certificates. Union Bank's charter belongs in
its owner's portfolio; Union Bank's certificates and cash remain in its own treasury. Souris's President
is Union Bank, while its Controlling Owner is Union Bank's owning player.

Browser checks cover those distinctions, title switching, and reload at desktop
and mobile widths. Runtime tests cover player identity stability and retirement's
change to the PEIR denominator and president. Purchase, reload, and Undo are checked in the browser; processed-action replay is
checked through the engine.

Union Bank is a separate purchase choice. Its confirmation shows treasury cash
used first and its owning player paying the remainder. Company treasury shares
pay that company; Market purchases pay the Bank. Reserved shares are disabled.

Sales follow the shared contract: preview and cancellation leave the market and
portfolios unchanged; confirmation updates proceeds, presidency, and market
position. Undo restores the full trade. Effective certificate counts come from
the title rules for the current displayed market position.

Company starts and flotation follow the shared staged-selection contract. The
starting example supports player and Union Bank starts and displays tranche
occupancy. The flotation example exchanges a numbered PEIR share, replaces its
station, updates certificates and capital, and restores all of those through Undo.
The title's home positions come from its existing map definition. The live map renders those stations and their reservations.

TOP displays retained pass order. Acting again removes that player from the
order, preserving the others; Union Bank usage remains spent across human turns.
The completed view places open PEIR last and excludes Union Bank from operations.

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

### Opening offer-pile auction

TOP's opening shows the randomly assigned Mainline and Shortline, all public offer
piles, the auctioneer, two eligible bidders, current bids, designated forced
purchaser, and completed awards. Ordinary trading/operating panels appear after the
auction completes. Player counts are three or four; save identity is version 24.

Offer and bid choices are manual Game Session drafts. Back clears the draft; Undo
clears a manual draft first, then reverses committed engine history and its system
consequences. Drafts hide during updatingVisibleState and History View and clear
in beforeNewState. Pass is an explicit Action. Components use session methods;
no reactive UI behavior commits an offer, bid, pass, or automatic award.

Current bidding and offer piles survive reload. Completion displays the real first
stock round in remaining-cash order, and Undo can restore the last auction turn.
An unaffordable forced purchase with no player-private income stays visible with
an explanation and Undo; the supplied rules provide no further resolution.

## Branch-split preview

The TOP Game Session owns a manual parent, branch, and starting-price draft.
The panel renders the authoritative TOP calculation without committing an Action.
Every stage requires explicit input. Changing parent or branch clears dependent
stages. Back and Undo clear the latest manual stage; once the draft is empty,
Undo follows ordinary game history. No preview selection consumes a stock action.

Selections and results hide during `updatingVisibleState` and History View, and
`beforeNewState` clears all split stages. They do not persist across reload. A
canonical stock action therefore invalidates the old preview before the resulting
state is displayed. Station and train lists describe assets available for allocation; the map remains
canonical. Split commitment follows the allocation contract below. Shared UI and 1889 do not
own TOP preview state.

## Branch-split commitment

An explicit Allocate assets button adds a fourth manual stage to the split draft.
Station and train checkboxes, the branch home choice, cash, and Hunslet stay within
that stage. Back and draft-first Undo remove the allocation stage together; changing
parent, branch, or starting price clears it. Selecting a single available station
does not automatically choose the branch home. Confirm split is enabled only when
the same title model used by the Action accepts the complete allocation.

Confirm split sends one `SplitCompany` through the Game Session. The resulting
canonical state contains all share, station, train, cash, company, tranche, and
stock-turn changes. No intermediate authoritative split exists. The branch map
stations appear only with that committed state. The original stock turn remains
active with its buy/start allowance used; the player can use remaining permitted
private exchanges or Finish turn. Reload restores a completed split, and ordinary
Undo restores the entire pre-split state. Pending company decisions and flotations
retain their shared handler precedence.

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

Branch split presents one manual stage at a time: eligible parent token/name, branch token/name, then starting-price buttons. Completed company choices remain a compact token/name summary. The existing staged selection owns progress; Undo unwinds it without committing an action. There are no dropdowns or separate Back controls. Price selection opens the existing split preview and allocation flow.
