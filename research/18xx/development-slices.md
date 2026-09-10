# TOP and Shikoku 1889: proposed development slices

This is a research-backed proposal for developing both titles through the shared
`@tabletop/18xx` and `@tabletop/18xx-ui` libraries. The packages currently contain
tile/map foundations and inspection scenarios. Implemented slices are marked
below; the remaining slices are proposed work, not published issue specifications.
Accepted implementation tickets belong in the repository's GitHub Issues.

## Approach

Develop one mechanism through the model, Action, Machine State Handler, and a
prototype UI that exercises it. Apply the standing [18xx design rule](../../docs/agents/18xx-design.md)
to every designed asset: survey its use across all researched titles, then use
TOP and 1889 to exercise the first implementation. The wider family informs the
interface even when a rule happens to be identical in these two games.
The first slices use prepared scenarios, allowing finance and operation to develop
before either opening auction is complete. Those scenarios are development tools,
not altered editions or selectable shortcuts in normal games.

The early interfaces must distinguish Player Identity, asset owner, controller,
current operator, and the player entitled to make a pending decision. TOP's Union
Bank and PEIR make these distinctions necessary immediately. 1889 independently
exercises changing decision authority through private-company powers and forced
train discards. [T §§6.6, 6.8, 7.7, 11.3; S §§8.7, 15]

Shared behavior belongs in the family libraries; map data, parameters, rule
choices, and procedure composition belong in each title. Reuse Common's `HexGrid`,
coordinates, directions, geometry, and graph interfaces. Railway paths within
tiles and station-dependent access are additional 18xx behavior; neighboring
hexes alone do not establish a train route. Existing Common auction, turn, round,
phase, and PRNG modules are candidates where the actual semantics match. [C; R]

Action and state names below describe intended responsibilities. They are not a
commitment to one class per name or to a universal 18xx state machine. A shared
module should own substantial rule behavior through a small interface. Introduce
rule interfaces when researched variations and current needs justify their cost.

### Disposable prototype UI and lasting tile/map rendering

The ordinary screens, panels, forms, and control layouts requested by the logic
slices are disposable development UI. They make behavior inspectable and testable;
they do not establish the final desktop/mobile information architecture. Keep
prototype-only views in the harness/title UI, and promote other shared visual
modules only when their reuse is demonstrated. Game Session integration, legality,
and draft/history semantics remain real even when the controls are temporary.

The tile/map models and catalog in `@tabletop/18xx`, with tile and map rendering in
`@tabletop/18xx-ui` are lasting library work from the beginning. A single definition
should serve board tiles, supply thumbnails, placement previews, and enlarged
inspection. Titles select definitions and provide genuinely title-specific data;
they do not each recreate ordinary numbered tiles or draw their own track paths.
The catalog's printed identifiers are lookup/display information whose meaning
must be verified against a title/edition, rather than assumed globally unique.

The lasting map renderer supports two presentations of the same semantic map:
**physical board**, showing title artwork with tiles placed over it, and
**boardless**, drawing the complete map generically from its definitions. Both
consume the same current map state and tile renderer. Their shared overlays and
interaction layer identify hexes, track paths, cities, station slots, and pieces
by stable model identities. Cosmetic artwork never supplies rule facts.

Support a possible per-player choice between available presentations. It is a
local display preference, outside canonical Game State, Action history, and game
configuration. Account-wide versus device/title-specific persistence, defaults,
and the final toggle location remain open UI decisions. Different players can
view the same game in different modes simultaneously without affecting rules.

The T1–T3 and M1–M2 slices establish the tile library and lasting map rendering
before the financial work. The
existing logic slice numbers remain stable. Full game UI design and implementation
are separate U1–U2 slices once representative play is available. This addresses
small-screen information density deliberately instead of letting prototype panels
accumulate into the finished interface. [E-T]

## Family-wide checks throughout the slices

Every slice includes the full relevant catalog/trait survey and a concise design
note specified by the standing rule. The following are useful known counterexamples
from the research, not an exhaustive substitute for that survey or a promise to
implement those games. In particular, a rule shared by TOP and 1889 may still
belong in their selected policy rather than the family model. [R; R-C]

| Slices                                            | Assumptions to challenge using the wider research                                                                                                                                                                                                                                                                          |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1–4: finance, holdings, formation                 | 18MEX's 5% certificates; 1841 corporate ownership cycles; preferred interests; 1856's changing capitalization; companies formed or funded before they can operate. Preserve those distinctions without building every financing or control rule now.                                                                       |
| 3, 5, 19: markets, rounds, endings                | Different market geometries and marker ordering; 1870 price-protection responses; 1880 suspended rounds; 1866's different calendar; endings other than bankruptcy or bank break. Shared state/visuals must not assume a rectangular market or one universal SR/OR schedule.                                                |
| T1–T3, M1–M2, 6–8: map, tiles, stations           | Multiple gauges, paths/lanes, paired physical tile faces, reservations that survive upgrades, alternate layouts, and map-specific markings. Financial mechanisms should remain usable for Rolling Stock, which does not use railway-map operation. Reuse Common geometry without treating one hex as one railway junction. |
| 9–12, 18: trains, service plans, payouts          | 1849 gauge-dependent distance, 1862 permits and cross-train reuse, 1860 fleet connectivity, 18Carolinas capacity, 18Chesapeake train exports, and separate retained/subsidy income. A route editor, validator, or optimizer must expose the same selected rules.                                                           |
| 13–17: powers, auctions, finance, reorganizations | Different auctions/drafts, loans and liability orders, merger/conversion/nationalization procedures, and resource-linked powers. Share actual transfers, decision support, and useful UI while allowing different participants and continuations.                                                                          |
| All visual work                                   | Review the semantic variations affecting what the view must show: owners versus decision makers, alternative market geometry, multiple revenue components, variable certificate structures, and absent mechanisms. Choose composable views with small inputs rather than a universal screen with a flag for every title.   |

For each asset, the design note distinguishes **supported now**, **considered and
extendable later**, and **intentionally outside this module's scope**. An interface
may be revised as implementation evidence improves. The aim is useful reuse, not
encoding the full trait catalog as mandatory configuration.

## Milestones and order

| Milestone                 | Slices | What can be demonstrated                                                                                                  |
| ------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------- |
| Tile library              | T1–T3  | Shared tile definitions, lasting rendered tiles, and separate inventories for both titles.                                |
| Map rendering             | M1–M2  | Lasting boardless and artwork-backed presentations of the same semantic maps, with shared tile overlays and interaction.  |
| Financial play            | 1–5    | Both titles can play stock scenarios with real ownership, funding, presidency, and turn rules through prototype controls. |
| Railway operation         | 6–11   | Both can construct track and operate companies through an ordinary OR in prepared scenarios.                              |
| Connected rules           | 12–15  | Phase changes, powers, negotiations, and emergency obligations integrate with that operation.                             |
| Complete title procedures | 16–17  | Real openings for both games and TOP's branch splits connect to the existing mechanisms.                                  |
| Complete game logic       | 19     | Full ending rules and final valuation are covered.                                                                        |
| Verified game logic       | 20     | Both complete games through prototype clients, including persistence, history, and hosted multi-client behavior.          |
| Designed game clients     | U1–U2  | Deliberately designed desktop and mobile experiences using the validated logic and shared tile library.                   |

