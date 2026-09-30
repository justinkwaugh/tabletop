# Oath retained knowledge

A player who looks at a hidden card keeps knowing it. Today most of those looks live only in actor-known Action metadata, so a projected Exploration would have to mine history for them. This note puts each one in state, owner-known, so the projection alone says what its player has seen (hidden-information.md: "titles requiring retained knowledge must represent the permitted facts explicitly").

Each field records a fact the player saw, kept in step with later public events that move the seen card: a draw of a public count, a card put on the bottom, a pile merged. No field is refreshed from the vault after the look itself. Every write happens in an Action that already reads the vault, so each is host-executed and already an Undo barrier; no new client path appears.

## What each power records

| Power | What the player saw | Where it is kept | When it changes |
| --- | --- | --- | --- |
| Ivory Eye, a site | one facedown site | new `peekedSites: Record<slotId, siteCardId>`, Owner, beside the public `peekedSiteSlotIds` | never; a site slot flips once and its id is not reused |
| Ivory Eye, a relic | one facedown relic | `peekedRelics`, as now | as now |
| Ivory Eye, an adviser (another player's) | one facedown adviser | the row's `shownTo` gains the viewer; `shownCardId` reaches them by `oath.adviserShownTo` | as any shown row: gone when the card flips faceup or leaves play |
| Inquisitor, not the Conspiracy | one facedown adviser | the same row mechanism | the same |
| Inquisitor, the Conspiracy | — | nothing: the card is played or discarded at once | — |
| Dream Thief, The Gathering | each holder knows the card they gave | the moved row keeps its card's `shownTo` and adds the player who gave it | the same |
| Oracular Pig | the world deck's top three | new `knownWorldDeckTop: cardId[]`, Owner, index 0 the top | a draw of n drops the first n; Oracle's draw removes the first Vision in the list, if any; a new look replaces it |
| Scryer | one discard pile, whole | new `knownDiscardPiles: Record<Region, (cardId \| null)[]>`, Owner, indexed from the pile's bottom, `null` where unknown | a top draw truncates to the new public count; Mushrooms' bottom draw shifts it; Convoys moves it onto the target pile above that pile's count; a deposit changes nothing |
| Tavern Songs | the top three of one pile | the same field, those three positions | the same |
| A discard, and Brass Horse | cards put on a pile: every one the table could see (a card leaving play faceup, a revealed Vision, the order of a public discard, Brass Horse's reveal) by everyone, and every other one by the player who held it or drew it | new public `seenDiscardPiles` on the state for what the table saw; the player's `knownDiscardPiles` for the rest | the same as Scryer's; a card underneath lifts every record |
| Family Heirloom, Dowsing Sticks | a drawn relic sent to the bottom | new `knownRelicDeckBottom: (cardId \| null)[]`, Owner, last element the bottom | every relic sent to the bottom appends to every player's list, the id to those who know it and `null` to the rest; a draw that reaches into the list trims it from the top |
| Fae Merchant | the drawn relic, or a held one (public) | the same field; a held relic is public, so it is named in everyone's list | the same |
| Relic Hunter | the site relics taken, then bottomed | the same field, for the attacker and anyone who had peeked at that slot | the same |
| Relic Breaker | nothing new | the same field, named only for players who had peeked at that slot | the same |

The relic deck's length is not in public state. It follows from public state (every relic, less those held, in slots, or out of play), so trimming against it discloses nothing new.

## Policy

- All new fields are `Visibility.Policy.Owner` on the player, like `peekedRelics`: the owner and the host see them; other players and spectators do not.
- `shownTo` stays public, as now: that a card was shown, and to whom, is public (the Ivory Eye and Inquisitor choices already name the row).
- A player's own facedown advisers are not recorded: they know them through `adviserIds`.

## Scope

- Scryer and Tavern Songs look at a discard pile, not the world deck, so the world deck and the discard piles have separate fields.
- Who saw a discard is decided when the action commits it to the pile, from a snapshot taken as the action starts: a card on the table, a revealed Vision or a card named in a public question is everyone's; a hand card or a facedown adviser is its holder's; a card the action drew out of concealment, or one no one else could see, is the acting player's.
- A card handed from one player's row to another's, by Dream Thief or an exchange at The Gathering, keeps its `shownTo` and adds the player who gave it, who held it and saw it go.
- Not recorded: where a known card went when another player drew it, and cards once in a player's hand. Exploration treats them as unknown, which is less informed but never leaks.

## Invariant asserts (G2, G3)

- `discardFromPlayInChosenOrder` asserts that no id it is given is a facedown adviser; `OrderDiscards.cardIds` is public.
- The default Card-choice domain (`defaultDomain`, from `accessibleCardIds`) drops the actor's facedown advisers, since `PowerChoice.Card.cardId` is public. No current power relies on the default.

## Specs

One per power above: the field after the look, from the owner's projection and absent from another player's and a spectator's; each maintenance event (world deck draw, Oracle, top and bottom discard draws, Convoys, relic bottomed then drawn); Dream Thief and The Gathering carrying `shownTo`; the two asserts refusing a facedown adviser.
