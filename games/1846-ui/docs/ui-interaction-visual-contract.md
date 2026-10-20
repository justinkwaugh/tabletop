# 1846 table interaction and visual contract

1846 renders the shared 18xx table through `EighteenFortySixSession`, a specialization of
the shared 18xx session that runs on the title's own rules. Shared modules own stock
selection and confirmation, ordinary tile and station staging, train purchases, discards
and compulsory funding, negotiated purchase responses, routes, dividends, history and the
single contextual Undo; their behaviour is recorded in the
[18xx-ui contract](../../../libs/18xx-ui/ui-interaction-visual-contract.md). This contract
covers what 1846 adds or composes differently. The map is the generic presentation; no
physical board artwork is claimed for 1846.

## Visual intents

- **Hidden draft.** During the draft the action area shows the private packet behind
  **Show my cards**. Showing or hiding is local presentation. Choosing a card is one
  immediate Action. The public final-company offer stays visible while personal
  commitments are covered. Opponents and spectators never see packets or commitments.
- **Two-player opening.** Opening purchases are public company cards showing price,
  income or independent capitalization and debt, with the actions available now.
- **Construction modes.** During construction the action area shows one of track
  building, station placement or issuing/redeeming shares (Finance), chosen with the
  operating-mode switch. The switch lists only modes available now and appears when
  there are at least two; before routes are run, Finance also sits beside Run trains.
- **Nothing to build.** When the operating railroad's only legal action is finishing
  construction, the action area says "<railroad> can't lay track or place a station" with
  an inline **finish**. Company decisions such as buying a private or independent still
  show above it.
- **Issuing or redeeming.** Each transaction commits at once; the first locks the turn to
  issuing or to redeeming. When issuing or redeeming is all that is left, the switch
  selects Finance and its panel offers skip to end construction.
- **Private construction.** A private's tile power stages a plan of one or two lays,
  previewed on the shared map with shared tile drawings, then commits as one Action.
  C&WI's extra station is its own title action, not an ordinary token allowance.
- **Steamboat and revenue markers.** The Steamboat's railroad, then its port, and a
  revenue marker's location are chosen on the map from the eligible locations, with their
  bonuses shown; placed markers are drawn on the shared map with title-owned names.
- **Receivership take-over.** In a stock round, when a player may claim a corporation in
  receivership, the stock menu offers **Receivership** beside Buy and Sell. Its panel lists
  each claim as "buy 10% for price and become president".
- **Independent absorption.** Buying an independent uses the shared negotiated-purchase
  selection, price and response controls.
- **Emergency funding.** The shared compulsory-funding panel, under 1846's rules: shares
  are issued first, the president pays the rest and sells one block per corporation, and
  the operating corporation's presidency is protected. Bankruptcy follows when funding is
  exhausted and the game goes on. Receivers run trains through the shared route UI; their
  other steps are automatic.

Every control is a keyboard button with an accessible label and uses the shared theme
variables. Read-only history, a pending publication and another actor's turn disable
every mutation.

## Coexistence and precedence

The action area shows one panel, in this order of precedence: opening purchases, the
draft, a pending revenue marker, Steamboat assignment, the Receivership panel, Finance,
station placement or nothing to build, then the shared operating actions.

- **Finance and selections.** Finance gives way to a purchase offer, a private-power
  selection, a private track-power selection and a company decision, so a private bought
  from the Finance step shows its purchase flow at once. The operating-mode switch hides
  for a pending revenue marker, a purchase offer, a company decision or a private
  selection.
- **Track and stations.** Track and station placement share 1846's construction step.
  One mode is active at a time; choosing a mode clears the other mode's pending
  selection. Placing a station does not end construction, and the player can return to
  track. Station mode never offers the sequential titles' `FinishStations`; finishing
  submits `FinishTrack`, which ends the whole construction window.
- **Nothing to build and company decisions.** They coexist: the decisions show above the
  message. A selection in progress replaces the message until it is committed or cleared.
- **Construction and purchases.** A private or company purchase selection suspends the
  ordinary construction targets until it is committed or cleared.
- **Private construction and everything else.** Starting a plan clears ordinary
  construction and route selection and activates track inside the plan. A pending
  revenue-marker choice or a private plan blocks unrelated shared actions; purchase
  responses keep the shared response UI and its action authority.
- **Receivership and Buy/Sell.** At most one stock panel is open. Choosing Buy or Sell
  closes Receivership, and choosing Receivership closes them.
- **Draft cover and the final offer.** They coexist; covering the packet never hides the
  public final-company offer.

## Shared visual state

