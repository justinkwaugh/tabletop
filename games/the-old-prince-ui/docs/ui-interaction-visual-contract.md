# The Old Prince 1871 UI interaction contract

The Old Prince renders through the shared 18xx game table. Stock trading, company
starts, track, stations, routes, trains, earnings, the map, history, and Undo follow
the [shared 18xx contract](../../../libs/18xx-ui/ui-interaction-visual-contract.md).
This contract records only what the title owns or changes. Rule sources and
unresolved rule questions live in `research/18xx`.

## Visual intents

### Opening offer-pile auction

Trigger: the game is in its opening auction. The action area replaces ordinary
trading and operating content with the auction until it completes.

- While the auctioneer chooses a lot, the offer piles are interactive and the
  assigned Mainline and Shortline, every public pile, the auctioneer, the two
  eligible bidders, and completed awards are shown. Choosing a lot can focus its
  home location on the map.
- While a lot is being bid on, the bidding controls replace the offer choice.
- When the auctioneer has one lot left, the engine records the offer as a system
  action and bidding opens without a manual offer.
- Offer and bid choices are manual session selections. Pass is an explicit action.
  No reactive behavior commits an offer, bid, pass, or award.

### Stalled forced purchase

Trigger: a forced purchase is unaffordable and no player-owned private produces
income. The auction shows the stalled position with an explanation and offers no
auction actions. This is the accepted resolution, not an error state: the player
whose bid or pass caused the stall uses Undo to take a different line. Undo stays
available because eligibility follows the last user action, not the active player.

### Branch split selection

Trigger: the active player chooses Split in the stock action strip, which is offered
only when a branch remains and the player has an eligible parent. Choosing Split
closes any open stock menu. The split panel then replaces the operating content.

- Stages are presented one at a time: eligible parent, branch, then starting price,
  each as token and name or as price buttons. Completed company choices collapse to
  a compact summary. There are no dropdowns and no separate Back control.
- Choosing a starting price opens the preview of the authoritative split calculation
  together with the allocation of stations, branch home, trains, cash, and Hunslet.
  The allocation starts from an empty default rather than requiring a button press.
  Selecting a single available station does not choose the branch home.
- Station entries can focus their location on the map. The map stays canonical and
  shows no branch stations until the split is committed.
- Confirm split is enabled only when the title model that validates the action
  accepts the complete allocation. It sends one action through the session. No
  intermediate authoritative split exists.
- After commitment the original stock turn stays active with its buy or start
  allowance used.

### Tranche display

Trigger: always, in the game information area. Each tranche shows its capacity as
slots, filled by the tokens of the companies it holds. A tranche that can no longer
fill shows a lock in its empty slots. It follows displayed state and has no input.

### Title presentation

These change shared presentation without adding interaction:

- Company cards omit Par and label the current stock-market share price Value. The
  ownership spreadsheet shows Value after the share pools and before company cash
  in both orientations, with a dash for a company that has no market position. It is
  a per-share price, not net worth or treasury.
- The reserved certificate pool is named Exchange and a company's own pool Treasury.
- PEIR keeps its initials in history and stock lists and is listed last among stock
  companies. The prototype workbench also summarizes its outstanding shares and
  explains its president as the largest shareholding, then the lowest numbered share.
- Union Bank's charter sits in its owner's portfolio while its certificates and cash
  stay in its own treasury. A company it presides over shows Union Bank as president
  and Union Bank's owner as controlling owner.
- A committed split appears in history as the branch split from its parent with the
  branch capital.
- Vernon River's unbuilt map marker is title artwork: a large VR above two small
  connected circles. It disappears when a tile is laid and adds no route nodes or
  station slots.
