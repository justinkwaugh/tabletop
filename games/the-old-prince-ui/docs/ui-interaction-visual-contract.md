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
