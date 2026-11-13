# Ride the Rails scenarios

The dev harness lists these under **Scenarios**; loading one again starts it over. The menu names each file by its slug, so a fixture's name is its slug with the first letter capitalised. Each is a position reached by legal play: `src/lib/testing/tableFixtures.ts` builds it by sending every past placement through the engine in its seat's building turn. `tableFixtures.spec.ts` writes the files and fails when one drifts; after changing a fixture, run `pnpm exec vitest run -u src/lib/testing/tableFixtures.spec.ts`. The seats are Ada, Ben, Cora, Dell and Eli, in turn order. The numbers are the contract's verification scenarios (`docs/ui-interaction-visual-contract.md`); the Playwright specs in `tests/` play them.

## First share

Round 1 with four seats, before anyone holds a share. Dell, last in turn order, decides first (scenario 1).

- Red and Blue read "27 left"; Orange to Black are disabled with their rounds.
- Taking Red flies a locomotive to Dell's marker and passes to Cora, with Red at "26 left".

## Red supply empty

Round 3, Take a share. Red's 27 locomotives are all shares and track, and Ben decides (scenario 2).

- Red reads "none left" and is disabled; Blue, Orange and Yellow are enabled.

## First placement

Round 1, Build. Ada and Cora took Red, Ben and Dell Blue; Ada builds first (scenarios 3, 6 and 10).

- The six East Coast cities light with hollow Red pips; the rest of the map dims.
- With four seats the limit is 5, or 4 once a mountain is used.
- Build nothing passes the turn to Ben.

## Philadelphia taken

Round 1, Build. Ada started Blue in Philadelphia; Ben, holding Red, builds next (scenario 4).

- Five East Coast cities light for Red; Philadelphia does not.

## Two railroads meet

Round 2, Build. Red runs west from Baltimore and Blue from Washington, three hexes apart; Ada holds both (scenario 5).

- The hexes between the two lines read "place Red or Blue" and open the railroad popup.

## Black unstarted

Round 5, Build. Ada holds Red, Orange and Black; Black has no track yet (scenarios 7 and 9).

- Chicago reads "start Black, $2"; Denver, empty, reads "place Orange or start Black, $5".
- Nearly every city lights; cities offering only a Black start wear the fainter start ring.

## Transcontinental in reach

Round 5, Build. Purple from San Francisco waits beside Denver, where Orange's line from Chicago ends, and Red runs from New York into Chicago; Ada holds Red, Orange and Purple (scenario 8).

- Denver reads "place Purple, $12 Transcontinental"; the plain hex east of it, on Orange's line, reads "$8".

## Yellow starts

Round 3 with three seats, Build. Ada holds Red, Orange and Yellow; Omaha, Des Moines and Kansas City are the westernmost occupied cities with one locomotive each (scenario 9).

- Yellow may start in Chicago or in one of those three.
- After a Yellow start in Chicago, Orange building on to Cheyenne leaves the western set as it was.

## Red runs out

Round 3, Build. Ada holds Red and Blue, and Red has two locomotives left in the supply (scenario 11).

- Watch from another seat: each new locomotive carries Ada's bar, and Red leaves the waiting view's "May build" list once its supply runs out.
