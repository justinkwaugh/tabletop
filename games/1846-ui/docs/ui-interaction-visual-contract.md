# 1846 table interaction and visual contract

## Shared table ownership

1846 renders `GameTable` through `EighteenFortySixSession`, a shared
`EighteenXXSession` specialization. Shared modules own stock selection and
confirmation, ordinary tile/station staging, train purchases and discards,
negotiated purchase responses, routes, dividends, history and committed Undo.
Shared table views own Board, Map, Market, Companies, Players, Spreadsheet, Tiles,
Player Aid and History. The title supplies rules, geometry, colors, labels,
phase aid, custom action descriptions and its distinctive decisions.

The playground selects 1846 on `/table`, with 2–5 players and named scenarios.
The former standalone `/1846` prototype is removed. Generic map presentation is
available; no physical board artwork is supplied or claimed for 1846.

## Construction coexistence and precedence

A legal station target clicked on the map commits through the shared station
module; choosing its token is local selection. Track and station placement share
the 1846 construction step. Session-owned
`constructionMode` activates one shared selection module at a time. Choosing a
mode clears the previous module's pending selection. Station placement does not
end construction; the player can return to track. Finish construction submits
`FinishTrack`, which ends the combined construction window according to title
rules. Station mode does not expose the sequential title's `FinishStations`.
Private/company purchase selection suspends ordinary construction targets until
the purchase is committed or the selection is cleared.

Private construction stages a title-owned plan of one or two lays before one
`BuildPrivateTrack` Action. Its evaluated copy is the shared map's display state;
canonical inventory/stations remain unchanged until confirmation. Starting that
plan clears ordinary construction/route selection. Pending revenue-marker choice
and a private construction plan block unrelated shared actions. Purchase responses
retain the shared response UI and action authority.

Back/Undo first remove shared manual selection, then private-plan steps, and only
then committed Actions. The operating-mode choice is a view choice, not a step:
Back/Undo never change it. Automatic singleton choices do not consume Undo. State
publication, perspective changes and history changes invalidate title-local
construction selections. No intermediate plan is serialized.

## Hidden and public distribution

The hidden draft initially conceals packets and commitments behind **Show my
cards**. Show/hide is local presentation only. A card choice is one immediate
Action and an information barrier. The public final-company offer stays visible
even when personal commitments are covered. Submission closes the packet before
sending the Action, including a failed submission. State publication, perspective
changes and pending transitions close it again. History permits inspecting only
that perspective's known cards and disables purchases. History row descriptions
never print a draft card, including for the actor's own projection. Opponent and
spectator projections contain neither packets nor commitments.

Two-player opening purchases are public and use the same table. Company cards
show price, income or independent capitalization/debt and available actions.
Preliminary independent operations use shared construction and routes; the title
runtime resumes public purchases automatically.

## Distinctive title decisions

- Issuing or redeeming shares is a mode beside track and station building, and beside
  Run trains, until routes are run. Each transaction commits immediately; the first one
  locks the turn to issuing or redeeming. Construction does not finish by itself while a
  transaction is still possible; when issuing or redeeming is all that is left, the switch
  selects it and its panel offers skip to end construction.
- The operating-mode switch lists only modes that are available now and appears when
  there are at least two. A chosen mode lasts through that step's actions while it stays
  available; leaving the step, perspective or history view resets it.
- Steamboat and revenue-marker controls show eligible locations and bonuses;
  canonical marker placement is drawn on the shared map with title-owned names.
- Private construction uses shared tile drawings and previews its entire plan.
  C&WI's extra station is a separate title action, not an ordinary token allowance.
- Independent absorption uses shared negotiated-purchase selection, price and
  response controls. The title engine handles cash/trains, closure and restrictions.
- Emergency funding retains title-issued shares, personal sales, contribution and
  bankruptcy decisions; it does not create generic funding state. Receivers use
  shared automatic routes and title settlement/train-buying rules.

All controls use shared theme variables, keyboard buttons and accessible labels.
Read-only history, a pending publication or another actor's turn disable mutation.
Company facts expose receivership; ordinary shared panels expose holdings,
treasury, trains, debt where applicable and end-game valuation.

## Route preview and history

The shared worker/client owns cancellation, generation identity and route overlays.
Title `RouteRules1846` determine runnable trains, express paying stops, east–west
bonuses and Mail Contract. A bounded solver uses the canonical evaluator for those
callbacks and reports whether search was exhaustive. Confirm runs the displayed
routes through the existing authoritative `RunTrains` Action. Historical display
uses recorded inputs/metadata, never action patches as descriptions.

## Verification scenarios

- Open a private packet, choose, change perspective and revisit history: covers
  return, unauthorized cards stay absent and historical mutation is disabled.
- Choose track, rotate/preview, Back, confirm and Undo: only confirmation mutates;
  inventory, treasury, stations and drawing agree after rollback.
- In combined construction, place a station then continue track; local Undo clears
  a selected station placement before leaving station mode.
- Stage a two-lay private plan: shared map previews it; cancel changes nothing;
  confirm creates one Action. Revenue-marker interruption blocks unrelated actions.
- Run ordinary and express trains, including Mail Contract and a barred acquired
  train; preview revenue agrees with committed rules. Receiver routes use the same UI.
- Buy a private/independent, accept/decline, buy/discard trains, distribute dividends,
  fund a mandatory train, declare bankruptcy and take over a receiver.
- Two-player opening and final operating turn work through the shared table.
- Desktop and narrow viewports retain accessible actions and board navigation;
  other titles retain their normal sequential operating controls.

## Shared control and information corrections

- One Buy companies entry in the operating strip opens the staged source/card/price
  flow for privates and independents. The persistent independent selector and
  duplicate purchase entry are absent. Global Undo traverses manual selections,
  then committed actions; there are no purchase Back buttons.
- Interleaved construction disables exhausted track selection and automatically
  presents stations when they are the remaining ordinary choice. That automatic
  mode consumes no Undo step. Completion uses the shared inline skip position.
  Exhaustion of lays, stations and construction powers creates system completion
  actions, rolled back with the triggering committed action.
- Railroad heralds and explicit colors are shared by map stations, company panels,
  market markers and portfolios.
- The market remains one row with tall narrow cells, spanning the map bounds.
  Static, animated and expanded markers all use the same cell dimensions.
- Depot rows show paired faces and separate prices with shared supply counts.
  Obsolescence shows triggering train badges; final-run notes distinguish it from
  immediate rust. The depot has sufficient board space to read these entries.
- The recorded finished game reaches phase IV and the reference final values.
  History uses canonical replay and Undo patches. Mutation controls remain
  disabled in the finished position and in history.

- Live and historical maps use the same marker projection, including Steamboat,
  company revenue markers and pending blocking stations.
- Operating-strip navigation passes Finance or finishes combined Build through
  canonical actions, stopping for interruptions. Summaries remain visible for
  title-defined steps in live play and history.
- Entering a private construction plan automatically activates track within that
  plan. Cancelling the plan restores the preceding mode and adds no hidden Undo
  step. Explicit track/station choices remain manual selections.
