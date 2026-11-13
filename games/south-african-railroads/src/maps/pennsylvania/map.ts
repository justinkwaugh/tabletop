import { Color } from '@tabletop/common'
import { MapId, RailroadId, SettlementKind, type MapDefinition } from '../types.js'
import { EXTERNAL_CONNECTIONS, LINKS, SETTLEMENTS } from './data.js'

const METRO_INCOME = [3, 4, 5, 6]

// Positions follow Fabian Peng Kärrholm's 2022 redraw of the board, compressed to fit the table.
export const PENNSYLVANIA: MapDefinition = {
    id: MapId.Pennsylvania,
    name: 'Pennsylvania Railroad',
    railroads: [
        {
            id: RailroadId.CO,
            shortName: 'C&O',
            name: 'Chesapeake and Ohio Railway',
            color: Color.Brown,
            homeId: 'richmond'
        },
        {
            id: RailroadId.BO,
            shortName: 'B&O',
            name: 'Baltimore and Ohio Railroad',
            color: Color.Blue,
            homeId: 'baltimore'
        },
        {
            id: RailroadId.NYC,
            shortName: 'NYC',
            name: 'New York Central Railroad',
            color: Color.Black,
            homeId: 'new-york'
        },
        {
            id: RailroadId.BM,
            shortName: 'B&M',
            name: 'Boston and Maine Railroad',
            color: Color.Green,
            homeId: 'boston'
        },
        {
            id: RailroadId.PRR,
            shortName: 'PRR',
            name: 'Pennsylvania Railroad',
            color: Color.Red,
            homeId: 'philadelphia'
        },
        {
            id: RailroadId.PLE,
            shortName: 'P&LE',
            name: 'Pittsburgh and Lake Erie Railroad',
            color: Color.Yellow,
            homeId: 'pittsburgh'
        }
    ],
    initialOffering: [RailroadId.CO, RailroadId.BO, RailroadId.NYC, RailroadId.BM, RailroadId.PRR],
    startPlayerRailroad: RailroadId.PRR,
    doubleBuildBarrierId: 'pittsburgh',
    freeMetroDevelopment: true,
    automaticDevelopment: ['pittsburgh', 'cincinnati', 'st-louis', 'detroit', 'chicago'],
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
        pittsburgh: METRO_INCOME,
        cincinnati: METRO_INCOME,
        'st-louis': METRO_INCOME,
        detroit: METRO_INCOME,
        chicago: METRO_INCOME
    },
    startingCash: { 3: 80, 4: 70, 5: 60, 6: 50 },
    offerStockSlots: { 3: 2, 4: 3, 5: 3, 6: 3 },
    dividendsBeforeFinal: 5,
    specialDividendsRoundUp: false
}
