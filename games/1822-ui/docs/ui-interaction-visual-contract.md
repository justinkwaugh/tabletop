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
- **Loan to repay:** the amount starts at the most payable; a larger or empty amount disables
  the button; paying part leaves the panel with the remainder.
- **Private to acquire** and **Minor to acquire:** choose one with terms, change a term, Undo:
  the list returns; choose again and send: one Action.
