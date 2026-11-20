# Entities view

An optional table tab, closed by default, that lays the table out by player: one column
per player in turn order (bankrupt players last), holding that player's card, the cards
of any company-held portfolios the player controls, then the started companies the
player controls, in operating order. Anything no player controls goes in a last
"No president" column, drawn only when it has something in it.

## Control, not direct presidency

Columns follow `controllingOwner`, which walks company presidents up to a player.
Surveyed in the 2026-09-08 research package (`18xx-domain-model-study.md`, the
ownership/control section; `18xx-game-variation-catalog.md`, 1841 and TOP):

- **TOP:** the Union Bank is a private that holds shares and can be a company's
  president. Its card and the companies it presides over sit under the player who owns
  it, since that player makes the decisions (the user's call, 2026-11-18). The company
  cards' owner lists still show the Union Bank as president.
- **1841** (not implemented): corporations own and control other corporations, so
  control runs through chains and can form a cycle that freezes an entity.
  `controllingOwner` finds no player for a cycle, so such a company lands in the
  "No president" column. Chains deeper than TOP's may want the intermediate holders
  shown in the column; revisit when 1841 is built.
- **Other titles:** company-held portfolios come only from a title's
  `portfolioCompanyIds`, which today only TOP sets. Receivership and companies with
  no president also go to the "No president" column.

`entityColumns.spec.ts` covers turn order, a Union Bank presidency and the
uncontrolled column.
