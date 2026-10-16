# Edition rule functions

An edition supplies each rule that differs between Railheads titles as a function on its `EditionDefinition`, so the shared rules call one interface. Surveyed: the Germany, Midwest, Switzerland, Denmark and England & Wales rulebooks (v0.60).

| Function | Germany | Midwest | Elsewhere in the series |
| --- | --- | --- | --- |
| `siteCapacity(round, siteId)` | the round number | 3 | Switzerland 3; England 2, London 3 |
| `trackCost(hexKind, discsBelow)` | $2 countryside, $4 a site | $2 countryside, $4 + $2 a disc beneath on a site | England's price also depends on the action space, which this signature does not carry yet |
| `industryInDemand(industry, companyId, track, map)` | always | network beside a demand area wanting the industry | none of the others has demand areas |
| `endBonusPerShare(companyId, track, map)` | Railroad Bonus from top discs | State Subsidies by states reached | England's Running Rights Bonus and Switzerland's subsidies are per-share too; Switzerland's also reads loans |

Map data carries what the board prints rather than rules: hex orientation (Germany flat, the Midwest pointy), sites, states (`regions`), demand areas and lakes. The Lay Track spaces and obsolescence bands are shared by Germany and the Midwest in `src/editions/standard.ts`.
