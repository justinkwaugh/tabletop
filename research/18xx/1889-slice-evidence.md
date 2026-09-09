# Shikoku 1889: evidence for development slices

This note supports the paired TOP/1889 development plan; it does not implement rules. Statements under **Rules** describe the supplied rulebook. **Source** describes inspected production implementation. **Design inference** identifies proposed implementation order rather than a rule.

## Sources and scope

- [Supplied Shikoku 1889 rulebook](</workspace/Shikoku 1889 Rulebook.pdf>), Grand Trunk Games, copyright 2022; section numbers and printed/PDF page numbers coincide. Text extraction read from `/tmp/shikoku-1889-rules.txt`. The phase table and tile-manifest illustrations are not represented in that extraction; their numerical data below come from source code, not an asserted visual inspection.
- All GitHub links below pin the research snapshot at `715567bdc7e5cc68a68a286b21dc8edd1a125e50`. Local source lives at `/workspace/research/18xx-2026-09-08/source`.
- [1889 game configuration][game], [entities and private abilities][entities], [map and tile definitions][map], and the shared procedures they select. Standard game is the baseline; beginner/quick-start options need their own later acceptance decision.

## Dependencies and acceptance cases

### 1. Ownership, cash, assets, and complete title data

**Rules:** Bank ¥7,000; starting cash ¥420 for 2–4 players and ¥390 for 5–6. Include privates A–E/A–F/A–G for 2/3/4+ players (§2, p.10). A presidency certificate is one certificate worth two 10% shares; privates count as certificates. Limits are 25/19/14/12/11 (§7.6, p.19). Corporate assets remain separate from the president's assets (overview, p.5).

**Design inference:** Begin with explicit asset owners, cash accounts, certificate identities and percentages, corporations, physical tiles/trains/tokens, and read-only portfolios/charters. Avoid representing shares as undifferentiated certificate counts. Acceptance: the complete initial state conserves bank cash, has the correct player-count inventories, and survives serialization. Common's existing hex graph is the geometry foundation; track paths and city slots still need their own topology.

### 2. Stock market and an initial stock/float slice

**Rules:** Buy at par from initial offering and market value from open market; president pays twice chosen par. Float at 50% leaving the initial offering, receive 10×par once, and place free home tokens at the beginning of the next OR (§7.2–7.4, pp.17–18). Started but un-floated corporations neither operate nor lose price for no dividends. Market zones change certificate and ownership limits; token stacks and horizontal position break price ties (§3, p.12).

**Design inference:** Develop cash/certificates together with a market-position model, then par/buy/float actions and a stock-market/portfolio UI. A temporary fixture can start in the first SR while the opening auction is unfinished. Acceptance: a 20% president certificate plus three ordinary certificates floats exactly once; buying from market does not count as another initial-offering sale; all floated home tokens appear before anyone lays track. Price equality alone must not collapse distinct market cells or stack order.

### 3. Complete stock trading and control changes

**Rules:** Sell then buy, or buy then sell, but never sell/buy/sell; at most one certificate purchase per turn. No sales in first SR; no rebuy of a corporation sold this SR; market holds at most 50%. At turn start excess holdings force sales; market-zone changes can remove the excess during selling. Presidency changes immediately on a strictly larger holding, with clockwise ties among eligible successors. Sold-out price increases happen in stock-price order at SR end; consecutive passes terminate the round and establish priority (§§7.1–7.7, pp.17–19; §3.3, p.12). [Shared stock step][stock] also explicitly prevents breaking one corporation's sales into multiple blocks during a turn, enabled by `MUST_SELL_IN_BLOCKS` in [1889 configuration][game].

**Design inference:** This slice establishes reusable share transfer/control settlement, complete turn state, legal sale bundles, and market movement, all prerequisites of emergency finance. Acceptance should cover a presidency dump with certificate exchange, ownership-limit relief on entering orange, remaining above limits when exiting a zone, a sale at pre-movement price followed by one downward step per share, and pass followed by renewed action.

### 4. Opening auction as a resumable procedure

