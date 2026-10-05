# 1846 phase-II operations and company acquisitions

## Scope and evidence

GMT 2021 §§6.43–6.48, 6.64–6.65, 6.9 and §9 govern these two slices.
Play resumes after the first phase-II purchase. Add the printed green supply,
ordinary construction (two yellow or a yellow plus one upgrade, either order),
city connectivity, Z/Chicago upgrades, terrain and East–West scoring. Corporations
can purchase player-owned privates and independents for $1 through list price
throughout their operating turn. Another owner's agreement is a recorded decision.
Absorption brings treasury, train and an extra station, closes the independent,
and prevents its train running in the acquisition OR. Ordinary private powers,
train trading, emergency funding, later phases and game ending remain later work.

Evidence: reference snapshot 715567bdc7e5cc68a68a286b21dc8edd1a125e50,
g_1846/map.rb, game.rb and step/buy_company.rb, plus the official GMT rules.
Source behavior supplies requirements; no source classes or algorithms are copied.

## Family survey and seams

Surveyed the complete trait assignment lists: construction usefulness128,
allowance320, upgrade preservation135, supply179, connectivity147, running
permissions128, visit/payment259, revenue modifiers416, control190, entity roles325,
reorganization operations192, settlements360, interruptions488 and power lifecycle680.
These include titles with no relevant mechanism and unresolved classifications.

Construction ranges from one lay/upgrade to points, multiple upgrades, remote
powers, gauge conversion and paired tiles. Existing TrackConstruction owns supply,
track preservation, rotation, connectivity and station migration. A connected-city
fact extends its usefulness policy; 1846 owns the rule accepting it. Costs and
allowances remain title rules. Shared standard green faces are reused; printed
Z/Chicago faces belong to the title catalog. Preprinted Detroit pays terrain on its
first upgrade; later upgrades and upgraded IC land grants pay the ordinary $20.

Selected payments can interact with directional bonuses: 1846 optimizes the three
counted stops including its station and both E–W endpoints where that pays better.
RouteEvaluation retains visited stops/distance and gains a paying-stop bonus policy.
Running permissions include owned trains, gauge/permit restrictions and special
permissions: a title policy governs runnable inventory, used by rules and editor.
Only 1846 stores its two possible independent acquisition occurrences; other titles
acquire no extra state fields.

Private interests differ from operating companies. A company purchase asset means
all equity from its sole player owner; it does not relabel a minor as a private.
Existing OfferPurchase/RespondToPurchaseOffer own negotiation and cash settlement.
A small purchase-only handler composes with operating steps; the existing broader
company-decision handler reuses its action discovery. No fake private-power policies
are needed. Shared asset-transfer helpers already used by 1817 move treasury and
trains. 1846 owns closure and extra-token disposition, including no extra token when
the buyer already occupies the city. Transfer effects use existing AssetTransfer and
StationTransfer metadata. 1867 share compensation and follow-up dealing, 1841
secession and 1856 nationalization are counterexamples to a universal absorption
procedure; they remain independent policies/processes. Existing titles reject the
new asset kind unless explicitly supported. Company acquisitions opt into separate
offer-state and Action schemas; all four existing titles retain their exact
runtime contracts, including their original private/train asset union.

The offer and response schemas share their common metadata fields while retaining
the title opt-in for acquisition effects. Steamboat purchase removes the existing
player-owned assignment, as required by GMT 2021 p.12; it does not transfer that
port bonus to the corporation. Corporate marker placement remains deferred.
The acquisition regression checks bonus removal, replay, Undo and the next OR.

## UI and verification

The playground shares the actual title session/runtime. Green choices use the
existing map picker. A manual acquisition selection, price and confirm uses session
Actions; Back cancels selection, Undo clears manual selection first, then reverses
committed history. Pending offers suspend construction/routes/finance and give only
the seller response controls. Publication, perspective changes and History clear
local drafts. Read-only History exposes terms/effects, never active controls.

Verify phase continuation, both upgrade orders, one-upgrade maximum, finite supply,
Z/Chicago track/token preservation, border/terrain pricing, counted E–W optimization,
private income/ownership, consent/refusal/wrong actors/stale requests, independent
cash/train/token transfer and same-city behavior, train limit, acquisition-round
running restriction and next-OR eligibility, closure, replay and Undo. Browser checks
exercise actual green construction and private/independent purchases.

No host bridge member changes. Older UI Artifacts keep their embedded runtime;
1846's logic and UI must be published together to adopt these changes. Other titles
need no publication to continue their unchanged behavior.

Verification completed on 2026-10-04: 820 engine/title tests passed across the
shared engine and all five titles. An additional playground rendering regression
covers every supplied 1846 tile in both orientations and all six rotations. The
browser exposed Chicago 298's missing layout; its title-owned layout now serves
the board, picker and tile library. Shared/title UI checks, existing title contract
fixtures, and logic/UI bundles passed. The playground check also passed.

Native browser play from seed 7 reached OR1.2 after buying a 3/5, upgraded Detroit
with green 295 for $40, and restored the yellow face with Undo. C&WI negotiation
exercised draft Back/Undo, refusal, acceptance and reversal; Michigan Southern
absorption transferred its $60 treasury, 2 train and Detroit station. History
disabled actions and displayed the prior station owner; Undo restored the pending
offer and original assets. The playground route now imports its shared stylesheet
so the harness and scaling controls render correctly.
