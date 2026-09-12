# Game table shell

The first U1 increment follows the requested desktop composition: the repository's
standard left sidebar with history controls above player/history/chat tabs, a
phase and turn header with Undo on the right, a light action area bounded by top
and bottom rules, and the semantic map directly inside ScalingWrapper. Indonesia
supplies the visual reference for the table background and restrained separators;
player panels reuse the family Portfolio component with collapsed details.

## Family applicability

The full trait assignments for round sequence, control resolution, entity roles
and allocation information were reviewed with the family construction/network
survey. Stock/operating rounds are not universal: 1817 adds acquisition procedures,
1846 has a draft, 1822 has committed bids, and some researched titles lack ordinary
share trading or construction. Ownership and decision authority also differ;
TOP's Union Bank and company ownership in 1841 mean a company president cannot
stand in for the acting player. The header uses canonical active player ids, and
portfolios keep company assets separate from player assets. The initial header
and action composition target the already implemented TOP/1889 sessions; they are
not a universal 18xx round schema.

The reusable shell receives a session and a title-provided action snippet. TOP and
1889 retain their own auction presentation and TOP retains its split controls.
The initial shared action composition reuses existing operating/stock controls.
Future titles can supply different action content without expanding a global
state switch. Shared packages do not import title packages. History lists actual
player Actions with basic readable action names; a full domain-specific narrative
and complete client information design remain later work.

## Existing infrastructure and interaction ownership

DefaultTableLayout, DefaultTabs, HistoryControls, GameChat and ScalingWrapper are
existing Common UI infrastructure. MapScene draws directly in the scaling area;
there is no MapViewer frame, inspector column, card or board background container.
The table sets the existing game session context for the shared controls.

Both the old logic workbench and the table use FinanceExampleSession.selectMap,
which preserves the existing precedence of route editing, construction, station
placement and inspection. It only stages selections; confirmation still runs
through Session methods. Header Undo calls the existing title-aware undo method;
manual drafts and committed history preserve their existing behavior. History
changes use the existing History object and visible-state lifecycle. The shell
adds no animation or canonical state. Collapsing portfolios and changing sidebar
tabs are local presentation decisions.

The title UiDefinition now uses the table shell. PrototypeUiDefinition retains the
previous composition for the existing /economy test workbench. The new /table
harness uses the same local game service, persistence, seeded examples and chat
service, with a compact game/position selector above the table. The host bridge
contract and shared GameSession implementation are unchanged; title UI Artifacts
must be rebuilt to adopt the shell. No Site Frontend or Logic Artifact change is
required for this UI work.

## Verification

Check both title tables, sidebar switching, local harness chat, map bounds, map
selection, header Undo for drafts and committed Actions, history navigation and
reload. Re-run existing construction/station/route checks after moving map
selection into the session. The current scope establishes the requested desktop
shell, not full U1 mobile design or U2 acceptance.

Initial verification: all nine selected browser checks passed (both tables,
committed/draft Undo and history, and the six existing construction/station/route
cases). Seven selected logic/selection checks passed. Shared, title and harness
Svelte/TypeScript checks passed. The local preview required a restart after prior
package rebuilds left differently timestamped instances of the same context module;
no context API or shared-component change was needed.

After extracting the existing title auction compositions for reuse by the table
and workbench, the three table checks and both opening-auction browser checks
passed again. Both final table layouts were inspected at 1500 × 1000. Rebuilding
a package during preview can leave stale class/context identities in Vite; finish
builds and restart the preview before browser verification.

The next shell increment adds Map/Market/Spreadsheet view tabs between actions
and the viewport. The existing StockMarket renderer supplies title-specific market
geometry and markers, so rectangular/linear shape differences remain data. These
are presentation choices rather than additional round types or a universal finance
schema; future titles without a stock market are outside this initial composition.
Spreadsheet remains undefined. The selector is outside ScalingWrapper; keeping the
inactive map mounted at its original dimensions preserves navigation and staged
map choices when consulting the market. Tabs use local state and keyboard navigation.

