# Santiago visibility interaction contract

## Visual intents

Private money displays a question mark for other players during play and a numeric balance for the current Player Perspective. Spectators see only question marks. Public Money and EndOfGame show all balances. The tile supply always displays the public remaining count, including when the actual bag is concealed.

Private-money Games disable entry into Exploration in every perspective and phase, including ordinary hotseat, Host View, and legacy Games with the configuration option. Public-money Games can enter projected Exploration and return to their source.

## Coexistence and precedence

EndOfGame disclosure takes precedence over private-money presentation. History uses the displayed state's phase, so navigating back before the end restores private presentation. Perspective changes replace the permitted state; values learned through Host View must not remain in a subsequent Player or Spectator representation.

## Shared visual state

These behaviors derive from displayed Game State, persisted configuration, and the Game Session's perspective. They add no transient selection. The Game Session owns Exploration availability; the shared exploration control consumes that value.

## Render ownership

The players panel owns balance presentation. The table owns the tile-supply count and reads the public count through the hydrated state. The shared control owns the disabled Exploration button. Changing visibility does not change board hit targets or layer ordering.

## Verification scenarios

- Start a private-money protected Game and select the acting player: exactly their balance is delivered, three opponent badges show question marks in a four-player Game, the public tile count remains visible, and a submitted bid reduces the owner's money. Automated browser test, at desktop and narrow viewport sizes.
- Switch to Host View and then Spectator: canonical bag and balances are available only in Host View; Spectator restores an empty bag representation and four question marks. Exploration stays disabled. Automated browser test.
- Start a Public Money protected Game as Spectator: all balances are delivered, the bag remains concealed, and Exploration samples a playable complete bag. Submit a bid there and exit: the original action count and concealed bag return. Automated browser test.
- Complete a private-money Game, navigate backward and forward through history: end-game money is public, earlier opponent balances remain omitted, and tile order never enters projected history. Automated logic conformance test.