- The published artwork option uses the packaged board image, the Boda Games charter
  tokens (icon discs in the wood-specification colours, which also tint routes and
  market entries), the published private cards and second-variant PEIR certificates in
  the auction bidding panel and, when a private is clicked, centred over a full-screen
  mask at a size that follows the viewport, laid tiles drawn in the published tile style
  (board-matched colours, paper grain, hand-inked track without casing, heavy-ringed
  station circles, plain white revenue discs, and a faint ring or inset hex in place of the X
  and T labels), and printed-city station positions
  for Wellington, Summerside and Charlottetown. In that mode the page and map surround
  take the board's dark border color, the table takes the board's own palette (light tan
  paper for bright text, the grey-tan of its stock market figures for dimmed text and
  inactive tabs, slate market-cell surfaces and borders), share certificates beside share purchases and sales in history and the position
  summary, and train and phase badges take
  the player aid's purple, crimson and teal cycle with a two-tone diesel, and leaving the mode or the table restores the
  generic lettered tokens, generated cards and background. It is a per-player display
  choice held by the session; it never changes Game State or creates an Action.
  Calibration notes are in [the board artwork note](board-artwork.md).

## Coexistence and precedence

- **Split selection and stock menu.** They never coexist. Choosing Split clears the stock
  menu, and the split panel replaces the operating content while a split selection exists.
- **Split selection and opening auction.** Impossible together: Split requires the stock
  round, which begins only after the auction completes.
- **Split selection and History View or state publication.** The selection is hidden, not
  merely disabled, whenever the session is viewing history, publishing visible
  state, busy, or the player is not the active stock player.
- **Split selection and pending company decisions or flotations.** Those keep their
  shared handler precedence. A split cannot start once the turn's buy has been used.
- **Stalled auction and auction actions.** The stall wins: no offer, bid, or pass is
  available, and only Undo changes the position.
- **Map focus from a lot or a split station and the shared map focus rules.** These
  use the shared focus operation and follow its precedence. They create no action.

## Shared visual state

### Split selection

- **Meaning.** The player's staged progress toward one split: that Split was chosen,
  the parent, the branch, the starting price, and the allocation.
- **Producer and consumers.** The title session produces it. The table decides
  whether to show the split panel from it, the split preview and allocation panels
  render it, and the stock action strip marks Split as selected from it.
- **Allowed effects.** It may show the split panel, mark the strip's Split segment,
  and enable Confirm split. It must not change the map, portfolios, market, or any
  canonical value.
- **Stage sources.** The action, parent, branch, and price stages are manual. The
  allocation is created automatically with an empty default when a price is chosen,
  and becomes manual once the player edits it.
- **Back and Undo.** Undo unwinds the latest manual stage first and consumes no game
  action while a selection exists. Changing parent, branch, or price clears the later
  stages. Once the selection is empty, Undo follows ordinary game history.
- **Lifetime.** Cleared before each new visible state is applied, and when selection
  is cancelled. It does not persist across reload.
- **Validity.** While present it applies only when the session can preview a split.
  Otherwise consumers see an empty selection.
- **History, replay, and restoration.** Hidden in History View and during state
  publication. A committed action invalidates the old selection before the new state is
  displayed, so no stale preview survives replay or silent restoration.

### Auction selections

Offer and bid selections follow the shared auction selection rules: hidden during state
publication and History View, and cleared before each new visible state.

## Render ownership

- **Action area content.** The title's table is the single owner of which panel
  fills the action area: offer choice, bidding, the stalled auction view, the split
  panel, or the shared operating actions. It decides from the auction state and the
  split selection. The shared table only provides the slot.
- **Split entry.** The title supplies Split as an additional stock action. The shared
  strip renders it and owns its selected styling.
- **Tranches.** The title owns the tranche display inside the shared game
  information slot.
- **Map.** The shared map owns all map rendering. The title supplies both token
  sets (generic and published), the Vernon River marker, the published board image
  with its printed-city layouts, and the published card images; the shared session
  chooses between generic and published from the artwork toggle. The title excludes
  PEIR from company map focus.

## Verification scenarios