Begin with T1–T3 and M1–M2, then follow the numbered logic slices. The tile/map work
has no dependency on corporate finance; slice 6 later connects live game state to
the established map renderer. Physical-artwork availability may defer a title's
M2 visual acceptance while boardless rendering and logic continue. Slices 16 and
17 have explicit independently reviewable parts. Slice 18 is deferred as a client UI
optimization; proceed from 17B to 19 and 20 using manually selected routes.
U1 can begin when representative stock and operating scenarios exist and be
challenged again by later complex procedures. Do not treat a milestone as proof
of rules completeness before the later rules and conformance slices are finished.

## 0. Establish the rule evidence for the slice being implemented

This is a small recurring preparation step, not a project-wide research blockade.
Use the supplied Shikoku rulebook and the pinned production source together. Treat
1889's Standard Game as the proposed initial scope; Beginner Game and quick-start
variants are follow-on work. TOP uses the supplied older prototype rules as
evidence, with unresolved revisions identified before encoding affected behavior.

TOP's existing comparison records differences in four-player starting cash,
King's Mail income, Union Bank auction value, and contradictions in diesel ending
and Ice Boats setup. It also records suspected implementation defects in routes,
split eligibility, and emergency finance. Resolve setup values before building
the complete TOP initializer in 16B; resolve later rule differences in the slice
that needs them. Do not silently merge values from incompatible sources. [R-T]

The 1889 evidence note also identifies auction-order and Beginner Game differences
between the PDF and source. Production status makes the source useful evidence;
it does not erase a concrete disagreement with the supplied edition. [E-S]

**Result:** each slice has explicit rule examples and any blocking rule question
recorded in its implementation issue. Undisputed model and infrastructure work
can proceed while another rule remains unresolved.

## T1. Establish the shared tile catalog and logical model

**Implemented:** [T1 interface, evidence, scope, and verification](../../libs/18xx/tiles.md).
Both title logic packages export initial specimen selections; complete inventories
remain T3 work.

**Outcome:** resolve shared numbered tiles and title-specific variants into
explicit, serializable tile definitions that both games can use.

**Shared work:** first survey tile-relevant profiles across the full researched
family and inspect the existing tile catalog. Separate catalog identity, printed
number/aliases, tile definition, physical supply, and placed state. A definition
describes rule-significant color, internal stops/junctions, paths and endpoints,
station capacity, labels, and revenue information needed by the initial titles.
Reuse Common coordinates/orientation/directions through an explicit mapping from
tile-edge numbering. Keep rule values distinct from visual layout hints. [E-T; C]

**Acceptance:** a common numbered definition is referenced by both titles without
copying it; a verified same-number variant can coexist without overwriting that
definition. Use shared #7/#8/#9 in TOP and 1889 as reuse cases, and the standard
#611 versus 1832's Y-labeled #611 as a variant case. Round-trip schemas preserve topology; all six rotations transform
edge references consistently; crossing paths do not connect unless the definition
contains an appropriate shared node. Preprinted tilees can use the same semantic
vocabulary without receiving an invented tile number. Record source/edition
provenance for catalog entries in design documentation, without research-source
references in implementation or test code.

**Scope:** implement the primitives and an initial specimen set needed for both
titles; consider broader gauge/lane/terminal/paired-face variations before choosing
the interface. Add their implementations only as justified by the current catalog
work. Tile upgrade legality remains a later rule procedure, not an assumption that
two tile numbers establish a universally permitted upgrade.

**Depends on:** existing family packages and the standing design review.

## T2. Build a lasting SVG tile renderer and inspection gallery

**Implemented:** [T2 interface, design review, and verification](../../libs/18xx-ui/tiles.md).
Includes Classic/Muted appearances and a standalone development gallery in
[`apps/18xx-tile-viewer`](../../apps/18xx-tile-viewer/README.md). Only the app
depends on game packages; the shared libraries do not, even for development or tests.
Game tile-selection UI will be designed in an actual game context. Complete title
inventories remain T3 work.

**Outcome:** inspect catalog tiles in all rotations, at board/thumbnail/detail
sizes, using the same reusable renderer intended for the eventual games. Export a
lasting tile-library viewer from `@tabletop/18xx-ui`, usable as a standalone
development gallery or embedded in a game's interface.

**Shared work:** SVG track geometry, cities/towns, station spots, revenue values,
labels, and the relevant special markings. Tile numbers remain catalog metadata
shown in the surrounding viewer, rather than printed on the artwork. Common supplies hex
geometry; the tile renderer derives connections from T1's semantic paths and uses
separate layout information for curves, label placement, and visual clarity.
Allow layout adjustments for complex tiles without changing their rule meaning.
Board-specific location names, current tokens, route highlights, and previews
compose with the tile view rather than mutating shared catalog entries.

The viewer accepts the catalog or a caller-selected title subset, without needing
a Game Session. Provide identifier/label search, color and track/stop filters,
rotation controls, and enlarged inspection. Show catalog identity and title/edition
context where printed numbers collide. Optional caller-supplied inventory counts
arrive with T3; distinguish browsing definitions from browsing available pieces,
including paired faces and unlimited supply where supported. Keep search and
inspection state local. An embedded host may consume a selected catalog reference
and rotation; the host owns staging any gameplay Action and querying legality.

**Acceptance:** the exported viewer exposes supported tiles, rotations, and title variants for visual
review. Search finds same-number variants without collapsing them; browsing never
mutates definitions or requires live game state. Validate visible edge connections against model endpoints,
distinguish a crossing from a junction, and inspect city/slot/track/label collisions
on complex specimens. Include TOP's T, X, and CX city tiles as labeled specimens
before assessing renderer coverage; T1's initial TOP selection contains only PEI1
and shared examples. The supplied TOP rulebook's section 12.3 (page 20) identifies
X/T cities and the special gray CX tile for Charlottetown. Check small-screen
thumbnails and enlarged detail views on
both flat and pointy layouts covered by the supported renderer. Automated geometry
checks plus targeted visual examples protect semantics and legibility. A screenshot
alone cannot certify the track graph.

**Scope:** both renderer and viewer earn careful visual design now, including
small-screen browsing. The thin development page hosting the viewer may be
disposable; the exported component is a lasting asset. Its design does not choose
the final game's screen layout. Rules queries use the model and never infer
connectivity from SVG intersections.

**Depends on:** T1.

## T3. Compose title tile sets and verify physical inventory

**Implemented:** [T3 inventory design, title reconciliation, and verification](../../libs/18xx/inventory.md).
Complete TOP (58 definitions/164 pieces), 1889 standard (40/63), and 1889 beginner
(40/71) manifests; finite single/paired physical supply; prepared return/retire
replacement; viewer counts; representative preprinted tiles. Unlimited and conditional
supply remain explicit later extensions.

**Outcome:** TOP and 1889 select shared catalog entries plus explicit special
definitions, with independent counts, and can display their complete selected
tile sets and representative placed/preprinted map tiles.

**Shared work:** title tile manifests, catalog resolution, physical piece identity,
and placed tile/face/rotation references. Title-defined counts stay outside the
shared definition. Exercise a prepared replacement that returns the old physical
tile to supply where permitted. Printed terrain, location identity, reservations,
and persistent map markers remain location facts. Handle or explicitly defer
paired-face/unlimited inventory behavior based on the family survey without
conflating a face with an independently available piece.