**Rules:** Only cheapest remaining private can be bought; reserve bids on later companies tie up cash. Buying the cheapest can cascade through sole-bid purchases and closed auctions before the outer turn resumes. Passing in a closed auction withdraws permanently from that company; an ordinary auction pass does not. All-pass with no private sold reduces the cheapest price by ¥5 down to a forced free acquisition; after some sales it pays private revenue instead. Priority follows the last ordinary purchase, not the last cascade winner (§5, pp.14–16).

**Design inference:** Share cash-commitment and bid primitives if TOP needs them, but keep auction continuation/participant rules title-specific. Build an auction panel showing available cash, commitments, current subauction, and next outer player. Acceptance should reproduce the rulebook's pp.15–16 complete example and both all-pass branches. Resolve the source discrepancy below before claiming canonical bidding order.

“Closed” restricts participation to reservation bidders; bids are public. It does not describe sealed bids.

### 5. Ordinary operating turn: board, track, stations, routes, settlement

**Rules:** Private income first; floated corporations then act in descending market order. A–E are track, station, routes, dividends, trains; private purchases can occur throughout the operating turn in phases 3/4 (§8.1–8.2, p.20; §8.8, p.24). Track is one lay/upgrade, physically limited, preserves track/cities/towns/tokens/labels, and must be a home-hex placement, add connected track, or improve a connected city value (§8.3, pp.20–21). Tokens cost ¥40, preserve home reservations, and cannot duplicate a corporation on one hex (§8.4). Blocked cities are reachable endpoints but cannot be traversed (§4.2, p.13).

**Rules:** Validate routes as a set: no train may reuse another's track or hex-border crossing, although different trains may share revenue centers. Each route counts its token, visits every encountered center, has at least two centers, respects capacity, and visits each center once. Diesel alone earns gray offboard revenue (§8.5, pp.21–22). Dividend income comes only from this turn's train runs: IPO shares pay nothing and market shares pay the corporate treasury; withholding sends the whole run revenue to the treasury (§8.6, pp.22–23).

**Design inference:** Split this into independently reviewable track/station, route-set, and settlement slices, each with real title fixtures and corresponding map/preview/editor UI. Do not start with an automatic route optimizer. Acceptance includes rotation preserving token rights, sold-out tile supply, junction reversal, blocked endpoint versus through-path, shared-center/nonshared-track routes, a Diesel and ordinary train valuing the same offboard differently, and distinguishing private income from dividend-eligible revenue.

**Reading limit:** §8.5 requires owned trains to operate for revenue; I found no explicit maximum-revenue requirement in the supplied text. That does not establish an exemption from any external ruling.

### 6. Trains, phases, and obligations that interrupt operation

**Rules:** Purchase one train at a time and finish all effects before another purchase. At train limit no purchase is allowed even when it would rust one's own trains; Diesel exchange is an exception. Excess train discards resolve immediately, starting with the triggering corporation, then market order, before resuming its turn. Discards are otherwise prohibited. Diesel becomes available after the first 6 and costs ¥800 with a 4/5/6 trade-in; the traded 4 immediately rusts. Rust removes that rank everywhere (§8.7.1–8.7.4, p.23). OR-set length is captured at SR end; phase changes do not lengthen the current set (§6, p.17; §8.9, p.24).

**Source:** [1889 configuration][game] defines phases 2/3/4/5/6/D, train limits 4/4/3/2/2/2, rusting 2→4, 3→6, 4→D, and first-5 private closure.

**Design inference:** Use explicit pending obligations with deciding player, affected corporation, and continuation; the current operator is insufficient to authorize every action. Acceptance: buy first 5 while several other corporations exceed limit, reload mid-discard, finish ordered discards and resume exactly the interrupted buy-train step; buy first 3 and finish the already-scheduled single OR before the next SR.

### 7. Private powers exercise shared interfaces

**Rules:** Mitsubishi owner places special coastal port outside another player's corporation operation; Ehime sale gives the selling player an immediate optional Ôzu upgrade in addition to the buyer's ordinary lay. Sumitomo changes mountain cost; Dôgo exchanges for IPO Iyo 10%; Uno-Takamatsu stays open and increases revenue to ¥50 when player-owned at first 5, thereafter cannot sell to a corporation (§15, p.28; §8.8, p.24).

