# 1822 table interaction and visual contract

1822 renders the shared 18xx table through `Session1822`. Shared modules own stock selection,
tile and station staging, routes, dividends, train purchases, history and the single contextual
Undo, and the bid boxes, separate revenue, drawn runs and track agreements that came with this
title; their behaviour is recorded in the
[18xx-ui contract](../../../libs/18xx-ui/ui-interaction-visual-contract.md). This contract covers
what 1822 adds or composes differently.

## Visual intents

- **Bidding and the boxes.** The stock menu has **Bid** beside the family's panels. The boxes are
  also drawn on the board, with the stock market and depot, for every seat.
- **Termini.** Track that reaches a station where a route must end is pointed: a spike from the
  hex side to the station. So are the standard off-board areas (Highlands, Aberdeen, Cornwall,
  Fishguard, Mid Wales, Holyhead and France, §5.4.4) and every scenario overlay. Merthyr Tydfil
  and Pontypool, termini only from each other, share a side; as printed, their one connection
  is two pointed tracks side by side, each from its own station into the other's hex, Pontypool's
  above (§5.4.7). A route across them is drawn along the connection between the two.
- **London.** The board's London hex is black, as printed, with a black spike from the middle
  of each side out into the hex beyond, drawn under any tile laid there. Its six stations stand
  in a ring out at the sides their track leaves by; "London" in white and its value stand in
  the middle, the £20 upgrade cost in white in the left corner and the L in the right. A London
  tile laid over it is in its own colour with the same layout and spikes. The Metropolitan
  Railway's space beside a station overlaps that station toward the middle.
- **Grey areas across hexes.** The Highlands' station stands upright across the side its two
  hexes share, its spike pointing straight in from its side. Mid Wales is one strip of hexes,
  its station and values centred on it. Southwest England's scenario overlay is one area across
  its two hexes: its station to the west of the upper, its values in a column in the lower.
- **Destinations.** Each major company's destination shows its token beside the city until it
  connects there (§5.11); the destination station it then places, or the station it already had
  there, which becomes its destination station, is outlined in orange (§5.11.7). The LNWR shows
  none: its Manchester station is a second home until it connects to London, then outlined.
- **Minor bid boxes.** While a minor company's box has no bid it says what the minor costs if
  unsold: box 1 that it leaves the game and removes two trains (one once the L-trains are gone),
  the others that it removes one train, while any L-trains are left (§4.10.3).
- **Scenarios.** A scenario's name is among the game's facts. The board draws only the hexes
  in play, with each overlay a grey station named for its area. The market colours every space
  of the scenario's game end value or more as a game end space. Under each stack, the boxes name
  the companies the game plays without. Where the Metropolitan Railway may take a removed London
  company's station space, its home previews in that space.
- **1822+ private stacks.** With 1822+ each private box has its own stack. The boxes keep their
  places as they empty and fill; the list of what is still to come is one per box, and the
  private companies removed during setup are named beneath it. P17's choice lists each stack
  apart.
- **What a held private keeps.** Under its name on its holder's player card, the tax haven says
  which shares and how much money it holds, and P15 and P20 the money on their charters. A share
  is bought for the tax haven from the stock menu's buyer choice, like any share; the choice
  shows the haven's money once it buys with its own.
- **Repaying a loan.** A player with a loan sees what they owe above whichever stock panel is
  open, with an amount field, starting at the most they can pay, and one button to pay it.
- **Declaring cash.** At the end of a stock round the holder of P9 is asked whether to declare
  double their cash, only where that would change the order; other seats see who is deciding.
- **The Metropolitan Railway's home.** On its first turn the track step offers one mode. The
  panel asks for a tap on one of London's six stations on the map. A tap previews the home token
  beside that station and the panel names the station with **Place its home**; tapping another
  station changes it.
- **A minor's first train.** A minor on its first turn may buy an L-train before its track.
- **Private companies.** Before its track a company lists the privates it may acquire, each
  marked where another player holds it and must agree. One with a choice or a discard opens that
  choice before the request or acquisition is sent.
- **Acquiring a minor.** After its trains a major lists the minors it may acquire. Choosing one
  shows the terms, the exchange token's fate, any London station to choose and any trains to
  discard, with one button to acquire or, where another player directs the minor, to offer.
- **Answering an offer.** While a major's offer for a minor, or a company's request for a
  private, waits on another player, the action area shows the offer in place of the operating
  panels: the player asked sees its terms with accept and decline; every other seat sees who is
  answering.

## Coexistence and precedence

- The cash declaration and a pending offer each replace the action area; the game admits only
  one at a time.
- The loan panel sits above the bid panel or the family stock panel and never replaces them.
- The Metropolitan mode is the only track mode offered on that turn, so its map taps cannot
  meet tile-space selection.
- Choices for a private, a minor and P17's certificate are one at a time; opening one replaces
  the list it was chosen from until it is sent or undone.

## Shared visual state

- **The Metropolitan station chosen.** Meaning: the London station tapped for the home, until it
  is placed. Producer: the session, from a map tap on a London station while the home is the
  operating player's to place. Consumers: the map, which draws the home token beside that
  station, and the mode panel. It is a staged selection registered with the session's local
  selections: Undo clears it, and placing clears it. It applies only in Live View while the
  home is due.
- **The private, minor and certificate chosen.** Each is a staged selection of the pick followed
  by how it is taken up, whose terms start at their defaults and are the player's own once
  changed. Components change them only through session methods. Undo drops the whole choice;
  sending the Action clears it.

## Render ownership

- The family map draws the previewed home token from the session's map display state; the mode
  panel draws nothing on the map.
- `Table.svelte` decides what replaces the action area; the panels do not test for each other.

## Verification scenarios

Each is manual in the harness, in the named scenario.

- **Metropolitan home:** tap London's north-east station: the token is previewed there and the
  panel names it; tap another: the preview moves; Undo: the preview and the choice go; choose
  again and place: the home stands there and the mode ends.
- **Offer for a minor** and **Request for a private:** the player asked sees the terms and both
  answers; accepting applies the acquisition, declining leaves everything as it was and the
  asker's list no longer offers it that turn.
- **Small regional scenario:** the north, the southwest and South Wales are not drawn; Glasgow,
  Edinburgh, Southwest England and South Wales stand at the edge; the market's game end spaces
  begin at £400; the stack lists name twelve minors, four concessions and six privates not in
  the game.
- **First stock round of 1822 plus:** open the private companies' stack list: three lists by box
  and the removed companies beneath.
- **Humber bridge to lay:** choose P21: only Hull and Grimsby light; lay in one, then the other
  only; after the first, ordinary track is no longer offered; finishing track after one lay
  closes P21.
- **Tax haven with money:** under the haven on its owner's card: its share and money; buying for the tax
  haven offers companies it holds no share of, priced within its own money.
- **Loan to repay:** the amount starts at the most payable; a larger or empty amount disables
  the button; paying part leaves the panel with the remainder.
- **Private to acquire** and **Minor to acquire:** choose one with terms, change a term, Undo:
  the list returns; choose again and send: one Action.
