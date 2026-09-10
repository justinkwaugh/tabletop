# Shikoku 1889 finances

The finance example follows the shared
[finance inspection contract](../../../libs/18xx-ui/ui-interaction-visual-contract.md#finance-inspection).
The Game Session exposes an illustrative position with one prepared stock turn supporting purchases, sales, and Finish turn.
Share selection, trade previews, stock history, market rendering, and Undo follow the shared
contract. Switching away disposes this Game Session,
and revisiting restores its local example.

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
phase changes and emergency financing remain later work.

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
The Routes fixture now continues into earnings and train purchasing. Phase changes,
emergency funding, and game-ending obligations remain explicitly outside this slice.
