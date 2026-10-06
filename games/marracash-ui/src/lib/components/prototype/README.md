# PROTOTYPE: player card variants (throwaway)

Question: what should MarraCash's player cards look like? Four variants of `PlayerState`
in the real players tab, switchable with `?variant=` (current, stall, ledger, riad) or the
floating bar / arrow keys. Delete this folder and the switch in `PlayersPanel.svelte` once
a direction is chosen.

## Where it landed

The Riad variant (`RiadCard.svelte`) is the direction being refined:

- Deep teal tiled panel with brass trim; the player's board standee sign (seat shape, brass
  edge) with their initial and an `N/6 shops` count beneath.
- Customer pawns in a darkened band; zero counts as dashed hollow pawns, never dimmed.
- Antiques always in full colour: solid card when covered, dashed when not; a completed set
  shows its payout instead of fading unpaid cards. Opponents' hidden antiques are a splayed
  fan of card backs.
- Money uses the dirham sign `د.م.`, not the word "Dirham".
- Type: El Messiri for names, money, sign initials and numbers (21px names, cap heights
  matched with `font-size-adjust: cap-height 0.74`); the dirham sign is Noto Naskh Arabic;
  labels ("antiques", "1st set", "5 hidden antiques") stay in the game's serif.

Before folding in: replace `font-size-adjust` with fixed sizes (Safari < 17 lacks the
cap-height form), ship El Messiri as a subset woff2 instead of the 139 KB variable TTF, and
switch the board's `ShopSign` initials if the panel's font is kept.
