import { Color } from '@tabletop/common'
import { MapId, RailroadId, SettlementKind, type MapDefinition } from '../types.js'
import { EXTERNAL_CONNECTIONS, LINKS, SETTLEMENTS } from './data.js'

// Positions follow the 2023 redrawn board (1584 × 1224 points).
export const SOUTH_AFRICA: MapDefinition = {
    id: MapId.SouthAfrica,
    name: 'SAR',
    railroads: [
        {
            id: RailroadId.CMRC,
            shortName: 'CMRC',
            name: 'Cape Midland Railway Company',
            color: Color.Red,
            homeId: 'norvals-point'
        },
        {
            id: RailroadId.CTRD,
            shortName: 'CTR&D',
            name: 'Cape Town Railway & Dock Company',
            color: Color.Blue,
            homeId: 'kimberley'
        },
        {
            id: RailroadId.CSAR,
            shortName: 'CSAR',
            name: 'Central South African Railway',
            color: Color.Green,
            homeId: 'aliwal-north'
        },
        {
            id: RailroadId.NRC,
            shortName: 'NRC',
            name: 'Natal Railway Company',
            color: Color.Brown,
            homeId: 'ladysmith'
        },
        {
            id: RailroadId.ZASM,
            shortName: 'ZASM',
            name: 'Zuid Afrikaansche Spoorweg Maatschappij',
            color: Color.Yellow,
            homeId: 'johannesburg'
        },
        {
            id: RailroadId.CdFM,
            shortName: 'CdFM',
            name: 'Caminhos de Ferro de Moçambique',
            color: Color.Black,
            homeId: 'lourenco-marques'
        }
    ],
    initialOffering: [
        RailroadId.CdFM,
        RailroadId.CSAR,
        RailroadId.NRC,
        RailroadId.CTRD,
        RailroadId.CMRC
    ],
    startPlayerRailroad: RailroadId.CMRC,
    doubleBuildBarrierId: 'johannesburg',
    freeMetroDevelopment: true,
    automaticDevelopment: ['johannesburg'],
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
        bloemfontein: [3, 4, 5, 6],
        johannesburg: [2, 3, 4, 5, 6, 7, 8, 9, 10]
    },
    startingCash: { 3: 80, 4: 70, 5: 60, 6: 50 },
    // The rulebook limits only the three-player game to two Offer Stock slots. The redrawn board
    // marks the third slot "4p, 5p", but a six-player game has it too.
    offerStockSlots: { 3: 2, 4: 3, 5: 3, 6: 3 },
    dividendsBeforeFinal: 5,
    specialDividendsRoundUp: false
}
