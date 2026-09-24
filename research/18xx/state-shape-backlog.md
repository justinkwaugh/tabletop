# State shape changes deferred until the deployed game finishes

One Hosted Game of The Old Prince is in progress, and Hosted Games follow the current
Publication. Its schema is closed (`additionalProperties: false`), so any of the changes
below alters what an already-loaded client accepts. They wait until that game is finished
or Common has a hydrate-time state migration. Each needs the runtime-contract snapshots in
`games/*/test/fixtures/runtime-contract.json` regenerated deliberately, the deployed-game
replay fixture retired or migrated, and TOP moved to `1.0.0` so clients reload.

Measured on the deployed game's latest State at action 181: 52,360 bytes as compact JSON
(the exported file is 87 KB pretty-printed). Definition data restated in every State is
about 45% of it.

## 1. Certificates carry their definition (about 12 KB)

`certificates` is 22,985 bytes for 134 records. Of each record only `owner`, `poolId`
and `retired` change during play. `kind`, `shares`, `president` and
`certificateLimitCount` (3,618 bytes; it is 1 on every record) are fixed facts, and
`companyId` is derivable from the id. `number` is TOP's and is derivable from the id too.

Change: keep the variable fields in State and take the fixed ones from a certificate
definition owned by the title (the family's `createOrdinaryShareCertificates` already
knows the shape). `Portfolio`, `OpenShare` and the queries in `finance.ts` become joins
against the definition. The UI reads certificates through the session, so it follows.

## 2. Certificates and stations for companies not yet in play (about 11 KB)

TOP creates its six branches' 9 certificates and 4 station markers each at setup (54
certificates, 24 stations) for companies that exist only after a split, and every
company's unplaced stations are `{ id, companyId, status: 'available' }`, derivable from
the title's station counts.

Change: create a branch's certificates and stations when the split creates the company
(`addTheOldPrinceBranches` moves from the opening to `TheOldPrinceBranchSplit.apply`), and
represent stations as placed positions plus a count, with `createCompanyStations` and
`homeStationId` becoming the definition side. `validateStations` and `StationPlacement`
change from "find the available marker" to "count placed against the allowance".

## 3. Stock market spaces are serialized (6.6 KB)

`stockMarket.spaces` holds the 59 spaces' price, row, column, colour and `moves` graph;
the State part is `stacks`, 76 bytes. The map, tile set and depot are already static
definitions outside the State.

Change: `createMarket` becomes a title definition alongside `phases`, carried on
`EighteenXXTitleRules` and given to hydration like the map; the State keeps `stacks`
only. `companyMarketSpace`, `stockMarketSpace`, `moveMarketSpace` and the UI's market
board take the definition. `research/18xx/opening-contract-design.md` already notes that
the market travels in the opening position only because of this.

## 4. Names and unbought trains (about 2 KB)

Company names and pool names are definition data; `trainInventory.trains` lists the
depot's unbought trains as records with `status: 'depot'`. Small; fold into 1–3 if the
same migration is being written, otherwise leave.

## Not a change

`turnManager.series` (6.3 KB, growing one record per turn) stays: it is the index of the
game's turns. Round and phase managers recording their own starts and ends are wanted
later for the same reason, and 18xx's `operatingSet` and `phaseEvents` are candidates to
be written through them.

## Order

3 first: smallest surface, and the market definition is wanted for the UI anyway. Then 1
and 2 together, since both change what a certificate and a station are. 4 with whichever
migration is open. Regenerate the guards after each, and keep `openingPosition.spec.ts`
digests as the check that setup randomness is untouched.
