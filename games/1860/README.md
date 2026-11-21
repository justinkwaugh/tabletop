# 1860

`@tabletop/1860` is the game logic for 1860: Railways on the Isle of Wight (Mike Hutton; JKLM
2004 and 2010, All-Aboard Games 2022), for 2–4 players, on the shared 18xx family runtime in
`@tabletop/18xx`.

The rules authority is the second-edition rulebook, which the third edition reprinted with light
clarifications, together with the designer's BoardGameGeek rulings; both are kept in
`/workspace/artassets/1860` (`rules-2nd-edition-rulespal.txt`, `rulings.md`). `title-design.md`
maps the game's mechanisms to the family support it uses, lists what this title added to the
family, and records the readings of rules the sources leave open.

Run `pnpm --filter @tabletop/1860 test` for the rules, contract and whole-game specs; set
`SWEEP=<seeds>` to play many seeded games.
