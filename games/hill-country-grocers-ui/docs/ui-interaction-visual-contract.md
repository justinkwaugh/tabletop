# Hill Country Grocers UI interaction visual contract

## Visual intents

- **Choose an action.** On the acting player's Choosing Action turn, the action spaces they may take are highlighted and clickable, by pointer or with Enter/Space. Their pawn sits in the space they last used, which stays plain.
- **Choose a building company.** When the acting player could build for more than one grocer, those company cards get a dashed gold border and become clickable. With exactly one option it is chosen automatically and no card is highlighted.
- **Stage cubes.** Hexes that can legally and affordably take the next cube get a pulsing gold ring. Clicking one adds a dashed ghost cube in the building company's colour and refreshes the ring set for the next cube. Reaching the company's cube limit, or leaving no further legal hex, commits the build. Otherwise the action panel offers "Build N cubes · $X".
- **Place the bonus cube.** After a Streamside Sisters share sells, the buyer sees rings on the hexes Streamside can take. One click commits; "Place no cube" skips the bonus.
- **Develop a city.** Cities that can take a marker get a ring around their dot and marker slots, and clicking one commits. When Balcones Builders cannot pay every grocer there, the city's ring stays lit and the action panel lists the grocers to choose as payees.
- **Pick a share to auction.** Every company with an unsold share is highlighted. The picked card keeps a solid gold border while the action panel shows the opening-bid stepper.

## Coexistence and precedence

Only one of these intents can be live at a time, because each belongs to exactly one machine state. During any auction, the company being bid on keeps the selected border.

## Shared visual state

The session owns the staged selections: build company and cube hexes, develop city and payees, and the auction company. The map, the company cards and the action panel only read them.

- **Lifetime:** all staged selections clear in `beforeNewState`, so they never outlive the game state they were made in. Undo pops the most recent manual stage first, and an automatic company choice is never popped.
- **Validity:** a stored company or city applies only while it is still among the current options and the owning machine state is active. History View shows no targets, because `canAct` is false there.

## Render ownership

Hex and city rings are drawn last in the map layer so they sit above the cubes and markers and receive the clicks. Ghost cubes render in the hex's cube row, after the cubes already placed there.

## Verification scenarios

- In Building Network with two buildable companies, click the second card and then a ringed hex: a ghost cube appears and Undo removes it. A second Undo clears the company choice.
- With Alamo City Supplies, place three cubes: the third click commits the build with no confirm button.
- With Balcones Builders holding $1, develop San Antonio: the city ring stays lit, the panel lists Alamo City and Verbena, and choosing one commits.
- During Starting Auction, click a company card and step back with Undo: the card returns to its highlighted, unselected look.
