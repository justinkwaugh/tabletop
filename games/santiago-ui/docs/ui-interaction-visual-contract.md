# Santiago visibility interaction contract

## Visual intents

Private money displays a question mark for other players during play and a numeric balance for the current Player Perspective. Spectators see only question marks. Public Money and EndOfGame show all balances. The tile supply always displays the public remaining count, including when the actual bag is concealed.

Private-money Games disable entry into Exploration in every perspective and phase, including ordinary hotseat, Host View, and legacy Games with the configuration option. Public-money Games can enter projected Exploration and return to their source.

History uses 12-pixel outlined dots centered on the timeline, including action and game boundary entries. Player names designated white render at full brightness in panels, bidding, history, and status text.

## Tile reveal

Each round opens in TileReveal. The tile strip beside the board shows only the draw pile with its public count; once dealt, the round's tiles sit above the pile for the rest of the round. For the round's first bidder in the current Player Perspective, the pile is a button with a hover scale, and the action bar above the board prompts them to click it. Only the table's tile column is animated; hit targets and layer ordering elsewhere are unchanged. Every other perspective, history navigation, and the hotseat non-active view show the same pile as a static count. Clicking sends RevealTiles through the host; the local optimistic attempt is skipped because the draw reads the concealed bag. The reveal is the round's only Undo barrier, so the toolbar's Undo stays available to whoever acted last in the previous round until the pile is clicked.

## Tile deal animation

The Game Session's tile deal animator owns the motion when tiles appear; the table and the action bar both consume it. On a RevealTiles action it first previews the bidding content in the action bar as a pre-reactivity override, tweening the bar's wrapper from its previous height to the new one so the board and tile strip slide down together, then fades that content in. It renders the `to` state's tiles in their slots as a hidden override, holds the persistent draw pile at the first slot, then on the shared action timeline deposits a tile there and slides the pile down one slot at a time; each tile appears beneath the resting pile and flips from the pile's back design to its face as the pile moves on. The pile finishes at its home below the tiles. It renders above the tiles while it travels. Without an action, as in state-only history navigation, the tiles fade in face-up within the fallback budget and the pile does not move. Tiles disappearing, as when navigating backward past the reveal, unmount reactively with no motion. Both overrides last exactly one action and clear in afterAnimations; the pile's count updates when the reactive state publishes. The action bar's wrapper is always rendered, empty when there is nothing to show, so its height can be measured.

## Coexistence and precedence

EndOfGame disclosure takes precedence over private-money presentation. History uses the displayed state's phase, so navigating back before the end restores private presentation. Perspective changes replace the permitted state; values learned through Host View must not remain in a subsequent Player or Spectator representation.

## Shared visual state

These behaviors derive from displayed Game State, persisted configuration, and the Game Session's perspective. They add no transient selection. The Game Session owns Exploration availability; the shared exploration control consumes that value.

## Render ownership

The players panel owns balance presentation. The table owns the tile-supply count and reads the public count through the hydrated state. The shared control owns the disabled Exploration button. Changing visibility does not change board hit targets or layer ordering.

Paper texture paints behind content within an isolated stacking context. It may texture a panel background, but must not darken player names or other foreground content. The history panel owns its custom dots and suppresses Flowbite’s default markers only within that panel.

## Verification scenarios

- Start a private-money protected Game and select the acting player: exactly their balance is delivered, three opponent badges show question marks in a four-player Game, the public tile count remains visible, and a submitted bid reduces the owner's money. Automated browser test, at desktop and narrow viewport sizes.
- Switch to Host View and then Spectator: canonical bag and balances are available only in Host View; Spectator restores an empty bag representation and four question marks. Exploration stays disabled. Automated browser test.
- Start a Public Money protected Game as Spectator: all balances are delivered, the bag remains concealed, and Exploration samples a playable complete bag. Submit a bid there and exit: the original action count and concealed bag return. Automated browser test.
- Complete a private-money Game, navigate backward and forward through history: end-game money is public, earlier opponent balances remain omitted, and tile order never enters projected history. Automated logic conformance test.

- Create a Game: the first bidder sees the draw pile and the reveal prompt with no bid controls; clicking the pile first grows the bar above the board so the board and strip slide down while the bid controls fade in, then the pile leaves a face-up tile where it stood and slides down the strip leaving one at each of the next three slots, ending below them; the count drops by four and bid controls appear. Step backward and forward through that reveal in history: backward the tiles vanish, forward they fade in quickly, and Shift-forward replays the deal. In a later round, after the last personal-canal decision, Undo remains available to that player until the pile is clicked, and disappears once it is. The reveal click and the reappearance of bid controls are covered by the automated browser test; the count drop and Undo barrier are manual browser verification.
- Create a Game and place a bid: panel and inline names retain full-white text; History shows one 12-pixel dot per entry aligned with the timeline. Verified in Chromium with rendered-pixel and geometry checks.