**Acceptance:** each selected tile resolves to the intended definition and display
number, including all special TOP/1889 entries under the chosen rules baseline.
Counts agree with source manifests and available rulebook evidence; repeated copies
render through the same definition, and changing one game's inventory cannot alter
another game's. For example, the pinned TOP/1889 manifests select different counts
of shared #7/#8/#9 tiles. Placement/rotation preserves catalog immutability. A replacement
fixture preserves map-owned facts and accounts for physical supply; complete legal
upgrade and token-migration rules arrive in slices 7–8.

**Scope:** complete tile coverage for the initial two selected title rule sets.
The entire research family is surveyed, but its full tile inventory need not be
imported before game logic can start. The tile library remains modules inside the
existing logic/UI family packages unless package separation later earns its cost.

**Depends on:** T1–T2. **Milestone:** a reusable tile model, catalog, renderer, and
two verified title tile sets before the first financial slice.

## M1. Build the lasting map scene and boardless presentation

**Implemented:** complete TOP/1889 semantic maps, shared scene/inspection, prepared
overlays, and existing `ScalingWrapper` composition. See the
[M1 design and verification note](../../libs/18xx/maps.md).

**Outcome:** render and inspect both complete semantic maps generically, using
the shared tile renderer, independent of a physical-board image.

**Shared work:** map definitions with stable hex/location identities, initial
track/stops, terrain/borders, labels, revenues, and persistent map-owned facts;
map placement based on Common coordinates and geometry; shared tile, token,
annotation, selection, and route-overlay layers. Compose the map inside the existing
`ScalingWrapper` from `@tabletop/frontend-components` for fitting, panning, zooming,
and optional focus via `focusRect`. The wrapper owns viewport transforms; the map
owns hex geometry and map-object inspection. Keep tiles and overlays in the same
transformed content, and account for that transform when converting pointer positions.
Use a temporary surrounding control panel if convenient.

**Family review:** survey the full researched map/network profiles, including
flat/pointy layouts, coordinate conventions, irregular map extents, special
offboards, partitions/borders, multiple path types, and persistent resource
markers. Consult the reference generic renderer for presentation evidence without
copying its complete UI or letting its source-specific vocabulary define our model.
Title-specific annotations can compose with the common map scene. [R-C; E-T; R-M]

**Acceptance:** compare the generated maps against title definitions and available
rulebook figures; all rule-relevant printed information is accessible. Test tile
and station placement at map edges and across zoom levels, along with selectable
internal paths/city slots. The same model identity selects the same logical object
through drawing, hit testing, and inspection. Viewport changes never alter logical
hex adjacency or tile rotation. Token/route examples can be prepared fixtures until
their live rules arrive in the numbered slices.

**Depends on:** T3. **Milestone:** lasting generic map rendering for both titles.

## M2. Add physical-board presentation and independent view selection

**Deferred:** matching board artwork is not currently available. Continue with
numbered slice 1 using the boardless presentation; return to M2 when the artwork
is available.

**Outcome:** show the same position on title board artwork, with current tiles
overlaid in their correct locations, and switch between this and boardless mode.

**Shared work:** compose a title artwork layer with M1's tiles, semantic overlays,
and interaction behavior. Each title supplies an artwork asset matching the chosen
map edition and an explicit alignment from model locations into that artwork's
coordinate space. Start with the simplest verified alignment; add per-location
layout data only when an actual board requires it. Both forward placement and
inverse pointer conversion use that same mapping.

Distinguish unchanged printed board content from replacement tile faces and live
overlays. A laid tile must cover the obsolete printed content appropriately;
tokens, route highlights, and state-dependent labels remain derived from the live
model. Avoid duplicate labels/track where artwork already shows the unchanged
content. Generic mode supplies its own equivalent base drawing from the semantic
map, while sharing the live overlay implementation.

**Acceptance:** inspect alignment at distant map corners, on noncentral city
slots, and across zoom levels. Selecting a hex/path/slot acts on the same model
object in either mode. Switch modes with a selected tile preview or route fixture:
preserve its semantic selection and focal map location, reproject overlays, and
revalidate any interaction geometry. Neither switching nor saving the local
preference creates a gameplay Action or alters canonical state. Two simultaneous
clients may select different modes. Repeat these cases with live history and
Action Drafts in slices 6–10 and 20.

**Preference scope:** design for individual viewing choice; decide the default,
persistence scope, and final control placement with the full UI design. A title
advertises physical presentation only when its matching artwork/alignment is
available. Identify missing artwork or edition mismatches concretely; a placeholder
image is insufficient to accept a title's physical-board rendering.

**Depends on:** M1 and matching title artwork. **Milestone:** two lasting map
presentations sharing rules, tiles, overlays, and interaction semantics. This
does not require a second game-state schema, tile catalog, or railway graph.

## 1. Inspect the same economic concepts in both titles

**Implemented:** shared financial fields and queries, strict example Game State
hydration, both title definitions and local Game Session inspection screens. See the
[finance design and verification note](../../libs/18xx/finance.md).

**Outcome:** load a prepared example for each title and inspect its players,
companies, cash, certificates, and control relationships in a small local Game
Client harness.

**Shared work:** JSON schemas and hydrated models for the holdings actually needed
now; stable identities; identifiable certificates with shares separate
from certificate-limit contribution; cash, portfolios, and treasuries; a strict example Game
State and round-trip hydration. Add player portfolios and company
summaries in the prototype harness. Establish title `GameDefinition`/`GameUiDefinition`
composition and the existing Game Session path as needed for this harness.

**Paired evidence:** ordinary president/10% certificates for 1889; TOP fixtures
also include Union Bank-owned certificates and five numbered PEIR shares. A
person's own portfolio and Union Bank's portfolio remain separate; PEIR entitlement
is based on outstanding shares rather than an assumed fixed 10% unit. [S §§1, 7;
T §§3, 6.3, 7.7, 11.3]

**Acceptance:** JSON hydration preserves identities and quantities; a 20%
president certificate counts as one physical certificate and two shares; changing
player colors/order does not change ownership. The inspector
shows why Union Bank can own a certificate while a human decides for it.

**Depends on:** existing scaffolds. **Limit:** prepared examples, no invented
generic transfer button or claimed complete initialization.

## 2. Buy an existing share and settle its actual cost

**Implemented:** shared purchase evaluation, payment settlement, BuyShares Action,
stock-purchase handler, and Game Session selection/confirmation with payment
history and Undo. Both title examples offer one prepared active turn. TOP includes
Bank and treasury sources and Union Bank's treasury-first contribution; 1889
uses IPO par and Market prices. Engine tests cover settlement, rejection, hydration,
Undo, and processed replay; browser tests cover desktop/mobile interaction.

**Current boundary:** three-player examples, ordinary market spaces, floated
companies, and purchases that retain the incumbent president. Colored-market
exceptions and presidency changes arrive with slice 3; flotation with slice 4;
full stock-round progression with slice 5. The title rules supply permitted buyers,
purchase sources/prices, payers/recipients, and limits; shared code settles the
result without game imports. Broader-family corporate buyers, certificate sizes,
and capitalization recipients informed that boundary without adding unexercised
short-sale, escrow, or multi-buy machinery.

**Outcome:** execute a stock purchase through the Game Session in both title examples.