- **Construction mode** (`constructionMode`). Meaning: which construction panel and map
  targets are active. Produced by the session from the legal actions, with the player's
  switch choice taking priority while that mode stays available. Consumed by the action
  area, the map's track and station targets, and the mode switch. Lifetime: the player's
  choice lasts through the step's actions and resets on leaving the step, on a change of
  perspective or in history. Validity: a chosen mode that is no longer available falls
  back to the derived one. A view choice, not a step: Undo never changes it, and an
  automatically selected mode consumes no Undo step.
- **Nothing to build** (`nothingToBuild`). Meaning: construction can only be finished.
  Derived from the legal actions and the Finance choices; consumed only by the action
  area. It has no lifetime of its own.
- **Private plan and Steamboat railroad.** Manual staged selections: the plan's first lay
  and the Steamboat's railroad, chosen before its port. Undo removes shared manual
  selections first, then these, and only then committed Actions. Automatic singleton
  choices consume no Undo. State publication, perspective changes and history changes
  clear them, and a change to the private action choices clears a staged lay. No
  intermediate plan is serialized; the evaluated plan is the map's display state, and
  canonical inventory and stations change only on confirmation.
- **Open Receivership panel.** A local selection registered with Undo, which closes it.
  It stays chosen only while the panel has claims for the acting player.
- **Draft cover.** Local presentation. Submitting a card closes the packet before the
  Action is sent, even if the submission fails; state publication, perspective changes
  and pending transitions close it again. In history a perspective sees only its own known
  cards, purchases are disabled, and history rows never print a draft card, the actor's
  own included.

## Render ownership

- **Route preview.** The shared route worker and client own cancellation, generation
  identity and the overlay. 1846's route rules decide runnable trains, express paying
  stops, east–west bonuses and the Mail Contract; a bounded solver evaluates them through
  the canonical evaluator and reports whether its search was exhaustive. Run trains
  submits the displayed routes through the authoritative `RunTrains` Action. History draws
  recorded runs from Action inputs and metadata, never from patches.
- **Map markers.** Live and historical maps use the same marker projection, including the
  Steamboat, company revenue markers and pending blocking stations.
- **Railroad colours.** Heralds and explicit colours are shared by map stations, company
  panels, market markers and portfolios.
- **Market and depot on the board.** The market is one row of tall narrow cells spanning
  the map bounds; static, animated and expanded markers use the same cell size. Depot rows
  show both faces of a certificate with separate prices and one shared supply count;
  obsolescence shows its triggering train badges, with final-run notes that tell it apart
  from immediate rust.
- **Action-pane styles.** 1846's panels share one class for their headings, paragraphs
  and buttons, so title styles never reach the family's own panels in the same pane.

## Verification scenarios

1. Open the packet, choose a card, change perspective, then open history. The packet
   closes on submission; other perspectives show no cards; history shows only the
   perspective's own cards and disables purchases. Manual.
2. Choose a track tile, rotate and preview it, then Undo. Nothing changes until
   confirmation; after Undo, inventory, treasury, stations and the drawing agree. Manual.
3. In combined construction, place a station, then continue with track. Undo first
   clears a selected station placement, then leaves station mode. Manual.
4. Stage a two-lay private plan. The shared map previews it; clearing it changes nothing;
   confirming creates one Action. A revenue-marker interruption blocks unrelated
   actions. Manual.
5. Open a recorded position where the operating railroad is already in construction with no
   affordable tile, station or share issue but can still offer to buy a company. The
   action area shows the purchase controls above "can't lay track or place a station";
   finish moves it to Run trains. A railroad entering construction with nothing at all to
   do finishes by itself (`operatingSequence.spec.ts`). Automated for the engine, manual
   for the panel.
6. During Finance, open Buy privates. The purchase flow replaces the Finance panel at once
   and the mode switch hides; Undo returns to Finance. Manual.
7. In a stock round with a claimable receivership, open Receivership, then Buy. Buy closes
   the panel; reopen it and Undo closes it. Claim a company: the player becomes
   president. Automated for the claim (`receivership.spec.ts`), manual for the panel.
8. Run ordinary and express trains, including the Mail Contract and an acquired train
   that may not run. The preview revenue matches the committed result; a receiver's routes
   use the same UI. Manual.
9. Buy a private and an independent, accept and decline offers, buy and discard trains,
   distribute dividends, fund a compulsory train choosing between the 5 and the 4/6, go
   bankrupt, and take over a receiver. Automated for the rules (`trainFunding.spec.ts`,
   `receivership.spec.ts`, `acquisitions.spec.ts`) and for choosing among fundable trains
   (the 18xx-ui funding module spec); manual for the panels.
10. Play the two-player opening and a final operating turn through the shared table.
    Manual.
11. Replay the recorded finished game: it reaches phase IV and the reference final values,
    history uses canonical replay and Undo patches, and every mutation control is disabled
    at the end and in history. Automated (`apps/18xx-playground` finished-game spec).
12. On desktop and narrow viewports, every action stays reachable and the board stays
    navigable. Manual.
