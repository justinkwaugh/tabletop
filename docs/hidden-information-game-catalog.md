# Hidden-information adoption catalog

Audit date: 2026-09-06. Baseline: `0b1ff3f9` on `feature/hidden-information`.

This catalogs the ten implemented Game Titles other than Fresh Fish. It examines canonical state, Action payloads and metadata, random calls, state handlers, and relevant UI visibility. Rulebooks were checked for specific ambiguous cases; this is not a complete rules audit of every edition. The sample game is scaffolding and has no identified secrets.

**Seven titles have protection candidates. None of these ten currently registers `runtime.visibility`.** All ten already register a canonical state validator. Existing UI concealment and annotations inherited from shared components do not currently prevent these titles' canonical fields from reaching ordinary hosted clients.

The requirements below concern new games adopting protected delivery. Existing v1/v2 games retain their historical behavior; in particular, already-public v2 games are not expected to become private. This catalog does not change runtime behavior.

**Implementation follow-up:** Sol now implements explicit projection, protected v3 deck shuffling, shared projected hydration, and hypothetical deck population after the selected recorded cascade completes. Its entry below preserves the audit requirements; Sol is no longer outstanding repository adoption work. Matching Logic/UI publication and major-version reload remain release work.

## Overview

| Title | State to protect | Action data to protect | Protected randomness |
| --- | --- | --- | --- |
| Sol | Undrawn deck contents/order | No private payload identified; drawn results are public | Deck shuffle |
| The Estates | Undrawn roof bag; owner-only money, stolen totals, and running scores with Hidden Money | No sealed bids; drawn roofs and embezzlement are public | Roof shuffle |
| Santiago | Future tile bag; money under its private-money option | No sealed bids; tile reveals are public | Tile shuffle |
| Kaivai | Pending final island bids | `PlaceScoringBid.amount` until the round is revealed | Fishing dice, including randomized less-luck variants |
| Container | Owner scoring card; pending foreign-island bids and duplicate totals; money policy to decide | `SubmitBid.bidAmount` until round reveal | Scoring-card allocation |
| Lowenherz | Future action deck, politics piles, owner politics hands, pending duel bids; optional private money | Inspected-card choice and pending duel amounts/treasure cards | Action-deck ordering and politics-card allocation |
| Indonesia | Other players' future city cards; current-card reveal and money policies to settle | No private payload identified in current Actions | City-card allocation |
| Bus | None identified | None identified | None beyond public setup/identity |
| Bridges of Shangri-La | None identified | None identified | None beyond public setup |
| Urbino | None identified | None identified | None beyond public setup |

“Until reveal” does not mean an old submission Action should be dynamically unredacted later. Keep private historical submissions protected and publish a separate complete result at the reveal transition.

## Sol

Sources: [state](../games/sol/src/model/gameState.ts), [player state](../games/sol/src/model/playerState.ts), [deck](../games/sol/src/components/deck.ts), [initializer](../games/sol/src/definition/gameInitializer.ts), [DrawCards](../games/sol/src/actions/drawCards.ts), [player card UI](../games/sol-ui/src/lib/components/PlayerState.svelte).

