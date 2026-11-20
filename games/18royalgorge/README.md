# 18RoyalGorge

`@tabletop/18royalgorge` is the game logic for 18RoyalGorge: The Rails of Fremont County and the
Royal Gorge Wars (Kayla Ross and Denman Scofield; 18Wood / Mr. B Games, 2025), for 2–4 players,
on the shared 18xx family runtime in `@tabletop/18xx`.

The rules authority is the published rulebook with the designer's BoardGameGeek rulings; both
are kept in `/workspace/artassets/18royalgorge` (`rulebook-rulespal.txt`, `rulings.md`).
`title-design.md` maps each of the game's mechanisms to the family support it uses, lists what
this title added to the family, and records the readings of rules the sources leave open.

Run `pnpm --filter @tabletop/18royalgorge test` for the rulings, contract and whole-game specs;
`SWEEP=30` plays thirty seeds of each player count, and `SCENARIOS=1` rewrites the harness
scenarios of `@tabletop/18royalgorge-ui`.
