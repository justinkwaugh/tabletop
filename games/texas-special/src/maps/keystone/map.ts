import { Color } from '@tabletop/common'
import { MapId, RailroadId, SettlementKind, type MapDefinition } from '../types.js'
import { EXTERNAL_CONNECTIONS, LINKS, SETTLEMENTS } from './data.js'

const METRO_INCOME = [3, 4, 5, 6]

export const KEYSTONE: MapDefinition = {
    id: MapId.Keystone,
    name: 'Keystone Railroads',
    railroads: [
        {
            id: RailroadId.Brown,
            shortName: 'BROWN',
            name: 'Brown Railroad',
            color: Color.Brown,
            homeId: 'brown-base'
        },
        {
            id: RailroadId.Blue,
            shortName: 'BLUE',
            name: 'Blue Railroad',
            color: Color.Blue,
            homeId: 'blue-base'
        },
        {
            id: RailroadId.Black,
            shortName: 'BLACK',
            name: 'Black Railroad',
            color: Color.Black,
            homeId: 'black-base'
        },
        {
            id: RailroadId.Green,
            shortName: 'GREEN',
            name: 'Green Railroad',
            color: Color.Green,
            homeId: 'green-base'
        },
        {
            id: RailroadId.Red,
            shortName: 'RED',
            name: 'Red Railroad',
            color: Color.Red,
            homeId: 'red-base'
        },
        {
            id: RailroadId.Yellow,
            shortName: 'YELLOW',
            name: 'Yellow Railroad',
            color: Color.Yellow,
            homeId: 'keystone'
        }
    ],
    initialOffering: [
        RailroadId.Brown,
        RailroadId.Blue,
        RailroadId.Black,
        RailroadId.Green,
        RailroadId.Red
    ],
    startPlayerRailroad: RailroadId.Red,
    doubleBuildBarrierId: 'keystone',
    freeMetroDevelopment: true,
    automaticDevelopment: ['keystone', 'bend', 'landing', 'works', 'crossroads'],
    leaveTown: false,
    settlements: SETTLEMENTS,
    links: LINKS,
    externalConnections: EXTERNAL_CONNECTIONS,
    settlementIncome: {
        [SettlementKind.RailroadStation]: [1, 2],
        [SettlementKind.MercantileCenter]: [2, 4],
        [SettlementKind.RailroadBase]: [3, 6],
        [SettlementKind.NaturalResource]: [1, 5]
    },
    metroIncome: {
        keystone: METRO_INCOME,
        bend: METRO_INCOME,
        landing: METRO_INCOME,
        works: METRO_INCOME,
        crossroads: METRO_INCOME
    },
    startingCash: { 3: 80, 4: 70, 5: 60, 6: 50 },
    offerStockSlots: { 3: 2, 4: 3, 5: 3, 6: 3 },
    dividendsBeforeFinal: 5,
    specialDividendsRoundUp: false
}