- **Protect:** `deck.items`, including card identities and order. Preserve the bag's public remaining count and the public solar-flare counters.
- **Keep public:** `players[].card`, the currently drawn cards, suit/effect mapping, played effects, pieces, energy, momentum, and realized flare consequences. The kept card is explicitly face-up in the [official rulebook, page 17](https://elephantlaboratories.com/sol-rulebook.pdf). The current UI also displays it to other players.
- **Actions:** `DrawCards.metadata.drawnCards` and `squeezedCards` describe revealed outcomes; `ChooseCard.suit`, effect activation, and flare results remain public. Drawing requires canonical execution and permitted patches, not concealment of the whole draw Action.
- **Randomness:** separate the deck shuffle from public color/turn-order and publicly disclosed suit/effect setup. Deck construction currently uses the same public PRNG for card IDs and shuffling; split those responsibilities without moving ordinary public identifiers onto a protected stream.
- **Exploration:** populate a hypothetical remaining deck consistent with public draws, kept cards, and flare counts. The existing hook shuffles a complete deck and cannot populate an omitted one. Preserve revealed card identities; do not replay the real hidden order.

This is principally a future-deck protection task, not an owner-private-hand task.

## The Estates

Sources: [state and scoring](../games/estates/src/model/gameState.ts), [initializer](../games/estates/src/definition/gameInitializer.ts), [options](../games/estates/src/definition/gameConfig.ts), [DrawRoof](../games/estates/src/actions/drawRoof.ts), [StartAuction](../games/estates/src/actions/startAuction.ts), [Embezzle](../games/estates/src/actions/embezzle.ts).

- **Protect:** `roofs.items`. Keep the remaining count and `visibleRoofs` selection-slot availability public. A selected roof becomes public.
- **Implemented conditional fields:** with `hiddenMoney`, opponents' `players[].money`, `stolen`, and combined running `score` are omitted during play. Final totals are public at EndOfGame.
- **Keep public:** cube offers, board, certificates, chosen pieces, roof results, and the once-around auction. Its bids are public, not sealed.
- **Actions:** `DrawRoof.visibleIndex` and `metadata.chosenRoof` remain public. `Embezzle` always transfers one unit, so the public Action history reveals the stolen total even if its current-state field is omitted. Hidden-money delivery is a display/memory convention, not a promise that balances cannot be calculated.
- **Randomness:** roof shuffle uses protected entropy for newly initialized v3 Games. The initially revealed cube supply and other public setup can keep public randomness.
- **Legal discovery:** Hidden Money auctions include every non-auctioneer and require explicit bids/passes and recipient choices, preventing cash-based automatic skips from disclosing affordability. Own cash limits positive bids and buyouts. Public-money and legacy Games retain their automatic decisions.
- **Exploration:** unavailable with Hidden Money, including legacy Games. Public-money Games reconstruct the remaining roof multiset from public draw history before sampling. See the [implementation and compatibility contract](../games/estates/docs/visibility.md).

**Decision:** `sneakyBuildings` currently changes rendering of previously public building faces. Auction history, placements, and scoring can disclose those values. Treat it as presentation unless a different information rule is explicitly desired; do not automatically protect every placed cube value.

## Santiago

Sources: [state and scoring](../games/santiago/src/model/gameState.ts), [initializer](../games/santiago/src/definition/gameInitializer.ts), [options](../games/santiago/src/definition/gameConfig.ts), [bidding handler](../games/santiago/src/stateHandlers/bidding.ts), [PlaceBid](../games/santiago/src/actions/placeBid.ts), [round transition](../games/santiago/src/stateHandlers/extraIrrigation.ts).

- **Protect:** ordered `tileBag`. It is a raw array, so introduce a public count rather than treating an omitted/empty array as an exhausted bag.
- **Conditional fields:** `players[].money` when `publicMoney` is false. Public payments and known starting balances still permit accounting. Final scores intentionally include remaining money and can be revealed at the end.
- **Keep public:** `revealedTiles`, field placements, canal proposals/amounts, overseer decisions, water infrastructure, and realized drought/income results.
- **Actions:** `PlaceBid.amount` is public. The handler explicitly implements sequential bidding and uses earlier bids to validate later bids. A simultaneous-group field does not make this auction sealed. The title description's “secretly bid” wording conflicts with this implementation and should be corrected or reconciled during adoption.
- **Randomness:** protect the tile-bag shuffle; public board setup, colors, and initial order can remain public.
- **Reveal barrier:** new tiles are drawn when entering the bidding state, including through the end-round cascade. No `revealsInfo` marker was found in the title's implementation. Mark the actual reveal transition so Undo cannot erase knowledge; authoritative fallback alone is not the information-reveal Undo contract.
- **Exploration:** generate a remaining bag consistent with all publicly removed tiles, including three-player discards, not just tiles still on the board. The existing hook only shuffles canonical contents.

## Kaivai

Sources: [state](../games/kaivai/src/model/gameState.ts), [normal bid](../games/kaivai/src/actions/placeBid.ts), [scoring bid](../games/kaivai/src/actions/placeScoringBid.ts), [island bidding](../games/kaivai/src/stateHandlers/islandBidding.ts), [ScoreIsland](../games/kaivai/src/actions/scoreIsland.ts), [Fish](../games/kaivai/src/actions/fish.ts).

- **Protect:** entries in `bids` during final island bidding, known only to the submitting player until resolution. Preserve the public bidder list/submission status.
- **Keep public:** ordinary round bids. Those are sequential and determine visible `buildingCost` and `baseMovement`. The same `bids` record is used for both systems; a blanket private annotation would conceal information required by normal bidding.
- **Actions:** protect `PlaceScoringBid.amount` with actor entitlement. Keep `PlaceBid.amount` public. `ScoreIsland.metadata.playerMajorities[playerId].influence` already records each revealed final bid, alongside public huts, boats, winners, and awards; retain this as the public reveal snapshot.
- **Randomness:** both editions' randomized fishing branches currently use `state.prng`. Move them to the version-aware protected accessor. Some less-luck variants still roll dice and need protection; the luckless deterministic branch does not. Keep fishing location and realized `numFish`/`dieResults` metadata public.
- **Schema dependency:** `Record<playerId, number>` does not supply the immediate containing `playerId` required by `Policy.Owner`. Separate normal/scoring bid structures or use explicit owner-bearing records and an appropriate reveal representation.
- **Exploration:** sample unknown pending scoring bids within public influence constraints, preserve the explorer's own known bid, and use fresh hypothetical dice entropy. No unseen future dice result should come from the real game.

## Container

Sources: [player state](../games/container/src/model/playerState.ts), [value card](../games/container/src/model/valueCard.ts), [initializer](../games/container/src/definition/initializer.ts), [foreign-island auction](../games/container/src/components/foreignIslandAuction.ts), [SubmitBid](../games/container/src/actions/submitBid.ts), [bidding handler](../games/container/src/stateHandlers/auctionBidding.ts).

- **Protect:** the entire owner `valueCard`, including its color/value mapping and special values. Protect pending foreign-island `round.participants[].bid` **and `totalBids`**, which duplicates each submitted amount immediately.
- **Reveal lifecycle:** initial-round bids become public before the tiebreak; additional tiebreak amounts remain sealed until that round resolves. Separate the published initial baseline from pending totals. Simply hiding all totals loses already-revealed information; leaving totals public leaks new submissions.
- **Actions:** protect `SubmitBid.bidAmount`. Add a public resolved-round snapshot before `resolveRound()` replaces the initial round. A final winner/price alone does not preserve the complete initial reveal through a tiebreak. Keep public acceptance, winner selection, loans, purchases, shipping, prices, and cargo transfers.
- **Keep public:** machines, warehouses, priced stores, ship cargo/location, island containers, loans, and public commerce. The Investment Bank's broker offers and payment-card bidding are open in the implementation; do not apply the foreign-island sealed-bid policy to them.
- **Randomness:** value-card assignment requires protected entropy. Initially revealed machines, broker stock, colors, and turn order can remain public.
- **Legal discovery:** use public `submitted` flags and the acting player's known bid. Do not inspect other participants' omitted `bid` fields to infer whether a round is complete. Review other-player cash checks if concealed money is adopted.
- **Exploration:** generate a consistent assignment of unknown value cards and legal unknown pending bids, preserving the explorer's card and previously published bid baselines. The current exploration hook returns canonical state unchanged.

**Money decision:** the published rules conceal money values and value cards, expose the number of money cards, and reveal value cards at the end. Bids reveal together, with initial bids remaining visible during extra tiebreak bidding. The implementation exposes scalar `money`, has no private-money option, and does not model physical money-card counts. Decide whether to preserve this open-money adaptation or add owner-only balances. Public transaction history will still support balance inference. [Publisher rulebook, pages 2–3 and 7–8](https://cs.uwaterloo.ca/~dtompkin/dtlib/base/Container%20-%2010th%20Anniversary%20Jumbo%20Edition%21.pdf).

## Lowenherz

Implemented in matching Logic/UI 2.0.0. See [the design and migration notes](lowenherz-hidden-information-design.md).

- Host-only remaining action deck and politics piles; public deck backs and remaining counts.
- Owner-only politics hands, active inspection snapshot, and pending duel amounts/treasure values. Counts and submitted-player identities stay public.
- Actor-private inspection records, card choices, and bid payloads. Complete draws, resolved duel rounds (including losing/tied treasure), public payments/plays, and final hands are explicit public observations.
- New system-v3 initialization uses protected randomness for secret ordering/allocation. Public board/color/turn setup and legacy v1/v2 replay retain public randomness.
- Exploration reconstructs hypothetical politics trajectories from the explorer's permitted source prefix, preserving observed multisets, revealed ownership, payments, and known hands. It reconstructs remaining action cards by back group and samples only unknown pending bids. Missing historical observations fail explicitly; Host/Admin Exploration retains its full-state path with Public Money enabled. Private-money Games disable Exploration, including legacy and Host View entry.
- Current legacy saves normalize before projection and remain playable forward. Old Action History is not guaranteed across the face-based schema change. Existing v2 games do not gain privacy, and old public seeds cannot become retroactively secret.
- `publicMoney: false` omits other balances during play and reveals them at EndOfGame. Private-money negotiation demands do not query the other player’s balance; the payer must afford personal commitments. Public payments remain inferable.

## Indonesia

Sources: [player state](../games/indonesia/src/model/playerState.ts), [initializer](../games/indonesia/src/definition/initializer.ts), [new-era handler](../games/indonesia/src/stateHandlers/newEra.ts), [turn-order bidding](../games/indonesia/src/stateHandlers/biddingForTurnOrder.ts), [PlaceTurnOrderBid](../games/indonesia/src/actions/placeTurnOrderBid.ts), [city-card UI](../games/indonesia-ui/src/lib/components/BoardCityReferenceCardLayer.svelte).

- **Protect according to current UI intent:** `players[].cityCards`, including future-era cards, should be owner-known. The reference-card UI reads the local player's cards; serving every player's full allocation defeats that distinction. This privacy interpretation should be confirmed when implementing it.
- **Reveal boundary to settle:** the new-era handler copies the active placement card to `currentCityCard`. Decide whether the card becomes public when selected for placement or only when the city is placed. Protect that duplicate consistently up to the selected reveal point.
- **Actions:** no current private Action payload identified. `PlaceCity` location/result is public. Turn-order `PlaceTurnOrderBid.amount` and multiplied totals are sequential public bids; merger bids are open too. Money concealment does not imply sealed auctions.
- **Keep public:** companies, deeds, research, city placements, turn-order results, operations, and committed delivery plans.
- **Randomness:** move each era's city-card allocation to protected entropy. Keep color/order setup and public structural IDs for cities, companies, and mergers on the public stream.
- **Exploration:** generate feasible unknown city-card allocations preserving the explorer's cards and all revealed placements/cards. The existing hook returns state unchanged.

**Money decision:** the [bundled rulebook](../games/indonesia/indonesia-rules-09-EN.pdf), setup section, allows open or closed money and defaults to closed when no agreement is made. The implementation displays `cash` and `bank` publicly and has no corresponding option. Decide whether to retain open money or introduce a configurable owner-only representation, with final totals public. As elsewhere, public financial history can reveal balances by calculation.

## Titles with no identified protection requirement

| Title and source | Reviewed public state and Actions |
| --- | --- |
| [Bus](../games/bus/src/model/gameState.ts) | Routes, passengers and their movement, buildings, worker action choices, buses/sticks/stones, time, first-player order, scores, and passes are public. Randomness found is public setup and passenger identity generation. |
| [Bridges of Shangri-La](../games/bridges-of-shangri-la/src/model/gameState.ts) | Masters, students, bridges, stones, supplies, scores, recruitment, placements, journeys, and passes are public. Randomness found is setup colors and order. |
| [Urbino](../games/urbino/src/model/gameState.ts) | Board, architects, building supplies, placements/repositioning, passes, concession, and scores are public. Randomness found is setup colors and order. |

These titles need no visibility registration merely because new game instances use system version 3. Local UI selections that have not been submitted are not canonical secrets to project.

## Shared adoption work and constraints

1. **Explicit registration and complete schemas.** Register state and all User/System Action projectors for each adopting title. `DrawBag`, protected PRNG, and `SimultaneousAuction` annotations alone have no delivery effect. Retain strict canonical validation while deriving the shared projected hydration representation.
2. **Protect every representation of a secret.** Include duplicate state fields, card identifiers in Action payloads, submitted amounts, result metadata, scores derived from secret values, and both History patch directions. Public reveal events should carry only the intended revealed result, never a remaining deck or hand. Preserve the public Action envelope and its stable Action identity.
3. **Represent known facts separately.** Public counts, submission flags, eligibility, and resolved bid baselines must survive redaction. An empty replacement collection is not evidence that the canonical collection is empty. Legal discovery should use the acting player's known data and public facts.
4. **Fit the supported policy model.** `Policy.Owner` requires a public stable `playerId` on the immediate containing object; keyed records do not qualify by themselves. Custom policies can project snapshots but are not trusted for guarded local execution. Phase/config-dependent visibility and private inspection need explicit design; do not assume they inherit the owner-hand execution guarantees.
5. **Make reveal transitions explicit.** Public outcome Actions can remain public even if their execution reads hidden state. Container and Lowenherz need resolved bid snapshots before round reset. Mark information-revealing cascades for Undo, independently of whether they require host execution. Define final-game disclosures explicitly; there is no automatic endgame unhide.
6. **Split entropy without changing legacy games.** Current random operations in these titles use the public stream. Route secret setup and fishing dice through the version-aware protected accessor for adopting games; retain public setup/identity generation and historical v1/v2 behavior. Never derive secrets from the public seed.
7. **Populate Exploration from permitted knowledge.** Reconstruct a hypothetical complete state from the projected source and its known facts. Existing reshuffle/identity hooks are not sufficient for omitted state. Preserve owner-known cards, observed removals, published bids, and game-specific deck constraints. Host/Admin Exploration still uses authorized full-state access; real hosted Forks remain canonical continuations.
8. **Verify title-specific delivery and play.** Exercise owner, opponent, spectator, Host View, and hotseat; inspect state, metadata, and History around reveals; test legal discovery and a playable continuation from projected state; check compatible artifacts and legacy forward play. Republish the affected Logic and UI Artifacts together as required by their schema changes.

## Decisions to resolve before the affected title is implemented

- Whether Container and Indonesia retain their current public-money behavior or adopt concealed/configurable balances.
- Whether Santiago's money option should enforce delivery concealment as well as presentation, accepting that public transactions remain inferable.
- Indonesia's city-card privacy and exact current-card reveal point.

Suggested implementation order: Sol first for a public-result/private-deck case; Kaivai for protected dice and final sealed bids; Santiago for its bag and optional money (Estates has adopted protection); Container for owner cards and multistage auctions; Indonesia after its reveal/money decisions; Lowenherz has now adopted the inspection-knowledge design. Bus, Bridges, and Urbino require no hidden-information adoption work on the present findings.