**Shared work:** purchase eligibility, cash settlement and ownership transfer;
candidate `BuyShares` Action; stock-purchase handler; result metadata for a clear
history entry; share selection, payer/recipient preview, and confirmation UI.
Introduce the minimum stock-turn facts needed to enforce a purchase now.

**Paired evidence:** 1889 distinguishes Initial Offering purchases at par from
Open Market purchases at market price. TOP prices purchases at current market
value and sends proceeds to the bank or selling corporation's treasury. Include
a TOP purchase for Union Bank: its cash is used first, then its owner's permitted
contribution, with the certificate owned by Union Bank. [S §7.2; T §§6.5, 6.8]

**Acceptance:** exact debit/credit and certificate recipient; unaffordable and
ineligible purchases rejected; no purchase of a reserved or unavailable
certificate; correct human authorization. Undo and processed-action replay restore
and reproduce the same result. Use purchases that do not yet trigger flotation
or presidency changes; those branches become available with slices 3–4.

**Depends on:** 1.

## 3. Sell shares, move market markers, and transfer presidency

**Implemented:** shared market spaces/stacks, sale evaluation and settlement,
presidency exchange on purchases and sales, effective stock limits, SellShares,
and FinishStockTurn. Both examples now exercise one prepared stock turn, including
permitted sales around a purchase, ordered sale blocks, previews, market rendering,
portfolio counts, saved history, and Undo. See the
[slice design and family review](stock-trading-slice-design.md).

**Outcome:** an investment decision changes cash, market position, and who controls
a corporation, visibly and consistently.

**Shared work:** market cells and ordered marker stacks; sale settlement and
certificate exchanges; ownership/certificate-limit calculations; candidate
`SellShares` Action; stock decision UI with selected quantity, proceeds, and
resulting presidency/market position. Keep eligibility separate from settlement.

**Paired evidence:** 1889 moves down per share sold; TOP moves down for the sale
and limits ordinary sales to 30% of a company per stock turn. TOP permits Union
Bank as president but does not give it ordinary player turn order. Preserve
1889's colored-market exceptions and its first-SR sale prohibition; TOP instead
requires the company to have operated. [S §§3, 7.3, 7.5–7.6; T §§6.3–6.6, 10]

**Acceptance:** tied holdings retain the existing president where prescribed;
exchanging two 10% certificates for the presidency preserves economic holdings;
market limits and illegal presidency dumping prevent a sale; same-priced market
cells and marker ordering remain distinct. TOP multi-company sales preserve any
required choice of marker order. Both buy and sell now exercise control changes.

**Depends on:** 2.

## 4. Start and float a corporation, including PEIR consequences

**Implemented:** shared StartCompany and automatic FloatCompany actions, distinct
company milestones, title-owned eligibility and capitalization, station/reservation
models, TOP tranche and phase restrictions, Union Bank starts, and PEIR exchanges
and closure for the currently modeled assets. Three example positions provide
staged price selection, flotation previews, saved results, and Undo. Train disposal
joins PEIR closure with the train model. See the
[slice design and family review](company-formation-slice-design.md).

**Outcome:** buy a presidency, fund a corporation, and see its operating rights
and ownership change when its flotation condition is met.

**Shared work:** distinct started/funded/floated/operated facts; candidate
`StartCorporation` Action; title-supplied start eligibility and capitalization;
automatic flotation consequences through runtime processing. Add a start-price
picker and an explicit capitalization/ownership result view.

**Paired evidence:** 1889's 50% flotation threshold and ten-times-par grant; TOP's
ordinary 60% threshold, tranche eligibility, reserved shares, and already-floated
Mainline. For TOP, ordinary flotation also exchanges the associated PEIR right,
replaces its station, updates PEIR control, and eventually closes PEIR. Model
location/station rights now, even before the full board renderer. [S §7.4;
T §§3, 6.7, 7.7]

**Acceptance:** capitalization occurs once; an un-floated company cannot operate;
PEIR exchange can change certificate/control counts without an ordinary purchase;
the last right's removal disposes of PEIR assets correctly. A prepared funded
branch fixture can float without receiving ordinary capitalization again; its
actual creation comes in slice 17.

**Depends on:** 3.

## 5. Complete a stock round and establish the next operating set

**Implemented:** shared turn advancement, pass tracking, title-owned next player
order, round completion and sold-out movement, and a separate operating-set start.
TOP preserves pass order and Union Bank usage; 1889 resets consecutive passes after
transactions. The desktop prototype shows round status and operating order, restores
saved completion, and undoes the final pass with its automatic consequences. See
[design and family review](stock-round-slice-design.md).

**Outcome:** each title plays a stock round from its prepared starting position to
an explicit operating-set start.

**Shared work:** per-turn purchases/sales, per-round sale history, pass/completion
facts, priority ordering, and current decision authority. Candidate stock `Pass`
or finish-turn behavior uses title-owned completion rules. Add turn/round status
and next-player controls that expose legal decisions from logic.

**Paired evidence:** 1889's priority-deal and sell-then-buy or buy-then-sell
procedure, which prohibits sell/buy/sell; TOP's
sell-before-buy budget, pass-order cards, and once-per-SR Union Bank action.
Ending a turn after a purchase is not the same as passing toward round completion.
Apply sold-out market movement and snapshot the operating-set length at the
prescribed time. [S §§6–7; T §§6.1–6.2, 6.8–6.9, 7.1]

**Acceptance:** passing players can re-enter when allowed; transactions invalidate
the appropriate pass status; Union Bank never gains a separate human stock turn;
round completion occurs once and yields the correct next order. Later private
exchanges and splits must integrate into these same budgets and pass semantics.

**Depends on:** 4. **Milestone:** meaningful financial play for both titles.

## 6. Connect live game state to the lasting map renderer

**Status:** implemented for boardless presentation. Both title sessions now render
serialized placements, current stations/reservations, and physical inventory;
inspection and per-player style stay local. History, Live, Undo, and reload use
the existing session lifecycle. Physical presentation remains deferred pending
artwork. See [design and verification](live-map-slice-design.md).

**Outcome:** view and inspect both maps and their available tile inventories.

**Shared work:** connect Game Session state to the T1–T3 and M1–M2 tile/map library.
Drive existing layers with live placements, corporations/stations, and authoritative
history state. Keep the semantic map and live overlays common to physical-board
and boardless presentations. The surrounding game panels remain prototypes; map
rendering, navigation, and object-selection geometry are lasting modules.

**Paired evidence:** each title supplies its map and tile manifest; use complex
city and labeled upgrade examples from both. TOP's shipyard has routing meaning
without station capacity. 1889's offboard values can depend on the train as well
as the phase. [S §§4, 8.5.3, 16; T §§9, 12–13; C]

**Acceptance:** compare map adjacency, printed track, station spots and special
locations against source data and rulebook figures; verify rotations join the
intended edges. Changing a tile face does not silently invent physical inventory.
Connected neighboring hexes with mismatched track ends are not a railway path.
Mode changes preserve the selected map object and cause no Game State/history
change. History navigation redraws the correct position in either presentation;
each player's display choice remains independent.

**Depends on:** M1, 1 and available M2 presentation; consume station/market facts
from 4 when available. Physical mode's live acceptance requires its title artwork.

## 7. Lay and upgrade track legally

