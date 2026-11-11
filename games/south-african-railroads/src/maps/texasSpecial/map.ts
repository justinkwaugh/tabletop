import { Color } from '@tabletop/common'
import { MapId, RailroadId, SettlementKind, type MapDefinition } from '../types.js'
import { LINKS, SETTLEMENTS } from './data.js'

// The Texas Special map is by James Geist, who granted permission for this implementation on
// 2026-10-17. Positions follow his printed map (1259 × 2000 points).
export const TEXAS_SPECIAL: MapDefinition = {
    id: MapId.TexasSpecial,
    name: 'Texas Special',
    railroads: [
        {
            id: RailroadId.MKT,
            shortName: 'Katy',
            name: 'Missouri-Kansas-Texas Railroad',
            color: Color.Green,
            homeId: 'junction-city'
        },
        {
            id: RailroadId.MP,
            shortName: 'MoPac',
            name: 'Missouri Pacific Railroad',
            color: Color.Blue,
            homeId: 'st-louis'
        },
        {
            id: RailroadId.SP,
            shortName: 'SoPac',
            name: 'Southern Pacific Railroad',
            color: Color.Purple,
            homeId: 'san-antonio'
        },
        {
            id: RailroadId.GHH,
            shortName: 'GH&H',
            name: 'Galveston Houston Henderson Railroad',
            color: Color.Orange,
            homeId: 'galveston'
        },
        {
            id: RailroadId.SLSF,
            shortName: 'Frisco',
            name: 'St. Louis–San Francisco Railway',
            color: Color.Red,
            homeId: 'springfield'
        },
        {
            id: RailroadId.TP,
            shortName: 'T&P',
            name: 'Texas & Pacific Railway',
            color: Color.Black,
            homeId: 'dallas'
        }
    ],
    initialOffering: [
        RailroadId.MKT,
        RailroadId.MP,
        RailroadId.SP,
        RailroadId.GHH,
        RailroadId.SLSF
    ],
    startPlayerRailroad: RailroadId.SLSF,
    doubleBuildBarrierId: 'dallas',
    freeMetroDevelopment: false,
    automaticDevelopment: ['dallas', 'kansas-city', 'memphis'],
    leaveTown: true,
    specialConnection: {
        name: 'Texas Special',
        northern: [RailroadId.MKT, RailroadId.MP],
        southern: [RailroadId.SP, RailroadId.GHH],
        cost: 30,
        valueBonus: 20
    },
    settlements: SETTLEMENTS,
    links: LINKS,
    externalConnections: [],
    settlementIncome: {
        [SettlementKind.RailroadStation]: [1, 2],
        [SettlementKind.MercantileCenter]: [2, 4],
        [SettlementKind.RailroadBase]: [3, 6],
        [SettlementKind.NaturalResource]: [1, 5]
    },
    metroIncome: {
        'kansas-city': [3, 4, 5, 6],
        memphis: [3, 4, 5, 6],
        dallas: [3, 4, 5, 6]
    },
    startingCash: { 3: 80, 4: 70, 5: 60, 6: 50 },
    offerStockSlots: { 3: 2, 4: 3, 5: 3, 6: 3 },
    dividendsBeforeFinal: 5,
    specialDividendsRoundUp: false
}
