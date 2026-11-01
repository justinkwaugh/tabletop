import { Color } from '@tabletop/common'
import { MapId, RailroadId, SettlementKind, type MapDefinition } from '../types.js'
import { CLOSED_BORDERS, EXTERNAL_CONNECTIONS, LINKS, SETTLEMENTS } from './data.js'

// Frontier Railroads' rotated board, redrawn with its older network, closed borders and wartime.
export const OLD_FRONTIER: MapDefinition = {
    id: MapId.OldFrontier,
    name: 'Old Frontier Railroads',
    railroads: [
        {
            id: RailroadId.Red,
            shortName: 'RED',
            name: 'Red Railroad',
            color: Color.Red,
            homeId: 'red-base'
        },
        {
            id: RailroadId.Blue,
            shortName: 'BLUE',
            name: 'Blue Railroad',
            color: Color.Blue,
            homeId: 'blue-base'
        },
        {
            id: RailroadId.Green,
            shortName: 'GREEN',
            name: 'Green Railroad',
            color: Color.Green,
            homeId: 'green-base'
        },
        {
            id: RailroadId.Brown,
            shortName: 'BROWN',
            name: 'Brown Railroad',
            color: Color.Brown,
            homeId: 'brown-base'
        },
        {
            id: RailroadId.Yellow,
            shortName: 'YELLOW',
            name: 'Yellow Railroad',
            color: Color.Yellow,
            homeId: 'center'
        },
        {
            id: RailroadId.Black,
            shortName: 'BLACK',
            name: 'Black Railroad',
            color: Color.Black,
            homeId: 'black-base'
        }
    ],
    initialOffering: [
        RailroadId.Black,
        RailroadId.Green,
        RailroadId.Brown,
        RailroadId.Blue,
        RailroadId.Red
    ],
    startPlayerRailroad: RailroadId.Red,
    doubleBuildBarrierId: 'center',
    freeMetroDevelopment: true,
    automaticDevelopment: ['center'],
    leaveTown: false,
    settlements: SETTLEMENTS,
    links: LINKS,
    externalConnections: EXTERNAL_CONNECTIONS,
    settlementIncome: {
        [SettlementKind.AgriculturalRailhead]: [1, 5],
        [SettlementKind.RailroadStation]: [1, 2],
        [SettlementKind.MercantileCenter]: [2, 4],
        [SettlementKind.RailroadBase]: [3, 6]
    },
    metroIncome: {
        junction: [3, 4, 5, 6],
        center: [2, 3, 4, 5, 6, 7, 8, 9, 10]
    },
    startingCash: { 3: 80, 4: 70, 5: 60, 6: 50 },
    offerStockSlots: { 3: 2, 4: 3, 5: 3, 6: 3 },
    dividendsBeforeFinal: 7,
    specialDividendsRoundUp: true,
    startingTreasuryRoll: { doubled: [RailroadId.Yellow] },
    closedBorders: CLOSED_BORDERS,
    war: { round: 4, linkCost: 7, haltedRailroad: RailroadId.Yellow, developments: 3 },
    recoveryRound: 5,
    metroRailroad: { railroadId: RailroadId.Yellow, opensAtIncome: 6, costMultiplier: 2 }
}
