# 18USA UI

`@tabletop/18usa-ui` is the Svelte Game Client for 18USA. It uses the logic in `@tabletop/18usa`
and the shared 18xx table from `@tabletop/18xx-ui`, composing the family's sized-company session
(`SizedCompanySession`) as 1817 does: company auctions, shorts, loans and buy-backs, the merger
and acquisition rounds, and the Bank of New York's loan strip.

The map is the boardless presentation of the USA in pointy hexes. The table opens on the Board
view: the one-row market (liquidation, three acquisition spaces, then $42–$800, start prices
$50–$200 marked), wrapped onto a second line after $200, with the loan strip beneath it runs across
Canada above the map and the depot; the depot stands in the Pacific beside the west coast.
`src/lib/boardAreas.spec.ts` checks that no market cell, the loan strip or the depot covers a hex.

What the title adds to the shared table:

- **Map semantics.** Printed coal, oil, ore and bridge icons, the Great Northern border icons
  (while P17 is in the game), each red area's dealt values, Mexico drawn as one joined area with
  its name and values once, the subsidy each subsidy city still offers during the first stock
  round, the +10 and +10/+20 city bonuses taken, and every token placed in play: resource and
  bridge tokens (over the icon they replace, with their value, oil's rising in phase 5), upgraded
  ore, P6's Import / Export token and P8's Express Freight station in its company's colours.
- **Subsidies.** The company auction names the subsidy its home city offers; held Boomtown, Free
  Station and Resource subsidies are listed among the company's privates and powers.
- **Operating turn.** Entries of the operating mode switch for buying or scrapping a Pullman,
  upgrading ore, turning Denver's metropolis tile and giving P19's or P30's power to a train; the
  shared run panel attaches the Pullman. The Pennsy Boneyard's choice of a train to save.
- **History.** Rows for every 18USA action, over the sized-company and shared rows.

`pnpm --filter @tabletop/18usa-ui dev` serves the standalone harness on port 4258; its Scenarios
menu lists the positions in `src/scenarios` (see its README).

The station tokens in `src/lib/images/logos` are drawn for this package by
`scripts/generate-logos.mjs`, each company's abbreviation on a disc of its charter colour. The cover
sets the title over Frances F. Palmer's _Across the Continent_ (Currier & Ives, 1868, public
domain); `tools/cover-art` renders it.