**Status:** implemented for ordinary TOP and 1889 construction. Shared evaluation,
Actions, track-step state, and map preview/selection cover costs, preservation,
finite/paired inventory, reservations, Back/Undo and history. The first operating
company finishes track and continues into the station placement added in slice 8. Explicit
private-power decision flows remain in 13–14. See the
[construction design and evidence](track-construction-slice-design.md).

**Outcome:** select a hex, tile, and rotation; preview cost/connectivity; commit a
legal lay or upgrade through a candidate `LayTile` Action.

**Shared work:** connected construction, upgrade path preservation, inventory
exchange, terrain payment, and lay allowance accounting. Add tile preview,
rotation, legal-target emphasis, and staged Back/Undo behavior.

**Paired evidence:** 1889's ordinary one lay/upgrade versus TOP's optional second
yellow lay for $20 or one upgrade. Include labels, borders, blocked construction,
existing station/reservation preservation, and TOP's special upgrade chains.
Private powers that modify these rules arrive in 13–14. [S §8.3; T §§7.2, 12]

**Acceptance:** enforce the title's construction access rule, including 1889's
home-hex exception; a connected upgrade must add reachable track or improve city
value. Reject lost existing track, illegal labels/colors, exhausted tiles, and
insufficient treasury funds. Back changes the
draft; Undo reverses the committed tile/inventory/payment result. Document shared
preview/highlight ownership when it crosses UI layers.

**Depends on:** 6 and the financial settlement work in 2.

## 8. Place stations and enforce network access

Implemented for the first operating company's ordinary station step in TOP and
1889, with automatic 1889 homes before construction. The example stops after
station placement. See [design and evidence](station-placement-slice-design.md).

**Outcome:** place a station and observe the change in route access and blocking.

**Shared work:** `PlaceStation` Action; station supply, reserved capacity,
cost and connection legality; graph access queries scoped to a company. Add
station selection and access/blocking visualization.

**Paired evidence:** 1889 places all newly floated corporations' free homes at OR
start before any corporation operates, with ordinary extra placement costing ¥40;
TOP's ordinary $80 placement, existing PEIR stations, and replacement on associated
company flotation. PEIR cannot place extra stations. [S §§7.4, 8.4–8.5;
T §§6.7.5, 7.3, 7.7]

**Acceptance:** no duplicate company token in a hex; reserved homes remain
placeable; a blocked city can be a route endpoint but not traversed by an
unentitled corporation. Re-run the slice 4 PEIR transition against the rendered
map and ensure graph queries see the new station owner after replay/undo.

**Depends on:** 4, 7.

## 9. Buy a train from the depot

Implemented for same-phase depot purchases in prepared TOP and 1889 positions.
Normal operating progression waits for routes and dividends; phase-triggering
purchases remain blocked until slice 12. See [design and evidence](train-purchase-slice-design.md).

**Outcome:** purchase an available train with corporation cash, view it in the
roster, and reproduce the transaction through history.

**Shared work:** train definitions/instances, ownership, depot supply, availability,
purchase pricing and capacity restrictions; candidate `BuyTrain` Action;
train-purchase handler, depot display, and corporation roster.

**Paired evidence:** 1889 numbered trains versus TOP's H and later train types.
Represent the distance rule rather than assuming every train has one integer
range. Include TOP's PEIR one-depot-purchase-per-OR constraint. [S §8.7;
T §§7.6–7.7, 13]

**Acceptance:** correct money/supply/ownership, no duplicate purchase, no illegal
train-limit overshoot, and deterministic identities for unlimited supply. Start
with same-phase prepared purchases. Phase-triggering purchases are not declared
supported until their full consequences are implemented in 12; negotiated and
emergency purchases follow in 14–15.

**Depends on:** 2, 5, 8.

## 10. Submit routes and calculate an operating result

Implemented for TOP and 1889 with shared path traversal, whole-set validation,
authoritative revenue, RunTrains, and a staged prototype route editor. See
[design and evidence](route-running-slice-design.md). Payout follows in slice 11;
client-only auto-routing remains in slice 18.

**Outcome:** select routes for a corporation's trains, validate the whole submitted
set, and display an itemized revenue result through a candidate `RunTrains` Action.

**Shared work:** railway path traversal, route-set legality, visits and revenue-center payments, per-train distance policies, and revenue calculation. Add a route editor,
train assignment, shared-track conflict feedback, and per-train totals. Revenue
is calculated by authoritative logic from chosen paths, not trusted client totals.

**Paired evidence:** 1889's revenue-center counts, no skipped centers, shared-track prohibition,
and diesel-specific offboard values; TOP's boundary-counting H trains, + trains
with trailing towns, 7 and diesel rules. Enforce whole-set track usage rather than
validating each train independently. [S §8.5; T §§7.4, 13]

**Acceptance:** known route examples produce exact totals; disconnected routes,
illegal repeated stops/edges, missing station access, and excessive distance are
rejected. Topology queries handle internal paths rather than just hex adjacency.
The same evaluator serves previews and committed Actions.

**Depends on:** 7–9. **Limit:** this proves legal routes and revenue, not maximum
revenue. Benchmark candidate enumeration on a late TOP position now to expose the
performance risk for slice 18 while the route interface is still easy to revise.

## 11. Distribute earnings and complete ordinary operating rounds

**Status:** implemented for both prepared titles. Shared earnings evaluation and
settlement, private income, operating progress, train-ownership requirements,
and stock-round restart are wired through the runtime and prototype controls.
King's Mail uses the supplied rulebook's $60 baseline. The Operating rounds
example exercises full sets; phase changes and emergency funding remain later
slices. See [design and evidence](earnings-operating-rounds-slice-design.md).

**Outcome:** operate successive corporations, pay or retain earnings, and return
to the next OR or SR in prepared scenarios.

**Shared work:** candidate `DistributeEarnings` Action; income settlement and
market movement; private income at OR entry; operation progress, operator order,
has-operated facts, and per-operation allowances. Add payout previews, recipient
breakdowns, and a usable operating-step strip.

**Paired evidence:** 1889 Initial Offering shares receive no payout while Open
Market shares pay the corporation. TOP bank/treasury shares pay the corporation;
PEIR has withholding/full/half pay, changing entitlement counts, and prescribed
rounding. Include TOP's market-ceiling bonus, PEIR-last order, and King’s Mail
income once its baseline is resolved. [S §§8.1–8.2, 8.6, 8.9;
T §§7.1, 7.5, 7.7–7.8, 10.2]

**Acceptance:** pay correct recipients and exact rounded amounts. For TOP's
three-right PEIR, $100 full payout gives $34 per right; the bank funds the rounding
effect. A started but un-floated corporation does not move for no dividends;
an 1889 floated corporation operating without trains does move left. Private income
and operator completion happen once even when a handler is re-entered.

**Depends on:** 5, 9–10. **Milestone:** ordinary ORs through the UI for both games,
within prepared scenarios that avoid unsupported special events and obligations.

## 12. Advance phases, rust trains, and interrupt operations

**Status:** implemented for both prepared titles. Purchases advance phases through
recorded System Actions; excess-train decisions preserve and resume the operator.
TOP final-operation rusting, 1889 Market returns and diesel exchanges, and
history/reload/Undo are wired through the runtime and prototype controls.
Phase-triggered private effects remain in slices 13–14 and endings in slice 19.
See [design and evidence](phase-changes-slice-design.md).

