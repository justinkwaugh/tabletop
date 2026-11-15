# Preußische Ostbahn UI interaction visual contract

## Visual intents

- **Choose an action.** On the acting player's Choosing Action turn, the action panel offers Build track (when the player holds a share of a railroad that can place track), Offer a share (when a share may be auctioned), and Pass. Choosing Build track or Offer a share replaces them with one pill per eligible railroad in its own colour, showing its treasury and "N track left" when building; a railroad pill builds or opens the auction. When only one railroad can build, Build track goes straight to its rings. The railroad cards carry no buttons. Nothing on the map is ringed until a railroad is chosen to build.
- **Build track.** Choosing a railroad to build outlines its card in the railroad's own colour. Each space the railroad may enter next gets a blue ring over a pale wash and a price tag with what that one track costs (the Badische's free rural track and the Bayerische's discount already applied). Clicking a ring builds that track at once as its own Action: the cube appears and the rings refresh. The action panel reads "Build <railroad> track" on one line and, beneath it, the treasury and track left. Once a track is built, a Done building button appears with "N of M built" beside it. The Expansion ends by itself, with no press, once the railroad reaches its track limit or can afford nothing more.
- **Railroad cards.** Every card always shows income, treasury and Track left (the count of cubes still to build, beside a cube of the railroad's colour), its share owners and its direct connections.
- **Share auction.** The auctioned railroad's card is outlined in the railroad's own colour. The action panel reads "Auctioning 1st/2nd/3rd share of <railroad>" on one line and, beneath it, the railroad's income, treasury and track left; below that it shows one equal-width tile per bidder in bidding order, all in a single row at any width: a band in the player's colour with their name, their own latest bid (or a dash), and a status line. The high bidder's tile has a solid blue border and reads High bid. The bidder to act has a dashed blue border and reads To bid. Passed bidders are faded and read Passed. The bidder gets a $1 stepper capped at their cash and Pass.
- **Player income.** A slim full-width strip below the map, labelled Player income, holds one numbered track ($0 to $40, growing in steps of $10 whenever an income would reach the end) with each player's marker (their colour and initial) on their income. Tied markers overlap as a pile, each offset up and to the right, so even five tied stay inside the strip; hovering a marker, or tapping it (tap again to close), shows a dark label above the track naming every player at that income and the amount. It changes only with the Game State.
- **Draw the turn order.** When the opening auctions end, or a round's last turn ends, the player ending it (the last opening share's buyer, then the last turn slot's player) gets "Draw the next round’s turn order." and a Draw turn order button; everyone else reads "Waiting for <player> to draw the turn order." The draw reveals the cup, so nobody can undo across it. When the game is over at that point it ends by itself, with no press.
- **Turn order.** Under the board title, from round 1 on, "Turn order" with "Round N" beside it, then one rounded square per turn slot in the drawn order, in the player's colour with their initial. Slots already played fade; the slot whose turn it is (choosing, building or paying out) has a navy outline. Hidden during the opening auctions.
- **Focus the board.** A Map / Railroads switch sits centred over the board's top edge, in the board's own overlay so it stays in full screen. Railroads zooms to the railroad cards; Map returns to the board's resting view. The chosen side is filled cream; panning or zooming by hand clears the choice.

## Coexistence and precedence

Only one intent is live at a time: each belongs to one machine state, and Build track replaces Choose an action from the moment Build is pressed. The shared scaling wrapper's zoom and full-screen controls and the Map / Railroads switch change only the view, so a staged build survives them.

## Shared visual state

The session owns the chosen intent (build or offer) and, for building, the chosen railroad until the first track is built; from then on the Expansion lives in the game state. The map's rings, the railroad cards and the action panel only read them.

- **Lifetime:** the chosen railroad clears whenever a new Game State is presented. Undo clears the railroad, then the intent, and only then undoes the last Action (a built track).
- **Validity:** the chosen railroad applies only while it is among the player's expandable railroads in Choosing Action, so History View, other players and other machine states show no rings.

## Render ownership

The map layer (hexes, terrain marks, Berlin Approaches, Berlin's name and city values) sits beneath the track cubes, which sit beneath the rings, which sit beneath the railroad cards. Only rings take clicks. The board uses no SVG or CSS filters, masks, gradients or endless animations.

## Verification scenarios

- On a turn holding a share, choose Build track and a railroad, then click a ring: the track is built at once; the panel keeps "Build <railroad> track" with the treasury and track left, and shows Done building with "1 of M built" beside it. Undo takes the track back. Automated in `session.spec.ts` and `rules.spec.ts`.
- Build a railroad up to its track limit: the Expansion closes by itself and the next turn begins. Automated in `rules.spec.ts`.
- Step into History View after choosing a railroad to build: the rings disappear. Manual.