Tab verification: the three table browser tests pass for both titles, including
map/market/spreadsheet switching, keyboard wraparound, retained staged tile
selection and unchanged zoom after returning to the map. Shared UI checking
reports no errors or warnings. The tab strip was visually checked at desktop size.

Market presentation now mirrors the map: the reusable StockMarketScene is rendered
directly by ScalingWrapper. The existing workbench StockMarket component reuses
that scene inside its prior scroll/heading composition. This preserves one renderer
for title-supplied rows, columns, prices and stacks without adding a market topology
assumption or finance policy. Map and Market have independent retained viewports.

Market edge arrows show the right/up and left/down dividend convention used by
both current consumers: a missing horizontal connection with an available vertical
connection gets a small arrow in that lower corner. Terminal spaces get no arrow.
This follows the stock-trading survey of linear, rectangular, hex and zigzag markets
and the earnings survey's distinction between movement policies. The rectangular
renderer currently depicts the same edge convention as dividendMarketMove; a title
with different edge rules will require title-supplied movement presentation.

The table renders the market at twice its base size, scaling cells, type, markers
and arrows together. ScalingWrapper still fits the complete market initially, with
more room to zoom toward native size. The workbench retains the base render size;
this presentation parameter changes neither market geometry nor movement rules.

## Company order and token artwork

The horizontal CompanyOrder component sits above the view tabs and outside all
scaling wrappers. It takes an ordered list, current company, completed ids, and
caller-owned appearances; it does not calculate order from price or player control.
The TOP/1889 shell uses the recorded OperatingSet order during operations and the
title's existing OperatingRules for a prospective order during stock rounds.
Completed companies remain visible. The current operator remains distinct from an
interrupting decision maker. History and Undo use the displayed state directly.

Survey: the full title-traits assignments for actor-order, round-sequence and
entity-roles, and the domain study's decision/interruptions section were reviewed.
Market ordering is common but minors-first, first-OR low-price, par order, numeric
line order, special national placement, continuous operations and recalculation
rules are counterexamples. TOP's PEIR goes last. The display never imposes one
family-wide ordering, nor treats every company as a major. Continuous schedules
and suspended operating rounds will need their own shell composition.

CompanyToken shares rendering between this strip and map stations. StationAppearance
accepts a title-owned image URL alongside the existing initials/color representation.
The image is artwork rather than a source of identity or rules; initials remain
supported for callers without artwork. No game imports enter shared packages.
TOP's prepared ML identity represents Charlottetown and uses its C artwork; ordinary
randomized titles use their canonical company identities. All seven 1889 appearances
are supplied, including companies absent from the prepared position.