**Outcome:** a train purchase changes the rules immediately, may require another
president to discard, and then resumes the interrupted decision correctly.

**Shared work:** event occurrence history, phase effects, train rusting,
pending obligations and saved continuation. Candidate `DiscardTrain` and automatic
event Actions; explicit decision-owner UI and an explanation of what resumes.
Use the existing engine's System Action lifecycle, not a second event engine.

**Paired evidence:** changed colors/limits and rusting in both titles; 1889
diesel availability/trade-in conditions; TOP's changing start-price permissions
and 4+ guarantee of one operation after diesel if it has never run. Event effects
are immediate, but the current OR-set length stays fixed. [S §§8.7, 9;
T §§6.7.2, 7.1, 7.6, 13–14]

**Acceptance:** all affected companies resolve obligations in legal order; the
original operator is retained even when another player decides. TOP's eligible
4+ cannot be traded and rusts after its permitted run. Serialize in the middle of
a pending discard, reload, and resume. Flattened replay applies each processed
System Action once; undo restores the prior phase and train roster.
In 1889, reject an ordinary purchase at the train limit even if it would rust
owned trains; exercise the permitted diesel-exchange exception separately.

**Depends on:** 9–11. All phase-triggered private events integrate through this
mechanism in slices 13–14 before the full game is considered complete.

## 13. Exchange private rights and apply their lifecycle

**Status:** implemented for both prepared titles: private exchanges, reserved shares,
phase closures and income changes, concession closures, out-of-turn Dôgo decisions,
presidency/flotation, pass history, and prototype controls. Four-player examples
include Ice Boats and Uno-Takamatsu. Power execution, consent, and construction
supply cleanup are covered by slice 14. See [design and evidence](private-lifecycle-slice-design.md).

**Outcome:** exchange an owned private for a share, exercise its precise turn
permissions, and close/expire rights through phase events.

**Shared work:** ownership/timing/usage facts for the concrete powers present;
candidate `ExchangePrivate` Action; ownership transfer, reserved interests, and
automatic closure/exchange results. Add actionable private cards and clear expired
or consumed states. Introduce specific shared power families only when useful.

**Paired evidence:** 1889 Dougo's Iyo exchange and Uno-Takamatsu's phase-dependent
survival/income; TOP's reserved Shortline exchanges, Ice Boats, and phase-forced
exchanges versus closure without exchange. A TOP extra exchange can invalidate
an earlier pass without consuming the ordinary purchase action. [S §15;
T §§6.2, 6.5, 11.3, 14]

**Acceptance:** reserved shares cannot be bought normally; exchange rights and
limit exceptions apply only to their entitled owner; closure occurs once. Verify
that every phase reaches a complete state after the relevant closure/exchange
cascade and that stock-round pass history remains correct.

**Depends on:** 4–5, 12.

## 14. Negotiate transfers and resolve interrupting powers

**Status:** implemented for both prepared titles: negotiated train/private purchases,
owner consent, same-player settlement, Ehime's seller lay, Mitsubishi's stock and
operating windows, Sumitomo terrain relief, Hunslet's early purchase through phase
and discard effects, and TOP construction entitlement/bridge permission. Prototype
positions are Negotiated purchases and Private powers. See
[design and evidence](negotiated-transfers-slice-design.md).

**Outcome:** complete an agreed asset purchase and any resulting decision by its
seller or another player, then resume normal operation.

**Shared work:** candidate train/private purchase offer, acceptance, and rejection
Actions where two owners must agree; authoritative permitted prices and ownership;
pending response state and saved continuation. Reuse track/train Actions with
explicit power permissions. Add an offer/response view and power-specific drafts.

**Paired evidence:** 1889 corporation/private purchases, Ehime seller's optional
immediate lay, Mitsubishi Ferry timing, and Sumitomo terrain relief; TOP Hunslet
transfer/early train purchase, construction tile entitlement, and Vernon River
Bridge permission. Also complete normal inter-corporation train purchases for
both. Consent must be attributable to the entitled human. [S §§8.7–8.8, 15;
T §§7.1.1, 7.6–7.7, 11.3, 12.2]

**Acceptance:** an unrelated player cannot accept another owner's sale or give
their construction permission. Ehime's seller acts even when not the current
operator; Hunslet can trigger phase/discard effects before routes, then return
to the correct step. Revalidate an offer if its price/asset availability changes.
Unused powers expire correctly. Same-controller transactions need only the
appropriate explicit confirmation, without an artificial second human turn.

**Depends on:** 7, 9, 12–13. Can be implemented as transfer consent first and the
two title-specific power integrations next, sharing the same response mechanism.

## 15. Resolve compulsory train funding and bankruptcy

**Status:** implemented for TOP and Shikoku 1889. See the
[funding design and evidence](train-funding-slice-design.md).

**Outcome:** an operator lacking a required train must satisfy the actual funding
procedure or reach bankruptcy; optional actions cannot bypass the obligation.

**Shared work:** legal liquidity evaluation, ordered contributions, forced sale
choices, candidate contribution/forced-sale Actions, bankruptcy transition, and
an emergency-finance UI showing remaining cost and allowed sources.

**Paired evidence:** 1889 president support and restrictions on emergency sales
and train sources. TOP first uses company treasury cash and required treasury
issuance, then the liable president; Union Bank control introduces its balance
sheet before the human owner's. PEIR is exempt from compulsory train ownership.
Normal stock-sale restrictions and forced issuance are not interchangeable.
[S §§8.7, 10.1; T §§7.6.3–7.6.4, 7.7, 11.3]

**Acceptance:** every balance sheet contributes at most once; no double-counted
corporate cash or issuance in Union Bank buying power. Enforce legal sale amounts,
ownership restrictions, and exact shortfall contributions. Bankruptcy is
immediate when required funding is impossible; scoring is completed in 19.

**Depends on:** 3, 9–14.

## 16A. Play the complete 1889 opening auction

**Status:** implemented for the 2–6 player Standard Game using the shared
reserved-bid waterfall procedure.

**Outcome:** initialize the Standard Game for supported player counts, auction all
privates, and reach the real first SR.

**Shared work:** reusable bid commitments, affordability, award/settlement and
auction UI where semantics match existing Common mechanisms. The shared reserved-bid
waterfall procedure owns reservation bids, ordered lots, restricted-participant
auctions, cascaded awards, discount/income behavior, and priority-deal continuation.
1889 supplies setup, lots, and rule choices. Shared purchase/reserve-bid/raise/pass
Actions and explicit auction substates. See the
[implementation design](opening-auction-slice-design.md).

**Acceptance:** multiple outstanding bids reserve the correct funds; a pending
auction survives reload; multiple automatic awards resume the proper outer
auction turn; all-pass behavior follows the chosen rule baseline. Resolve the
PDF/source bidder-order difference before implementing that handler. These are
public bids restricted to eligible participants, not hidden sealed bids. [S §§2,
5; E-S]

**Depends on:** 1–5, 13. This can move earlier if playing from setup becomes the
priority; the financial scenarios do not depend on it.

## 16B. Play the complete TOP opening auction

**Status:** implemented for three and four players. The unresolved zero-income
forced-purchase edge case is preserved with Undo; see the
[design and rule evidence](top-opening-auction-slice-design.md).

