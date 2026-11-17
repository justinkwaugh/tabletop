# 1867 harness scenarios

Written by `games/1867/src/scenarios.build.spec.ts` (run with `SCENARIOS=1`) from seeded bot
games, each with the actions that led to it.

- **Private auction**: the opening. Pass with every player and the Champlain & St. Lawrence's
  lowest bid falls by $5; nominate it and the others may raise or pass (GTG §5).
- **Minor auction**: the privates sold. Choose a minor and the city its station goes in: any city
  with no station, Toronto's and Montreal's cities each on their own (GTG §7.2.1).
- **Minor laying track**: a minor's operating turn. A company whose home hex has no track lays
  there first; a second track action costs $20 and only one of the two may be an upgrade
  (GTG §8.6, AAG §10.4).
- **Merger round**: a minor's owner decides. Convert a minor from the blue zone, choose partner
  minors to merge into a major, or pass (GTG §9).
- **Major company buying trains**: interest is settled first; a company without a train borrows
  for one from the bank (GTG §8.2, §8.10, §8.11).
- **Trainless company borrowing**: a major with no train must buy one from the bank, borrowing
  for it where its treasury falls short (GTG §8.11.3).
- **Phase 8 trade-in**: a major buying trains in phase 8 may give a train for half its face value
  off a new one.
- **Major start**: a stock round from phase 4. A major starts in an unconnected city in an empty
  hex, or any empty hex where none is unconnected (GTG §7.4).
- **Trainless major company**: a phase began with a major that has operated but owns no train;
  its president nationalises it or keeps it (GTG §10).
