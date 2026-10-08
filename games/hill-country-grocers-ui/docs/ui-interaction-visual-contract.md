# Hill Country Grocers UI interaction visual contract

## Visual intents

- **Choose an action.** On the acting player's Choosing Action turn, the action spaces they may take are highlighted and clickable, by pointer or with Enter/Space. Each player's initialled square sits in the space they last used, which stays plain.
- **Choose a building company.** When the acting player could build for more than one grocer, those company cards in the Investors sidebar get a dashed gold border and become clickable, and the action panel offers the same grocers as buttons, so the choice works when the sidebar is out of view. With exactly one option it is chosen automatically and nothing is highlighted.
- **Stage stores.** Hexes that can legally and affordably take the next store get a pulsing dashed burgundy ring over a pale wash, so they stand out from the tan terrain. Clicking one adds a dashed ghost store in the building company's colours and refreshes the ring set for the next store. Reaching the company's store limit, or leaving no further legal hex, commits the build. Otherwise the action panel offers "Build N stores · $X".
- **Place the bonus store.** After a Streamside Sisters share sells, the buyer sees rings on the hexes Streamside can take. One click commits; "Place no store" skips the bonus.
- **Develop a city.** Cities that can take a development get a ring around their dot and development slots, and clicking one commits. When Balcones Builders cannot pay every grocer there, the city's ring stays lit and the action panel lists the grocers to choose as payees.
- **Pick a share to auction.** Every company with an unsold share is highlighted in the sidebar and offered as a button in the action panel. The picked card keeps a solid gold border while the action panel shows the opening-bid stepper. While bidding, the action panel shows a card per bidder in bidding order: a wide player-colour stripe, the name and the latest bid. The card of the player whose bid it is lifts with a burgundy outline, matching the acting player's card in the sidebar, and a player who passed is faded under a PASSED stamp.

## Coexistence and precedence

Only one of these intents can be live at a time, because each belongs to exactly one machine state. During any auction, the company being bid on keeps the selected border. The shared scaling wrapper's zoom and full-screen controls sit in its bottom-left corner and change only the view, so staged selections and their rings survive them.

## Shared visual state

The session owns the staged selections: build company and store hexes, develop city and payees, and the auction company. The map, the company cards and the action panel only read them.

- **Lifetime:** all staged selections clear in `beforeNewState`, so they never outlive the game state they were made in. Undo pops the most recent manual stage first, and an automatic company choice is never popped.
- **Validity:** a stored company or city applies only while it is still among the current options and the owning machine state is active. History View shows no targets, because `canAct` is false there.

## Render ownership

The terrain layer (paper, contour lines, tiles, decorations and the game logo) draws beneath everything on the map sheet and takes no clicks. The round header shares that sheet. Hex and city rings are drawn last in the map layer so they sit above the stores and developments and receive the clicks. Ghost stores render in the hex's store row, after the stores already placed there. In a city, the store row sits below the name for one or two stores and moves into the hex's wider middle for three or four.

## Sidebar and history styling

- **Player receipts.** Each investor is a till-roll receipt: a thick end-of-roll stripe in the player's colour, the name and cash in typewriter capitals, one line per company held with its share certificates and the dividend those shares would pay now, and a TOTAL DIV line above a scalloped tear. The acting player's receipt sits in a burgundy frame.
- **Company ledgers.** Each company is a ledger page: its name on a band in the company colour, ruled rows for treasury, company value and dividend per share with the amounts in a red-ruled money column, a row of its five share certificates (unsold ones dashed) beside its remaining supply, and its ability in italics. Choice and selection borders replace the ledger's own border.
- **History roll.** The History tab is one long receipt, newest first: a store masthead, numbered transactions separated by dashed tears, each with a stripe in the acting player's colour, dividend payouts as burgundy double-ruled breaks, and the winner as a final-total banner. A turn's own player is named once in its heading; other players acting in it are named on their lines. Clicking a transaction shows the board after it.
- **Map legend.** A compact table gives each city tier and the countryside the maximum stores and developments a hex can hold, under store and development icons in the title row.

## Verification scenarios

- In Building Network with two buildable companies, click the second card and then a ringed hex: a ghost store appears and Undo removes it. A second Undo clears the company choice.
- With Alamo City Supplies, place three stores: the third click commits the build with no confirm button.
- With Balcones Builders holding $1, develop San Antonio: the city ring stays lit, the panel lists Alamo City and Verbena, and choosing one commits.
- During Starting Auction, click a company card and step back with Undo: the card returns to its highlighted, unselected look.