**Source:** [1889 special track][special-track] explicitly assigns the Ehime seller as tile-lay spender; [game active-player override][game] assigns that seller the decision. [Sale-interrupt helper][sale-interrupt] allows passing the optional lay. [Entities][entities] and [shared exchange][exchange] supply timing/ownership/availability checks.

**Design inference:** Include one real interruption (Ehime) as soon as track plus private transfer exist, rather than postponing all powers to a final polish phase. UI must visibly hand decision to the seller and then return to the operating president. Acceptance: save/reload or undo the optional lay without losing the buyer's track action; Dôgo exchange respects actual available IPO certificate; closure/revenue-change depends on owner at the event. Remaining private timing/limit edge cases need targeted source reads during their slice.

Private purchase requires mutual agreement at half–double face value (§8.8). Capture seller consent before transfer; a buyer's unilateral action is insufficient, especially when seller and president differ.

### 8. Emergency finance and ending complete the logic

**Rules:** Train ownership is mandatory only with token connectivity to another revenue center. Corporate cash can buy another corporation's train by agreement, but president-assisted forced purchase uses depot/market. President must contribute available cash, sell only as needed for the cheapest available train (except mandatory ownership-limit correction), cannot transfer a presidency through these sales, and bankrupts only after legal funding cannot suffice (§8.7.5–8.7.6, p.24). Bankruptcy ends immediately. Bank depletion grants unlimited bank funds and ends after the current OR set, or the next complete OR set when triggered in SR. Score cash, shares at final prices, and surviving private face value; a bankrupt player can still win (§10, p.26).

**Design inference:** Emergency finance composes stock legality, route connectivity, train availability, cash, and resumable obligations; it should follow those slices. Ending records a durable trigger and completion boundary. Acceptance: reject assisted intercorporation purchase; enforce no presidency change; test over-limit forced sale exception; bankruptcy aborts pending operation immediately; bank break in SR versus OR waits for the correct boundary and allows continued payments.

## Source discrepancies to retain explicitly

1. **Closed-auction order:** Rulebook §5.2 says clockwise starting left of current highest bidder. [Pinned waterfall code][auction] selects the lowest current bidder. These may diverge with three bidders; do not silently treat code as confirming the printed rule.
2. **Beginner game:** Rulebook §14.1, p.27 supplies private assignments and extra tiles; pinned [beginner configuration][game] additionally removes all abilities and changes values/revenues, and its two-player private selection differs. Keep the optional variant outside the standard-game acceptance claim until reconciled.
3. **Private names and mountain wording:** Printed F is Pilgrimage Railway; source uses South Iyo Railway. Printed Sumitomo text broadly says ignore mountain terrain costs; [entity description][entities] excludes combined river/mountain hexes, represented in [map][map]. Check visual map/cost interpretation when building the terrain slice; source descriptions are evidence of implementation, not proof that every wording discrepancy is equivalent.

[game]: https://github.com/tobymao/18xx/blob/715567bdc7e5cc68a68a286b21dc8edd1a125e50/lib/engine/game/g_1889/game.rb
[entities]: https://github.com/tobymao/18xx/blob/715567bdc7e5cc68a68a286b21dc8edd1a125e50/lib/engine/game/g_1889/entities.rb
[map]: https://github.com/tobymao/18xx/blob/715567bdc7e5cc68a68a286b21dc8edd1a125e50/lib/engine/game/g_1889/map.rb
[stock]: https://github.com/tobymao/18xx/blob/715567bdc7e5cc68a68a286b21dc8edd1a125e50/lib/engine/step/buy_sell_par_shares.rb
[auction]: https://github.com/tobymao/18xx/blob/715567bdc7e5cc68a68a286b21dc8edd1a125e50/lib/engine/step/waterfall_auction.rb
[special-track]: https://github.com/tobymao/18xx/blob/715567bdc7e5cc68a68a286b21dc8edd1a125e50/lib/engine/game/g_1889/step/special_track.rb
[sale-interrupt]: https://github.com/tobymao/18xx/blob/715567bdc7e5cc68a68a286b21dc8edd1a125e50/lib/engine/step/track_lay_when_company_sold.rb
[exchange]: https://github.com/tobymao/18xx/blob/715567bdc7e5cc68a68a286b21dc8edd1a125e50/lib/engine/step/exchange.rb
