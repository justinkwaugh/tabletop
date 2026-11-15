# 1861 harness scenarios

Written by `games/1861/src/scenarios.build.spec.ts` (run with `SCENARIOS=1`) from seeded bot
games, each with the actions that led to it.

- **Private auction**: the opening. Pass with every player and the Tsarskoye Selo's lowest bid
  falls by R5 to R15; nominate it and the others may raise or pass (§9.4).
- **Nikolaev auction**: the privates sold. Only the Nikolaev can be auctioned, from R100 in R5
  steps; its winner's left takes the next turn (§9.2, §9.4).
- **Minor laying track**: a minor's operating turn. A minor whose home hex has no track lays
  there first; a second tile operation costs R20 and only one of the two may be an upgrade
  (§10.4).
- **Merger round**: a minor's owner decides. Convert a minor from the yellow column, choose
  partner minors to merge into a public company, or pass (§12).
- **Public company buying trains**: interest is settled first; a company without a train borrows
  for one from the bank (§10.2, §10.8–§10.10).
- **Trainless company borrowing**: a public company with no train must buy one from the bank,
  borrowing for it where its treasury falls short (§10.2, §10.10).
- **State railway running**: the Russian State Railway's turn; the priority holder runs its
  trains, it keeps its earnings and buys trains by itself (§7.4).
- **Trainless public company**: a phase began with a public company that has operated but owns
  no train; its director nationalises it or keeps it (§11).