| Scenario | Start | Input | Expected | After exit | Verified |
|---|---|---|---|---|---|
| Offer then bid | Opening auction, several lots | Choose a lot, then bid | Bidding replaces the offer choice and the bid commits | Undo restores the prior auction turn | Automated, engine (`topOpening.spec.ts`); manual in browser |
| Single remaining lot | Auctioneer has one lot | None | Offer is recorded as a system action and bidding opens | Undo reverses the offer with its cause | Automated, engine |
| Stall and recovery | All players at zero cash before a forced purchase | The action that forces the purchase | Stalled view, no auction actions, no active player | Undo restores the exact prior state | Automated, engine (`topOpening.spec.ts`); manual in browser |
| Auction completion | Final lot awarded | None | First stock round appears in remaining-cash order | Undo restores the last auction turn | Automated, engine |
| Split staging | Stock round, eligible parent and branch | Split, parent, branch, price | One stage at a time, earlier choices collapse, preview and allocation open on price | Undo unwinds one manual stage at a time, then follows game history | Automated, selection (`branchSplitSelection.spec.ts`); manual in browser |
| Reselect earlier stage | Split selection with a price | Choose a different parent or branch | Later stages clear | As above | Automated, selection |
| Split and stock menu | Stock menu open | Choose Split | Menu closes and the split panel shows | Cancelling the split returns the operating content | Manual |
| Split commitment | Complete valid allocation | Confirm split | One action; shares, stations, trains, cash, tranche, and turn update together; branch stations appear on the map | Undo restores the entire pre-split state; reload keeps the split | Automated, engine (`splitCompany.spec.ts`, `branchSplit.spec.ts`); manual in browser |
| Selection across history | Split selection in progress | Enter History View, then return | Selection hidden in history | Selection is cleared once a new state is applied | Manual |
| Value label | Company cards and spreadsheet | Switch spreadsheet orientation, step through history | Value replaces Par and follows displayed state | 1889 keeps Par and Market | Manual |
| Published board | Generic map with a track selection | Toggle published artwork | Board image under tiles and overlays, dark surround, published tokens on the map and in panels | Toggling back or leaving restores the background and lettered tokens | Automated, browser (`boardArtwork.spec.ts`) |
| Published tiles | Track construction, published artwork | Pick and lay a tile, then toggle back | Picker and laid tiles use the published tile style with a paper-grain overlay; generic presentation restores the classic style | Toggling back restores the classic tiles | Automated, browser (`boardArtwork.spec.ts`) |
| Published shares | Stock round, published artwork | Buy or sell shares, then view history or step back | History rows show the traded certificates side by side behind a plus (bought) or minus (sold, in the debit colour) sign, as does the position summary, where the sign hangs left of the centred cards; the position summary stacks a company's certificates with each card dropped by 18% of its height so every card's two stripes show; when a trade transfers the presidency, the president's certificate stands in for the shares exchanged for it and is the fully visible top card (share or president's certificate per company, numbered PEIR certificates); clicking one opens the full-screen mask | Generic presentation shows no certificate art | Manual in browser |
| Published cards | Opening auction, generic presentation | Toggle published artwork, click a lot, offer a lot, click the bidding card, step back through history | Clicking a lot opens the printed card centred over a full-screen mask, sized from the viewport; the bidding panel shows the same image sized from the action pane's height with a floor (PEIR lots use the second certificate variant), and clicking it opens the same mask; in History View the position summary shows the lot's card below an offer, bid or pass description, published or generated to match the presentation; Escape or a click closes the mask | Toggling back restores the generated card popover | Automated, browser (`boardArtwork.spec.ts`) |
| Tranches | Companies started across tranches | Start a company, then Undo | Slots fill and closed tranches lock | Undo empties the slot | Manual |

A sole Split option in the stock action bar opens automatically, excluding Pass
from the count. Its menu stage is auto-sourced; selecting a parent starts manual
progress. Undo skips the automatic menu and undoes committed history when no
manual split choice remains. Split counts alongside the shared stock menus, so
multiple legal menu options require an explicit choice.

Ice Boats shows one exchange row per eligible company, not one row per ordinary
certificate. It retains the started-company restriction, excluding Mainline,
Shortline and PEIR. With only Mainline and Shortline started, no exchange appears;
starting another eligible railway makes one company row available.
