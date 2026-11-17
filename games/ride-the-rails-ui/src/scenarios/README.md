# Ride the Rails scenarios

The dev harness lists these under **Scenarios**; loading one again starts it over. The menu names each file by its slug, so a fixture's name is its slug with the first letter capitalised. Each is a position reached by legal play: `src/lib/testing/tableFixtures.ts` builds it by sending every past placement through the engine in its seat's building turn. `tableFixtures.spec.ts` writes the files and fails when one drifts; after changing a fixture, run `pnpm exec vitest run -u src/lib/testing/tableFixtures.spec.ts`. The seats are Ada, Ben, Cora, Dell and Eli, in turn order. The numbers are the contract's verification scenarios (`docs/ui-interaction-visual-contract.md`); the Playwright specs in `tests/` play them.

## Germany berlin

Germany, round 4 with three seats, Build. Red from Leipzig and Blue from Dresden have reached Berlin, Ben has started Purple there, and Ada started Orange in München. Ada holds Red, Orange, Yellow and Purple and builds next.

- Berlin is one city over two cells: one outline, one Purple and Black band, one cream middle, its three cubes alternating between the cells, its "6" and passenger in its own cell and its "$3" pill in the second.
- The mountain beside München lights for Orange with no "−1": an Orange placement there leaves the limit at 8.

## France paris ring

France, round 2 with three seats, Build. Red runs from Lille into the entry hex north of Paris, Blue from Sedan to Reims, and Ben has started Orange in Le Havre. Ada holds Red and Orange and builds next.

- The six entry hexes round Paris are tinted and edged in navy, each with its "1"; Paris carries its "6" and "$10" in the hex, and the four Red/Blue/Black cities their "1".
- Paris lights for Red with its $10; round Le Havre the hexes light for Orange, but not Caen across the estuary.
- Caen's passenger, its head in Le Havre's hex, stands over the Seine's red line; in the pick it is dimmed whole, and the line beside it is not.

## Canada toronto

Canada, round 4 with three seats, Build. Red from Montréal and Blue from Windsor have reached Toronto, and Ben has started Purple there and run it into the hex beside it, whose south side is impassable. Ada holds Red, Orange, Yellow and Purple and builds next.

- Toronto, which has no limit, is drawn as Chicago is, its three cubes small in a row, its "$3/$2" pill below them and its "6" in the lake.
- Hamilton lights for Purple; the hex past the impassable side, though empty, does not.
- Every impassable side is a red line over the bands, cubes and scrim, under the passengers: Québec City's south-west side and Montréal's south side run over their bands, and Nicolet's and Sorel-Tracy's passengers stand over the river's line.

## Australia perth chain

Australia, round 4 with three seats, Build. Orange started in Adelaide and stands in the first long-distance hex of the chain to Perth; Blue runs from Melbourne past the Alps over four mountains; Red runs west from Sydney. Ada holds Red, Orange, Yellow and Purple and builds first.

- The Alps are hatched; the four long-distance hexes are ochre with a "1" and a buffer stop; Perth and Brisbane carry their gold pills, "$50" and "$20", and a buffer stop at the top. The lit long-distance hex's name ends ", ends the turn".
- The chain's next hex lights for Orange; the one past it does not. An Orange placement there, the turn's first, ends Ada's turn.

## First share

Round 1 with four seats, before anyone holds a share. Dell, last in turn order, decides first (scenario 1).

- Red and Blue read "27 left"; Orange to Black are not shown until their rounds.
- Taking Red flies a locomotive to Dell's marker and passes to Cora, with Red at "26 left".

## Red supply empty

Round 3, Take a share. Red's 27 locomotives are all shares and track, and Ben decides (scenario 2).

- Red reads "none left" and is disabled; Blue, Orange and Yellow are enabled.

## First placement

Round 1, Build. Ada and Cora took Red, Ben and Dell Blue; Ada builds first (scenarios 3, 6 and 10).

- The six East Coast cities light with a Red ghost cube in each; the rest of the map dims.
- With four seats the limit is 5, or 4 once a mountain is used.
- Skip passes the turn to Ben.

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

## Canada link in reach

Round 4 on Canada, Build. Blue runs from Windsor and Red from Montréal into Toronto, Orange from Québec City to Montréal, and Yellow from Sault Ste. Marie to Toronto's door; Ada holds Yellow and builds first (the Intercolonial, R-8.3).