The SVG artwork was taken from the locally supplied visual assets at the user's
request: [TOP tokens](https://github.com/tobymao/18xx/tree/715567bdc7e5cc68a68a286b21dc8edd1a125e50/public/logos/1871)
and [1889 tokens](https://github.com/tobymao/18xx/tree/715567bdc7e5cc68a68a286b21dc8edd1a125e50/public/logos/1889).
They are housed in the corresponding title UI packages. This imports visual assets,
not implementation code. The source LICENSE distinguishes the platform's MIT
license from title rights; title artwork remains subject to its designers'/publishers'
rights. The shared renderer and ordering composition were implemented in this repo.

Verification covers both prepared operating orders, current-company highlighting,
artwork loading on the strip and map, switching tabs, and the opening state.

The order strip now uses compact rounded pills with 28px tokens and treasury cash,
read through the existing cashOwnedBy helper from the displayed financial state.
The ownership/capitalization survey distinguishes corporate cash from president
wealth, buying power, loans and restricted capital; this is only the cash balance.
It introduces no currency assumption, and preserves absent/unlimited cash values
from the shared model. TOP and 1889 use the same presentation, including zero cash.

Pills sit under the heading and show dollar-prefixed cash, named owned trains,
and a tiny token beside the available station-piece count. The family train/capacity and token
surveys distinguish owned assets from runnable trains, train limits, and currently
legal station placements. We reuse trainsOwnedBy and the title depot's display
names, preserving H/+ and duplicate trains. Remaining tokens counts only available
station pieces, excluding placed or removed ones; it is not a legal-placement count
or a promise of future purchasable tokens. Leased capacity and differently limited
station supplies remain future presentation extensions. The compact two-line pill places trains above a 14px token and its remaining count,
with cash on the right. The existing CompanyToken renderer supplies title-owned
artwork; the token and count are grayed out at zero. The count also remains in the accessible summary.
This introduces no draft or round policy.

## Company disclosure

The company pill is a keyboard-accessible disclosure. One company opens below the
row; clicking the same pill collapses it. Inspection
is local presentation, independent of Action Drafts, map selection and Undo.
The chosen identity persists through history and displayed-state updates, with its
panel hidden when the company is absent from the displayed order. Close restores
focus to its pill. The viewport yields height to the panel; its detail body scrolls
when needed, preserving the map's independent ScalingWrapper.

CompanyOrder accepts a detail snippet, while CompanyDetails composes the current
TOP/1889 session's ownership, assets and private descriptions. CompanyOwnership
aggregates live share quantities by owner plus certificate pool. It does not merge
Bank IPO/Market/reserved pools, mistake president certificates for single shares,
or replace corporate owners with their controlling player. Only represented pools
appear; the UI does not invent title eligibility for zero-balance IPOs or treasuries.
Numbered certificates remain visible. Ownership displays share counts without a percentage column. PEIR’s numbered
interests retain their certificate numbers.

The full family profiles for entity roles, eligible investors, control resolution,
certificate structure, capitalization, private powers, trains and stations were
considered against the domain study and earlier slice surveys. 1841's corporate
ownership, TOP's Union Bank and PEIR, 1873's separate asset owner/operator, special
station supplies and private powers shared by a player's railways challenge a
single owner/major/fixed-capital model. We reuse canonical owner/control, cash,
share, train, station and private-description helpers. No new rules are inferred
from presentation. The current panel shows corporate privates separately from the
controlling player's open privates, with their descriptions and consumed-power
status; listing a player's private does not grant its powers to the railway.
Leased operating capacity, title-specific debt and reorganizations remain future
detail extensions when those titles are implemented.

The panel renders authoritative displayed state even while a construction or
purchase draft exists. It offers no gameplay controls. Validation covers two pool
owners with multiple pools, a corporate president, treasury shares, retired shares,
numbered interests, both title panels, focus/collapse, retained drafts, and history.

The card header now renders each remaining station token with its placement cost,
using StationRules rather than a price inferred from token order or title identity.
Pending automatic homes display $0; ordinary costs come from the current displayed
state. The station-placement survey already covers token schedules, replacement,
free homes and different supplies. This presentation adds no placement permission.
Station counts and locations no longer repeat in the body; the map shows placements. Tighter cell spacing and inline pool owners reduce card height while retaining
readable type.

Train badges now sit directly beneath the expanded header's company name, using
the same owned roster and title depot names as the pills. Distance tooltips retain
hex, city/offboard, revenue-center and unlimited distinctions from the train
survey; final-run rust status remains visible. Construction examples show TOP
Charlottetown with 2H/3H, Souris with 4H, and PEIR with none; 1889 Iyo has 2/3 and
Awa has none. These are prepared inventories, not changes to setup or purchase rules.

Purchasable privates now reuses TransferRules.priceRange for the inspected company and
displayed phase. The family private-transfer survey distinguishes unsaleable
powers, recipient restrictions, fixed prices, capped negotiations and uncapped
transfers. TOP permits Hunslet only, excludes PEIR, and caps payment at 200; 1889
uses phase-dependent twice-face-value caps. The card shows that maximum (or No
maximum for uncapped terms), without clipping it to cash or enforcing whose turn
it is. Closed and ineligible privates are omitted; company-owned privates retain
their operating revenue. No purchase policy is duplicated in the shared UI.

Private descriptions in company details are supplied by the title UI and limited
to powers affecting that railway’s operation, including powers gained on purchase.
Income, closure and share-exchange text is omitted. TOP describes Hunslet’s early
train purchase; 1889 describes Ehime’s unused sale-triggered upgrade and Sumitomo’s
terrain discount. Player-only powers are not implied to transfer with ownership.

Trainless-company emphasis reuses TrainRules.requiresTrain, preserving title
exemptions and route-dependent obligations from the family train survey. It does
not infer a forced purchase merely from an empty roster or gate the signal on
whose turn it is. TOP PEIR remains exempt; 1889 railways need a station route.

## Train badge phase colors

CompanyOrder and CompanyDetails share TrainBadge, using the existing tile palette
and dark text. Title UI packages map train definition IDs to their phase colors.
TOP uses yellow for 2H/3H, green from 4H through 3+, brown for 4+/7, and gray
for diesel. 1889 uses yellow for 2, green for 3/4, and brown for 5/6/diesel.
The phase definitions and existing track color policies agree on these groupings.
The family train/phase survey includes variants, private trains and non-train
phase triggers (1822, 1846 and 1862); therefore the shared renderer neither parses
train names nor assumes a train-to-phase progression. Mapping remains title-owned,
with no phase or purchase-rule change. Both consumers use the same badge palette;
the chosen dark text is checked for contrast on all four used backgrounds.

## Player panels

PlayersPanel replaces the generic certificate inspector with title-independent
ownership and private-company tables. playerPortfolio groups actual owned shares,
using the company's share count or outstanding numbered shares when the company
has no fixed capital (TOP PEIR). Corporate holdings stay with their corporate
owner. Current net worth reuses ValuationRules and portfolioWealth; TOP Union
Bank assets enter once through its charter, not as directly owned railway shares.
Open privates show their income per operating round and valuation-rule value.

Liquidity is cash plus shareSaleValue: maximum proceeds for one legal block per
owned company under current stock-sale terms. It checks the existing disposal
evaluator for market capacity, certificate indivisibility, presidency succession,
company operation requirements and per-block limits. It does not assume it is
currently the player's action, simulate multiple future turns, count negotiated
private sales or include company cash. The two current titles have independent
sale blocks by issuer. This summation is not a liquidation search for titles with
cross-company price effects, shorts, or sale-linked debt; those require their own
liquidity policy. Emergency funding remains governed by its separate sequence.

The full-catalog domain study's ownership, financing, priority and valuation
sections informed these limits: 1817 shorts/loans, 1841 corporate ownership and
personal bankruptcy debt, 1846 issuance, 1856 changing share sizes, and 1867 final
loan deductions are not assumptions imported into the current titles. Existing
valuation policies remain title-owned. priorityOrder supports the existing
consecutive-pass and pass-order StockRoundRules: passing can establish TOP's next
order, while 1889 preserves priority through passes and moves it after an action.
Outside the stock round, panels use canonical turn order. Other priority
mechanisms need an additional policy when that title is implemented.

Verification covers market capacity, blocked succession, per-block limits, sale
prohibitions, both priority schemes, no state mutation, live TOP/1889 totals and
PEIR fractional ownership. Player panels derive from displayed state for history
and Undo, and never initiate game Actions.

The Certs stat uses stockCertificateCount and the title's certificateLimit,
including fractional weights, special-certificate exemptions and market-zone
exemptions already encoded by StockRules. It is the count against the limit,
not the number of physical certificates or shares.

### Company portfolio cards

The family ownership survey (including TOP Union Bank, 1841 corporate ownership, and 1873 separate asset ownership) distinguishes the investing entity from its human controller. Reuse owner-based portfolio assembly and the player-card rendering for title-selected company portfolios after the players. TOP supplies UB; 1889 supplies none. Corporate cash and investments remain separate from personal liquidity, even when their value contributes to the controlling player’s net worth. Do not infer corporate sale permissions or certificate limits from player rules. Broader debt/short valuation still requires title valuation policies. Verify UB ownership and controller in TOP, with no extra card in 1889.

Track-lay masking uses the existing title-policy-backed legal choices, rather than inferring availability from terrain, track color, or connectivity in the renderer. The family construction survey includes differing allowances, private powers, and upgrade restrictions; these remain in construction rules. TOP and 1889 supply the same presentation contract. Masking is optional for reusable map consumers, applies equally to board artwork and generic hexes, and does not alter staged selections or action validation.

### Map-based tile choices

The family construction survey includes shared numbered tiles, title specials, phase-dependent upgrades, private exceptions, and station remapping. The picker consumes existing legal TrackRequests rather than computing legality. A choice previews the first legal request and repeated hex clicks cycle full legal placements, preserving same-rotation station mappings. The title supplies artwork/layout and policy; screen-space arc layout has no title knowledge. TOP and 1889 exercise the first consumers. Source-tagged selection and session-owned confirmation preserve construction consent, history, and Undo behavior.

Private descriptions in player panels reuse the existing title-owned PrivateRules descriptions and shared Floater positioning. The family private survey spans revenue-only holdings, exchanges, terrain rights, phase-dependent abilities, and titles without privates; the visual component treats this as supplied text rather than inferring a universal power or purchase rule. TOP and 1889 provide their existing state-aware descriptions. Hover and focus expose the full explanation without expanding the compact portfolio rows.

The first auction-panel refinement targets offer-pile auctions: display only the current auctioneer's legal lots with value, private income where applicable, and direct Offer actions. The family auction survey distinguishes TOP offer piles from 1889/1830 reserved-bid waterfalls and 1822 minor/private auctions; an offer list is not imposed on those different procedures. Auction lot names/prices and the set of offerable lots remain rules-owned; private income and share identity use existing canonical definitions. The prototype bidding panel remains pending a separate design pass. Shared presentation lives in AuctionOffers; the TOP table composes it without shared-to-title dependencies.

Auction geography and descriptions remain title-supplied: TOP's numbered PEIR rights map to company homes, while Vernon River Bridge points to a specific blocked hex. The broader private survey includes location-free exchanges, construction allowances, and multi-location powers; the first focus affordance accepts an optional single location and does not invent one for those cases. Existing map selection geometry and ScalingWrapper own focus. Hover descriptions reuse the private popover with explicit exclusions for action buttons.

The operating-order overview reuses title token appearances and the existing ordered company list. The full catalog's differences in operating-order policies, company counts, corporate ownership and token art remain upstream: the overview measures rendered pill visibility, with no title or numeric-company-limit assumptions. TOP and 1889 exercise normal fit and constrained overflow. It introduces no navigation or game action, and appears only when scrolling is necessary.

Market token rendering follows the stock-trading slice's full-catalog survey: market geometries, movement connections, stack arrival order and title ordering differ. This change retains the existing rectangular renderer and its explicit scope; it does not pretend to support hex or zigzag boards. TOP/1889 use stockMarketOrder and stored stack order. Token art remains title-supplied; the renderer uses canonical prices, not parsed labels. Crowding is presentation only: vertical compression preserves stack sequence, and hover spreads without changing state. A linear board uses multiple columns when needed. Shared token geometry is covered for single, double, crowded and linear examples; session animation covers real sales, arrival under an existing marker, actionless history, full-action replay and Undo.

The Tiles tab reuses the full-catalog tile survey in tile-library-evidence.md: colors and special definitions vary, paired faces share physical stock, and finite, unlimited and conditional supplies are distinct. The manifest renderer accepts title definitions, canonical remaining counts, layouts and appearance without importing games or calculating construction legality. It shows all remaining colors, including future phases, with an optional color filter; shared-piece counts remain coupled by TileSet. This slice uses the existing finite-count inventory contract (including TOP's currently recorded quantities); unlimited/conditional inventory policy remains a model extension, not a renderer inference. TOP specials and 1889 standard tiles exercise the same grid. Filter pills and counts accompany unframed tile artwork; there are no cell borders or inspection controls.

Manifest ordering groups colors in the supplied title order, then sorts simpler faces first: non-city faces before cities, fewer nodes and track segments before more, fewer station slots before more, and straight edge-to-edge track before gentle and sharp bends. Printed numbers only break ties. This is a browsing heuristic over the existing tile model, not upgrade or route legality; the survey's multi-city, town and title-special distinctions remain intact. The same within-color order applies when filtered.

The initial spreadsheet shows open share companies as rows and players in priority order as columns. It reuses sharesOwned to count share units rather than certificates or percentages. The ownership/certificate survey distinguishes multi-share president certificates, mixed denominations and corporate ownership (TOP Union Bank and 1841); direct player holdings are displayed without attributing corporate assets to their controller. Title-selected corporate owners follow players (Union Bank in TOP), then Treasury counts shares owned by the row company, and Market counts shares in the title-supplied market pool only. Company kinds and token artwork remain supplied by the title; no fixed ten-share or major-only assumption is introduced.

Spreadsheet names now use optional title-owned short and initial forms, keeping canonical company identity and full accessible row names. Container width selects full, short, or initial text without JS measurements. This presentation-only choice accommodates the survey's title naming differences and formed companies without deriving abbreviations from token artwork or changing company models. Unspecified variants retain the full name and canonical id.

Company and Player spreadsheet views transpose one shared matrix. The corporate-owner and pool distinctions from the ownership survey are retained as rows in Player view; transposition does not reinterpret Treasury as a fixed owner or assign Union Bank's shares to its controller. Shared label rendering preserves title abbreviations in either axis.

Player financial summaries reuse the existing portfolio valuation and title certificate-limit rules: cash, net worth, total share units and counted certificates/limit. This retains the family survey's varying certificate weights, private valuation, and corporate ownership distinctions. Corporate-owner summaries include cash, wealth and shares but no player certificate limit; Treasury and Market have no owner-level financial summaries. The summary vectors transpose with the ownership matrix.

Operating history reuses the earnings/round-sequence survey (earnings-operating-rounds-slice-design.md), including different dividend entitlements, rounding, retained amounts, private income and corporate ownership. Player income sums recorded private-income and earnings payments to that player; stock sales, train funding and negotiated transfers are excluded. Company income is finalized train revenue before distribution, not retained cash. End-of-OR net worth uses title valuation rules on reconstructed historical state, never current share prices. The renderer offers Current/Income alongside Company/Player views. Recorded undo patches and Common's ExplorationHistory reconstruct snapshots without moving live history controls or mutating state; totals stop at the displayed action boundary and recompute after Undo. Fixed OperatingSet numbering is supported; titles without this OR structure need a different grouping policy. Prepared positions missing OR-entry actions are explicitly partial.

Titles can supply a reserved exchange pool for a separate Exchange column/row before Treasury. TOP uses its reserved pool; 1889 has no separate exchange pool and omits the entry. This preserves the survey's distinction between company ownership, bank market inventory and reserved exchange certificates. The stronger divider remains between owners and pools, moving before Exchange when present. Pool counts reuse one calculation over live, non-retired certificates.

Operating-order token-only and detailed presentations share the existing ordered entries and title-owned token artwork. The family company-order survey remains upstream; presentation neither assumes a company count nor changes priority. A local icon toggle changes only chip contents, preserving company-detail selection and measured horizontal overflow.

The active offer auction now uses a compact amount stepper and direct Bid/Pass controls. The allocation survey (domain-model study, allocation mechanisms and auction traits) distinguishes TOP's sequential offers, 1889/1830 reserved waterfall bids, 1822 cash commitments, and 1846 drafts. AuctionBidControl owns only presentation: its caller supplies increment and legality for each control, allowing reserved cash or different increments without imposing TOP's procedure on other titles. TOP composes OfferAuctionBidding with its existing model and session selection/commit methods. Its increment is $5; drafts and other allocation procedures remain separate. Initial minimum is a displayed default rather than an automatic selection; only changing the amount creates a draft. Pass clears that draft before committing, while Undo remains the existing session operation.