**Outcome:** perform seeded role/offer setup and the actual TOP auction for three
and four players, then reach the proper first SR.

**Title work using shared models:** Mainline/Shortline assignment, five retained
PEIR shares, starting stations, Union Bank assets, public offer piles, and
concession awards. Auctioneer, two eligible bidders, and forced purchaser remain
distinct. Implement fallback richest-player purchase and repeated private payouts
when nobody can afford the mandatory purchase. Add offer-pile and forced-buyer UI.

**Acceptance:** deterministic setup; no asset duplication in concessions;
first-bidder re-entry follows TOP rules; forced-purchase ties use the right order;
the first SR order follows remaining cash. Integrate special award/flotation
effects rather than bypassing the normal shared holdings and control behavior.
Resolve disputed setup/auction values in slice 0 before this initializer is final.
[T §§3, 5, 11.3; R-T]

**Depends on:** 4–5, 8, 11, 13. Share settlement and displays with 16A, while retaining
the two different auction procedures.

## 17A. Preview a TOP branch split with exact entitlement arithmetic

**Status:** implemented as a local draft and pure calculation. See the
[design and verification](branch-split-preview-slice-design.md).

**Outcome:** select an eligible parent/branch and inspect the financial effects of
a proposed split without changing Game State.

**Shared work:** reuse holdings, cash, station, and train models; extract repeated
certificate-exchange/asset-allocation calculations only where useful. TOP owns
split eligibility, exchange arithmetic, branch funding, and constraints. Add a
parent/child ownership and asset preview.

**Acceptance:** check floated parent, presidency, holding threshold, placed
stations, available branch, and tranche capacity. Reproduce TOP's worked example,
including rounding each holder's exchanged units, preserving reserved shares,
putting exchanged parent shares in its treasury, and giving the child its president
certificate. Child funding and child flotation stay separate. [T §6.7.4]

**Depends on:** 4, 8–9, 13–14. 1889 remains a regression consumer of shared
calculations; it gains no split fields, Actions, or states.

## 17B. Commit a split and resume the stock procedure

**Status:** implemented with a complete manual allocation and one canonical split
Action. See the [design and verification](branch-split-commit-slice-design.md).

**Outcome:** allocate parent/child stations, cash, trains, and Hunslet; commit the
split and continue the interrupted stock turn legally.

**Title procedure:** use the preview's authoritative calculations and explicit
candidate split/allocation Actions. Decide which selections can remain an Action
Draft and which must become serialized decisions based on the actual rules and
multi-client interaction. Never store an unfinished authoritative reorganization
only in UI state. The preview and commit must have the same validation.

**Acceptance:** parent's protected home remains; child receives at least one
station; replaced parent pieces are removed correctly; assets are not copied;
branch grant occurs once; late flotation does not grant it again. Handle train
limits, control recalculation, and follow-up obligations. Undo/reload at every
committed decision preserves a legal resumable state. [T §6.7.4; R-T]

**Depends on:** 17A, 12, 15. This is a TOP procedure composed from shared modules,
not a reason to introduce a universal reorganization framework.

## 18. Suggest routes with a client-side optimizer

**Status:** deferred as a client UI optimization. It is not a prerequisite for
game endings, final valuation, or complete-game logic verification. Players continue
to select routes manually through the existing route editor and `RunTrains` Action.

**Outcome:** a client-only helper proposes a best legal fleet route set for the
route editor. TOP's maximum-revenue rule guides its suggestions; 1889 can use
optional route suggestions. Automatic search is never part of authoritative
Action processing. [T §7.4]

**Shared client work:** candidate enumeration and joint route-set optimization,
reusing the deterministic path legality/revenue evaluator from slice 10. Include
previews, cancellation and visible calculation progress. Search executes in the
client, using workers where needed. The player confirms the chosen paths through
RunTrains; shared game logic validates those paths and calculates their revenue.
It does not search for a better set or certify that submitted revenue is maximal.

**Acceptance:** exhaustive small-map comparison proves optimizer correctness;
examples show why independently selecting each train's best route can be wrong.
Exercise TOP H/+ trains, shared-track conflicts and late-game/diesel positions with
measured performance. Cache keys account for topology, stations, trains, phase
values and powers. A timeout or heuristic suggestion must not be represented as
a proven maximum. Cancel/restart search when relevant state changes; a suggestion
is local draft state until the player confirms it.

**Depends on:** 10, 12, 14; accepts split-created positions after 17.

## 19. End games at the correct time and calculate final wealth

**Status:** implemented. See the [design and verification](game-ending-slice-design.md).

**Outcome:** both titles stop on the correct decision boundary, reject subsequent
Actions, and display an auditable final valuation.

**Shared work:** identified end triggers, deferred terminal scheduling, final
wealth calculation from actual holdings, and final-result UI. Runtime terminal
states expose no actions; do not equate end triggered with game already ended.

**Paired evidence:** 1889 bank breaking changes the bank to unlimited and ends at
the specified SR/OR-set boundary; TOP starts with an unlimited bank and uses its
diesel ending schedule. Both end immediately on bankruptcy. TOP includes remaining
PEIR shares and Union Bank net worth; neither ruleset automatically excludes a
bankrupt player from winning. [S §10; T §8]

**Acceptance:** trigger bank break during an SR and during an OR; continue all
prescribed payments and rounds. For the proposed detailed TOP §8.2 baseline,
finish the diesel's OR set, a final SR, and three final ORs, subject to resolving
the documented conflicting summary. Value every asset once, including Union Bank
holdings through its owner, and reproduce totals after replay.

**Depends on:** 11–17. **Milestone:** both complete rule flows exist.

## 20. Verify complete game logic through prototype clients

**Outcome:** both titles run from real initialization through final scoring, with
their shared modules exercised in ordinary and difficult positions.

**Logic verification:** seeded games and curated rule examples covering every
supported player count; all Actions/states registered; illegal Actions rejected;
round-trip persistence; deterministic System Action cascades; processed history,
Undo, and terminal behavior. Adapt the reference source's fixtures as evidence or
differential scenarios only after mapping their semantics to our runtime and
chosen rule baseline. Source fixture presence is not proof it passes.

**Prototype verification:** actual local Game Session flows for each slice, then hosted
multi-client sessions for seller consent, cross-player interruptions, reconnects,
and authoritative reconciliation. Verify usable test controls, route editing, and
draft Back/Undo behavior. These checks establish working logic and integration;
production desktop/mobile usability is accepted in U1–U2. Add animation only
under the repository animation skill and established visual contracts.

**Distribution verification:** complete title registration and Logic/UI Artifact
builds, then verify them through local hosting. Keep the existing host bridge
contract. A shared rule change must be bundled into matching logic and UI for each
title adopting it; updating a shared source package alone does not update deployed
games. Publishing publicly is a separate release action. [D]

**Acceptance:** finish at least a normal ending and a bankruptcy scenario for each
title; replay agrees with authoritative final state; reconnect during an obligation
resumes the correct player's decision. Maintain a coverage matrix for private
powers, phase events, unusual stock restrictions, TOP splits/PEIR lifecycle, and
the selected rules-baseline exceptions. Do not label a title complete with an
unimplemented required power or unresolved rule-critical shortcut.

