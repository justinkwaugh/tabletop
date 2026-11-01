# Texas Special

`@tabletop/texas-special` is the deterministic logic package for Texas Special, a share-auction railroad game for 3–6 players based on SAR by John Bohrer, published by Winsome Games and republished as Age of Rail: South Africa. Its companion Game Client package is `@tabletop/texas-special-ui`.

## Rules

The public `Definition` covers the initial offering, the Construct Track, Offer Stock, Develop Settlements and Pay Dividends actions, the opening of the ZASM when track reaches Johannesburg, external connections with their special dividends, and the final payoff after the sixth dividend. Where the rulebook is silent or ambiguous, the choices made are recorded in [rules interpretations](docs/rules-interpretations.md), each backed by a test.

## Maps

Five maps are implemented: SAR, the original board; Texas Special, a map by James Geist, who granted permission for this implementation on 17 October 2026; and Frontier Railroads, a neutral version of the SAR board turned half a turn, with colour-named railroads and numbered settlements; Keystone Railroads, a neutral eastern network whose crossings add nothing to a railroad's value; and Old Frontier Railroads, Frontier Railroads' board with an older network, closed borders, a war and a recovery round over eight rounds. Players choose between Texas Special, the default, Frontier Railroads, Keystone Railroads and Old Frontier Railroads; SAR is withheld until a later release, and offering it again only needs its entry restored in `src/definition/gameConfig.ts`. [Maps](docs/maps.md) describes what a map defines and how to add one.