- The turn line shows the Intercolonial's chip, "$8 · open", in the Transcontinental's place; Sault Ste. Marie, Windsor and Québec City wear gold rings.
- Toronto reads "place Yellow, $3, $8 Intercolonial". Placing it joins the three: the link cities outline, a gold coin flies to the chip, Ada gains $11, the chip shows her seat, and the rings go.

## Germany link in reach

Round 4 on Germany, Build. Red runs from Köln to Hamburg, Blue from Dresden to Berlin, Orange from München through the mountains to Dresden, and Yellow from Hamburg to Berlin's door; Ada holds Yellow and builds first (Greater Germany, R-8.5).

- The turn line shows Greater Germany's chip, "$12 · open"; Berlin (round both its hexes), Hamburg, Köln, Dresden and München wear gold rings.
- Berlin reads "place Yellow, $3, $12 Greater Germany". Placing it joins the five: Ada gains $15, the chip shows her seat, and the rings go.

## Purple arrives

Round 4, Build, the first round Purple may build. Ada holds Red, Orange and Purple; Purple has no track yet (scenario 25 and the railroad cards).

- The railroad cards show Red, Blue, Orange, Yellow and Purple; Black is not shown. On a phone the build panel shows Ada's railroads' piles alone: Red, Orange and Purple.
- Purple's four western start cities wear its dashed start cue.

## Yellow starts

Round 3 with three seats, Build. Ada holds Red, Orange and Yellow; Omaha, Des Moines and Kansas City are the westernmost occupied cities with one locomotive each (scenario 9).

- Yellow may start in Chicago or in one of those three.
- After a Yellow start in Chicago, Orange building on to Cheyenne leaves the western set as it was.

## Red runs out

Round 3, Build. Ada holds Red and Blue, and Red has two locomotives left in the supply (scenario 11).

- Watch from another seat: each new locomotive carries Ada's bar, and Red leaves the waiting view's "May build" list once its supply runs out.

## Journey choices

Round 3, Ride, Ada first. Orange and Yellow both run from Chicago to Milwaukee over one plain hex; Orange goes on to Des Moines, and Yellow's line to Saint Louis leaves Chicago through Orange's first hex towards Des Moines. Chicago's passenger is gone (scenarios 12 to 15 and 17).

- Lit to start: Milwaukee, Des Moines, New York, Saint Louis and Baltimore; Chicago, with no passenger, is not.
- Des Moines to Chicago is one Orange link, "1 link · fare $2". From there only Milwaukee lights: Saint Louis would reuse a hex.
- Chicago to Milwaukee asks which railroad: Orange pays Ada $1 more than Yellow, since she holds Orange.

## Short way to washington

Round 1, Ride, three seats. Red runs Baltimore, the plain south-west of it, Washington; from that plain a longer Red way passes the plain west of Washington, where Red's line on to Cincinnati leaves Washington. Ada rides first (scenario 12, a journey's shortest way).

- Baltimore, then Washington: the link draws the short way, through the plain south-west of Baltimore.
- Adding Cincinnati keeps that link as it was; the new link leaves through the plain west of Washington.

## Round one ends

Round 1, Ride. Ada, Ben and Cora have ridden; Dell rides last (scenario 18).

- Dell's journey from Washington brings him level with Ben at $4; the tied pair swap places, so round 2's order is Dell, Ben, Cora, Ada, and Orange becomes available.

## Crowded chicago

Round 3, Ride. Orange runs from Chicago to Milwaukee and on its other side to Detroit, and Yellow from Chicago to Cincinnati; Ada rides first (the map's Ride button, Pick conventions).

- Milwaukee, then Chicago by Orange: Detroit lights east of Chicago and Cincinnati below it.
- On the whole map the Ride button's own side covers Detroit on desktop and Cincinnati on a phone, so it stands at the first clear place instead; zoomed in, it is back on its own side.

## Ringed chicago

Crowded chicago with Yellow on from Chicago to Saint Louis as well; Ada rides first (the map's Ride button, Pick conventions).

- Milwaukee, then Chicago by Orange: Detroit lights east of Chicago, Cincinnati below it and Saint Louis south-west of it.
- On a phone's whole map no place beside Chicago is clear, so the map's Ride button stays hidden; Cincinnati and Saint Louis, under its own side, still take a press.

## Last journey

Round 6 with three seats, Ride. Ada and Ben have ridden; Cora rides the game's last journey (scenario 19).

- Saint Louis to Chicago to Milwaukee, both links by Yellow, gives Cora $44, level with Ada: the two share the win.