**Depends on:** T1–T3, M1–M2, and numbered slices 1–17 and 19. Slice 18 remains
optional client work. Acceptance for both map modes
requires matching artwork; record any unavailable physical mode explicitly.
Beginner variants and broader
18xx-family mechanisms can follow as their own work. The complete logic can be
used through the prototype UI while the final game clients are designed.

## U1. Design the desktop and mobile game experience

**Outcome:** review task-based desktop and phone prototypes that account for the
whole game's information density, using the lasting tile/map renderers and realistic
positions from both titles.

**Work:** decide which information stays visible, what opens on demand, and how
players move between map, portfolios, stock market, corporation operations, and
pending responses. Compare alternative layouts and navigation before choosing.
Evaluate physical-board and boardless views on desktop and phone, including the
presentation preference control and its persistence scope. The choice of default
should follow those evaluations; either mode must support the complete workflow.
Exercise stock comparisons, selecting/rotating tiles, building multi-train routes,
an out-of-turn seller response, emergency funding, and TOP split allocation.
Include phone landscape/portrait and large late-game positions; a phone must
support the whole workflow, not merely shrink every desktop panel.

**Acceptance:** concrete designs demonstrate those tasks without losing the
current actor, intended action, or relevant economic/map context. Tile labels,
station slots, and track remain readable at the actual viewing scale, with an
appropriate inspection view where needed. Record design decisions before turning
them into shared layout contracts; retain only prototype modules that earn reuse.

**Depends on:** M1–M2 and representative stock/operating scenarios, normally after 11. Later procedures can initially use realistic fixtures and must be validated
again when implemented. This can proceed while later logic slices are developed.

## U2. Implement and verify the chosen game clients

**Outcome:** replace prototype screens with the reviewed desktop/mobile experience,
using existing game logic, Game Session behavior, and shared tile/map rendering.

**Work:** implement title layouts and the visual modules whose shared use is now
demonstrated. Preserve the rules/authorization/draft/history semantics proven by
the logic slices. Establish visual contracts for coordinated interaction and
follow the animation skill where motion is introduced.

**Acceptance:** play the U1 tasks and complete-game scenarios in both titles with
mouse, keyboard, and touch; test real small viewports, long asset lists, complex
tile selection, fleet route editing, and interrupted turns. Reconnect, History
View, Back, and Undo behave correctly after the layout replacement. Artifact and
host compatibility remain intact. Readability and useful access to information
are evaluated separately from successful rule execution.

**Depends on:** reviewed U1 designs and implemented logic for each migrated flow;
final complete-client acceptance also requires slice 20.

## Definition of done for an implementation slice

1. The family-wide design note accounts for every asset designed or materially
   changed in this slice, following the standing 18xx rule. Its relevant research
   variations shape both logical and visual interfaces, with intentional limits
   explicit.
2. Both title scenarios exercise the shared interface, or a title-only procedure
   demonstrates reuse and the other title passes relevant regression cases.
3. New serialized facts have schemas and deliberate hydration. Every new Action
   is registered; each Machine State has a handler; player authorization is checked
   against the current decision, including controlled entities and interruptions.
4. Legality, application, and automatic consequences agree. Rule-driven commits
   use the Game Runtime and System Actions; a Svelte effect never commits a turn.
5. Focused rule examples check outcomes and rejected choices through the same
   interface callers use. Every new Action path gets appropriate Undo/replay
   coverage; every resumable obligation gets a save/reload case.
6. The slice has a usable prototype demonstration, without implying final game
   layout acceptance. T1–T3 and M1–M2 additionally establish lasting tile/map models
   and rendering, including physical-board and boardless presentation equivalence;
   U1–U2 accept the full desktop/mobile experience. Components call Game Session
   methods; manual and automatic draft selections obey the existing Back/Undo
   rules. Shared highlights and transient UI state have a visual contract when
   required. Presentation derives from authoritative rule results.
7. Relevant package builds/checks and behavioral tests pass. Remaining unsupported
   branches are explicit in the development scenario and issue; they are not
   silently treated as legal full-game behavior.

## Sources and evidence limits

- **S:** supplied [Shikoku 1889 rulebook](</workspace/Shikoku 1889 Rulebook.pdf>),
  32 PDF pages. SHA-256 `cb8a11af8adb0467571e24c6d828279b8ac290a950bd1ac60e04afa3ca2ba7a2`.
  Section references above refer to that edition.
- **T:** supplied [TOP prototype rulebook](/workspace/research/18xx-2026-09-08/reference/TOP71_RULES_PROTOTYPE.pdf),
  25 PDF pages. SHA-256 `d01911344da66f217bad7e7ca66dfe2acec658b0d17dacb54da67c10e2112f61`.
- **R:** [family mechanism study](/workspace/research/18xx-2026-09-08/18xx-domain-model-study.md)
  and [shared source study](/workspace/research/18xx-2026-09-08/18xx-shared-engine-design.md),
  especially their reuse distinctions and explicit limits.
- **R-T:** [TOP rulebook/source comparison](/workspace/research/18xx-2026-09-08/top-rulebook-comparison.md),
  including unresolved discrepancies. Its source snapshot is
  [`715567bdc7e5cc68a68a286b21dc8edd1a125e50`](https://github.com/tobymao/18xx/tree/715567bdc7e5cc68a68a286b21dc8edd1a125e50).
- **R-C:** [title variation catalog](/workspace/research/18xx-2026-09-08/18xx-game-variation-catalog.md),
  [trait catalog](/workspace/research/18xx-2026-09-08/18xx-trait-catalog.md), and
  [recorded title profiles](/workspace/research/18xx-2026-09-08/data/title-traits.json).
- **E-S:** [1889 slice evidence](1889-slice-evidence.md), including section-specific
  references and pinned implementation links.
- **E-T:** [tile-library evidence](tile-library-evidence.md), including family
  survey coverage, catalog identity, variants, and physical/rendered tile distinctions.
- **R-M:** reference [generic map renderer](https://github.com/tobymao/18xx/blob/715567bdc7e5cc68a68a286b21dc8edd1a125e50/assets/app/view/game/map.rb),
  [1889 map definition](https://github.com/tobymao/18xx/blob/715567bdc7e5cc68a68a286b21dc8edd1a125e50/lib/engine/game/g_1889/map.rb),
  and [TOP map definition](https://github.com/tobymao/18xx/blob/715567bdc7e5cc68a68a286b21dc8edd1a125e50/lib/engine/game/g_1871/map.rb).
  The two-presentation design is this project's proposal; those sources establish
  generic rendering and semantic map data, not an existing physical-board mode.
- **C:** [Common HexGrid](../../libs/common/src/graph/grids/hex/grid.ts),
  [graph interface](../../libs/common/src/graph/graph.ts), and
  [existing auction model](../../libs/common/src/game/components/auctions/auction.ts).
- **D:** [Game Implementation Design](../../docs/DESIGN.md),
  [interaction semantics](../../docs/user-interactions.md),
  [visual contracts](../../docs/ui-interaction-visual-contract.md), and
  [Game Distribution](../../docs/contexts/game-distribution/CONTEXT.md).

The order and proposed interfaces are design inferences from these sources. This
work reads rules and source; it does not execute the Ruby engine, certify every
reference implementation rule, or implement the proposed slices. TOP disputes
and any 1889 edition differences need explicit resolution where they affect code.
